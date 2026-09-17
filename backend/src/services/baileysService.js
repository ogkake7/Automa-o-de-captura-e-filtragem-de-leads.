const path = require("path");
const QRCode = require("qrcode");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");

const AUTH_FOLDER = path.join(__dirname, "..", "..", "auth_info");

const state = {
  sock: null,
  status: "disconnected",
  qrDataUrl: null,
  error: null,
  meNumber: null,
};

function getStatus() {
  return {
    status: state.status,
    error: state.error,
    meNumber: state.meNumber,
  };
}

function getQr() {
  return { qr: state.qrDataUrl, status: state.status };
}

async function connect() {
  if (state.status === "connecting" || state.status === "qr_pending") {
    return getStatus();
  }
  state.status = "connecting";
  state.error = null;
  state.qrDataUrl = null;

  try {
    const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

    const sock = makeWASocket({
      auth: authState,
      logger: pino({ level: "silent" }),
      printQRInTerminal: true,
    });

    state.sock = sock;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          state.qrDataUrl = await QRCode.toDataURL(qr);
          state.status = "qr_pending";
        } catch (err) {
          state.status = "error";
          state.error = "Falha ao gerar QR code: " + err.message;
        }
      }

      if (connection === "open") {
        state.status = "connected";
        state.qrDataUrl = null;
        state.error = null;
        state.meNumber = sock.user?.id?.split(":")[0] || null;
        console.log("✔ WhatsApp conectado com sucesso! Número:", state.meNumber);
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        state.status = "disconnected";
        state.qrDataUrl = null;
        state.meNumber = null;
        state.error = lastDisconnect?.error?.message || "Conexão encerrada.";

        if (loggedOut) {
          state.error = "Sessão deslogada no celular. Escaneie o QR code novamente.";
        }
      }
    });

    return getStatus();
  } catch (err) {
    state.status = "error";
    state.error = err.message || "Erro desconhecido ao iniciar sessão do WhatsApp.";
    throw err;
  }
}

async function disconnect() {
  if (state.sock) {
    try {
      await state.sock.logout();
    } catch (err) {}
    state.sock = null;
  }
  state.status = "disconnected";
  state.qrDataUrl = null;
  state.meNumber = null;
  state.error = null;
  return getStatus();
}

async function checkHasWhatsApp(phoneNumber) {
  if (state.status !== "connected" || !state.sock) {
    const err = new Error("WhatsApp não está conectado. Conecte no painel antes de validar números.");
    err.code = "WHATSAPP_NOT_CONNECTED";
    throw err;
  }
  const digits = String(phoneNumber).replace(/\D/g, "");
  const result = await state.sock.onWhatsApp(digits);
  if (result && result[0]?.exists) {
    return { registered: true, jid: result[0].jid };
  }
  return { registered: false };
}

async function sendMessage(jid, text) {
  if (state.status !== "connected" || !state.sock) {
    const err = new Error("WhatsApp não está conectado.");
    err.code = "WHATSAPP_NOT_CONNECTED";
    throw err;
  }
  try {
    await state.sock.sendMessage(jid, { text });
    return { ok: true };
  } catch (err) {
    const e = new Error(err.message || "Falha ao enviar mensagem.");
    e.code = "WHATSAPP_SEND_FAILED";
    throw e;
  }
}

module.exports = { connect, disconnect, getStatus, getQr, checkHasWhatsApp, sendMessage };
