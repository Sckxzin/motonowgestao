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

async function gcPost(path, body) {
  if (!process.env.GC_ACCESS_TOKEN || !process.env.GC_SECRET_TOKEN) {
    throw new Error('GC_ACCESS_TOKEN/GC_SECRET_TOKEN não configurados neste ambiente');
  }
  const url = new URL(path, BASE);
  const res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
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

// Confirmado com a diretoria: venda de moto é sempre PIX à vista.
// forma_pagamento_id e plano_contas_id vistos numa venda real via GET /vendas.
const FORMA_PAGAMENTO_PADRAO = { id: '5885248', nome: 'PIX' };
const CONDICAO_PAGAMENTO_PADRAO = 'a_vista';
const PLANO_CONTAS_VENDA_MOTO = { id: '32200746', nome: 'Vendas de produtos' };

// Toda venda feita pelo MotoNow é de motocicleta pra cliente pessoa física
// não contribuinte (tipo_contribuinte = '9' no cadastro de cliente do GestãoClick).
const TIPO_CONTRIBUINTE_PADRAO = '9';

async function buscarClientePorCPF(cpf) {
  if (!cpf) return null;
  const r = await gcGet('/clientes', { cpf_cnpj: cpf });
  return (r.json?.data || [])[0] || null;
}

async function buscarProdutoPorChassi(chassi) {
  if (!chassi) return null;
  const r = await gcGet('/produtos', { codigo: chassi });
  return (r.json?.data || [])[0] || null;
}

// O pg devolve colunas TIMESTAMPTZ como objeto Date, não string.
function dataISO(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

// Visto em GET /vendas: toda venda "Concretizada" já tem nota fiscal associada
// (coluna NF-e preenchida em 100% das concretizadas na listagem do GestãoClick).
// Criar a venda com essa situação é tratado como risco fiscal — bloqueado por
// padrão em criarVenda(), só passa com forcar=true.
const SITUACAO_CONCRETIZADA_ID = '8245780';

// Monta o payload de criar venda a partir de uma venda de moto do MotoNow,
// seguindo o FORMATO DE LEITURA (GET /vendas) — o GestãoClick avisa que o
// formato de escrita às vezes difere, então isso é um RASCUNHO pra revisar
// antes de mandar de verdade, não algo já validado contra a API.
// situacaoId é OBRIGATÓRIO — sem valor padrão de propósito, pra nunca cair
// sozinho numa situação que dispare nota fiscal sem ninguém escolher isso.
function montarPayloadVenda(vendaMotos, { cliente, produto, loja, situacaoId }) {
  if (!situacaoId) throw new Error('situacaoId é obrigatório pra montar o payload de venda');
  const variacao = produto?.variacoes?.[0]?.variacao;
  const data = dataISO(vendaMotos.data_venda || vendaMotos.created_at);
  return {
    cliente_id: cliente?.id || null,
    loja_id: loja?.id || null,
    situacao_id: situacaoId,
    data,
    condicao_pagamento: CONDICAO_PAGAMENTO_PADRAO,
    pagamentos: [{
      pagamento: {
        data_vencimento: data,
        valor: Number(vendaMotos.valor || 0).toFixed(2),
        forma_pagamento_id: FORMA_PAGAMENTO_PADRAO.id,
        plano_contas_id: PLANO_CONTAS_VENDA_MOTO.id,
      },
    }],
    produtos: [{
      produto: {
        produto_id: produto?.id || null,
        variacao_id: variacao?.id || null,
        quantidade: '1.00',
        valor_venda: Number(vendaMotos.valor || 0).toFixed(2),
        valor_total: Number(vendaMotos.valor || 0).toFixed(2),
      },
    }],
  };
}

// RASCUNHO — não confirmado contra a API ainda. A documentação avisa que no
// cliente PF os campos de escrita usam prefixo (pf_cpf, pf_rg, pf_data_nascimento,
// pf_sexo) mesmo saindo sem prefixo na leitura (cpf, rg, ...). "nome" não tem
// prefixo em nenhum dos dois lados.
function montarPayloadCliente(vendaMotos) {
  return {
    tipo_pessoa: 'PF',
    nome: vendaMotos.nome_cliente || null,
    pf_cpf: vendaMotos.cpf || null,
    telefone: vendaMotos.telefone || vendaMotos.numero_cliente || null,
    tipo_contribuinte: TIPO_CONTRIBUINTE_PADRAO,
  };
}

async function criarCliente(payload) {
  const r = await gcPost('/clientes', payload);
  if (r.status < 200 || r.status >= 300) throw new Error(`GestãoClick recusou criar cliente (${r.status}): ${JSON.stringify(r.json)}`);
  return r.json?.data || r.json;
}

// forcar=true é a única forma de mandar situacaoId === SITUACAO_CONCRETIZADA_ID.
// Sem isso, lança erro e não chama a API — bloqueio pensado especificamente pra
// não gerar nota fiscal sem intenção explícita de quem está chamando.
async function criarVenda(payload, { forcar = false } = {}) {
  if (payload.situacao_id === SITUACAO_CONCRETIZADA_ID && !forcar) {
    throw new Error('Bloqueado: essa situação (Concretizada) dispara nota fiscal automaticamente. Passe forcar=true se isso for intencional.');
  }
  const r = await gcPost('/vendas', payload);
  if (r.status < 200 || r.status >= 300) throw new Error(`GestãoClick recusou criar venda (${r.status}): ${JSON.stringify(r.json)}`);
  return r.json?.data || r.json;
}

module.exports = {
  gcGet, gcPost, lojaPorCNPJ,
  FORMA_PAGAMENTO_PADRAO, CONDICAO_PAGAMENTO_PADRAO, PLANO_CONTAS_VENDA_MOTO,
  TIPO_CONTRIBUINTE_PADRAO, SITUACAO_CONCRETIZADA_ID,
  buscarClientePorCPF, buscarProdutoPorChassi, montarPayloadVenda, montarPayloadCliente,
  criarCliente, criarVenda,
};
