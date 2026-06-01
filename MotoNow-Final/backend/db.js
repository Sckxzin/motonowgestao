const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// helpers para manter a mesma interface do SQLite
pool.q   = (sql, p=[]) => pool.query(sql, p).then(r => r.rows);
pool.one = (sql, p=[]) => pool.query(sql, p).then(r => r.rows[0] || null);
pool.run = (sql, p=[]) => pool.query(sql, p);

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY, username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'FILIAL',
      cidade TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY, nome TEXT NOT NULL, cpf TEXT,
      telefone TEXT, cidade TEXT, observacao TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS cliente_motos (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      chassi TEXT, modelo TEXT, cor TEXT, ano INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS motos (
      id SERIAL PRIMARY KEY, modelo TEXT NOT NULL, cor TEXT NOT NULL,
      chassi TEXT NOT NULL UNIQUE, filial TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DISPONIVEL',
      santander INTEGER NOT NULL DEFAULT 0, cnpj_empresa TEXT,
      ano_moto INTEGER, valor_compra REAL, valor_minimo_venda REAL,
      repasse REAL, garantia_meses INTEGER DEFAULT 12,
      negociacao_por INTEGER, negociacao_em TIMESTAMPTZ,
      data_venda TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pecas (
      id SERIAL PRIMARY KEY, nome TEXT NOT NULL,
      preco REAL NOT NULL DEFAULT 0, estoque INTEGER NOT NULL DEFAULT 0,
      cidade TEXT NOT NULL, tipo_moto TEXT, modelos_compativeis TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS vendas (
      id SERIAL PRIMARY KEY, cliente_nome TEXT NOT NULL,
      cliente_telefone TEXT, forma_pagamento TEXT NOT NULL,
      total REAL NOT NULL DEFAULT 0, cidade TEXT NOT NULL,
      observacao TEXT, modelo_moto TEXT, chassi_moto TEXT, km TEXT,
      cliente_id INTEGER REFERENCES clientes(id),
      rp INTEGER NOT NULL DEFAULT 0, rr INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS venda_itens (
      id SERIAL PRIMARY KEY, venda_id INTEGER NOT NULL REFERENCES vendas(id),
      peca_id INTEGER REFERENCES pecas(id),
      nome_peca TEXT NOT NULL, quantidade INTEGER NOT NULL,
      preco_unitario REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS vendas_motos_pendentes (
      id SERIAL PRIMARY KEY, moto_id INTEGER NOT NULL REFERENCES motos(id),
      modelo TEXT, cor TEXT, chassi TEXT,
      filial_origem TEXT, filial_venda TEXT NOT NULL,
      nome_cliente TEXT NOT NULL, cpf TEXT, telefone TEXT,
      numero_cliente TEXT, valor REAL NOT NULL,
      forma_pagamento TEXT, brinde INTEGER NOT NULL DEFAULT 0,
      gasolina REAL, como_chegou TEXT, local_retirada TEXT,
      filial_retirada TEXT, santander INTEGER DEFAULT 0,
      cnpj_empresa TEXT, valor_compra REAL, repasse REAL,
      comissao_valor REAL DEFAULT 0,
      cliente_id INTEGER REFERENCES clientes(id),
      status TEXT NOT NULL DEFAULT 'PENDENTE',
      motivo_recusa TEXT, aprovado_por TEXT,
      aprovado_em TIMESTAMPTZ, data_venda TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS vendas_motos (
      id SERIAL PRIMARY KEY, moto_id INTEGER,
      modelo TEXT, cor TEXT, chassi TEXT,
      filial_origem TEXT, filial_venda TEXT,
      nome_cliente TEXT, cpf TEXT, telefone TEXT,
      numero_cliente TEXT, valor REAL, forma_pagamento TEXT,
      brinde INTEGER DEFAULT 0, gasolina REAL, como_chegou TEXT,
      local_retirada TEXT, filial_retirada TEXT,
      santander INTEGER DEFAULT 0, cnpj_empresa TEXT,
      valor_compra REAL, repasse REAL,
      comissao_valor REAL DEFAULT 0,
      rp INTEGER DEFAULT 0, rr INTEGER DEFAULT 0,
      data_venda TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS revisoes (
      id SERIAL PRIMARY KEY, cidade TEXT NOT NULL,
      cliente_nome TEXT NOT NULL, cliente_telefone TEXT,
      cliente_cpf TEXT, modelo_moto TEXT, chassi_moto TEXT,
      km TEXT, tipo_revisao TEXT, observacao TEXT,
      status TEXT NOT NULL DEFAULT 'ABERTA',
      total REAL, forma_pagamento TEXT,
      mao_de_obra REAL DEFAULT 0, desconto REAL DEFAULT 0,
      cliente_id INTEGER REFERENCES clientes(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS revisao_itens (
      id SERIAL PRIMARY KEY,
      revisao_id INTEGER NOT NULL REFERENCES revisoes(id),
      peca_id INTEGER REFERENCES pecas(id),
      nome_peca TEXT NOT NULL, quantidade INTEGER NOT NULL,
      preco_unitario REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS emplacamentos (
      id SERIAL PRIMARY KEY, cliente TEXT NOT NULL,
      moto TEXT NOT NULL, cidade TEXT NOT NULL, data TEXT NOT NULL,
      valor REAL NOT NULL DEFAULT 0, custo REAL NOT NULL DEFAULT 0,
      forma_pagamento TEXT,
      pago INTEGER NOT NULL DEFAULT 0, entregue INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS transferencias_pecas (
      id SERIAL PRIMARY KEY, peca_id INTEGER, nome_peca TEXT,
      filial_origem TEXT, filial_destino TEXT, quantidade INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS transferencias_motos (
      id SERIAL PRIMARY KEY, moto_id INTEGER, modelo TEXT,
      chassi TEXT, filial_origem TEXT, filial_destino TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS financeiro (
      id SERIAL PRIMARY KEY, data TEXT NOT NULL UNIQUE,
      saldo REAL DEFAULT 0, a_receber REAL DEFAULT 0,
      estoque_compra REAL DEFAULT 0, estoque_venda REAL DEFAULT 0,
      qtd_estoque INTEGER DEFAULT 0, shineray REAL DEFAULT 0,
      eduardo REAL DEFAULT 0, fornecedor REAL DEFAULT 0,
      jota_compra REAL DEFAULT 0, jota_venda REAL DEFAULT 0,
      observacao TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS agendamentos (
      id SERIAL PRIMARY KEY, titulo TEXT NOT NULL,
      data TEXT NOT NULL, hora_inicio TEXT NOT NULL DEFAULT '08:00',
      hora_fim TEXT, cliente_nome TEXT, cliente_tel TEXT,
      chassi TEXT, modelo_moto TEXT,
      tipo TEXT NOT NULL DEFAULT 'REVISAO',
      status TEXT NOT NULL DEFAULT 'AGENDADO',
      cor TEXT DEFAULT '#3b82f6', observacao TEXT,
      cidade TEXT NOT NULL,
      cliente_id INTEGER REFERENCES clientes(id),
      revisao_id INTEGER REFERENCES revisoes(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ordens_servico (
      id SERIAL PRIMARY KEY, numero TEXT NOT NULL UNIQUE,
      cidade TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ABERTA',
      tipo TEXT NOT NULL DEFAULT 'REVISAO',
      cliente_id INTEGER REFERENCES clientes(id),
      cliente_nome TEXT NOT NULL, cliente_telefone TEXT, cliente_cpf TEXT,
      chassi TEXT, modelo_moto TEXT, cor_moto TEXT, ano_moto INTEGER,
      km TEXT, em_garantia INTEGER NOT NULL DEFAULT 0,
      mao_de_obra REAL DEFAULT 0, desconto REAL DEFAULT 0,
      total REAL DEFAULT 0, forma_pagamento TEXT,
      data_agendada TEXT, hora_agendada TEXT,
      problema_relatado TEXT, servico_realizado TEXT, observacao TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS os_itens (
      id SERIAL PRIMARY KEY,
      os_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
      peca_id INTEGER REFERENCES pecas(id),
      nome_peca TEXT NOT NULL, quantidade INTEGER NOT NULL DEFAULT 1,
      preco_unitario REAL NOT NULL DEFAULT 0,
      baixou_estoque INTEGER NOT NULL DEFAULT 0
    );
  `);
  console.log('✅ Banco inicializado');
}

init().catch(e => { console.error('❌ Erro DB:', e.message); process.exit(1); });

module.exports = pool;

// Migração: campo emplacamento nas vendas
try { db.prepare('ALTER TABLE vendas_motos ADD COLUMN emplacamento INTEGER DEFAULT 0').run(); } catch(e) {}
try { db.prepare('ALTER TABLE vendas_motos_pendentes ADD COLUMN emplacamento INTEGER DEFAULT 0').run(); } catch(e) {}
