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

module.exports = { gcGet };
