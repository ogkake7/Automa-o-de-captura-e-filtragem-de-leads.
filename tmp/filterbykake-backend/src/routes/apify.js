const express = require("express");
const router = express.Router();
const apifyService = require("../services/apifyService");
const { readDb, writeDb } = require("../db");
const { normalizarLead, calcularScore } = require("../services/scoring");

// GET /api/apify/categories
router.get("/categories", (req, res) => {
  res.json({ categorias: apifyService.getCategorias() });
});

// POST /api/apify/search  { pais, estado, cidade, categoria, limite }
router.post("/search", async (req, res) => {
  const { pais, estado, cidade, categoria, limite } = req.body;
  if (!categoria || !cidade) {
    return res.status(400).json({
      error: true,
      code: "INVALID_INPUT",
      message: "Informe ao menos cidade e categoria para iniciar a busca.",
    });
  }

  try {
    const { runId, datasetId } = await apifyService.iniciarBusca({ pais, estado, cidade, categoria, limite });
    const db = readDb();
    db.searches[runId] = {
      status: "RUNNING",
      datasetId,
      params: { pais, estado, cidade, categoria, limite },
      createdAt: new Date().toISOString(),
    };
    writeDb(db);
    res.json({ runId });
  } catch (err) {
    res.status(err.httpStatus || 500).json({
      error: true,
      code: err.code || "APIFY_SEARCH_FAILED",
      message: err.message,
    });
  }
});

// GET /api/apify/search/:runId/status
router.get("/search/:runId/status", async (req, res) => {
  const { runId } = req.params;
  try {
    const status = await apifyService.statusBusca(runId);
    const db = readDb();
    if (db.searches[runId]) {
      db.searches[runId].status = status.status;
      db.searches[runId].datasetId = status.datasetId;
      writeDb(db);
    }
    res.json(status);
  } catch (err) {
    res.status(err.httpStatus || 500).json({
      error: true,
      code: err.code || "APIFY_STATUS_FAILED",
      message: err.message,
    });
  }
});

// GET /api/apify/search/:runId/results
router.get("/search/:runId/results", async (req, res) => {
  const { runId } = req.params;
  const db = readDb();
  const search = db.searches[runId];

  if (!search) {
    return res.status(404).json({ error: true, code: "SEARCH_NOT_FOUND", message: "Busca não encontrada." });
  }
  if (search.status !== "SUCCEEDED") {
    return res.status(409).json({
      error: true,
      code: "SEARCH_NOT_READY",
      message: `Busca ainda não concluída (status atual: ${search.status}).`,
    });
  }

  try {
    const rawResults = await apifyService.resultadosBusca(search.datasetId);
    const novosLeads = rawResults.map(normalizarLead).map((lead) => ({
      ...lead,
      score: calcularScore(lead),
    }));

    const existentesIds = new Set(db.leads.map((l) => l.id));
    const adicionados = novosLeads.filter((l) => !existentesIds.has(l.id));
    db.leads.push(...adicionados);
    writeDb(db);

    res.json({ total: novosLeads.length, adicionados: adicionados.length, leads: novosLeads });
  } catch (err) {
    res.status(err.httpStatus || 500).json({
      error: true,
      code: err.code || "APIFY_RESULTS_FAILED",
      message: err.message,
    });
  }
});

module.exports = router;
