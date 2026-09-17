import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import * as baileysPkg from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

dotenv.config();

// --- Local Persistence & Firestore REST Setup ---
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}
const SEARCHES_FILE = path.join(DATA_DIR, "searches.json");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");
const TEMPLATES_FILE = path.join(DATA_DIR, "templates.json");
const BATCHES_FILE = path.join(DATA_DIR, "batches.json");

function loadPersistedSearches(): any[] {
  try {
    if (fs.existsSync(SEARCHES_FILE)) {
      return JSON.parse(fs.readFileSync(SEARCHES_FILE, "utf-8"));
    }
  } catch (e) {
    console.warn("[PERSISTENCE] Erro ao ler searches.json:", e);
  }
  return [];
}

function savePersistedSearch(search: any) {
  try {
    const searches = loadPersistedSearches();
    const idx = searches.findIndex((s: any) => s.runId === search.runId);
    if (idx >= 0) {
      searches[idx] = { ...searches[idx], ...search };
    } else {
      searches.unshift(search);
    }
    fs.writeFileSync(SEARCHES_FILE, JSON.stringify(searches.slice(0, 100), null, 2), "utf-8");
  } catch (e) {
    console.warn("[PERSISTENCE] Erro ao gravar searches.json:", e);
  }
}

function loadPersistedLeads(): any[] {
  try {
    if (fs.existsSync(LEADS_FILE)) {
      return JSON.parse(fs.readFileSync(LEADS_FILE, "utf-8"));
    }
  } catch (e) {
    console.warn("[PERSISTENCE] Erro ao ler leads.json:", e);
  }
  return [];
}

function savePersistedLeads(newLeads: any[]) {
  try {
    const leads = loadPersistedLeads();
    leads.unshift(...newLeads);
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads.slice(0, 2000), null, 2), "utf-8");
  } catch (e) {
    console.warn("[PERSISTENCE] Erro ao gravar leads.json:", e);
  }
}

// Retorna contagem cumulativa de leads por conta (limite de 150 leads)
function getUserCumulativeLeadsCount(userId?: string): number {
  if (!userId) return 0;
  const leads = loadPersistedLeads();
  return leads.filter((l: any) => (l.capturedBy === userId || l.userId === userId || l.createdBy === userId)).length;
}

// --- WhatsApp Warm-up Persistence & Helper Functions ---
const WARMUP_FILE = path.join(DATA_DIR, "whatsapp_warmup.json");

interface WarmupData {
  connectedNumber: string;
  firstConnectedAt: string;
  history: Record<string, number>; // YYYY-MM-DD -> total sent
}

function loadWarmupData(): WarmupData {
  try {
    if (fs.existsSync(WARMUP_FILE)) {
      return JSON.parse(fs.readFileSync(WARMUP_FILE, "utf-8"));
    }
  } catch (e) {}
  return {
    connectedNumber: "",
    firstConnectedAt: new Date().toISOString(),
    history: {}
  };
}

function saveWarmupData(data: WarmupData) {
  try {
    fs.writeFileSync(WARMUP_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {}
}

function registerWhatsAppConnection(rawId?: string) {
  if (!rawId) return;
  const cleanId = rawId.split(":")[0].replace(/\D/g, "");
  if (!cleanId) return;
  const data = loadWarmupData();
  if (!data.connectedNumber || data.connectedNumber !== cleanId) {
    data.connectedNumber = cleanId;
    data.firstConnectedAt = new Date().toISOString();
    data.history = {};
    saveWarmupData(data);
    console.log(`[WHATSAPP WARM-UP] Novo número registrado: ${cleanId}. Iniciando cronograma de aquecimento (Dia 1).`);
  }
}

function getWarmupStatus(): {
  connectedNumber: string;
  daysConnected: number;
  stage: string;
  stageDescription: string;
  dailyLimit: number;
  sentToday: number;
  remainingToday: number;
  isWarmupActive: boolean;
} {
  const data = loadWarmupData();
  const todayKey = new Date().toISOString().slice(0, 10);
  const sentToday = data.history[todayKey] || 0;

  if (!data.connectedNumber) {
    return {
      connectedNumber: "",
      daysConnected: 1,
      stage: "NO_NUMBER",
      stageDescription: "Nenhum número conectado",
      dailyLimit: 20,
      sentToday: 0,
      remainingToday: 20,
      isWarmupActive: true
    };
  }

  const firstDate = new Date(data.firstConnectedAt).getTime();
  const now = Date.now();
  const diffDays = Math.floor((now - firstDate) / (1000 * 60 * 60 * 24)) + 1;
  const daysConnected = Math.max(1, diffDays);

  let dailyLimit = 20;
  let stage = "DIAS_1_2";
  let stageDescription = "Dia 1-2: Fase de Aquecimento Inicial (Máx. 20 msgs/dia)";
  let isWarmupActive = true;

  if (daysConnected <= 2) {
    dailyLimit = 20;
    stage = "DIAS_1_2";
    stageDescription = "Dia 1-2: Fase de Aquecimento Inicial (Máx. 20 msgs/dia)";
  } else if (daysConnected <= 5) {
    dailyLimit = 50;
    stage = "DIAS_3_5";
    stageDescription = "Dia 3-5: Fase de Aquecimento Moderado (Máx. 50 msgs/dia)";
  } else {
    dailyLimit = 1000;
    stage = "NORMAL";
    stageDescription = "Dia 6+: Aquecimento Concluído (Intervalo Humano Regular 18-35s)";
    isWarmupActive = false;
  }

  const remainingToday = Math.max(0, dailyLimit - sentToday);

  return {
    connectedNumber: data.connectedNumber,
    daysConnected,
    stage,
    stageDescription,
    dailyLimit,
    sentToday,
    remainingToday,
    isWarmupActive
  };
}

function recordWarmupSends(count: number) {
  const data = loadWarmupData();
  const todayKey = new Date().toISOString().slice(0, 10);
  data.history[todayKey] = (data.history[todayKey] || 0) + count;
  saveWarmupData(data);
}

// Spintax Resolver & Content Variation
// Permite tags {nome}, {categoria}, {cidade} e blocos spintax {Olá|Oi|Opa|Bom dia}
function resolveSpintax(template: string, lead: any): string {
  let result = template || "Olá!";
  
  if (lead.nome) {
    result = result.replace(/{nome}/gi, String(lead.nome).trim());
  }
  if (lead.categoria) {
    result = result.replace(/{categoria}/gi, String(lead.categoria).trim());
  }
  if (lead.cidade) {
    result = result.replace(/{cidade}/gi, String(lead.cidade).trim());
  }

  // Parse spintax {A|B|C}
  const spintaxRegex = /\{([^{}]+)\}/g;
  let hasSpintax = false;
  let iterations = 0;
  while (spintaxRegex.test(result) && iterations < 5) {
    iterations++;
    result = result.replace(spintaxRegex, (match, choices) => {
      if (!choices.includes("|")) return match;
      hasSpintax = true;
      const options = choices.split("|");
      const chosen = options[Math.floor(Math.random() * options.length)];
      return chosen ? chosen.trim() : "";
    });
  }

  // Se não havia spintax definido pelo usuário, aplica sutil variação com zero-width space ou espaçamento final
  // para evitar envio de payloads de texto com hash 100% idêntico em larga escala
  if (!hasSpintax) {
    const subtleSpaces = ["", " ", "  ", "\u200B", " \u200B"];
    const rnd = subtleSpaces[Math.floor(Math.random() * subtleSpaces.length)];
    result = result + rnd;
  }

  return result;
}

// --- Fingerprints & Anti-Abuse Persistence ---
const FINGERPRINTS_FILE = path.join(DATA_DIR, "fingerprints.json");

function loadFingerprints(): any[] {
  try {
    if (fs.existsSync(FINGERPRINTS_FILE)) {
      return JSON.parse(fs.readFileSync(FINGERPRINTS_FILE, "utf-8"));
    }
  } catch (e) {}
  return [];
}

function saveFingerprintRecord(record: any) {
  try {
    const records = loadFingerprints();
    records.push(record);
    fs.writeFileSync(FINGERPRINTS_FILE, JSON.stringify(records.slice(-1000), null, 2), "utf-8");
  } catch (e) {}
}

// REST Helper to sync with Firestore using user Bearer token
async function syncToFirestoreRest(collectionName: string, docId: string | null, data: any, authToken?: string): Promise<boolean> {
  try {
    const cfgPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (!fs.existsSync(cfgPath)) return false;
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));

    const baseUrl = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents/${collectionName}`;
    const url = docId ? `${baseUrl}/${docId}?key=${cfg.apiKey}` : `${baseUrl}?key=${cfg.apiKey}`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authToken) {
      headers["Authorization"] = authToken.startsWith("Bearer ") ? authToken : `Bearer ${authToken}`;
    }

    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === null || v === undefined) continue;
      if (typeof v === "string") fields[k] = { stringValue: v };
      else if (typeof v === "number") fields[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
      else if (typeof v === "boolean") fields[k] = { booleanValue: v };
      else if (Array.isArray(v)) {
        fields[k] = { arrayValue: { values: v.map((item: any) => ({ stringValue: String(item) })) } };
      }
    }

    const method = docId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers,
      body: JSON.stringify({ fields })
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// --- Firebase Admin SDK Setup (Auth Only) ---
let adminApp: any = null;
let adminAuth: any = null;

try {
  const cfgPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
    if (!getApps().length) {
      adminApp = initializeApp({ projectId: cfg.projectId });
    } else {
      adminApp = getApps()[0];
    }
    adminAuth = getAuth(adminApp);
    console.log(`[FIREBASE ADMIN] Inicializado com sucesso (Auth ID Token Validator) para projeto: ${cfg.projectId}`);
  } else {
    console.warn("[FIREBASE ADMIN] firebase-applet-config.json não encontrado.");
  }
} catch (fbAdminErr) {
  console.error("[FIREBASE ADMIN] Erro na inicialização do Firebase Admin:", fbAdminErr);
}

// Middleware de Autenticação para Rotas de Escrita
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de autorização não fornecido (Bearer ID Token)." });
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    if (!adminAuth) {
      return res.status(500).json({ error: "Firebase Admin Auth não está disponível no servidor." });
    }
    const decodedToken = await adminAuth.verifyIdToken(token);
    (req as any).user = decodedToken;
    (req as any).rawToken = token;
    next();
  } catch (authErr: any) {
    console.error("[AUTH] Falha ao validar token:", authErr.message);
    return res.status(401).json({ error: "Token inválido ou expirado: " + authErr.message });
  }
}

// Middleware para Admin Role
async function requireAdminRole(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: "Não autenticado" });

  const email = (user.email || "").toLowerCase();
  const isHardcodedAdmin = email === "kaiquelcorrea@gmail.com";

  if (isHardcodedAdmin || (user as any).role === "admin") {
    return next();
  }

  return res.status(403).json({ error: "Acesso restrito a administradores." });
}

// --- WhatsApp Baileys Setup ---
const makeWASocket = (baileysPkg as any).default?.default || (baileysPkg as any).default || (baileysPkg as any).makeWASocket || baileysPkg;
const { DisconnectReason, useMultiFileAuthState } = baileysPkg as any;

const AUTH_DIR = path.join(process.cwd(), "baileys_auth");
let sock: any = null;
let qrCodeDataUrl: string | null = null;
let connectionStatus: "disconnected" | "connecting" | "qr" | "connected" = "disconnected";
let connectedUser: any = null;
let isInitializing = false;

// Format phone number to WhatsApp JID format
function formatWhatsAppJid(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "";
  
  if (digits.length >= 12 && digits.startsWith("55")) {
    return `${digits}@s.whatsapp.net`;
  }
  
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}@s.whatsapp.net`;
  }
  
  return `${digits}@s.whatsapp.net`;
}

