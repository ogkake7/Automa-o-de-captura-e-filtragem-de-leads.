const express = require("express");
const router = express.Router();
const { readDb, writeDb } = require("../db");

// GET /api/templates
router.get("/", (req, res) => {
  const db = readDb();
  res.json({ templates: db.templates });
});

// POST /api/templates  { nome, texto }
router.post("/", (req, res) => {
  const { nome, texto } = req.body;
  if (!nome || !texto) {
    return res.status(400).json({ error: true, code: "INVALID_INPUT", message: "Informe nome e texto do template." });
  }
  const db = readDb();
  const template = {
    id: "tpl_" + Date.now().toString(36),
    nome,
    texto,
    createdAt: new Date().toISOString(),
  };
  db.templates.push(template);
  writeDb(db);
  res.status(201).json({ template });
});

module.exports = router;
