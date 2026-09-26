const BASE = process.env.GC_BASE_URL || 'https://api.beteltecnologia.com';

// Cada empresa (CNPJ) no GestãoClick tem seus PRÓPRIOS dados (clientes, produtos,
// vendas) — não é uma base compartilhada com "loja" só como etiqueta. Confirmado
// na prática em 2026-09-25: um produto cadastrado em RIBEIRAO não aparecia pra
// um token criado noutra empresa. Por isso cada loja tem seu próprio par de
// tokens, lido de variáveis de ambiente com o sufixo abaixo (ex: GC_ACCESS_TOKEN_IPOJUCA).
// Se as variáveis específicas da loja não existirem, cai pro token genérico
// (GC_ACCESS_TOKEN/GC_SECRET_TOKEN) — mantém compatibilidade com o que já tinha.
const LOJAS_POR_CNPJ = {
  '58021497000104': { id: '515958', nome: 'IPOJUCA', chave: 'IPOJUCA' },
  '61065883000102': { id: '516343', nome: 'MOTONOW ESCADA', chave: 'MOTONOW_ESCADA' },
  '62230241000184': { id: '552162', nome: 'RIBEIRAO', chave: 'RIBEIRAO' },
  '62619032000127': { id: '554577', nome: 'LITORAL MOTOCENTER', chave: 'LITORAL_MOTOCENTER' },
};
function normalizarCNPJ(s) { return String(s || '').replace(/\D/g, ''); }
function lojaPorCNPJ(cnpjEmpresa) {
  return LOJAS_POR_CNPJ[normalizarCNPJ(cnpjEmpresa)] || null;
}

function credenciaisPorLoja(loja) {
  const chave = loja?.chave;
  const accessToken = (chave && process.env['GC_ACCESS_TOKEN_' + chave]) || process.env.GC_ACCESS_TOKEN;
  const secretToken = (chave && process.env['GC_SECRET_TOKEN_' + chave]) || process.env.GC_SECRET_TOKEN;
  return { accessToken, secretToken };
}

function headers(credenciais) {
  const accessToken = credenciais?.accessToken || process.env.GC_ACCESS_TOKEN;
  const secretToken = credenciais?.secretToken || process.env.GC_SECRET_TOKEN;
  return {
    'access-token': accessToken,
    'secret-access-token': secretToken,
    'Content-Type': 'application/json',
  };
}

async function gcGet(path, params = {}, credenciais) {
  const h = headers(credenciais);
  if (!h['access-token'] || !h['secret-access-token']) {
    throw new Error('Tokens do GestãoClick não configurados neste ambiente/loja');
  }
  const url = new URL(path, BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: h });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

async function gcPost(path, body, credenciais) {
  const h = headers(credenciais);
  if (!h['access-token'] || !h['secret-access-token']) {
    throw new Error('Tokens do GestãoClick não configurados neste ambiente/loja');
  }
  const url = new URL(path, BASE);
  const res = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify(body) });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

// Confirmado com a diretoria: venda de moto é sempre PIX à vista.
// forma_pagamento_id e plano_contas_id vistos numa venda real via GET /vendas.
const FORMA_PAGAMENTO_PADRAO = { id: '5885248', nome: 'PIX' };
const CONDICAO_PAGAMENTO_PADRAO = 'a_vista';
const PLANO_CONTAS_VENDA_MOTO = { id: '32200746', nome: 'Vendas de produtos' };

// Toda venda feita pelo MotoNow é de motocicleta pra cliente pessoa física
// não contribuinte (tipo_contribuinte = '9' no cadastro de cliente do GestãoClick).
const TIPO_CONTRIBUINTE_PADRAO = '9';

async function buscarClientePorCPF(cpf, credenciais) {
  if (!cpf) return null;
  const r = await gcGet('/clientes', { cpf_cnpj: cpf }, credenciais);
  return (r.json?.data || [])[0] || null;
}

async function buscarProdutoPorChassi(chassi, credenciais) {
  if (!chassi) return null;
  const r = await gcGet('/produtos', { codigo: chassi }, credenciais);
  return (r.json?.data || [])[0] || null;
}

// O pg devolve colunas TIMESTAMPTZ como objeto Date, não string.
function dataISO(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

// Testado na prática em 2026-09-25: criar/concretizar uma venda NÃO emite nota
// fiscal sozinho — "Emitir" é uma ação manual separada, no menu de ações da
// venda. Então não tem problema criar a venda já como "Concretizada".
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
//
// O endereço segue o formato visto na LEITURA (GET /clientes): um array
// "enderecos" com objetos {endereco: {tipo_id, nome_tipo, cep, logradouro,
// numero, complemento, bairro, pais, cidade_id, nome_cidade, estado}}.
// cidade_id/tipo_id são IDs internos do GestãoClick que a gente não tem
// (dependeriam de buscar/casar a cidade lá) — por isso aqui manda só os
// campos de texto (cep, logradouro, numero, complemento, bairro, estado) e
// deixa cidade_id de fora; ainda não testado contra a API de escrita.
function montarPayloadCliente(vendaMotos) {
  const payload = {
    tipo_pessoa: 'PF',
    nome: vendaMotos.nome_cliente || null,
    pf_cpf: vendaMotos.cpf || null,
    telefone: vendaMotos.telefone || vendaMotos.numero_cliente || null,
    tipo_contribuinte: TIPO_CONTRIBUINTE_PADRAO,
  };
  if (vendaMotos.end_cep || vendaMotos.end_rua || vendaMotos.end_bairro) {
    payload.enderecos = [{
      endereco: {
        nome_tipo: 'Residencial',
        cep: vendaMotos.end_cep || null,
        logradouro: vendaMotos.end_rua || null,
        numero: vendaMotos.end_numero || null,
        complemento: vendaMotos.end_complemento || null,
        bairro: vendaMotos.end_bairro || null,
        nome_cidade: vendaMotos.end_cidade || null,
        estado: vendaMotos.end_uf || null,
        pais: 'Brasil',
      },
    }];
  }
  return payload;
}

async function criarCliente(payload, credenciais) {
  const r = await gcPost('/clientes', payload, credenciais);
  if (r.status < 200 || r.status >= 300) throw new Error(`GestãoClick recusou criar cliente (${r.status}): ${JSON.stringify(r.json)}`);
  return r.json?.data || r.json;
}

async function criarVenda(payload, credenciais) {
  const r = await gcPost('/vendas', payload, credenciais);
  if (r.status < 200 || r.status >= 300) throw new Error(`GestãoClick recusou criar venda (${r.status}): ${JSON.stringify(r.json)}`);
  return r.json?.data || r.json;
}

module.exports = {
  gcGet, gcPost, lojaPorCNPJ, credenciaisPorLoja,
  FORMA_PAGAMENTO_PADRAO, CONDICAO_PAGAMENTO_PADRAO, PLANO_CONTAS_VENDA_MOTO,
  TIPO_CONTRIBUINTE_PADRAO, SITUACAO_CONCRETIZADA_ID,
  buscarClientePorCPF, buscarProdutoPorChassi, montarPayloadVenda, montarPayloadCliente,
  criarCliente, criarVenda,
};