// Random delay between min and max seconds
function getRandomDelay(minSec: number, maxSec: number): Promise<void> {
  const min = Math.min(minSec, maxSec);
  const max = Math.max(minSec, maxSec);
  const delayMs = Math.floor(Math.random() * (max - min + 1) + min) * 1000;
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

// Initialize Baileys WhatsApp client
async function initWhatsApp(forceReset = false) {
  if (isInitializing && !forceReset) return;
  isInitializing = true;
  connectionStatus = "connecting";

  try {
    if (forceReset && fs.existsSync(AUTH_DIR)) {
      try {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        console.log("[WHATSAPP] Sessão antiga limpa.");
      } catch (err) {
        console.error("[WHATSAPP] Erro ao limpar pasta de auth:", err);
      }
    }

    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: ["LeadGen CyberDash", "Chrome", "1.0.0"],
      syncFullHistory: false,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
          connectionStatus = "qr";
          console.log("[WHATSAPP] QR Code gerado para leitura.");
        } catch (qrErr) {
          console.error("[WHATSAPP] Erro gerando imagem do QR Code:", qrErr);
        }
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        console.log(`[WHATSAPP] Conexão encerrada (status ${statusCode}). Deslogado: ${isLoggedOut}`);

        qrCodeDataUrl = null;
        connectedUser = null;

        if (isLoggedOut) {
          connectionStatus = "disconnected";
          try {
            if (fs.existsSync(AUTH_DIR)) {
              fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            }
          } catch (e) {
            console.error("[WHATSAPP] Erro ao resetar sessão após logout:", e);
          }
        } else {
          connectionStatus = "connecting";
          setTimeout(() => {
            initWhatsApp(false);
          }, 3000);
        }
      } else if (connection === "open") {
        connectionStatus = "connected";
        qrCodeDataUrl = null;
        connectedUser = sock?.user || null;
        console.log("[WHATSAPP] Conexão estabelecida com sucesso! Usuário:", sock?.user?.id);
        registerWhatsAppConnection(sock?.user?.id);
      }
    });
  } catch (error) {
    console.error("[WHATSAPP] Falha ao inicializar Baileys:", error);
    connectionStatus = "disconnected";
  } finally {
    isInitializing = false;
  }
}

// Auto-start WhatsApp if existing credentials exist
if (fs.existsSync(path.join(AUTH_DIR, "creds.json"))) {
  console.log("[WHATSAPP] Sessão existente encontrada. Reconectando automaticamente...");
  initWhatsApp(false);
}

// In-memory active search tracking for Live Log Console
interface SearchRunState {
  runId: string;
  projectName: string;
  status: 'STARTING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED-OUT' | 'ABORTED';
  datasetId?: string;
  itemCount: number;
  totalTarget?: number;
  startedAt: number;
  finishedAt?: number;
  recentBatch: string[];
  logs: Array<{ timestamp: string; message: string; type: 'info' | 'success' | 'warn' | 'error' }>;
  error?: string;
}

