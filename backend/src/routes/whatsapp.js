const express = require("express");
const router = express.Router();
const baileysService = require("../services/baileysService");

// GET /api/whatsapp/status
router.get("/status", (req, res) => {
  const s = baileysService.getStatus();
  const q = baileysService.getQr();
  res.json({
    status: s.status,
    connected: s.status === "connected",
    user: s.meNumber ? { id: s.meNumber } : null,
    qrCode: q.qr,
    hasSession: s.status === "connected",
    config: {
      intervalMin: Number(process.env.DISPARO_INTERVALO_MIN || 18),
      intervalMax: Number(process.env.DISPARO_INTERVALO_MAX || 35),
    },
  });
});

// POST /api/whatsapp/connect
router.post("/connect", async (req, res) => {
  try {
    await baileysService.connect();
    const s = baileysService.getStatus();
    const q = baileysService.getQr();
    res.json({
      status: s.status,
      connected: s.status === "connected",
      user: s.meNumber ? { id: s.meNumber } : null,
      qrCode: q.qr,
      hasSession: s.status === "connected",
    });
  } catch (err) {
    res.status(500).json({
      error: true,
      code: "WHATSAPP_CONNECT_FAILED",
      message: err.message || "Falha ao iniciar sessão do WhatsApp.",
    });
  }
});

// GET /api/whatsapp/qr
router.get("/qr", (req, res) => {
  res.json(baileysService.getQr());
});

// POST /api/whatsapp/disconnect
router.post("/disconnect", async (req, res) => {
  try {
    const status = await baileysService.disconnect();
    res.json({
      success: true,
      message: "WhatsApp desconectado com sucesso.",
      status: status.status,
    });
  } catch (err) {
    res.status(500).json({
      error: true,
      code: "WHATSAPP_DISCONNECT_FAILED",
      message: err.message || "Falha ao desconectar.",
    });
  }
});

// POST /api/whatsapp/test  { phone, message }
router.post("/test", async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: "Telefone e mensagem são obrigatórios." });
  }
  try {
    const check = await baileysService.checkHasWhatsApp(phone);
    if (!check.registered || !check.jid) {
      return res.status(400).json({ error: "Número informado não possui WhatsApp ativo." });
    }
    await baileysService.sendMessage(check.jid, message);
    res.json({ success: true, message: "Mensagem de teste enviada com sucesso!" });
  } catch (err) {
    res.status(500).json({ error: err.message || "Falha no disparo do teste." });
  }
});

module.exports = router;
