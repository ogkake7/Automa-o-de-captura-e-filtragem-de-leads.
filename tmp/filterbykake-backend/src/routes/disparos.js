const express = require("express");
const router = express.Router();
const { readDb, writeDb } = require("../db");
const baileysService = require("../services/baileysService");

function preencherTemplate(texto, lead) {
  return texto
    .replaceAll("{{nome_empresa}}", lead.nome || "")
    .replaceAll("{{cidade}}", lead.cidade || "")
    .replaceAll("{{categoria}}", lead.categoria || "");
}

function intervaloAleatorioMs() {
  const min = Number(process.env.DISPARO_INTERVALO_MIN || 18);
  const max = Number(process.env.DISPARO_INTERVALO_MAX || 35);
  const segundos = Math.floor(Math.random() * (max - min + 1)) + min;
  return segundos * 1000;
}

async function enviarUmItem(batchId, leadId) {
  const db = readDb();
  const batch = db.batches[batchId];
  const item = batch.items.find((i) => i.leadId === leadId);
  const lead = db.leads.find((l) => l.id === leadId);
  const template = db.templates.find((t) => t.id === batch.templateId);

  if (!lead || !template) {
    item.status = "failed";
    item.errorCode = "DADOS_INVALIDOS";
    item.errorMessage = "Lead ou template não encontrado no momento do envio.";
    item.timestamp = new Date().toISOString();
    writeDb(db);
    return;
  }

  if (lead.whatsappStatus !== "ativo" || !lead.whatsappJid) {
    item.status = "failed";
    item.errorCode = "SEM_WHATSAPP_VALIDADO";
    item.errorMessage = "Este número não foi validado como ativo no WhatsApp. Verifique antes de disparar.";
    item.timestamp = new Date().toISOString();
    writeDb(db);
    return;
  }

  item.status = "sending";
  writeDb(db);

  try {
    const texto = preencherTemplate(template.texto, lead);
    await baileysService.sendMessage(lead.whatsappJid, texto);
    item.status = "sent";
    item.errorCode = null;
    item.errorMessage = null;
    item.timestamp = new Date().toISOString();
  } catch (err) {
    item.status = "failed";
    item.errorCode = err.code || "WHATSAPP_SEND_FAILED";
    item.errorMessage = err.message || "Falha desconhecida ao enviar mensagem.";
    item.timestamp = new Date().toISOString();
  }
  writeDb(db);
}

async function processarFila(batchId, leadIds) {
  for (let i = 0; i < leadIds.length; i++) {
    await enviarUmItem(batchId, leadIds[i]);
    if (i < leadIds.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervaloAleatorioMs()));
    }
  }
}

// POST /api/disparos  { leadIds: [], templateId }
router.post("/", (req, res) => {
  const { leadIds, templateId } = req.body;
  if (!Array.isArray(leadIds) || leadIds.length === 0 || !templateId) {
    return res.status(400).json({
      error: true,
      code: "INVALID_INPUT",
      message: "Informe leadIds (array não vazio) e templateId.",
    });
  }

  const db = readDb();
  const template = db.templates.find((t) => t.id === templateId);
  if (!template) {
    return res.status(404).json({ error: true, code: "TEMPLATE_NOT_FOUND", message: "Template não encontrado." });
  }

  const wa = baileysService.getStatus();
  if (wa.status !== "connected") {
    return res.status(409).json({
      error: true,
      code: "WHATSAPP_NOT_CONNECTED",
      message: "WhatsApp não está conectado. Conecte antes de iniciar disparos.",
    });
  }

  const batchId = "batch_" + Date.now().toString(36);
  db.batches[batchId] = {
    templateId,
    leadIds,
    items: leadIds.map((leadId) => ({
      leadId,
      status: "pending",
      errorCode: null,
      errorMessage: null,
      timestamp: null,
    })),
    createdAt: new Date().toISOString(),
  };
  writeDb(db);

  processarFila(batchId, leadIds).catch((err) => {
    console.error("[Disparos] Erro inesperado no processamento da fila:", err.message);
  });

  res.status(202).json({ batchId });
});

// GET /api/disparos/:batchId
router.get("/:batchId", (req, res) => {
  const db = readDb();
  const batch = db.batches[req.params.batchId];
  if (!batch) return res.status(404).json({ error: true, code: "BATCH_NOT_FOUND", message: "Lote de disparo não encontrado." });

  const resumo = batch.items.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    { pending: 0, sending: 0, sent: 0, failed: 0 }
  );

  res.json({ batchId: req.params.batchId, resumo, items: batch.items });
});

// POST /api/disparos/:leadId/retry   body: { batchId }
router.post("/:leadId/retry", async (req, res) => {
  const { batchId } = req.body;
  const { leadId } = req.params;
  if (!batchId) {
    return res.status(400).json({ error: true, code: "INVALID_INPUT", message: "Informe o batchId no corpo da requisição." });
  }
  const db = readDb();
  const batch = db.batches[batchId];
  if (!batch) return res.status(404).json({ error: true, code: "BATCH_NOT_FOUND", message: "Lote não encontrado." });
  const item = batch.items.find((i) => i.leadId === leadId);
  if (!item) return res.status(404).json({ error: true, code: "ITEM_NOT_FOUND", message: "Lead não encontrado neste lote." });

  await enviarUmItem(batchId, leadId);
  const updated = readDb().batches[batchId].items.find((i) => i.leadId === leadId);
  res.json({ item: updated });
});

module.exports = router;