const activeSearches = new Map<string, SearchRunState>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Real HTTP Security Headers & Content-Security-Policy (CSP)
  // Restringe de onde scripts, conexões e estilos podem ser carregados no navegador
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseio.com https://*.googleapis.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com; frame-src 'self' https://*.firebaseapp.com;"
    );
    next();
  });

  app.use(express.json({ limit: '10mb' }));

  // --- API Routes ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      message: "CyberDash API online",
      firebaseAuth: !!adminAuth,
      whatsappStatus: connectionStatus,
      whatsappConnected: connectionStatus === "connected"
    });
  });

  // ==========================================
  // 0. AUTH, USAGE & ANTI-ABUSE ENDPOINTS
  // ==========================================

  // Register Device Fingerprint & IP for abuse detection (multiple accounts circumventing the 150 leads quota)
  // Documentado com base em legítimo interesse de segurança e combate a fraudes (LGPD)
  app.post("/api/auth/register-fingerprint", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const { visitorId } = req.body;
      const rawIp = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim();

      if (!visitorId) {
        return res.status(400).json({ error: "visitorId obrigatório" });
      }

      const existingRecords = loadFingerprints();
      // Checa se outra conta já esgotou os 150 leads com este mesmo fingerprint ou IP
      const suspiciousRecord = existingRecords.find((r: any) => 
        r.userId !== user.uid && 
        (r.visitorId === visitorId || (r.ip === rawIp && rawIp !== "127.0.0.1" && rawIp !== "::1" && rawIp.length > 3)) &&
        getUserCumulativeLeadsCount(r.userId) >= 150
      );

      let flagged = false;
      let flagReason = "";
      if (suspiciousRecord) {
        flagged = true;
        flagReason = `Fingerprint ou IP coincide com conta anterior (${suspiciousRecord.email || suspiciousRecord.userId}) que atingiu o limite gratuito de 150 leads. Sinalizado para auditoria manual.`;
        console.warn(`[ANTI-ABUSE] Conta ${user.uid} (${user.email}) sinalizada para revisão:`, flagReason);
      }

      const record = {
        userId: user.uid,
        email: user.email || "",
        visitorId,
        ip: rawIp,
        flaggedForReview: flagged,
        flagReason,
        createdAt: new Date().toISOString()
      };
      saveFingerprintRecord(record);

      const rawToken = (req as any).rawToken;
      if (flagged) {
        syncToFirestoreRest("teamUsers", user.uid, {
          flaggedForReview: true,
          flagReason,
          visitorId,
          lastKnownIp: rawIp
        }, rawToken).catch(() => {});
      }

      res.json({
        success: true,
        flaggedForReview: flagged,
        flagReason
      });
    } catch (err: any) {
      console.error("[ANTI-ABUSE] Erro ao registrar fingerprint:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // User cumulative leads usage endpoint (limite de 150 leads por conta)
  app.get("/api/user/usage", requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const used = getUserCumulativeLeadsCount(user?.uid);
      const limit = 150;
      res.json({
        used,
        limit,
        remaining: Math.max(0, limit - used),
        isLimitReached: used >= limit,
        percentage: Math.min(100, Math.round((used / limit) * 100))
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Profile sync on login
  app.post("/api/auth/sync-profile", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const isHardcodedAdmin = (user.email || "").toLowerCase() === "kaiquelcorrea@gmail.com";
      const assignedRole = isHardcodedAdmin ? "admin" : ((user as any).role || "vendedor");

      // Attempt non-blocking background REST sync with user token
      const rawToken = (req as any).rawToken;
      syncToFirestoreRest("teamUsers", user.uid, {
        email: user.email || "",
        role: assignedRole,
        updatedAt: new Date().toISOString()
      }, rawToken).catch(() => {});

      res.json({ success: true, role: assignedRole, email: user.email });
    } catch (err: any) {
      console.error("[API] Erro ao sincronizar perfil:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Create single lead (respeita limite de 150 leads por conta)
  app.post("/api/leads", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const currentCount = getUserCumulativeLeadsCount(user?.uid);
      const FREE_LEADS_LIMIT = 150;
      if (currentCount >= FREE_LEADS_LIMIT) {
        return res.status(403).json({
          error: `Limite de ${FREE_LEADS_LIMIT} leads atingido para esta conta (${currentCount}/${FREE_LEADS_LIMIT} usados). Faça upgrade para adicionar novos leads.`,
          code: "LIMIT_REACHED",
          used: currentCount,
          limit: FREE_LEADS_LIMIT
        });
      }

      const leadData = req.body;
      if (!leadData.nome || !leadData.telefone) {
        return res.status(400).json({ error: "Nome e telefone são obrigatórios" });
      }

      const newId = "lead_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
      const leadRecord = {
        id: newId,
        ...leadData,
        capturedAt: new Date().toISOString(),
        capturedBy: user?.uid || "system",
        manual: true,
        source: "manual"
      };

      savePersistedLeads([leadRecord]);
      const rawToken = (req as any).rawToken;
      syncToFirestoreRest("leads", newId, leadRecord, rawToken).catch(() => {});

      res.json({ success: true, id: newId });
    } catch (err: any) {
      res.status(500).json({ error: "Erro ao salvar lead: " + err.message });
    }
  });

  // Import Leads from Custom CSV (Lista Própria)
  // Respeita o limite de 150 leads por conta e o rate-limiting padrão da plataforma
  app.post("/api/leads/import-csv", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const { projectName, leads } = req.body;

      if (!Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({ error: "Nenhum lead fornecido no arquivo CSV." });
      }

      const currentCount = getUserCumulativeLeadsCount(user?.uid);
      const FREE_LEADS_LIMIT = 150;

      if (currentCount >= FREE_LEADS_LIMIT) {
        return res.status(403).json({
          error: `Limite de ${FREE_LEADS_LIMIT} leads já atingido (${currentCount}/${FREE_LEADS_LIMIT} usados). Faça upgrade para importar novos leads.`,
          code: "LIMIT_REACHED",
          used: currentCount,
          limit: FREE_LEADS_LIMIT
        });
      }

      if (currentCount + leads.length > FREE_LEADS_LIMIT) {
        const allowed = FREE_LEADS_LIMIT - currentCount;
        return res.status(403).json({
          error: `A importação de ${leads.length} contatos ultrapassa seu limite de ${FREE_LEADS_LIMIT} leads (${currentCount} já utilizados). Você pode importar no máximo ${allowed} leads ou realizar upgrade.`,
          code: "LIMIT_EXCEEDED",
          used: currentCount,
          allowedToImport: allowed
        });
      }

      const cleanProjectName = (projectName || "").trim() || `Import_${new Date().toISOString().slice(0, 10)}`;
      const searchId = "import_" + Date.now();
      const rawToken = (req as any).rawToken;

      const importedLeads: any[] = [];
      for (const item of leads) {
        if (!item.nome || !item.telefone) continue;
        const leadId = "lead_imp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
        const leadRecord = {
          id: leadId,
          nome: String(item.nome).trim(),
          telefone: String(item.telefone).trim(),
          categoria: item.categoria ? String(item.categoria).trim() : "Importado",
          cidade: item.cidade ? String(item.cidade).trim() : "",
          estado: item.estado ? String(item.estado).trim() : "",
          endereco: item.endereco ? String(item.endereco).trim() : "",
          site: item.site || "",
          semSite: !item.site,
          siteRuim: false,
          avaliacoes: 0,
          nota: 0,
          poucasAvaliacoes: false,
          notaBaixa: false,
          whatsappStatus: "desconhecido",
          score: 70,
          googleMapsUrl: "",
          searchId: searchId,
          projectName: cleanProjectName,
          capturedAt: new Date().toISOString(),
          capturedBy: user.uid,
          manual: true,
          source: "manual_import"
        };
        importedLeads.push(leadRecord);
        syncToFirestoreRest("leads", leadId, leadRecord, rawToken).catch(() => {});
      }

      if (importedLeads.length > 0) {
        savePersistedLeads(importedLeads);
      }

      // Record project in searches collection so it appears cleanly as a folder
      const searchRecord = {
        runId: searchId,
        projectName: cleanProjectName,
        status: 'SUCCEEDED',
        itemCount: importedLeads.length,
        totalTarget: importedLeads.length,
        searchStrings: ['Importação Manual'],
        locationQuery: 'Lista Própria (CSV)',
        startedAt: Date.now(),
        finishedAt: Date.now(),
        createdBy: user.uid,
        isManualImport: true
      };
      savePersistedSearch(searchRecord);
      syncToFirestoreRest("searches", searchId, searchRecord, rawToken).catch(() => {});

      res.json({
        success: true,
        importedCount: importedLeads.length,
        projectName: cleanProjectName,
        searchId: searchId,
        message: `${importedLeads.length} leads importados com sucesso para a pasta "${cleanProjectName}".`
      });
    } catch (err: any) {
      console.error("[IMPORT CSV] Erro na importação:", err);
      res.status(500).json({ error: "Erro ao processar importação de leads: " + err.message });
    }
  });

  // Update lead
  app.patch("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      delete updates.id;

      const leads = loadPersistedLeads();
      const idx = leads.findIndex((l: any) => l.id === id);
      if (idx >= 0) {
        leads[idx] = { ...leads[idx], ...updates, updatedAt: new Date().toISOString() };
        try { fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), "utf-8"); } catch (e) {}
      }

      const rawToken = (req as any).rawToken;
      syncToFirestoreRest("leads", id, updates, rawToken).catch(() => {});

      res.json({ success: true, message: "Lead atualizado com sucesso" });
    } catch (err: any) {
      res.status(500).json({ error: "Erro ao atualizar lead: " + err.message });
    }
  });

  // Batch delete leads
  app.post("/api/leads/batch-delete", requireAuth, requireAdminRole, async (req, res) => {
    try {
      const { leadIds } = req.body;
      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ error: "leadIds é obrigatório" });
      }

      const deleteSet = new Set(leadIds);
      const leads = loadPersistedLeads();
      const remaining = leads.filter((l: any) => !deleteSet.has(l.id));
      try { fs.writeFileSync(LEADS_FILE, JSON.stringify(remaining, null, 2), "utf-8"); } catch (e) {}

      res.json({ success: true, deleted: leadIds.length });
    } catch (err: any) {
      res.status(500).json({ error: "Erro ao deletar leads: " + err.message });
    }
  });

  // Clear Section: All leads or specific project folder
  app.post("/api/leads/clear-section", requireAuth, requireAdminRole, async (req, res) => {
    try {
      const { searchId, clearAll } = req.body;
      const leads = loadPersistedLeads();
      let deletedCount = 0;
      let remaining: any[] = [];

      if (clearAll) {
        deletedCount = leads.length;
        remaining = [];
      } else if (searchId) {
        remaining = leads.filter((l: any) => {
          const match = l.searchId === searchId || l.projectName === searchId;
          if (match) deletedCount++;
          return !match;
        });
      } else {
        return res.status(400).json({ error: "Parâmetro searchId ou clearAll é obrigatório." });
      }

      try {
        fs.writeFileSync(LEADS_FILE, JSON.stringify(remaining, null, 2), "utf-8");
      } catch (e) {
        console.warn("[PERSISTENCE] Erro ao salvar leads após limpar seção:", e);
      }

      res.json({ success: true, deletedCount, remainingCount: remaining.length });
    } catch (err: any) {
      res.status(500).json({ error: "Erro ao limpar seção de leads: " + err.message });
    }
  });

  // Rename project in leads
  app.patch("/api/projects/rename", requireAuth, async (req, res) => {
    try {
      const { searchId, newProjectName } = req.body;
      if (!searchId || !newProjectName) {
        return res.status(400).json({ error: "searchId e newProjectName são obrigatórios" });
      }

      const leads = loadPersistedLeads();
      let updatedCount = 0;
      leads.forEach((l: any) => {
        if (l.searchId === searchId || l.projectName === searchId) {
          l.projectName = newProjectName;
          l.updatedAt = new Date().toISOString();
          updatedCount++;
        }
      });
      if (updatedCount > 0) {
        try { fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), "utf-8"); } catch (e) {}
      }

      // Update search record if exists
      const searches = loadPersistedSearches();
      const sIdx = searches.findIndex((s: any) => s.runId === searchId);
      if (sIdx >= 0) {
        searches[sIdx].projectName = newProjectName;
        savePersistedSearch(searches[sIdx]);
      }

      res.json({ success: true, updatedCount, message: `Projeto renomeado para "${newProjectName}" em ${updatedCount} leads.` });
    } catch (err: any) {
      res.status(500).json({ error: "Erro ao renomear projeto: " + err.message });
    }
  });

  // Create Template
  app.post("/api/templates", requireAuth, async (req, res) => {
    try {
      const { nome, texto } = req.body;
      if (!nome || !texto) {
        return res.status(400).json({ error: "Nome e texto do template são obrigatórios" });
      }

      const id = "tpl_" + Date.now();
      const templateRecord = {
        id,
        nome,
        texto,
        createdBy: (req as any).user.uid,
        createdAt: new Date().toISOString()
      };

      try {
        let templates: any[] = [];
        if (fs.existsSync(TEMPLATES_FILE)) {
          templates = JSON.parse(fs.readFileSync(TEMPLATES_FILE, "utf-8"));
        }
        templates.unshift(templateRecord);
        fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), "utf-8");
      } catch (e) {}

      const rawToken = (req as any).rawToken;
      syncToFirestoreRest("templates", id, templateRecord, rawToken).catch(() => {});

      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: "Erro ao criar template: " + err.message });
    }
  });

  // Delete Template (Admin only)
  app.delete("/api/templates/:id", requireAuth, requireAdminRole, async (req, res) => {
    try {
      const { id } = req.params;
      try {
        if (fs.existsSync(TEMPLATES_FILE)) {
          let templates = JSON.parse(fs.readFileSync(TEMPLATES_FILE, "utf-8"));
          templates = templates.filter((t: any) => t.id !== id);
          fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), "utf-8");
        }
      } catch (e) {}

      res.json({ success: true, message: "Template excluído com sucesso" });
    } catch (err: any) {
      res.status(500).json({ error: "Erro ao excluir template: " + err.message });
    }
  });

  // Record Campaign / Batch
  app.post("/api/campaigns/batch", requireAuth, async (req, res) => {
    try {
      const { batchId, leadCount, templateText, leads } = req.body;
      const batchRecord = {
        batchId,
        leadCount,
        templateText: templateText || "",
        createdBy: (req as any).user.uid,
        createdAt: new Date().toISOString(),
        status: "RUNNING"
      };

      try {
        let batches: any[] = [];
        if (fs.existsSync(BATCHES_FILE)) {
          batches = JSON.parse(fs.readFileSync(BATCHES_FILE, "utf-8"));
        }
        batches.unshift(batchRecord);
        fs.writeFileSync(BATCHES_FILE, JSON.stringify(batches.slice(0, 100), null, 2), "utf-8");
      } catch (e) {}

      const rawToken = (req as any).rawToken;
      syncToFirestoreRest("batches", batchId, batchRecord, rawToken).catch(() => {});

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 1 & 2. APIFY SEARCH EXPANDED & LIVE CONSOLE
  // ==========================================

  // Start Apify Search with full parameter expansion
  app.post("/api/search", requireAuth, async (req, res) => {
    const {
      projectName,
      searchStrings,
      locationQuery,
      countryCode,
      state,
      city,
      postalCode,
      zoom,
      customCircle,
      language,
      maxCrawledPlacesPerSearch,
      allPlaces,
      minRating,
      maxRating,
      onlyWithoutWebsite,
      onlyWithWebsite,
      skipClosed,
      minReviewsCount,
      maxReviewsCount,
      maxImages,
      maxReviews,
      reviewsSort,
      scrapePopularTimes,
      scrapePeopleAlsoSearch,
    } = req.body;

    const user = (req as any).user;
    const currentLeadCount = getUserCumulativeLeadsCount(user?.uid);
    const FREE_LEADS_LIMIT = 150;

    if (currentLeadCount >= FREE_LEADS_LIMIT) {
      return res.status(403).json({
        error: `Limite de ${FREE_LEADS_LIMIT} leads atingido para esta conta (${currentLeadCount}/${FREE_LEADS_LIMIT} usados). Faça upgrade ou adquira recarga de créditos para continuar capturando.`,
        code: "LIMIT_REACHED",
        used: currentLeadCount,
        limit: FREE_LEADS_LIMIT
      });
    }

    const apifyToken = process.env.APIFY_TOKEN;
    const actorId = process.env.APIFY_ACTOR_ID || "compass~crawler-google-places";

    const cleanProjectName = (projectName || "").trim() || `Busca_${new Date().toISOString().slice(0, 10)}`;
    const effectiveRunId = "run_" + Date.now();

    // Prepare searchStrings array
    let effectiveSearchStrings: string[] = [];
    if (Array.isArray(searchStrings) && searchStrings.length > 0) {
      effectiveSearchStrings = searchStrings.filter(s => !!s && s.trim().length > 0);
    } else if (req.body.category) {
      effectiveSearchStrings = [req.body.category];
    } else {
      effectiveSearchStrings = ["estabelecimentos"];
    }

    // Prepare countryCode: Apify compass/crawler-google-places requires lower-case 2-letter ISO code (e.g. "br", "us")
    // or omit/empty string. Never pass uppercase or locale like "pt-BR" or "BR".
    let validCountryCode: string | undefined = undefined;
    if (countryCode && typeof countryCode === 'string') {
      const cleanCountry = countryCode.trim().toLowerCase();
      if (/^[a-z]{2}$/.test(cleanCountry)) {
        validCountryCode = cleanCountry;
      }
    }

    // Build structured location
    let finalLocationQuery = locationQuery || req.body.location || "";
    if (city || state || postalCode) {
      const parts = [city, state, postalCode, validCountryCode].filter(Boolean);
      if (parts.length > 0) {
        finalLocationQuery = parts.join(", ");
      }
    }

    const calculatedLimit = allPlaces ? 9999 : (parseInt(maxCrawledPlacesPerSearch || req.body.limit || "50", 10));

    // Register active search state
    const runState: SearchRunState = {
      runId: effectiveRunId,
      projectName: cleanProjectName,
      status: 'STARTING',
      itemCount: 0,
      totalTarget: allPlaces ? undefined : calculatedLimit,
      startedAt: Date.now(),
      recentBatch: [],
      logs: [
        {
          timestamp: new Date().toLocaleTimeString(),
          message: `Iniciando captura de projeto: "${cleanProjectName}"`,
          type: 'info'
        },
        {
          timestamp: new Date().toLocaleTimeString(),
          message: `Filtros: Termos=[${effectiveSearchStrings.join(', ')}] | Local=${finalLocationQuery || 'Global'}${validCountryCode ? ` [País: ${validCountryCode}]` : ''} | Limite=${allPlaces ? 'TODOS' : calculatedLimit}`,
          type: 'info'
        }
      ]
    };
    activeSearches.set(effectiveRunId, runState);

    // If Apify token is missing, log transparently
    if (!apifyToken) {
      runState.status = 'FAILED';
      runState.error = "APIFY_TOKEN ausente no arquivo .env do servidor. Configure a chave para execução.";
      runState.logs.push({
        timestamp: new Date().toLocaleTimeString(),
        message: "ERRO CRÍTICO: APIFY_TOKEN não configurado no servidor (.env).",
        type: 'error'
      });

      return res.status(400).json({
        status: "error",
        error: "APIFY_TOKEN não configurado no .env.",
        runId: effectiveRunId
      });
    }

    // Construct Apify payload according to compass/crawler-google-places schema
    const apifyInput: any = {
      searchStringsArray: effectiveSearchStrings,
      locationQuery: finalLocationQuery || undefined,
      maxCrawledPlacesPerSearch: calculatedLimit,
      skipClosedPlaces: skipClosed !== false,
      language: language || "pt-BR",
      maxImages: maxImages ? parseInt(String(maxImages), 10) : 0,
      maxReviews: maxReviews ? parseInt(String(maxReviews), 10) : 0,
      reviewsSort: reviewsSort || "newest",
    };

    if (validCountryCode) {
      apifyInput.countryCode = validCountryCode;
    }

    if (zoom) {
      apifyInput.zoom = parseInt(String(zoom), 10);
    }

    if (customCircle && customCircle.lat && customCircle.lng) {
      apifyInput.customGeolocation = {
        lat: Number(customCircle.lat),
        lng: Number(customCircle.lng),
        zoom: zoom ? parseInt(String(zoom), 10) : 14
      };
    }

    if (minRating) {
      apifyInput.minRating = String(minRating);
    }

    // Launch Apify Actor Run via REST API
    try {
      const apifyActorUrl = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${apifyToken}`;
      const apifyResponse = await fetch(apifyActorUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apifyInput),
      });

      const apifyData: any = await apifyResponse.json();

      if (!apifyResponse.ok) {
        const errMsg = apifyData?.error?.message || `Erro Apify HTTP ${apifyResponse.status}`;
        runState.status = 'FAILED';
        runState.error = errMsg;
        runState.logs.push({
          timestamp: new Date().toLocaleTimeString(),
          message: `Falha na requisição Apify: ${errMsg}`,
          type: 'error'
        });
        return res.status(400).json({ error: errMsg, runId: effectiveRunId });
      }

      const apifyRunId = apifyData.data.id;
      const defaultDatasetId = apifyData.data.defaultDatasetId;
      runState.runId = apifyRunId; // Sync to real Apify ID
      runState.datasetId = defaultDatasetId;
      runState.status = 'RUNNING';
      activeSearches.set(apifyRunId, runState);
      activeSearches.delete(effectiveRunId);

      runState.logs.push({
        timestamp: new Date().toLocaleTimeString(),
        message: `Ator Apify inicializado com sucesso! Run ID: ${apifyRunId}. Acompanhando extração...`,
        type: 'success'
      });

      // Persist search run in searches collection
      const searchRecord = {
        runId: apifyRunId,
        projectName: cleanProjectName,
        status: 'RUNNING',
        itemCount: 0,
        totalTarget: allPlaces ? null : calculatedLimit,
        searchStrings: effectiveSearchStrings,
        locationQuery: finalLocationQuery || '',
        startedAt: Date.now(),
        createdBy: (req as any).user?.uid || "system"
      };
      savePersistedSearch(searchRecord);
      const rawUserToken = (req as any).rawToken;
      syncToFirestoreRest("searches", apifyRunId, searchRecord, rawUserToken).catch(() => {});

      // Background Worker to Monitor Apify Run & Stream Dataset
      (async () => {
        const checkIntervalMs = 4000;
        let isDone = false;
        let lastItemOffset = 0;

        while (!isDone) {
          await new Promise((r) => setTimeout(r, checkIntervalMs));

          try {
            const pollUrl = `https://api.apify.com/v2/actor-runs/${apifyRunId}?token=${apifyToken}`;
            const pollRes = await fetch(pollUrl);
            const pollData: any = await pollRes.json();

            if (!pollRes.ok) {
              runState.logs.push({
                timestamp: new Date().toLocaleTimeString(),
                message: `Aviso ao consultar status: ${pollData?.error?.message || 'Falha de conexão'}`,
                type: 'warn'
              });
              continue;
            }

            const currentStatus = pollData.data.status;
            runState.status = currentStatus;

            // Fetch new items from dataset
            const datasetUrl = `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${apifyToken}&offset=${lastItemOffset}&limit=50`;
            const datasetRes = await fetch(datasetUrl);
            if (datasetRes.ok) {
              const newPlaces: any[] = await datasetRes.json();
              if (newPlaces.length > 0) {
                lastItemOffset += newPlaces.length;
                runState.itemCount += newPlaces.length;

                const latestNames = newPlaces.slice(-3).map((p: any) => p.title || p.name || "Local").filter(Boolean);
                runState.recentBatch = latestNames;

                runState.logs.push({
                  timestamp: new Date().toLocaleTimeString(),
                  message: `Recebido lote com +${newPlaces.length} locais. Total acumulado: ${runState.itemCount}. Recentes: ${latestNames.join(", ")}`,
                  type: 'info'
                });

                // Post-process, apply qualification filters, and persist
                const qualifiedLeads: any[] = [];
                for (const place of newPlaces) {
                  const placeName = place.title || place.name || "Sem Nome";
                  const phone = place.phone || place.phoneUnformatted || "";
                  const website = place.website || null;
                  const rating = typeof place.totalScore === "number" ? place.totalScore : (place.rating || 0);
                  const reviewsCount = typeof place.reviewsCount === "number" ? place.reviewsCount : 0;

                  // Qualification Filters Check
                  if (onlyWithoutWebsite && website) continue;
                  if (onlyWithWebsite && !website) continue;
                  if (maxRating && rating > Number(maxRating)) continue;
                  if (minReviewsCount && reviewsCount < Number(minReviewsCount)) continue;
                  if (maxReviewsCount && reviewsCount > Number(maxReviewsCount)) continue;

                  const leadId = "lead_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
                  const leadRecord = {
                    id: leadId,
                    nome: placeName,
                    categoria: place.categoryName || place.subTitle || effectiveSearchStrings[0] || "Comércio",
                    endereco: place.address || place.street || "",
                    cidade: place.city || city || "",
                    estado: place.state || state || "",
                    telefone: phone,
                    site: website,
                    semSite: !website,
                    siteRuim: false,
                    avaliacoes: reviewsCount,
                    nota: rating,
                    poucasAvaliacoes: reviewsCount < 10,
                    notaBaixa: rating > 0 && rating < 4.0,
                    whatsappStatus: "desconhecido",
                    score: rating < 4.0 || !website ? 90 : 50,
                    googleMapsUrl: place.url || place.locationLink || "",
                    searchId: apifyRunId,
                    projectName: cleanProjectName,
                    capturedAt: new Date().toISOString(),
                    capturedBy: (req as any).user?.uid || "system",
                    manual: {}
                  };
                  qualifiedLeads.push(leadRecord);
                  syncToFirestoreRest("leads", leadId, leadRecord, rawUserToken).catch(() => {});
                }

                if (qualifiedLeads.length > 0) {
                  const currentTotal = getUserCumulativeLeadsCount((req as any).user?.uid);
                  const remainingQuota = Math.max(0, FREE_LEADS_LIMIT - currentTotal);
                  const allowedToSave = qualifiedLeads.slice(0, remainingQuota);

                  if (allowedToSave.length > 0) {
                    savePersistedLeads(allowedToSave);
                  }

                  if (qualifiedLeads.length > remainingQuota) {
                    runState.logs.push({
                      timestamp: new Date().toLocaleTimeString(),
                      message: `Aviso: Limite de 150 leads da conta atingido. Leads adicionais pausados.`,
                      type: 'warn'
                    });
                    isDone = true;
                  }
                }

                savePersistedSearch({
                  runId: apifyRunId,
                  itemCount: runState.itemCount,
                  status: runState.status
                });
                syncToFirestoreRest("searches", apifyRunId, {
                  itemCount: runState.itemCount,
                  status: runState.status
                }, rawUserToken).catch(() => {});
              }
            }

            if (currentStatus === "SUCCEEDED") {
              isDone = true;
              runState.status = 'SUCCEEDED';
              runState.finishedAt = Date.now();
              runState.logs.push({
                timestamp: new Date().toLocaleTimeString(),
                message: `Captura CONCLUÍDA com sucesso! Total de itens obtidos: ${runState.itemCount}`,
                type: 'success'
              });

              savePersistedSearch({
                runId: apifyRunId,
                status: 'SUCCEEDED',
                itemCount: runState.itemCount,
                finishedAt: Date.now()
              });
              syncToFirestoreRest("searches", apifyRunId, {
                status: 'SUCCEEDED',
                itemCount: runState.itemCount,
                finishedAt: new Date().toISOString()
              }, rawUserToken).catch(() => {});
            } else if (currentStatus === "FAILED" || currentStatus === "ABORTED" || currentStatus === "TIMED-OUT") {
              isDone = true;
              runState.status = currentStatus;
              runState.finishedAt = Date.now();
              runState.error = `O run terminou com status: ${currentStatus}`;
              runState.logs.push({
                timestamp: new Date().toLocaleTimeString(),
                message: `Run finalizado com erro/abortado: ${currentStatus}`,
                type: 'error'
              });

              savePersistedSearch({
                runId: apifyRunId,
                status: currentStatus,
                error: runState.error,
                finishedAt: Date.now()
              });
              syncToFirestoreRest("searches", apifyRunId, {
                status: currentStatus,
                error: runState.error,
                finishedAt: new Date().toISOString()
              }, rawUserToken).catch(() => {});
            }
          } catch (pollErr: any) {
            console.error("[APIFY WORKER] Erro no polling:", pollErr);
          }
        }
      })();

      res.json({
        status: "success",
        message: "Busca inicializada com sucesso",
        runId: apifyRunId,
        datasetId: defaultDatasetId,
        projectName: cleanProjectName
      });
    } catch (apifyErr: any) {
      console.error("[APIFY] Erro:", apifyErr);
      runState.status = 'FAILED';
      runState.error = apifyErr.message;
      res.status(500).json({ error: "Erro ao conectar com Apify: " + apifyErr.message });
    }
  });

  // Live Console Polling endpoint
  app.get("/api/search/status/:runId", requireAuth, async (req, res) => {
    const { runId } = req.params;
    const runState = activeSearches.get(runId);

    if (!runState) {
      return res.status(404).json({ error: "Execução não encontrada ou já expirou da memória." });
    }

    const elapsedSeconds = Math.floor(((runState.finishedAt || Date.now()) - runState.startedAt) / 1000);

    res.json({
      runId: runState.runId,
      projectName: runState.projectName,
      status: runState.status,
      itemCount: runState.itemCount,
      totalTarget: runState.totalTarget,
      elapsedSeconds,
      recentBatch: runState.recentBatch,
      logs: runState.logs,
      error: runState.error
    });
  });

  // Get active and past searches summary for Monitoring Tab
  app.get("/api/searches", requireAuth, async (req, res) => {
    try {
      // 1. Gather all in-memory active / recent runs
      const memoryRuns: any[] = [];
      activeSearches.forEach((runState) => {
        const elapsedSeconds = Math.floor(((runState.finishedAt || Date.now()) - runState.startedAt) / 1000);
        memoryRuns.push({
          runId: runState.runId,
          projectName: runState.projectName,
          status: runState.status,
          itemCount: runState.itemCount,
          totalTarget: runState.totalTarget,
          elapsedSeconds,
          startedAt: runState.startedAt,
          finishedAt: runState.finishedAt,
          recentBatch: runState.recentBatch,
          logs: runState.logs.slice(-10),
          error: runState.error,
          isLiveInMemory: true
        });
      });

      // 2. Query persistent searches from local store
      const persisted = loadPersistedSearches();
      const inMemIds = new Set(memoryRuns.map(m => m.runId));
      const persistedOnly = persisted.filter((p: any) => !inMemIds.has(p.runId)).map((p: any) => ({
        runId: p.runId,
        projectName: p.projectName || p.runId,
        status: p.status || 'UNKNOWN',
        itemCount: p.itemCount || 0,
        totalTarget: p.totalTarget,
        startedAt: p.startedAt || 0,
        finishedAt: p.finishedAt,
        searchStrings: p.searchStrings || [],
        locationQuery: p.locationQuery || '',
        isLiveInMemory: false
      }));

      // Combine and sort by startedAt desc
      const combined = [...memoryRuns, ...persistedOnly].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));

      res.json({ searches: combined });
    } catch (err: any) {
      res.status(500).json({ error: "Erro ao buscar histórico de buscas: " + err.message });
    }
  });

  // Save/archive collected search run summary to permanent history
  app.post("/api/searches/save-summary", requireAuth, async (req, res) => {
    try {
      const { runId, projectName, itemCount, status, startedAt, finishedAt, notes } = req.body;
      if (!runId) return res.status(400).json({ error: "runId é obrigatório" });

      const SAVED_SEARCHES_FILE = path.join(DATA_DIR, "searches_saved.json");
      let savedList: any[] = [];
      try {
        if (fs.existsSync(SAVED_SEARCHES_FILE)) {
          savedList = JSON.parse(fs.readFileSync(SAVED_SEARCHES_FILE, "utf-8"));
        }
      } catch (e) {}

      const record = {
        runId,
        projectName: projectName || runId,
        itemCount: itemCount || 0,
        status: status || "SUCCEEDED",
        startedAt: startedAt || Date.now(),
        finishedAt: finishedAt || Date.now(),
        savedAt: new Date().toISOString(),
        savedBy: (req as any).user?.uid || "user",
        notes: notes || "Resumo arquivado manualmente pelo usuário."
      };

      const existingIdx = savedList.findIndex((item: any) => item.runId === runId);
      if (existingIdx >= 0) {
        savedList[existingIdx] = { ...savedList[existingIdx], ...record };
      } else {
        savedList.unshift(record);
      }

      fs.writeFileSync(SAVED_SEARCHES_FILE, JSON.stringify(savedList, null, 2), "utf-8");
      res.json({ success: true, message: "Resumo da execução salvo com sucesso!", record });
    } catch (err: any) {
      res.status(500).json({ error: "Erro ao salvar resumo da busca: " + err.message });
    }
  });

  // Clear searches history (reset monitoring section)
  app.delete("/api/searches", requireAuth, async (req, res) => {
    try {
      // Remove finished runs from in-memory map
      for (const [runId, runState] of activeSearches.entries()) {
        if (runState.status !== 'RUNNING' && runState.status !== 'STARTING') {
          activeSearches.delete(runId);
        }
      }

      // Reset persisted searches file
      try {
        fs.writeFileSync(SEARCHES_FILE, JSON.stringify([], null, 2), "utf-8");
      } catch (e) {}

      res.json({ success: true, message: "Histórico de buscas limpo com sucesso." });
    } catch (err: any) {
      res.status(500).json({ error: "Erro ao limpar histórico: " + err.message });
    }
  });

  // Delete specific search run from monitoring
  app.delete("/api/searches/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      activeSearches.delete(id);

      const persisted = loadPersistedSearches();
      const filtered = persisted.filter((s: any) => s.runId !== id);
      try {
        fs.writeFileSync(SEARCHES_FILE, JSON.stringify(filtered, null, 2), "utf-8");
      } catch (e) {}

      res.json({ success: true, message: "Busca removida do monitoramento." });
    } catch (err: any) {
      res.status(500).json({ error: "Erro ao remover busca: " + err.message });
    }
  });

  // Integrations Status Summary (Apify + WhatsApp)
  app.get("/api/integrations/summary", requireAuth, async (req, res) => {
    const apifyConfigured = !!process.env.APIFY_TOKEN && process.env.APIFY_TOKEN.trim().length > 0;
    const whatsAppConnected = connectionStatus === "connected";

    res.json({
      apify: {
        configured: apifyConfigured,
        actorId: process.env.APIFY_ACTOR_ID || "compass~crawler-google-places",
        status: apifyConfigured ? "ONLINE" : "NOT_CONFIGURED"
      },
      whatsapp: {
        status: connectionStatus,
        connected: whatsAppConnected,
        user: connectedUser,
        hasSession: fs.existsSync(path.join(AUTH_DIR, "creds.json")),
        minDelay: parseInt(process.env.DISPARO_INTERVALO_MIN || "18", 10),
        maxDelay: parseInt(process.env.DISPARO_INTERVALO_MAX || "35", 10)
      }
    });
  });

  // WhatsApp Status endpoint (inclui status do programa de aquecimento progressivo)
  app.get("/api/whatsapp/status", (req, res) => {
    const warmup = getWarmupStatus();
    res.json({
      status: connectionStatus,
      connected: connectionStatus === "connected",
      user: connectedUser,
      qrCode: qrCodeDataUrl,
      hasSession: fs.existsSync(path.join(AUTH_DIR, "creds.json")),
      config: {
        intervalMin: parseInt(process.env.DISPARO_INTERVALO_MIN || "18", 10),
        intervalMax: parseInt(process.env.DISPARO_INTERVALO_MAX || "35", 10),
      },
      warmup
    });
  });

  // Public system health & integration status check (Host de UI/nuvem - não gera falso positivo de backend local)
  app.get("/api/config/status", (req, res) => {
    const apifyConfigured = !!process.env.APIFY_TOKEN && process.env.APIFY_TOKEN.trim().length > 0;
    res.json({
      ok: false,
      backend: "unavailable",
      service: "FilterByKake Cloud Web Host",
      message: "O servidor local do Baileys/WhatsApp não está conectado. Configure a URL do backend local nas Configurações.",
      apify: {
        configured: apifyConfigured,
        status: apifyConfigured ? "connected" : "not_configured"
      },
      whatsapp: {
        status: "disconnected",
        connected: false,
        user: null
      }
    });
  });

  // WhatsApp Connect / Generate QR endpoint
  app.get(["/downloads/filterbykake-backend.zip", "/api/downloads/backend"], (req, res) => {
    const publicZip = path.join(process.cwd(), "public", "downloads", "filterbykake-backend.zip");
    const distZip = path.join(process.cwd(), "dist", "downloads", "filterbykake-backend.zip");
    const filePath = fs.existsSync(publicZip) ? publicZip : distZip;
    if (fs.existsSync(filePath)) {
      return res.download(filePath, "filterbykake-backend.zip");
    }
    res.status(404).send("Arquivo do backend não encontrado.");
  });

  app.post("/api/whatsapp/connect", async (req, res) => {
    if (connectionStatus === "connected") {
      return res.json({
        status: "connected",
        message: "WhatsApp já está conectado.",
        user: connectedUser
      });
    }

    const forceReset = req.body?.force === true;
    await initWhatsApp(forceReset);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    res.json({
      status: connectionStatus,
      connected: (connectionStatus as any) === "connected",
      user: connectedUser,
      qrCode: qrCodeDataUrl
    });
  });

  // WhatsApp Disconnect / Logout endpoint
  app.post("/api/whatsapp/disconnect", async (req, res) => {
    try {
      if (sock) {
        try {
          await sock.logout();
        } catch {
          // Socket might already be closed
        }
      }
      connectionStatus = "disconnected";
      qrCodeDataUrl = null;
      connectedUser = null;

      if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      }

      res.json({
        status: "disconnected",
        message: "Sessão do WhatsApp encerrada e removida localmente com sucesso."
      });
    } catch (err: any) {
      res.status(500).json({ error: "Erro ao desconectar: " + err.message });
    }
  });

  // WhatsApp Test Message endpoint
  app.post("/api/whatsapp/test", async (req, res) => {
    const { phone, message } = req.body;

    if (connectionStatus !== "connected" || !sock) {
      return res.status(400).json({
        error: "WhatsApp não está conectado. Escaneie o QR Code em Configurações primeiro."
      });
    }

    if (!phone || !message) {
      return res.status(400).json({ error: "Telefone e mensagem são obrigatórios." });
    }

    const jid = formatWhatsAppJid(phone);
    if (!jid) {
      return res.status(400).json({ error: "Número de telefone inválido." });
    }

    try {
      console.log(`[WHATSAPP] Enviando mensagem de teste para ${jid}`);
      await sock.sendMessage(jid, { text: message });
      res.json({ status: "success", message: `Mensagem enviada com sucesso para ${phone}` });
    } catch (err: any) {
      console.error("[WHATSAPP] Falha no envio de teste:", err);
      res.status(500).json({ error: "Erro ao enviar mensagem: " + err.message });
    }
  });

  // WhatsApp Dispatch / Send Messages endpoint
  app.post("/api/whatsapp/send", requireAuth, async (req, res) => {
    const { leads, templateText } = req.body;

    if (connectionStatus !== "connected" || !sock) {
      return res.status(400).json({
        error: "WhatsApp desconectado. Conecte sua sessão via QR Code antes de disparar."
      });
    }

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: "Nenhum lead fornecido para disparo." });
    }

    // Validação de Aquecimento de Número (Warm-up)
    const warmup = getWarmupStatus();
    if (warmup.isWarmupActive && warmup.remainingToday <= 0) {
      return res.status(400).json({
        error: `Limite diário do aquecimento de número atingido (${warmup.sentToday}/${warmup.dailyLimit} msgs hoje). ${warmup.stageDescription}. Para reduzir riscos de bloqueio pelo WhatsApp, aguarde até amanhã para novos disparos.`,
        warmup
      });
    }

    const minInterval = parseInt(process.env.DISPARO_INTERVALO_MIN || "18", 10);
    const maxInterval = parseInt(process.env.DISPARO_INTERVALO_MAX || "35", 10);

    const batchId = "batch_" + Date.now();
    console.log(`[WHATSAPP] Iniciando lote ${batchId} com ${leads.length} leads. Intervalo humano: ${minInterval}s - ${maxInterval}s | Aquecimento: ${warmup.stageDescription}`);

    // Record batch in persistence
    const batchRecord: any = {
      batchId,
      leadCount: leads.length,
      templateText: templateText || "",
      createdBy: (req as any).user?.uid || "unknown",
      createdAt: new Date().toISOString(),
      status: "RUNNING",
      warmupStage: warmup.stage
    };

    try {
      let batches: any[] = [];
      if (fs.existsSync(BATCHES_FILE)) {
        batches = JSON.parse(fs.readFileSync(BATCHES_FILE, "utf-8"));
      }
      batches.unshift(batchRecord);
      fs.writeFileSync(BATCHES_FILE, JSON.stringify(batches.slice(0, 100), null, 2), "utf-8");
    } catch (e) {}

    const rawToken = (req as any).rawToken;
    syncToFirestoreRest("batches", batchId, batchRecord, rawToken).catch(() => {});

    // Process dispatch asynchronously in background with Circuit-Breaker & Spintax
    (async () => {
      let consecutiveErrors = 0;
      let isCircuitBroken = false;
      let breakerReason = "";
      let sentCount = 0;

      for (let i = 0; i < leads.length; i++) {
        // Checagem prévia de desconexão
        if (connectionStatus !== "connected" || !sock) {
          isCircuitBroken = true;
          breakerReason = "Sessão do WhatsApp desconectada durante o envio do lote.";
          break;
        }

        // Checagem de limite diário de aquecimento durante o lote
        const currentWarmup = getWarmupStatus();
        if (currentWarmup.isWarmupActive && currentWarmup.remainingToday <= 0) {
          isCircuitBroken = true;
          breakerReason = `Limite do aquecimento do dia atingido (${currentWarmup.dailyLimit} msgs). Fila pausada automaticamente para proteger a saúde do número.`;
          break;
        }

        const lead = leads[i];
        const jid = formatWhatsAppJid(lead.telefone || "");
        
        if (!jid) {
          console.warn(`[WHATSAPP] Lead ignorado (sem telefone válido):`, lead);
          continue;
        }

        // Resolução de Spintax e variações de conteúdo para evitar payloads idênticos
        const textToSend = resolveSpintax(templateText, lead);

        try {
          console.log(`[WHATSAPP] [${i + 1}/${leads.length}] Enviando para ${jid}...`);
          await sock.sendMessage(jid, { text: textToSend });
          console.log(`[WHATSAPP] [${i + 1}/${leads.length}] Enviado com sucesso.`);

          // Reset de falhas consecutivas ao ter sucesso
          consecutiveErrors = 0;
          sentCount++;
          recordWarmupSends(1);

          // Update lead status if lead.id is present
          if (lead.id) {
            const allLeads = loadPersistedLeads();
            const lIdx = allLeads.findIndex((l: any) => l.id === lead.id);
            if (lIdx >= 0) {
              allLeads[lIdx].whatsappStatus = "ativo";
              allLeads[lIdx].lastDispatchedAt = new Date().toISOString();
              allLeads[lIdx].lastBatchId = batchId;
              try { fs.writeFileSync(LEADS_FILE, JSON.stringify(allLeads, null, 2), "utf-8"); } catch (e) {}
            }
            syncToFirestoreRest("leads", lead.id, {
              whatsappStatus: "ativo",
              lastDispatchedAt: new Date().toISOString(),
              lastBatchId: batchId
            }, rawToken).catch(() => {});
          }
        } catch (sendErr: any) {
          consecutiveErrors++;
          console.error(`[WHATSAPP] Erro no envio para ${jid} (${consecutiveErrors}ª falha consecutiva):`, sendErr);

          // CIRCUIT-BREAKER: 3 falhas consecutivas disparam pausa automática de emergência
          if (consecutiveErrors >= 3) {
            isCircuitBroken = true;
            breakerReason = "ALERTA PREVENTIVO DE SEGURANÇA: 3 falhas consecutivas de envio detectadas. A fila foi pausada automaticamente para proteger seu número contra bloqueio iminente pelo WhatsApp.";
            console.warn(`[WHATSAPP CIRCUIT-BREAKER] ${breakerReason}`);
            break;
          }
        }

        if (i < leads.length - 1) {
          await getRandomDelay(minInterval, maxInterval);
        }
      }

      const finalStatus = isCircuitBroken ? "PAUSED_SAFETY" : "COMPLETED";
      console.log(`[WHATSAPP] Lote ${batchId} finalizado com status: ${finalStatus}. Enviadas com sucesso: ${sentCount}`);

      try {
        if (fs.existsSync(BATCHES_FILE)) {
          const batches = JSON.parse(fs.readFileSync(BATCHES_FILE, "utf-8"));
          const bIdx = batches.findIndex((b: any) => b.batchId === batchId);
          if (bIdx >= 0) {
            batches[bIdx].status = finalStatus;
            batches[bIdx].sentCount = sentCount;
            batches[bIdx].warning = breakerReason || undefined;
            batches[bIdx].completedAt = new Date().toISOString();
            fs.writeFileSync(BATCHES_FILE, JSON.stringify(batches, null, 2), "utf-8");
          }
        }
      } catch (e) {}

      syncToFirestoreRest("batches", batchId, {
        status: finalStatus,
        sentCount,
        warning: breakerReason || undefined,
        completedAt: new Date().toISOString()
      }, rawToken).catch(() => {});
    })();

    res.json({
      status: "started",
      batchId,
      totalLeads: leads.length,
      warmup,
      message: `Disparo de ${leads.length} mensagens iniciado com intervalos humanos de ${minInterval}s a ${maxInterval}s e proteção ativa contra banimento.`
    });
  });

  // --- Vite Middleware for Development / Static serving for Production ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SYSTEM] Server running on http://localhost:${PORT}`);
    console.log(`[SYSTEM] WhatsApp: Baileys embedded`);
    console.log(`[SYSTEM] Firebase Admin: Secured write endpoints active`);
  });
}

startServer();
