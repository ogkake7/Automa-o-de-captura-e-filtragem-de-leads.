require("dotenv").config();
const express = require("express");
const cors = require("cors");

const configRoutes = require("./routes/config");
const whatsappRoutes = require("./routes/whatsapp");
const apifyRoutes = require("./routes/apify");
const leadsRoutes = require("./routes/leads");
const templatesRoutes = require("./routes/templates");
const disparosRoutes = require("./routes/disparos");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use("/api/config", configRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/apify", apifyRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/templates", templatesRoutes);
app.use("/api/disparos", disparosRoutes);

app.get("/", (req, res) => {
  res.json({ ok: true, service: "FilterByKake backend", time: new Date().toISOString() });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", backend: "online" });
});

// handler global de erro
app.use((err, req, res, next) => {
  console.error("[ERRO NÃO TRATADO]", err);
  res.status(500).json({
    error: true,
    code: "INTERNAL_ERROR",
    message: err.message || "Erro interno inesperado no servidor.",
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✔ FilterByKake backend rodando em http://localhost:${PORT}`);
  console.log(`  Para expor para o dashboard hospedado, use um túnel: npx ngrok http ${PORT}`);
});
