require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const db      = require('./db');
const { isRepasseObrigatorio, getRepasse, calcularComissao } = require('./helpers');

const app = express();
const JWT  = process.env.JWT_SECRET || 'motonow_secret_2024';
const PORT = process.env.PORT || 3001;
function formatBRL(v) { return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.options('*', cors());
app.use(express.json());

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'Não autenticado' });
  try { req.user = jwt.verify(h.replace('Bearer ', ''), JWT); next(); }
  catch { res.status(401).json({ error: 'Token inválido' }); }
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'DIRETORIA') return res.status(403).json({ error: 'Acesso restrito' });
  next();
}

const FILIAIS_VER_TUDO = ['SAO JOSE','ESCADA','IPOJUCA'];

async function registrarLog(req, acao, entidade, entidade_id, descricao) {
  try {
    const { id, username } = req.user || {};
    await db.run(
      'INSERT INTO log_atividades(usuario_id,username,acao,entidade,entidade_id,descricao) VALUES($1,$2,$3,$4,$5,$6)',
      [id||null, username||'?', acao, entidade||null, String(entidade_id||''), descricao||null]
    );
  } catch(e) {}
}

app.get('/health', (_, res) => res.json({ ok: true }));

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const u = await db.one('SELECT * FROM usuarios WHERE username=$1 AND ativo=1', [username]);
    if (!u || !bcrypt.compareSync(password, u.password))
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    const token = jwt.sign({ id:u.id, username:u.username, role:u.role, cidade:u.cidade }, JWT, { expiresIn:'8h' });
    res.json({ token, user:{ id:u.id, username:u.username, role:u.role, cidade:u.cidade } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/usuarios', auth, adminOnly, async (_, res) => {
  res.json(await db.q('SELECT id,username,role,cidade,ativo,created_at FROM usuarios ORDER BY cidade,username'));
});
app.get('/usuarios/publico', auth, async (_, res) => {
  res.json(await db.q('SELECT id,username,cidade FROM usuarios WHERE ativo=1 ORDER BY cidade'));
});
app.post('/usuarios', auth, adminOnly, async (req, res) => {
  const { username, password, role, cidade } = req.body;
  if (!username||!password||!role||!cidade) return res.status(400).json({ error:'Dados incompletos' });
  try {
    const r = await db.one('INSERT INTO usuarios(username,password,role,cidade) VALUES($1,$2,$3,$4) RETURNING id,username,role,cidade',
      [username, bcrypt.hashSync(password,10), role, cidade]);
    res.json(r);
  } catch { res.status(409).json({ error:'Usuário já existe' }); }
});
app.put('/usuarios/:id/senha', auth, adminOnly, async (req, res) => {
  await db.run('UPDATE usuarios SET password=$1 WHERE id=$2', [bcrypt.hashSync(req.body.password,10), req.params.id]);
  res.json({ ok:true });
});
app.put('/usuarios/:id', auth, adminOnly, async (req, res) => {
  const { role, cidade, ativo } = req.body;
  await db.run('UPDATE usuarios SET role=COALESCE($1,role),cidade=COALESCE($2,cidade),ativo=COALESCE($3,ativo) WHERE id=$4',
    [role||null, cidade||null, ativo!=null?ativo:null, req.params.id]);
  res.json({ ok:true });
});

app.get('/clientes', auth, async (req, res) => {
  const { q } = req.query;
  if (q) {
    const like = `%${q}%`;
    return res.json(await db.q('SELECT * FROM clientes WHERE nome ILIKE $1 OR cpf ILIKE $1 OR telefone ILIKE $1 ORDER BY nome LIMIT 100', [like]));
  }
  res.json(await db.q('SELECT * FROM clientes ORDER BY nome LIMIT 100'));
});
app.get('/clientes/buscar', auth, async (req, res) => {
  const { q } = req.query;
  if (!q||q.length<3) return res.json(null);
  const like = `%${q}%`;
  const cli = await db.one(`SELECT * FROM clientes WHERE telefone ILIKE $1 OR nome ILIKE $1 OR cpf ILIKE $1 LIMIT 1`, [like]);
  if (!cli) return res.json(null);
  const motos = await db.q('SELECT * FROM cliente_motos WHERE cliente_id=$1 ORDER BY id', [cli.id]);
  res.json({ ...cli, motos });
});
app.get('/clientes/:id', auth, async (req, res) => {
  const c = await db.one('SELECT * FROM clientes WHERE id=$1', [req.params.id]);
  if (!c) return res.status(404).json({ error:'Não encontrado' });
  const motos    = await db.q('SELECT * FROM cliente_motos WHERE cliente_id=$1 ORDER BY id DESC', [c.id]);
  const vendas   = await db.q('SELECT * FROM vendas WHERE cliente_id=$1 ORDER BY created_at DESC LIMIT 20', [c.id]);
  const revisoes = await db.q('SELECT * FROM revisoes WHERE cliente_id=$1 ORDER BY created_at DESC LIMIT 20', [c.id]);
  for (const v of vendas) v.itens = await db.q('SELECT * FROM venda_itens WHERE venda_id=$1', [v.id]);
  const totalGasto = vendas.reduce((s,v)=>s+Number(v.total||0),0);
  res.json({ cliente:c, motos, vendas, revisoes, stats:{ totalGasto, qtdVendas:vendas.length, qtdRevisoes:revisoes.length } });
});
app.post('/clientes', auth, async (req, res) => {
  const { nome, cpf, telefone, cidade, observacao } = req.body;
  if (!nome) return res.status(400).json({ error:'Nome obrigatório' });
  const r = await db.one('INSERT INTO clientes(nome,cpf,telefone,cidade,observacao) VALUES($1,$2,$3,$4,$5) RETURNING *',
    [nome, cpf||null, telefone||null, cidade||null, observacao||null]);
  res.json(r);
});
app.put('/clientes/:id', auth, async (req, res) => {
  const { nome, cpf, telefone, cidade, observacao } = req.body;
  const r = await db.one('UPDATE clientes SET nome=$1,cpf=$2,telefone=$3,cidade=$4,observacao=$5 WHERE id=$6 RETURNING *',
    [nome, cpf||null, telefone||null, cidade||null, observacao||null, req.params.id]);
  res.json(r);
});
app.post('/clientes/:id/motos', auth, async (req, res) => {
  const { chassi, modelo, cor, ano } = req.body;
  const r = await db.one('INSERT INTO cliente_motos(cliente_id,chassi,modelo,cor,ano) VALUES($1,$2,$3,$4,$5) RETURNING *',
    [req.params.id, chassi||null, modelo||null, cor||null, ano||null]);
  res.json(r);
});
app.delete('/clientes/:cid/motos/:mid', auth, async (req, res) => {
  await db.run('DELETE FROM cliente_motos WHERE id=$1 AND cliente_id=$2', [req.params.mid, req.params.cid]);
  res.json({ ok:true });
});

