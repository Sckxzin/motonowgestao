const BASE = process.env.GC_BASE_URL || 'https://api.beteltecnologia.com';

function headers() {
  return {
    'access-token': process.env.GC_ACCESS_TOKEN,
    'secret-access-token': process.env.GC_SECRET_TOKEN,
    'Content-Type': 'application/json',
  };
}

async function gcGet(path, params = {}) {
  if (!process.env.GC_ACCESS_TOKEN || !process.env.GC_SECRET_TOKEN) {
    throw new Error('GC_ACCESS_TOKEN/GC_SECRET_TOKEN não configurados neste ambiente');
  }
  const url = new URL(path, BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: headers() });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

// Cada moto/venda carrega seu próprio "CNPJ empresa" (texto livre). O GestãoClick
// não tem uma loja por filial — só uma loja por CNPJ/empresa. Mapeamento fixo,
// confirmado com a diretoria em 2026-09-25.
const LOJAS_POR_CNPJ = {
  '58021497000104': { id: '515958', nome: 'IPOJUCA' },
  '61065883000102': { id: '516343', nome: 'MOTONOW ESCADA' },
  '62230241000184': { id: '552162', nome: 'RIBEIRAO' },
  '62619032000127': { id: '554577', nome: 'LITORAL MOTOCENTER' },
};
function normalizarCNPJ(s) { return String(s || '').replace(/\D/g, ''); }
function lojaPorCNPJ(cnpjEmpresa) {
  return LOJAS_POR_CNPJ[normalizarCNPJ(cnpjEmpresa)] || null;
}

module.exports = { gcGet, lojaPorCNPJ };
