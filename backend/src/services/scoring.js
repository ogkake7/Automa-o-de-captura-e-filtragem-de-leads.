const DOMINIOS_FRACOS = ["linktr.ee", "facebook.com", "instagram.com", "wa.me", "linktree"];

function siteEhRuim(site) {
  if (!site) return false;
  const s = site.toLowerCase();
  if (!s.startsWith("https://")) return true;
  if (DOMINIOS_FRACOS.some((d) => s.includes(d))) return true;
  return false;
}

function normalizarLead(raw) {
  const temSite = Boolean(raw.website);
  const site = raw.website || null;
  const avaliacoes = raw.reviewsCount ?? 0;
  const nota = raw.totalScore ?? null;

  return {
    id: raw.placeId || raw.cid || cryptoRandomId(),
    nome: raw.title || "Sem nome",
    categoria: raw.categoryName || null,
    endereco: raw.address || null,
    cidade: raw.city || null,
    estado: raw.state || null,
    telefone: raw.phone || raw.phoneUnformatted || null,
    site,
    semSite: !temSite,
    siteRuim: siteEhRuim(site),
    avaliacoes,
    nota,
    poucasAvaliacoes: avaliacoes < 10,
    notaBaixa: nota !== null && nota < 4.0,
    mapsUrl: raw.url || null,
    whatsappStatus: "nao_verificado",
    capturedAt: new Date().toISOString(),
    manual: {},
  };
}

function calcularScore(lead) {
  let score = 0;
  if (lead.semSite) score += 35;
  else if (lead.siteRuim) score += 20;
  if (lead.poucasAvaliacoes) score += 20;
  if (lead.notaBaixa) score += 15;
  if (lead.whatsappStatus === "ativo") score += 15;
  if (lead.telefone) score += 10;
  if (lead.manual?.siteRuim) score += 15;
  return Math.min(score, 100);
}

function cryptoRandomId() {
  return "lead_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

module.exports = { normalizarLead, calcularScore, siteEhRuim };