// ── PEÇAS ─────────────────────────────────
app.get('/pecas', auth, async (req, res) => {
  const { role, cidade: userCidade } = req.user;
  const { cidade } = req.query;
  const filtro = (role==='FILIAL' && !FILIAIS_VER_TUDO.includes(userCidade)) ? userCidade : (cidade||null);
  if (filtro) return res.json(await db.q('SELECT * FROM pecas WHERE cidade=$1 ORDER BY nome', [filtro]));
  res.json(await db.q('SELECT * FROM pecas ORDER BY nome'));
});
app.post('/pecas', auth, adminOnly, async (req, res) => {
  const { nome, preco, estoque, cidade, tipo_moto, valor_compra, codigo } = req.body;
  if (!nome||preco==null||!cidade) return res.status(400).json({ error:'Dados incompletos' });
  const r = await db.one('INSERT INTO pecas(nome,preco,estoque,cidade,tipo_moto,valor_compra,codigo) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [nome, Number(preco), Number(estoque||0), cidade, tipo_moto||null, valor_compra?Number(valor_compra):null, codigo||null]);
  res.json(r);
});
app.put('/pecas/:id/estoque', auth, adminOnly, async (req, res) => {
  const { quantidade, preco } = req.body;
  if (!quantidade||Number(quantidade)<=0) return res.status(400).json({ error:'Quantidade inválida' });
  const p = await db.one('SELECT * FROM pecas WHERE id=$1', [req.params.id]);
  if (!p) return res.status(404).json({ error:'Não encontrada' });
  const np = preco!=null ? Number(preco) : p.preco;
  const r = await db.one('UPDATE pecas SET estoque=estoque+$1,preco=$2 WHERE id=$3 RETURNING *', [Number(quantidade), np, req.params.id]);
  res.json(r);
});
app.post('/pecas/transferir', auth, async (req, res) => {
  const { role, cidade: userCidade } = req.user;
  if (role !== 'DIRETORIA' && !FILIAIS_VER_TUDO.includes(userCidade)) {
    return res.status(403).json({ error: 'Sem permissão para transferir peças' });
  }
  const { peca_id, filial_origem, filial_destino, quantidade } = req.body;
  if (!peca_id||!filial_destino||!quantidade) return res.status(400).json({ error:'Dados incompletos' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const src = await client.query('SELECT * FROM pecas WHERE id=$1 AND cidade=$2 FOR UPDATE', [peca_id, filial_origem]);
    if (!src.rows[0]) throw new Error('Peça não encontrada na origem');
    if (src.rows[0].estoque < Number(quantidade)) throw new Error('Estoque insuficiente');
    await client.query('UPDATE pecas SET estoque=estoque-$1 WHERE id=$2', [Number(quantidade), peca_id]);
    const dst = await client.query('SELECT id FROM pecas WHERE nome=$1 AND cidade=$2', [src.rows[0].nome, filial_destino]);
    if (dst.rows[0]) {
      await client.query('UPDATE pecas SET estoque=estoque+$1 WHERE id=$2', [Number(quantidade), dst.rows[0].id]);
    } else {
      await client.query('INSERT INTO pecas(nome,preco,estoque,cidade,tipo_moto) VALUES($1,$2,$3,$4,$5)',
        [src.rows[0].nome, src.rows[0].preco, Number(quantidade), filial_destino, src.rows[0].tipo_moto]);
    }
    await client.query('INSERT INTO transferencias_pecas(peca_id,nome_peca,filial_origem,filial_destino,quantidade) VALUES($1,$2,$3,$4,$5)',
      [peca_id, src.rows[0].nome, filial_origem, filial_destino, Number(quantidade)]);
    await client.query('COMMIT');
    res.json({ ok:true });
  } catch(e) { await client.query('ROLLBACK'); res.status(400).json({ error:e.message }); }
  finally { client.release(); }
});
app.put('/pecas/:id', auth, adminOnly, async (req, res) => {
  try {
    const { nome, preco, estoque, cidade, tipo_moto, descricao, valor_compra, codigo } = req.body;
    if (!nome || preco == null) return res.status(400).json({ error: 'Nome e preco obrigatorios' });
    const r = await db.one('UPDATE pecas SET nome=$1,preco=$2,estoque=$3,cidade=$4,tipo_moto=$5,valor_compra=$6,codigo=$7 WHERE id=$8 RETURNING *',
      [nome, Number(preco), Number(estoque||0), cidade||null, tipo_moto||null, valor_compra?Number(valor_compra):null, codigo||null, req.params.id]);
    res.json(r);
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.delete('/pecas/:id', auth, adminOnly, async (req, res) => {
  try { await db.run('DELETE FROM pecas WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/vendas', auth, async (req, res) => {
  const { cliente_nome, cliente_telefone, forma_pagamento, itens, total, cidade, observacao, modelo_moto, chassi_moto, km, cliente_id } = req.body;
  if (!cliente_nome||!forma_pagamento||!cidade) return res.status(400).json({ error:'Dados incompletos' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    let cliId = cliente_id||null;
    if (!cliId) {
      const c = await client.query('SELECT id FROM clientes WHERE telefone=$1 OR nome=$2 LIMIT 1', [cliente_telefone, cliente_nome]);
      if (c.rows[0]) cliId = c.rows[0].id;
    }
    const v = await client.query('INSERT INTO vendas(cliente_nome,cliente_telefone,forma_pagamento,total,cidade,observacao,modelo_moto,chassi_moto,km,cliente_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
      [cliente_nome, cliente_telefone||null, forma_pagamento, Number(total||0), cidade, observacao||null, modelo_moto||null, chassi_moto||null, km||null, cliId]);
    const vendaId = v.rows[0].id;
    for (const it of (itens||[])) {
      const p = await client.query('SELECT nome,estoque FROM pecas WHERE id=$1', [it.peca_id]);
      if (!p.rows[0]) throw new Error(`Peça não encontrada`);
      if (p.rows[0].estoque < it.quantidade) throw new Error(`Estoque insuficiente: ${p.rows[0].nome}`);
      await client.query('INSERT INTO venda_itens(venda_id,peca_id,nome_peca,quantidade,preco_unitario) VALUES($1,$2,$3,$4,$5)',
        [vendaId, it.peca_id, p.rows[0].nome, it.quantidade, it.preco_unitario]);
      await client.query('UPDATE pecas SET estoque=estoque-$1 WHERE id=$2', [it.quantidade, it.peca_id]);
    }
    await client.query('COMMIT');
    res.json({ vendaId });
  } catch(e) { await client.query('ROLLBACK'); res.status(400).json({ error:e.message }); }
  finally { client.release(); }
});
app.get('/vendas', auth, adminOnly, async (_, res) => {
  const vendas = await db.q('SELECT * FROM vendas ORDER BY created_at DESC');
  for (const v of vendas) v.itens = await db.q('SELECT * FROM venda_itens WHERE venda_id=$1', [v.id]);
  res.json(vendas);
});
app.put('/vendas/:id', auth, adminOnly, async (req, res) => {
  const { cliente_nome, cliente_telefone, forma_pagamento, cidade, observacao, total, rp, rr } = req.body;
  const r = await db.one('UPDATE vendas SET cliente_nome=$1,cliente_telefone=$2,forma_pagamento=$3,cidade=$4,observacao=$5,total=$6,rp=$7,rr=$8 WHERE id=$9 RETURNING *',
    [cliente_nome, cliente_telefone||null, forma_pagamento, cidade, observacao||null, Number(total||0), rp?1:0, rr?1:0, req.params.id]);
  res.json(r);
});
app.delete('/vendas/:id', auth, adminOnly, async (req, res) => {
  try {
    await db.run('DELETE FROM venda_itens WHERE venda_id=$1', [req.params.id]);
    await db.run('DELETE FROM vendas WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/nota/:id', auth, async (req, res) => {
  const v = await db.one('SELECT * FROM vendas WHERE id=$1', [req.params.id]);
  if (!v) return res.status(404).json({ error:'Não encontrada' });
  v.itens = await db.q('SELECT * FROM venda_itens WHERE venda_id=$1', [v.id]);
  res.json({ venda:v, itens:v.itens });
});

app.get('/motos', auth, async (_, res) => {
  res.json(await db.q('SELECT * FROM motos ORDER BY id'));
});
app.post('/motos', auth, adminOnly, async (req, res) => {
  const { modelo, cor, chassi, filial, santander, cnpj_empresa, ano_moto, valor_compra, valor_minimo_venda, repasse } = req.body;
  if (!modelo||!cor||!chassi||!filial) return res.status(400).json({ error:'Dados incompletos' });
  const ex = await db.one('SELECT id FROM motos WHERE chassi=$1', [chassi]);
  if (ex) return res.status(409).json({ error:'Chassi já cadastrado' });
  let rep = repasse!=null ? Number(repasse) : null;
  if (isRepasseObrigatorio(filial)) { const r=getRepasse(modelo); if (typeof r!=='number') return res.status(400).json({ error:`Repasse não configurado: ${modelo}` }); rep=r; }
  const r = await db.one('INSERT INTO motos(modelo,cor,chassi,filial,santander,cnpj_empresa,ano_moto,valor_compra,valor_minimo_venda,repasse) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
    [modelo, cor, chassi, filial, santander?1:0, cnpj_empresa||null, ano_moto||null, valor_compra?Number(valor_compra):null, valor_minimo_venda?Number(valor_minimo_venda):null, rep]);
  res.json(r);
});
app.put('/motos/:id/status', auth, async (req, res) => {
  const { status } = req.body;
  const { id:userId, role } = req.user;
  const m = await db.one('SELECT * FROM motos WHERE id=$1', [req.params.id]);
  if (!m) return res.status(404).json({ error:'Não encontrada' });
  if (status==='NEGOCIACAO') {
    await db.run('UPDATE motos SET status=$1,negociacao_por=$2,negociacao_em=NOW() WHERE id=$3', ['NEGOCIACAO', userId, m.id]);
  } else if (status==='DISPONIVEL' && m.status==='NEGOCIACAO') {
    if (role!=='DIRETORIA' && m.negociacao_por!=userId) return res.status(403).json({ error:'Sem permissão' });
    await db.run('UPDATE motos SET status=$1,negociacao_por=NULL,negociacao_em=NULL WHERE id=$2', ['DISPONIVEL', m.id]);
  } else {
    await db.run('UPDATE motos SET status=$1 WHERE id=$2', [status, m.id]);
  }
  res.json(await db.one('SELECT * FROM motos WHERE id=$1', [m.id]));
});
app.post('/motos/transferir', auth, adminOnly, async (req, res) => {
  const { moto_id, filial_destino } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const m = await client.query('SELECT * FROM motos WHERE id=$1 FOR UPDATE', [moto_id]);
    if (!m.rows[0]) throw new Error('Não encontrada');
    if (m.rows[0].status!=='DISPONIVEL') throw new Error('Moto não disponível');
    let rep = m.rows[0].repasse;
    if (isRepasseObrigatorio(filial_destino)) { const r=getRepasse(m.rows[0].modelo); if (typeof r!=='number') throw new Error('Repasse não configurado'); rep=r; }
    await client.query('UPDATE motos SET filial=$1,repasse=$2 WHERE id=$3', [filial_destino, rep, moto_id]);
    await client.query('INSERT INTO transferencias_motos(moto_id,modelo,chassi,filial_origem,filial_destino) VALUES($1,$2,$3,$4,$5)',
      [m.rows[0].id, m.rows[0].modelo, m.rows[0].chassi, m.rows[0].filial, filial_destino]);
    await client.query('COMMIT');
    res.json({ ok:true });
  } catch(e) { await client.query('ROLLBACK'); res.status(400).json({ error:e.message }); }
  finally { client.release(); }
});
app.post('/motos/vender', auth, async (req, res) => {
  const { moto_id, nome_cliente, cpf, numero_cliente, valor, forma_pagamento, brinde, gasolina, como_chegou, filial_venda, local_retirada, filial_retirada, data_venda, cliente_id, emplacamento } = req.body;
  if (!moto_id||!filial_venda||!nome_cliente||!valor) return res.status(400).json({ error:'Dados incompletos' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const moto = (await client.query('SELECT * FROM motos WHERE id=$1 FOR UPDATE', [moto_id])).rows[0];
    if (!moto) throw new Error('Não encontrada');
    if (moto.status!=='DISPONIVEL') throw new Error('Moto indisponível');
    let rep = moto.repasse;
    if (isRepasseObrigatorio(filial_venda)) { const r=getRepasse(moto.modelo); if (typeof r!=='number') throw new Error(`Repasse não configurado: ${moto.modelo}`); rep=r; }
    // Busca comissão do banco
    let comissao = 30;
    try {
      const comRows = await client.query('SELECT * FROM comissoes WHERE modelo ILIKE $1 LIMIT 1', [moto.modelo]);
      if (comRows.rows[0]) {
        const r = comRows.rows[0]; const v = Number(valor||0);
        if (v >= r.v100) comissao = 100;
        else if (v >= r.v50) comissao = 50;
        else if (v >= r.v30) comissao = 30;
        else comissao = 30;
      }
    } catch(e) { comissao = calcularComissao(moto.modelo, valor); }
    let cliId = cliente_id||null;
    if (!cliId) {
      const existing = await client.query('SELECT id FROM clientes WHERE telefone=$1 OR nome ILIKE $2 LIMIT 1', [numero_cliente||'__nenhum__', nome_cliente]);
      if (existing.rows[0]) {
        cliId = existing.rows[0].id;
        await client.query('UPDATE clientes SET nome=$1,cpf=COALESCE($2,cpf),telefone=COALESCE($3,telefone),cidade=COALESCE($4,cidade) WHERE id=$5',
          [nome_cliente, cpf||null, numero_cliente||null, filial_venda, cliId]);
      } else {
        const nc = await client.query('INSERT INTO clientes(nome,cpf,telefone,cidade) VALUES($1,$2,$3,$4) RETURNING id',
          [nome_cliente, cpf||null, numero_cliente||null, filial_venda]);
        cliId = nc.rows[0].id;
      }
    }
    if (cliId && moto.chassi) {
      const jaTem = await client.query('SELECT id FROM cliente_motos WHERE cliente_id=$1 AND chassi=$2', [cliId, moto.chassi]);
      if (!jaTem.rows[0]) await client.query('INSERT INTO cliente_motos(cliente_id,chassi,modelo,cor,ano) VALUES($1,$2,$3,$4,$5)',
        [cliId, moto.chassi, moto.modelo, moto.cor, moto.ano_moto]);
    }
    const p = await client.query(`INSERT INTO vendas_motos_pendentes(moto_id,modelo,cor,chassi,filial_origem,filial_venda,nome_cliente,cpf,numero_cliente,valor,forma_pagamento,brinde,gasolina,como_chegou,local_retirada,filial_retirada,santander,cnpj_empresa,valor_compra,repasse,comissao_valor,cliente_id,data_venda,emplacamento) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING id`,
      [moto.id,moto.modelo,moto.cor,moto.chassi,moto.filial,filial_venda,nome_cliente,cpf||null,numero_cliente||null,Number(valor),forma_pagamento||null,brinde?1:0,gasolina?Number(gasolina):null,como_chegou||null,local_retirada||null,filial_retirada||null,moto.santander,moto.cnpj_empresa,moto.valor_compra,rep,comissao,cliId,data_venda||null,emplacamento?1:0]);
    await client.query("UPDATE motos SET status='PENDENTE_APROVACAO' WHERE id=$1", [moto.id]);
    await client.query('COMMIT');
    res.json({ id:p.rows[0].id });
  } catch(e) { await client.query('ROLLBACK'); res.status(400).json({ error:e.message }); }
  finally { client.release(); }
});

app.get('/pendentes', auth, adminOnly, async (_, res) => {
  res.json(await db.q("SELECT * FROM vendas_motos_pendentes WHERE status='PENDENTE' ORDER BY created_at DESC"));
});
app.post('/pendentes/:id/aprovar', auth, adminOnly, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const p = (await client.query('SELECT * FROM vendas_motos_pendentes WHERE id=$1', [req.params.id])).rows[0];
    if (!p||p.status!=='PENDENTE') throw new Error('Pendência não encontrada');
    let rep = p.repasse;
    if (isRepasseObrigatorio(p.filial_venda)) { const r=getRepasse(p.modelo); if (typeof r!=='number') throw new Error('Repasse não configurado'); rep=r; }
    await client.query(`INSERT INTO vendas_motos(moto_id,modelo,cor,chassi,filial_origem,filial_venda,nome_cliente,cpf,numero_cliente,valor,forma_pagamento,brinde,gasolina,como_chegou,local_retirada,filial_retirada,santander,cnpj_empresa,valor_compra,repasse,comissao_valor,data_venda,emplacamento) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
      [p.moto_id,p.modelo,p.cor,p.chassi,p.filial_origem,p.filial_venda,p.nome_cliente,p.cpf,p.numero_cliente,p.valor,p.forma_pagamento,p.brinde,p.gasolina,p.como_chegou,p.local_retirada,p.filial_retirada,p.santander,p.cnpj_empresa,p.valor_compra,rep,p.comissao_valor,
       p.data_venda||new Date().toISOString().slice(0,10), // ← USA DATA DA VENDA, não NOW()
       p.emplacamento||0]);
    if (p.brinde) {
      const cap = await client.query("SELECT * FROM pecas WHERE nome ILIKE '%CAPACETE%' AND cidade=$1 AND estoque>0 LIMIT 1", [p.filial_venda]);
      if (!cap.rows[0]) throw new Error('Sem capacete em estoque');
      await client.query('UPDATE pecas SET estoque=estoque-1 WHERE id=$1', [cap.rows[0].id]);
    }
    // Atualiza moto com a data de venda informada pela filial
    await client.query(
      "UPDATE motos SET status='VENDIDA', data_venda=COALESCE($1::date, NOW()) WHERE id=$2",
      [p.data_venda||null, p.moto_id]
    );
    await client.query("UPDATE vendas_motos_pendentes SET status='APROVADA',aprovado_em=NOW() WHERE id=$1", [p.id]);
    // Notificação para filial
    await client.query(
      "INSERT INTO notificacoes(tipo,titulo,mensagem,filial) VALUES($1,$2,$3,$4)",
      ['APROVACAO', '✅ Venda aprovada', `${p.modelo} - ${p.nome_cliente} (${formatBRL(p.valor)})`, p.filial_venda]
    );
    await client.query('COMMIT');
    await registrarLog(req, 'APROVAR_VENDA', 'vendas_motos', p.id, `${p.modelo} - ${p.nome_cliente}`);
    res.json({ ok:true });
  } catch(e) { await client.query('ROLLBACK'); res.status(400).json({ error:e.message }); }
  finally { client.release(); }
});
app.get('/minhas-pendentes', auth, async (req, res) => {
  try {
    const { cidade } = req.user;
    const r = await db.q("SELECT * FROM vendas_motos_pendentes WHERE filial_venda=$1 ORDER BY created_at DESC LIMIT 30", [cidade]);
    res.json(r);
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.post('/pendentes/:id/recusar', auth, adminOnly, async (req, res) => {
  const { motivo_recusa } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const p = (await client.query('SELECT * FROM vendas_motos_pendentes WHERE id=$1', [req.params.id])).rows[0];
    if (!p||p.status!=='PENDENTE') throw new Error('Não encontrada');
    await client.query("UPDATE motos SET status='DISPONIVEL' WHERE id=$1", [p.moto_id]);
    await client.query("UPDATE vendas_motos_pendentes SET status='RECUSADA',motivo_recusa=$1,aprovado_em=NOW() WHERE id=$2", [motivo_recusa||null, p.id]);
    await client.query(
      "INSERT INTO notificacoes(tipo,titulo,mensagem,filial) VALUES($1,$2,$3,$4)",
      ['RECUSA', '❌ Venda recusada', `${p.modelo} - ${p.nome_cliente}. Motivo: ${motivo_recusa||'não informado'}`, p.filial_venda]
    );
    await client.query('COMMIT');
    await registrarLog(req, 'RECUSAR_VENDA', 'vendas_motos', p.id, `${p.modelo} - ${p.nome_cliente}. Motivo: ${motivo_recusa}`);
    res.json({ ok:true });
  } catch(e) { await client.query('ROLLBACK'); res.status(400).json({ error:e.message }); }
  finally { client.release(); }
});

app.get('/vendas-motos', auth, adminOnly, async (_, res) => {
  res.json(await db.q('SELECT * FROM vendas_motos ORDER BY data_venda DESC, created_at DESC'));
});
app.put('/vendas-motos/:id', auth, adminOnly, async (req, res) => {
  try {
    const { modelo,cor,chassi,filial_venda,filial_origem,nome_cliente,numero_cliente,valor,valor_compra,repasse,forma_pagamento,como_chegou,brinde,gasolina,santander,cnpj_empresa,comissao_valor,rp,rr,emplacamento,data_venda } = req.body;
    const r = await db.one(
      `UPDATE vendas_motos SET modelo=COALESCE($1,modelo),cor=COALESCE($2,cor),chassi=COALESCE($3,chassi),filial_venda=COALESCE($4,filial_venda),filial_origem=COALESCE($5,filial_origem),nome_cliente=COALESCE($6,nome_cliente),numero_cliente=COALESCE($7,numero_cliente),valor=COALESCE($8,valor),valor_compra=COALESCE($9,valor_compra),repasse=COALESCE($10,repasse),forma_pagamento=COALESCE($11,forma_pagamento),como_chegou=COALESCE($12,como_chegou),brinde=COALESCE($13,brinde),gasolina=COALESCE($14,gasolina),santander=COALESCE($15,santander),cnpj_empresa=COALESCE($16,cnpj_empresa),comissao_valor=COALESCE($17,comissao_valor),rp=COALESCE($18,rp),rr=COALESCE($19,rr),emplacamento=COALESCE($20,emplacamento),data_venda=COALESCE($21,data_venda) WHERE id=$22 RETURNING *`,
      [modelo||null,cor||null,chassi||null,filial_venda||null,filial_origem||null,nome_cliente||null,numero_cliente||null,valor!=null?Number(valor):null,valor_compra!=null?Number(valor_compra):null,repasse!=null?Number(repasse):null,forma_pagamento||null,como_chegou||null,brinde!=null?brinde?1:0:null,gasolina!=null?Number(gasolina):null,santander!=null?santander?1:0:null,cnpj_empresa||null,comissao_valor!=null?Number(comissao_valor):null,rp!=null?rp?1:0:null,rr!=null?rr?1:0:null,emplacamento!=null?Number(emplacamento):null,data_venda||null,req.params.id]
    );
    res.json(r);
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.delete('/vendas-motos/:id', auth, adminOnly, async (req, res) => {
  try {
    const v = await db.one('SELECT chassi FROM vendas_motos WHERE id=$1', [req.params.id]);
    if (v && v.chassi) await db.run("UPDATE motos SET status='DISPONIVEL' WHERE chassi=$1 AND status='VENDIDA'", [v.chassi]);
    await db.run('DELETE FROM vendas_motos WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/revisoes', auth, async (req, res) => {
  const { role, cidade } = req.user;
  if (role==='FILIAL') return res.json(await db.q('SELECT * FROM revisoes WHERE cidade=$1 ORDER BY created_at DESC', [cidade]));
  res.json(await db.q('SELECT * FROM revisoes ORDER BY created_at DESC'));
});
app.post('/revisoes', auth, async (req, res) => {
  const { cliente_nome, cliente_telefone, cliente_cpf, modelo_moto, chassi_moto, km, tipo_revisao, observacao, cliente_id } = req.body;
  const { cidade } = req.user;
  if (!cliente_nome) return res.status(400).json({ error:'Nome obrigatório' });
  let cliId = cliente_id||null;
  if (!cliId&&(cliente_nome||cliente_telefone)) {
    const c = await db.one('SELECT id FROM clientes WHERE telefone=$1 OR nome=$2 LIMIT 1', [cliente_telefone, cliente_nome]);
    if (c) cliId = c.id;
  }
  const r = await db.one('INSERT INTO revisoes(cidade,cliente_nome,cliente_telefone,cliente_cpf,modelo_moto,chassi_moto,km,tipo_revisao,observacao,cliente_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
    [cidade,cliente_nome,cliente_telefone||null,cliente_cpf||null,modelo_moto||null,chassi_moto||null,km||null,tipo_revisao||null,observacao||null,cliId]);
  res.json(r);
});
app.delete('/revisoes/:id', auth, adminOnly, async (req, res) => {
  try {
    await db.run('DELETE FROM revisao_itens WHERE revisao_id=$1', [req.params.id]);
    await db.run('DELETE FROM revisoes WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.put('/revisoes/:id/finalizar', auth, async (req, res) => {
  const { mao_de_obra, desconto, forma_pagamento, itens } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const rev = (await client.query('SELECT * FROM revisoes WHERE id=$1', [req.params.id])).rows[0];
    if (!rev) throw new Error('Não encontrada');
    if (rev.status==='FINALIZADA') throw new Error('Já finalizada');
    let totalPecas = 0;
    for (const it of (itens||[])) {
      if (it.peca_id) {
        const p = await client.query('SELECT estoque FROM pecas WHERE id=$1', [it.peca_id]);
        if (p.rows[0]?.estoque < Number(it.quantidade)) throw new Error(`Estoque insuficiente: ${it.nome_peca}`);
        await client.query('UPDATE pecas SET estoque=estoque-$1 WHERE id=$2', [Number(it.quantidade), it.peca_id]);
        await client.query('INSERT INTO revisao_itens(revisao_id,peca_id,nome_peca,quantidade,preco_unitario) VALUES($1,$2,$3,$4,$5)',
          [rev.id,it.peca_id,it.nome_peca||it.nome||'',Number(it.quantidade),Number(it.preco_unitario)]);
      }
      totalPecas += Number(it.preco_unitario||0)*Number(it.quantidade||1);
    }
    const total = totalPecas+Number(mao_de_obra||0)-Number(desconto||0);
    await client.query("UPDATE revisoes SET status='FINALIZADA',mao_de_obra=$1,desconto=$2,total=$3,forma_pagamento=$4 WHERE id=$5",
      [Number(mao_de_obra||0),Number(desconto||0),total,forma_pagamento||null,rev.id]);
    await client.query('COMMIT');
    res.json(await db.one('SELECT * FROM revisoes WHERE id=$1', [rev.id]));
  } catch(e) { await client.query('ROLLBACK'); res.status(400).json({ error:e.message }); }
  finally { client.release(); }
});

app.get('/emplacamentos', auth, adminOnly, async (_, res) => {
  res.json(await db.q('SELECT * FROM emplacamentos ORDER BY data DESC, id DESC'));
});
app.post('/emplacamentos', auth, adminOnly, async (req, res) => {
  const { cliente, moto, cidade, data, valor, custo, forma_pagamento } = req.body;
  if (!cliente||!moto||!cidade||!data) return res.status(400).json({ error:'Dados incompletos' });
  const r = await db.one('INSERT INTO emplacamentos(cliente,moto,cidade,data,valor,custo,forma_pagamento) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [cliente,moto,cidade,data,Number(valor||0),Number(custo||0),forma_pagamento||null]);
  res.json(r);
});
app.put('/emplacamentos/:id', auth, adminOnly, async (req, res) => {
  const { cliente,moto,cidade,data,valor,custo,forma_pagamento,pago,entregue } = req.body;
  const r = await db.one('UPDATE emplacamentos SET cliente=$1,moto=$2,cidade=$3,data=$4,valor=$5,custo=$6,forma_pagamento=$7,pago=$8,entregue=$9 WHERE id=$10 RETURNING *',
    [cliente,moto,cidade,data,Number(valor||0),Number(custo||0),forma_pagamento||null,pago?1:0,entregue?1:0,req.params.id]);
  res.json(r);
});
app.delete('/emplacamentos/:id', auth, adminOnly, async (req, res) => {
  await db.run('DELETE FROM emplacamentos WHERE id=$1', [req.params.id]);
  res.json({ ok:true });
});

app.get('/financeiro', auth, adminOnly, async (req, res) => {
  const { data } = req.query;
  if (data) return res.json(await db.one('SELECT * FROM financeiro WHERE data=$1', [data]));
  res.json(await db.q('SELECT * FROM financeiro ORDER BY data DESC LIMIT 90'));
});
app.post('/financeiro', auth, adminOnly, async (req, res) => {
  const { data,saldo,a_receber,estoque_compra,estoque_venda,qtd_estoque,shineray,eduardo,fornecedor,jota_compra,jota_venda,observacao } = req.body;
  await db.run(`INSERT INTO financeiro(data,saldo,a_receber,estoque_compra,estoque_venda,qtd_estoque,shineray,eduardo,fornecedor,jota_compra,jota_venda,observacao) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(data) DO UPDATE SET saldo=$2,a_receber=$3,estoque_compra=$4,estoque_venda=$5,qtd_estoque=$6,shineray=$7,eduardo=$8,fornecedor=$9,jota_compra=$10,jota_venda=$11,observacao=$12`,
    [data,saldo||0,a_receber||0,estoque_compra||0,estoque_venda||0,qtd_estoque||0,shineray||0,eduardo||0,fornecedor||0,jota_compra||0,jota_venda||0,observacao||null]);
  res.json({ ok:true });
});

app.get('/chassi/:chassi', auth, async (req, res) => {
  const chassi = req.params.chassi.toUpperCase().trim();
  const moto = await db.one('SELECT * FROM motos WHERE chassi=$1', [chassi]);
  const cm = await db.one('SELECT * FROM cliente_motos WHERE chassi=$1 LIMIT 1', [chassi]);
  const cliente = cm ? await db.one('SELECT * FROM clientes WHERE id=$1', [cm.cliente_id]) : null;
  const clienteMotos = cliente ? await db.q('SELECT * FROM cliente_motos WHERE cliente_id=$1', [cliente.id]) : [];
  const revisoes = await db.q('SELECT * FROM revisoes WHERE chassi_moto=$1 ORDER BY created_at DESC', [chassi]);
  const vendasPecas = await db.q('SELECT * FROM vendas WHERE chassi_moto=$1 ORDER BY created_at DESC LIMIT 10', [chassi]);
  let garantia = null;
  if (moto?.data_venda) {
    const exp = new Date(moto.data_venda);
    exp.setMonth(exp.getMonth()+(moto.garantia_meses||12));
    garantia = { em_garantia:new Date()<=exp, data_expiracao:exp.toISOString().slice(0,10), dias_restantes:Math.max(0,Math.floor((exp-new Date())/86400000)) };
  }
  if (!moto&&!cliente&&revisoes.length===0) return res.status(404).json({ error:'Chassi não encontrado' });
  res.json({ moto,cliente,clienteMotos,revisoes,vendasPecas,garantia });
});
app.get('/historico-moto/:chassi', auth, async (req, res) => {
  const revisoes = await db.q('SELECT * FROM revisoes WHERE chassi_moto=$1 ORDER BY created_at DESC', [req.params.chassi.toUpperCase()]);
  for (const r of revisoes) r.itens = await db.q('SELECT * FROM revisao_itens WHERE revisao_id=$1', [r.id]);
  res.json(revisoes);
});

app.get('/agendamentos', auth, async (req, res) => {
  const { mes,ano,cidade:cidadeQ } = req.query;
  const { role,cidade:userCidade } = req.user;
  const cidadeFiltro = role==='FILIAL' ? userCidade : (cidadeQ||null);
  let sql = 'SELECT * FROM agendamentos WHERE 1=1';
  const params = []; let i=1;
  if (mes&&ano) { sql+=` AND EXTRACT(MONTH FROM CAST(data AS DATE))=$${i++} AND EXTRACT(YEAR FROM CAST(data AS DATE))=$${i++}`; params.push(Number(mes),Number(ano)); }
  if (cidadeFiltro) { sql+=` AND cidade=$${i++}`; params.push(cidadeFiltro); }
  sql += ' ORDER BY data, hora_inicio';
  res.json(await db.q(sql, params));
});
app.post('/agendamentos', auth, async (req, res) => {
  const { titulo,data,hora_inicio,hora_fim,cliente_nome,cliente_tel,chassi,modelo_moto,tipo,observacao,cor,cliente_id } = req.body;
  const { cidade } = req.user;
  if (!titulo||!data||!hora_inicio) return res.status(400).json({ error:'Dados incompletos' });
  const r = await db.one('INSERT INTO agendamentos(titulo,data,hora_inicio,hora_fim,cliente_nome,cliente_tel,chassi,modelo_moto,tipo,observacao,cor,cidade,cliente_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *',
    [titulo,data,hora_inicio,hora_fim||null,cliente_nome||null,cliente_tel||null,chassi||null,modelo_moto||null,tipo||'REVISAO',observacao||null,cor||'#3b82f6',cidade,cliente_id||null]);
  res.json(r);
});
app.put('/agendamentos/:id', auth, async (req, res) => {
  const { titulo,data,hora_inicio,hora_fim,cliente_nome,cliente_tel,chassi,modelo_moto,tipo,status,observacao,cor } = req.body;
  const r = await db.one('UPDATE agendamentos SET titulo=$1,data=$2,hora_inicio=$3,hora_fim=$4,cliente_nome=$5,cliente_tel=$6,chassi=$7,modelo_moto=$8,tipo=$9,status=$10,observacao=$11,cor=$12 WHERE id=$13 RETURNING *',
    [titulo,data,hora_inicio,hora_fim||null,cliente_nome||null,cliente_tel||null,chassi||null,modelo_moto||null,tipo||'REVISAO',status||'AGENDADO',observacao||null,cor||'#3b82f6',req.params.id]);
  res.json(r);
});
app.delete('/agendamentos/:id', auth, async (req, res) => {
  await db.run('DELETE FROM agendamentos WHERE id=$1', [req.params.id]);
  res.json({ ok:true });
});

function gerarNumeroOS(cidade) {
  return `OS-${String(cidade||'OS').toUpperCase().replace(/\s+/g,'-').slice(0,10)}-${Date.now().toString().slice(-6)}`;
}
app.get('/os', auth, async (req, res) => {
  const { status,cidade:cidadeQ } = req.query;
  const { role,cidade:userCidade } = req.user;
  const filtro = role==='FILIAL' ? userCidade : (cidadeQ||null);
  let sql = 'SELECT o.*,(SELECT COUNT(*) FROM os_itens WHERE os_id=o.id) as qtd_itens FROM ordens_servico o WHERE 1=1';
  const params = []; let i=1;
  if (status) { sql+=` AND o.status=$${i++}`; params.push(status); }
  if (filtro) { sql+=` AND o.cidade=$${i++}`; params.push(filtro); }
  sql += ' ORDER BY o.created_at DESC';
  res.json(await db.q(sql, params));
});
app.get('/os/:id', auth, async (req, res) => {
  const os = await db.one('SELECT * FROM ordens_servico WHERE id=$1', [req.params.id]);
  if (!os) return res.status(404).json({ error:'Não encontrada' });
  os.itens = await db.q('SELECT * FROM os_itens WHERE os_id=$1', [os.id]);
  if (os.cliente_id) { os.cliente=await db.one('SELECT * FROM clientes WHERE id=$1',[os.cliente_id]); os.motos_cliente=await db.q('SELECT * FROM cliente_motos WHERE cliente_id=$1',[os.cliente_id]); }
  if (os.chassi) {
    const m = await db.one('SELECT data_venda,garantia_meses FROM motos WHERE chassi=$1', [os.chassi]);
    if (m?.data_venda) { const exp=new Date(m.data_venda); exp.setMonth(exp.getMonth()+(m.garantia_meses||12)); os.garantia={ em_garantia:new Date()<=exp, data_expiracao:exp.toISOString().slice(0,10), dias_restantes:Math.max(0,Math.floor((exp-new Date())/86400000)) }; }
  }
  res.json(os);
});
app.post('/os', auth, async (req, res) => {
  const { cliente_id,cliente_nome,cliente_telefone,cliente_cpf,chassi,modelo_moto,cor_moto,ano_moto,km,tipo,problema_relatado,observacao,data_agendada,hora_agendada } = req.body;
  const { cidade } = req.user;
  if (!cliente_nome) return res.status(400).json({ error:'Nome obrigatório' });
  const numero = gerarNumeroOS(cidade);
  let emGarantia=0;
  if (chassi) { const m=await db.one('SELECT data_venda,garantia_meses FROM motos WHERE chassi=$1',[chassi]); if (m?.data_venda) { const exp=new Date(m.data_venda); exp.setMonth(exp.getMonth()+(m.garantia_meses||12)); emGarantia=new Date()<=exp?1:0; } }
  let cliId=cliente_id||null;
  if (!cliId) { const c=await db.one('SELECT id FROM clientes WHERE telefone=$1 OR nome=$2 LIMIT 1',[cliente_telefone,cliente_nome]); if (c) cliId=c.id; else { const nc=await db.one('INSERT INTO clientes(nome,cpf,telefone,cidade) VALUES($1,$2,$3,$4) RETURNING id',[cliente_nome,cliente_cpf||null,cliente_telefone||null,cidade]); cliId=nc.id; } }
  if (cliId&&chassi&&modelo_moto) { const jaTem=await db.one('SELECT id FROM cliente_motos WHERE cliente_id=$1 AND chassi=$2',[cliId,chassi]); if (!jaTem) await db.run('INSERT INTO cliente_motos(cliente_id,chassi,modelo,cor,ano) VALUES($1,$2,$3,$4,$5)',[cliId,chassi,modelo_moto||null,cor_moto||null,ano_moto||null]); }
  const r = await db.one('INSERT INTO ordens_servico(numero,cidade,tipo,cliente_id,cliente_nome,cliente_telefone,cliente_cpf,chassi,modelo_moto,cor_moto,ano_moto,km,em_garantia,problema_relatado,observacao,data_agendada,hora_agendada) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *',
    [numero,cidade,tipo||'REVISAO',cliId,cliente_nome,cliente_telefone||null,cliente_cpf||null,chassi||null,modelo_moto||null,cor_moto||null,ano_moto||null,km||null,emGarantia,problema_relatado||null,observacao||null,data_agendada||null,hora_agendada||null]);
  if (data_agendada&&hora_agendada) { try { await db.run('INSERT INTO agendamentos(titulo,data,hora_inicio,cliente_nome,cliente_tel,chassi,modelo_moto,tipo,cidade,cor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[`OS ${numero} — ${cliente_nome}`,data_agendada,hora_agendada,cliente_nome,cliente_telefone||null,chassi||null,modelo_moto||null,'REVISAO',cidade,'#3b82f6']); } catch {} }
  res.json(r);
});
app.put('/os/:id', auth, async (req, res) => {
  const { status,km,problema_relatado,servico_realizado,observacao,mao_de_obra,desconto,forma_pagamento,data_agendada,hora_agendada } = req.body;
  const r = await db.one('UPDATE ordens_servico SET status=COALESCE($1,status),km=COALESCE($2,km),problema_relatado=COALESCE($3,problema_relatado),servico_realizado=COALESCE($4,servico_realizado),observacao=COALESCE($5,observacao),mao_de_obra=COALESCE($6,mao_de_obra),desconto=COALESCE($7,desconto),forma_pagamento=COALESCE($8,forma_pagamento),data_agendada=COALESCE($9,data_agendada),hora_agendada=COALESCE($10,hora_agendada),updated_at=NOW() WHERE id=$11 RETURNING *',
    [status||null,km||null,problema_relatado||null,servico_realizado||null,observacao||null,mao_de_obra!=null?Number(mao_de_obra):null,desconto!=null?Number(desconto):null,forma_pagamento||null,data_agendada||null,hora_agendada||null,req.params.id]);
  res.json(r);
});
app.post('/os/:id/itens', auth, async (req, res) => {
  const { peca_id,nome_peca,quantidade,preco_unitario } = req.body;
  if (!nome_peca||!quantidade) return res.status(400).json({ error:'Dados incompletos' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    let baixou=0;
    if (peca_id) {
      const { cidade: userCidade } = req.user;
      const p = (await client.query('SELECT estoque,nome,cidade FROM pecas WHERE id=$1 FOR UPDATE',[peca_id])).rows[0];
      if (!p) throw new Error('Peça não encontrada');
      if (p.cidade !== userCidade) throw new Error(`Peça é da filial ${p.cidade}, não da sua filial`);
      if (p.estoque < Number(quantidade)) throw new Error('Estoque insuficiente: '+p.nome+' (disponível: '+p.estoque+')');
      await client.query('UPDATE pecas SET estoque=estoque-$1 WHERE id=$2',[Number(quantidade),peca_id]);
      baixou=1;
    }
    const r = await client.query('INSERT INTO os_itens(os_id,peca_id,nome_peca,quantidade,preco_unitario,baixou_estoque) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.params.id,peca_id||null,nome_peca,Number(quantidade),Number(preco_unitario||0),baixou]);
    const tot = (await client.query('SELECT COALESCE(SUM(preco_unitario*quantidade),0) as t FROM os_itens WHERE os_id=$1',[req.params.id])).rows[0];
    const os = (await client.query('SELECT mao_de_obra,desconto FROM ordens_servico WHERE id=$1',[req.params.id])).rows[0];
    await client.query('UPDATE ordens_servico SET total=$1 WHERE id=$2',[Number(tot.t)+Number(os.mao_de_obra||0)-Number(os.desconto||0),req.params.id]);
    await client.query('COMMIT');
    res.json(r.rows[0]);
  } catch(e) { await client.query('ROLLBACK'); res.status(400).json({ error:e.message }); }
  finally { client.release(); }
});
app.delete('/os/:osId/itens/:itemId', auth, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const it = (await client.query('SELECT * FROM os_itens WHERE id=$1 AND os_id=$2',[req.params.itemId,req.params.osId])).rows[0];
    if (!it) throw new Error('Item não encontrado');
    if (it.peca_id&&it.baixou_estoque) await client.query('UPDATE pecas SET estoque=estoque+$1 WHERE id=$2',[it.quantidade,it.peca_id]);
    await client.query('DELETE FROM os_itens WHERE id=$1',[req.params.itemId]);
    const tot = (await client.query('SELECT COALESCE(SUM(preco_unitario*quantidade),0) as t FROM os_itens WHERE os_id=$1',[req.params.osId])).rows[0];
    const os = (await client.query('SELECT mao_de_obra,desconto FROM ordens_servico WHERE id=$1',[req.params.osId])).rows[0];
    await client.query('UPDATE ordens_servico SET total=$1 WHERE id=$2',[Number(tot.t)+Number(os.mao_de_obra||0)-Number(os.desconto||0),req.params.osId]);
    await client.query('COMMIT');
    res.json({ ok:true });
  } catch(e) { await client.query('ROLLBACK'); res.status(400).json({ error:e.message }); }
  finally { client.release(); }
});
app.post('/os/:id/finalizar', auth, async (req, res) => {
  const { mao_de_obra,desconto,forma_pagamento,servico_realizado } = req.body;
  if (!forma_pagamento) return res.status(400).json({ error:'Forma de pagamento obrigatória' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const os = (await client.query('SELECT * FROM ordens_servico WHERE id=$1',[req.params.id])).rows[0];
    if (!os) throw new Error('Não encontrada');
    if (os.status==='FINALIZADA') throw new Error('Já finalizada');
    const itens = (await client.query('SELECT * FROM os_itens WHERE os_id=$1',[os.id])).rows;
    let totalPecas=0;
    for (const it of itens) {
      if (it.peca_id&&!it.baixou_estoque) {
        const p = (await client.query('SELECT estoque FROM pecas WHERE id=$1',[it.peca_id])).rows[0];
        if (!p||p.estoque<it.quantidade) throw new Error(`Estoque insuficiente: ${it.nome_peca}`);
        await client.query('UPDATE pecas SET estoque=estoque-$1 WHERE id=$2',[it.quantidade,it.peca_id]);
        await client.query('UPDATE os_itens SET baixou_estoque=1 WHERE id=$1',[it.id]);
      }
      totalPecas+=it.preco_unitario*it.quantidade;
    }
    const total=totalPecas+Number(mao_de_obra||0)-Number(desconto||0);
    await client.query("UPDATE ordens_servico SET status='FINALIZADA',mao_de_obra=$1,desconto=$2,total=$3,forma_pagamento=$4,servico_realizado=COALESCE($5,servico_realizado),updated_at=NOW() WHERE id=$6",
      [Number(mao_de_obra||0),Number(desconto||0),total,forma_pagamento,servico_realizado||null,os.id]);
    if (os.chassi) {
      try { await client.query('INSERT INTO revisoes(cidade,cliente_nome,cliente_telefone,modelo_moto,chassi_moto,km,tipo_revisao,observacao,total,forma_pagamento,status,cliente_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [os.cidade,os.cliente_nome,os.cliente_telefone||null,os.modelo_moto||null,os.chassi,os.km||null,os.tipo||'OS',servico_realizado||os.problema_relatado||null,total,forma_pagamento,'FINALIZADA',os.cliente_id||null]); } catch {}
    }
    await client.query('COMMIT');
    res.json(await db.one('SELECT * FROM ordens_servico WHERE id=$1',[os.id]));
  } catch(e) { await client.query('ROLLBACK'); res.status(400).json({ error:e.message }); }
  finally { client.release(); }
});

app.get('/admin/resumo', auth, adminOnly, async (_, res) => {
  const hoje = new Date().toISOString().slice(0,10);
  const [disp,pend,vendH,zeradas,pendencias,totalCli,totalVend] = await Promise.all([
    db.one("SELECT COUNT(*) as n FROM motos WHERE status='DISPONIVEL'"),
    db.one("SELECT COUNT(*) as n FROM motos WHERE status='PENDENTE_APROVACAO'"),
    db.one("SELECT COALESCE(SUM(total),0) as fat, COUNT(*) as qtd FROM vendas WHERE DATE(created_at)=$1",[hoje]),
    db.one("SELECT COUNT(*) as n FROM pecas WHERE estoque=0"),
    db.one("SELECT COUNT(*) as n FROM vendas_motos_pendentes WHERE status='PENDENTE'"),
    db.one("SELECT COUNT(*) as n FROM clientes"),
    db.one("SELECT COUNT(*) as n FROM motos WHERE status='VENDIDA'"),
  ]);
  res.json({ motos_disponiveis:Number(disp.n),motos_pendentes:Number(pend.n),faturamento_hoje:Number(vendH.fat),vendas_hoje:Number(vendH.qtd),pecas_zeradas:Number(zeradas.n),pendencias:Number(pendencias.n),total_clientes:Number(totalCli.n),total_motos_vendidas:Number(totalVend.n) });
});
app.get('/admin/ranking', auth, adminOnly, async (_, res) => {
  const [pecas,motos] = await Promise.all([
    db.q('SELECT cidade,COUNT(*) as qtd,COALESCE(SUM(total),0) as faturamento FROM vendas GROUP BY cidade ORDER BY faturamento DESC'),
    db.q('SELECT filial_venda as cidade,COUNT(*) as qtd,COALESCE(SUM(valor),0) as faturamento FROM vendas_motos GROUP BY filial_venda ORDER BY faturamento DESC'),
  ]);
  res.json({ pecas,motos });
});

;(async()=>{ try {
  await db.run(`CREATE TABLE IF NOT EXISTS os_checklist (id SERIAL PRIMARY KEY, os_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE, item TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OK', observacao TEXT)`);
  await db.run(`CREATE TABLE IF NOT EXISTS os_orcamento (id SERIAL PRIMARY KEY, os_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE, aprovado INTEGER NOT NULL DEFAULT 0, aprovado_em TIMESTAMPTZ, observacao TEXT)`);
  await db.run(`CREATE TABLE IF NOT EXISTS reciclagem (id SERIAL PRIMARY KEY, tipo TEXT NOT NULL DEFAULT 'FERRO', descricao TEXT, valor REAL NOT NULL DEFAULT 0, data TEXT NOT NULL, observacao TEXT, created_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.run(`CREATE TABLE IF NOT EXISTS log_atividades (id SERIAL PRIMARY KEY, usuario_id INTEGER, username TEXT, acao TEXT NOT NULL, entidade TEXT, entidade_id TEXT, descricao TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.run(`CREATE TABLE IF NOT EXISTS notificacoes (id SERIAL PRIMARY KEY, tipo TEXT NOT NULL, titulo TEXT NOT NULL, mensagem TEXT, filial TEXT, lida INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.run(`CREATE TABLE IF NOT EXISTS historico_precos (id SERIAL PRIMARY KEY, moto_id INTEGER NOT NULL, chassi TEXT, modelo TEXT, campo TEXT NOT NULL, valor_anterior REAL, valor_novo REAL, alterado_por TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`);
} catch(e) {} })();

const CHECKLIST_PADRAO = ['Óleo do motor','Filtro de óleo','Filtro de ar','Vela de ignição','Corrente e coroa','Pneu dianteiro','Pneu traseiro','Freio dianteiro','Freio traseiro','Fluido de freio','Suspensão dianteira','Suspensão traseira','Farol e lanternas','Buzina','Espelhos retrovisores','Cabo de acelerador','Cabo de embreagem','Bateria','Nível de combustível','Documentação'];

app.get('/os/:id/checklist', auth, async (req, res) => {
  let items = await db.q('SELECT * FROM os_checklist WHERE os_id=$1 ORDER BY id',[req.params.id]);
  if (items.length===0) {
    for (const item of CHECKLIST_PADRAO) await db.run('INSERT INTO os_checklist(os_id,item,status) VALUES($1,$2,$3)',[req.params.id,item,'OK']);
    items = await db.q('SELECT * FROM os_checklist WHERE os_id=$1 ORDER BY id',[req.params.id]);
  }
  res.json(items);
});
app.put('/os/:id/checklist', auth, async (req, res) => {
  const { items } = req.body;
  for (const it of items) await db.run('UPDATE os_checklist SET status=$1,observacao=$2 WHERE id=$3 AND os_id=$4',[it.status,it.observacao||null,it.id,req.params.id]);
  res.json({ ok:true });
});
app.post('/os/:id/orcamento', auth, async (req, res) => {
  const { aprovado,observacao } = req.body;
  await db.run('DELETE FROM os_orcamento WHERE os_id=$1',[req.params.id]);
  await db.run('INSERT INTO os_orcamento(os_id,aprovado,aprovado_em,observacao) VALUES($1,$2,NOW(),$3)',[req.params.id,aprovado?1:0,observacao||null]);
  if (aprovado) await db.run("UPDATE ordens_servico SET status='EM_ANDAMENTO' WHERE id=$1 AND status='ABERTA'",[req.params.id]);
  else await db.run("UPDATE ordens_servico SET status='CANCELADA' WHERE id=$1",[req.params.id]);
  res.json({ ok:true });
});
app.get('/os/:id/orcamento', auth, async (req, res) => {
  res.json(await db.one('SELECT * FROM os_orcamento WHERE os_id=$1',[req.params.id])||null);
});
app.get('/os/sugestoes/:modelo', auth, async (req, res) => {
  const { cidade } = req.user;
  const sugestoes = await db.q(`SELECT oi.nome_peca,SUM(oi.quantidade) as total,AVG(oi.preco_unitario) as preco_medio,p.id as peca_id,p.estoque,p.preco FROM os_itens oi JOIN ordens_servico os ON os.id=oi.os_id LEFT JOIN pecas p ON p.nome=oi.nome_peca AND p.cidade=$2 WHERE os.modelo_moto ILIKE $1 GROUP BY oi.nome_peca,p.id,p.estoque,p.preco ORDER BY total DESC LIMIT 8`,[`%${req.params.modelo}%`,cidade]);
  res.json(sugestoes);
});

app.get('/reciclagem', auth, adminOnly, async (req, res) => {
  const { tipo } = req.query;
  let sql='SELECT * FROM reciclagem WHERE 1=1'; const params=[];
  if (tipo) { sql+=' AND tipo=$1'; params.push(tipo); }
  sql+=' ORDER BY data DESC, created_at DESC';
  res.json(await db.q(sql,params));
});
app.post('/reciclagem', auth, adminOnly, async (req, res) => {
  const { tipo,descricao,valor,data,observacao } = req.body;
  if (!valor||!data) return res.status(400).json({ error:'Valor e data obrigatórios' });
  const r = await db.one('INSERT INTO reciclagem(tipo,descricao,valor,data,observacao,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
    [tipo||'FERRO',descricao||null,Number(valor),data,observacao||null,req.user.username]);
  res.json(r);
});
app.delete('/reciclagem/:id', auth, adminOnly, async (req, res) => {
  await db.run('DELETE FROM reciclagem WHERE id=$1',[req.params.id]);
  res.json({ ok:true });
});

app.put('/motos/:id', auth, adminOnly, async (req, res) => {
  try {
    const { modelo,cor,chassi,ano_moto,valor_compra,valor_minimo_venda,repasse,filial,santander,cnpj_empresa } = req.body;
    if (!modelo||!chassi) return res.status(400).json({ error:'Modelo e chassi obrigatorios' });
    const motoAtual = await db.one('SELECT * FROM motos WHERE id=$1',[req.params.id]);
    const r = await db.one('UPDATE motos SET modelo=$1,cor=$2,chassi=$3,ano_moto=$4,valor_compra=$5,valor_minimo_venda=$6,repasse=$7,filial=$8,santander=$9,cnpj_empresa=$10 WHERE id=$11 RETURNING *',
      [modelo,cor||null,chassi,ano_moto||null,Number(valor_compra||0),valor_minimo_venda?Number(valor_minimo_venda):null,repasse?Number(repasse):null,filial||null,santander?1:0,cnpj_empresa||null,req.params.id]);
    for (const campo of ['valor_compra','valor_minimo_venda','repasse']) {
      const vAntes=Number(motoAtual[campo]||0), vDepois=Number(r[campo]||0);
      if (vAntes!==vDepois) await db.run('INSERT INTO historico_precos(moto_id,chassi,modelo,campo,valor_anterior,valor_novo,alterado_por) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [r.id,r.chassi,r.modelo,campo,vAntes,vDepois,req.user?.username||'?']);
    }
    await registrarLog(req,'EDITAR_MOTO','motos',r.id,`${r.modelo} ${r.chassi}`);
    res.json(r);
  } catch(e) { res.status(500).json({ error:e.message }); }
});
app.delete('/motos/:id', auth, adminOnly, async (req, res) => {
  try {
    const m = await db.one('SELECT status FROM motos WHERE id=$1',[req.params.id]);
    if (!m) return res.status(404).json({ error:'Nao encontrada' });
    if (m.status==='VENDIDA') return res.status(400).json({ error:'Nao e possivel excluir moto ja vendida' });
    await db.run('DELETE FROM motos WHERE id=$1',[req.params.id]);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.get('/financeiro-dashboard', auth, adminOnly, async (req, res) => {
  try { res.json(await db.q('SELECT * FROM financeiro ORDER BY data ASC',[])); }
  catch(e) { res.status(500).json({ error:e.message }); }
});

app.get('/historico-estoque', auth, adminOnly, async (req, res) => {
  try {
    const motos = await db.q('SELECT id,chassi,valor_compra,valor_minimo_venda,status,created_at FROM motos ORDER BY created_at ASC',[]);
    const vendas = await db.q('SELECT TRIM(chassi) as chassi,data_venda FROM vendas_motos WHERE data_venda IS NOT NULL ORDER BY data_venda ASC',[]);
    const vendaMap = {};
    vendas.forEach(v=>{ const ch=(v.chassi||'').trim().toUpperCase(); if (!vendaMap[ch]) vendaMap[ch]=v.data_venda; });
    const motosEnriquecidas = motos.map(m=>({ ...m, data_venda_real: vendaMap[(m.chassi||'').trim().toUpperCase()]||null }));
    const hoje = new Date().toISOString().slice(0,10);
    const datas_criacao = motosEnriquecidas.map(m=>m.created_at?new Date(m.created_at).toISOString().slice(0,10):null).filter(Boolean).sort();
    const minDate = datas_criacao.length ? datas_criacao[0] : '2026-01-01';
    const datas=[];
    let cur=new Date(minDate);
    while (cur.toISOString().slice(0,10)<=hoje) { datas.push(cur.toISOString().slice(0,10)); cur.setDate(cur.getDate()+1); }
    const resultado = datas.map(data=>{
      const dispNoDia = motosEnriquecidas.filter(m=>{
        const criada=m.created_at?new Date(m.created_at).toISOString().slice(0,10):minDate;
        const vendida=m.data_venda_real?new Date(m.data_venda_real).toISOString().slice(0,10):null;
        if (criada>data) return false;
        if (vendida&&vendida<=data) return false;
        return true;
      });
      return { data, quantidade:dispNoDia.length, totalCompra:Math.round(dispNoDia.reduce((s,m)=>s+Number(m.valor_compra||0),0)), totalVenda:Math.round(dispNoDia.reduce((s,m)=>s+Number(m.valor_minimo_venda||0),0)) };
    });
    const filtrado = resultado.filter((r,i)=>{ if (i===0||i===resultado.length-1) return true; return r.quantidade!==resultado[i-1].quantidade; });
    res.json(filtrado);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// METAS
app.get('/metas', auth, async (req, res) => {
  try {
    const { mes,ano } = req.query;
    let sql='SELECT * FROM metas WHERE 1=1'; const params=[];
    if (mes) { params.push(Number(mes)); sql+=` AND mes=$${params.length}`; }
    if (ano) { params.push(Number(ano)); sql+=` AND ano=$${params.length}`; }
    sql+=' ORDER BY filial';
    res.json(await db.q(sql,params));
  } catch(e) { res.status(500).json({ error:e.message }); }
});
app.post('/metas', auth, adminOnly, async (req, res) => {
  try {
    const { filial,mes,ano,meta_motos,meta_valor } = req.body;
    if (!filial||!mes||!ano) return res.status(400).json({ error:'Dados incompletos' });
    const r = await db.one(`INSERT INTO metas(filial,mes,ano,meta_motos,meta_valor) VALUES($1,$2,$3,$4,$5) ON CONFLICT(filial,mes,ano) DO UPDATE SET meta_motos=$4,meta_valor=$5 RETURNING *`,
      [filial,Number(mes),Number(ano),Number(meta_motos||0),Number(meta_valor||0)]);
    res.json(r);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// LOG
app.get('/log-atividades', auth, adminOnly, async (req, res) => {
  try {
    const { limite } = req.query;
    res.json(await db.q('SELECT * FROM log_atividades ORDER BY created_at DESC LIMIT $1',[Number(limite||100)]));
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// NOTIFICAÇÕES
app.get('/notificacoes', auth, async (req, res) => {
  try {
    const { cidade,role } = req.user;
    let sql='SELECT * FROM notificacoes WHERE lida=0'; const params=[];
    if (role==='FILIAL') { params.push(cidade); sql+=` AND (filial=$1 OR filial IS NULL)`; }
    sql+=' ORDER BY created_at DESC LIMIT 20';
    res.json(await db.q(sql,params));
  } catch(e) { res.status(500).json({ error:e.message }); }
});
app.put('/notificacoes/:id/ler', auth, async (req, res) => {
  try { await db.run('UPDATE notificacoes SET lida=1 WHERE id=$1',[req.params.id]); res.json({ ok:true }); }
  catch(e) { res.status(500).json({ error:e.message }); }
});
app.put('/notificacoes/ler-todas', auth, async (req, res) => {
  try {
    const { cidade,role } = req.user;
    if (role==='FILIAL') await db.run('UPDATE notificacoes SET lida=1 WHERE filial=$1 OR filial IS NULL',[cidade]);
    else await db.run('UPDATE notificacoes SET lida=1',[]);
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// HISTÓRICO DE PREÇOS
app.get('/historico-precos/:motoId', auth, adminOnly, async (req, res) => {
  try { res.json(await db.q('SELECT * FROM historico_precos WHERE moto_id=$1 ORDER BY created_at DESC',[req.params.motoId])); }
  catch(e) { res.status(500).json({ error:e.message }); }
});

// COMISSÕES
app.get('/comissoes', auth, async (req, res) => {
  try { res.json(await db.q('SELECT * FROM comissoes ORDER BY modelo')); }
  catch(e) { res.status(500).json({ error:e.message }); }
});
app.post('/comissoes', auth, adminOnly, async (req, res) => {
  try {
    const { modelo,v30,v50,v100 } = req.body;
    if (!modelo) return res.status(400).json({ error:'Modelo obrigatório' });
    const r = await db.one(`INSERT INTO comissoes(modelo,v30,v50,v100) VALUES($1,$2,$3,$4) ON CONFLICT(modelo) DO UPDATE SET v30=$2,v50=$3,v100=$4 RETURNING *`,
      [modelo,Number(v30||0),Number(v50||0),Number(v100||0)]);
    res.json(r);
  } catch(e) { res.status(500).json({ error:e.message }); }
});
app.delete('/comissoes/:id', auth, adminOnly, async (req, res) => {
  try { await db.run('DELETE FROM comissoes WHERE id=$1',[req.params.id]); res.json({ ok:true }); }
  catch(e) { res.status(500).json({ error:e.message }); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`\n🚀 MotoNow API — porta ${PORT}`));
