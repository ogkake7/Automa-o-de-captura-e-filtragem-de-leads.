const axios = require("axios");
const { readDb } = require("../db");

const APIFY_BASE = "https://api.apify.com/v2";

const CATEGORIAS_SUGERIDAS = [
  "Restaurantes", "Advocacia", "Clínicas Médicas", "Clínicas Odontológicas",
  "Salões de Beleza", "Barbearias", "Imobiliárias", "Oficinas Mecânicas",
  "Academias", "Pet Shops", "Contabilidade", "Arquitetura", "Autoescolas",
  "Despachantes", "Fisioterapia", "Estética", "Marcenarias", "Serralherias",
  "Lojas de Roupas", "Farmácias",
];

function getToken() {
  const db = readDb();
  return db.apifyToken || process.env.APIFY_TOKEN || null;
}

function actorPath() {
  const actorId = process.env.APIFY_ACTOR_ID || "compass~crawler-google-places";
  return actorId;
}

async function testToken(token) {
  try {
    const res = await axios.get(`${APIFY_BASE}/users/me`, {
      params: { token },
      timeout: 10000,
    });
    return { ok: true, user: res.data?.data?.username || res.data?.data?.id };
  } catch (err) {
    return {
      ok: false,
      error: mapAxiosError(err),
    };
  }
}

function getCategorias() {
  return CATEGORIAS_SUGERIDAS;
}

async function iniciarBusca({ pais, estado, cidade, categoria, limite }) {
  const token = getToken();
  if (!token) {
    const err = new Error("Nenhum token do Apify configurado no .env do backend.");
    err.code = "APIFY_NO_TOKEN";
    throw err;
  }

  const localizacao = [cidade, estado, pais].filter(Boolean).join(", ");
  const input = {
    searchStringsArray: [categoria],
    locationQuery: localizacao,
    maxCrawledPlacesPerSearch: Number(limite) || 20,
    language: "pt-BR",
    skipClosedPlaces: false,
  };

  try {
    const res = await axios.post(
      `${APIFY_BASE}/acts/${actorPath()}/runs`,
      input,
      { params: { token }, timeout: 15000 }
    );
    return { runId: res.data.data.id, datasetId: res.data.data.defaultDatasetId };
  } catch (err) {
    throw normalizeAxiosError(err, "APIFY_RUN_FAILED");
  }
}

async function statusBusca(runId) {
  const token = getToken();
  if (!token) {
    const err = new Error("Nenhum token do Apify configurado.");
    err.code = "APIFY_NO_TOKEN";
    throw err;
  }
  try {
    const res = await axios.get(`${APIFY_BASE}/actor-runs/${runId}`, {
      params: { token },
      timeout: 10000,
    });
    const data = res.data.data;
    return {
      status: data.status,
      datasetId: data.defaultDatasetId,
      startedAt: data.startedAt,
      finishedAt: data.finishedAt,
      statusMessage: data.statusMessage || null,
    };
  } catch (err) {
    throw normalizeAxiosError(err, "APIFY_STATUS_FAILED");
  }
}

async function resultadosBusca(datasetId) {
  const token = getToken();
  if (!token) {
    const err = new Error("Nenhum token do Apify configurado.");
    err.code = "APIFY_NO_TOKEN";
    throw err;
  }
  try {
    const res = await axios.get(`${APIFY_BASE}/datasets/${datasetId}/items`, {
      params: { token, format: "json", clean: true },
      timeout: 20000,
    });
    return res.data;
  } catch (err) {
    throw normalizeAxiosError(err, "APIFY_RESULTS_FAILED");
  }
}

function mapAxiosError(err) {
  if (err.response) {
    return {
      status: err.response.status,
      message: err.response.data?.error?.message || err.response.statusText,
    };
  }
  if (err.code === "ECONNABORTED") return { status: null, message: "Timeout ao contatar a API do Apify." };
  return { status: null, message: err.message || "Erro desconhecido ao contatar o Apify." };
}

function normalizeAxiosError(err, fallbackCode) {
  const mapped = mapAxiosError(err);
  const e = new Error(mapped.message);
  e.code = fallbackCode;
  e.httpStatus = mapped.status;
  return e;
}

module.exports = { getCategorias, iniciarBusca, statusBusca, resultadosBusca, testToken };
