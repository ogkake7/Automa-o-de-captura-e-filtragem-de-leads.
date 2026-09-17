const express = require("express");
const router = express.Router();
const { readDb, writeDb } = require("../db");
const apifyService = require("../services/apifyService");
const baileysService = require("../services/baileysService");

// GET /api/config/status
router.get("/status", async (req, res) => {
  const db = readDb();
  const wa = baileysService.getStatus();

  const token = db.apifyToken || process.env.APIFY_TOKEN;
  const configured = Boolean(token && token.trim().length > 0);

  res.json({
    backend: "online",
    apify: {
      configured,
      status: configured ? "connected" : "not_configured",
    },
    whatsapp: {
      status: wa.status,
      connected: wa.status === "connected",
      user: wa.meNumber ? { id: wa.meNumber } : null,
    },
  });
});

module.exports = router;
