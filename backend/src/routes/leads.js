const express = require("express");
const router = express.Router();
const { readDb, writeDb } = require("../db");
const { calcularScore } = require("../services/scoring");
const baileysService = require("../services/baileysService");

// GET /api/leads
router.get("/", (req, res) => {
  const db = readDb();
  const filtroParam = req.query.filtro;
  let leads = db.leads;

  if (filtroParam) {
    const filtros = String(filtroParam).split(",").map((f) => f.trim());
    leads = leads.filter((lead) => {
      return filtros.every((f) => {
        switch (f) {
          case "sem_site": return lead.semSite;
          case "site_ruim": return lead.siteRuim || lead.manual?.siteRuim;
          case "poucas_avaliacoes": return lead.poucasAvaliacoes;
          case "nota_baixa": return lead.notaBaixa;
          case "sem_whatsapp": return lead.whatsappStatus === "sem_whatsapp";
          case "whatsapp_ativo": return lead.whatsappStatus === "ativo";
          default: return true;
        }
      });
    });
  }

  res.json({ total: leads.length, leads });
});

// GET /api/leads/sem-whatsapp
router.get("/sem-whatsapp", (req, res) => {
  const db = readDb();
  const leads = db.leads.filter((l) => l.whatsappStatus === "sem_whatsapp");
  res.json({ total: leads.length, leads });
});

// POST /api/leads/:id/verificar-whatsapp
router.post("/:id/verificar-whatsapp", async (req, res) => {
  const db = readDb();
  const lead = db.leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: true, code: "LEAD_NOT_FOUND", message: "Lead não encontrado." });
  if (!lead.telefone) {
    return res.status(400).json({ error: true, code: "NO_PHONE", message: "Lead não possui telefone cadastrado." });
  }

  try {
    const result = await baileysService.checkHasWhatsApp(lead.telefone);
    lead.whatsappStatus = result.registered ? "ativo" : "sem_whatsapp";
    lead.whatsappJid = result.jid || null;
    lead.score = calcularScore(lead);
    writeDb(db);
    res.json({ lead });
  } catch (err) {
    res.status(err.code === "WHATSAPP_NOT_CONNECTED" ? 409 : 500).json({
      error: true,
      code: err.code || "WHATSAPP_CHECK_FAILED",
      message: err.message,
    });
  }
});

// PATCH /api/leads/:id
router.patch("/:id", (req, res) => {
  const db = readDb();
  const lead = db.leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: true, code: "LEAD_NOT_FOUND", message: "Lead não encontrado." });

  lead.manual = { ...lead.manual, ...(req.body.manual || {}) };
  lead.score = calcularScore(lead);
  writeDb(db);
  res.json({ lead });
});

module.exports = router;
