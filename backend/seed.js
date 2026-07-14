require('dotenv').config();
const db = require('./db');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('🌱 Populando banco...');
  await new Promise(r => setTimeout(r, 2000)); // espera o init do db.js

  const hash  = bcrypt.hashSync('admin123', 10);
  const filial = bcrypt.hashSync('filial123', 10);

  const usuarios = [
    ['diretoria','DIRETORIA','ESCADA',hash],
    ['escada',   'FILIAL',   'ESCADA',   filial],
    ['ipojuca',  'FILIAL',   'IPOJUCA',  filial],
    ['ribeirao', 'FILIAL',   'RIBEIRAO', filial],
    ['catende',  'FILIAL',   'CATENDE',  filial],
    ['saojose',  'FILIAL',   'SAO JOSE', filial],
    ['xexeu',    'FILIAL',   'XEXEU',    filial],
    ['maragogi', 'FILIAL',   'MARAGOGI', filial],
  ];

  for (const [u, r, c, p] of usuarios) {
    await db.run('INSERT INTO usuarios(username,role,cidade,password) VALUES($1,$2,$3,$4) ON CONFLICT(username) DO NOTHING', [u,r,c,p]);
  }
  console.log('✅ Usuários criados');

  const pecas = [
    ['Filtro de óleo SHI 175',   45,  12, 'ESCADA',   'SHI'],
    ['Óleo Motor 4T 20W50 1L',   38,  30, 'ESCADA',   null],
    ['Pastilha de freio JET 125',65,   8, 'ESCADA',   'JET'],
    ['Capacete Shineray M',     280,   5, 'ESCADA',   null],
    ['Vela NGK CR7E',            25,  10, 'ESCADA',   null],
    ['Luvas Shineray M',         95,   7, 'ESCADA',   null],
    ['Filtro de ar JET 125',     55,   6, 'IPOJUCA',  'JET'],
    ['Corrente 520 SHI',        120,   4, 'IPOJUCA',  'SHI'],
    ['Óleo Motor 4T 10W40 1L',   42,  18, 'RIBEIRAO', null],
    ['Pneu dianteiro 90/90-18', 180,   3, 'CATENDE',  null],
    ['Capacete Shineray G',     350,   3, 'MARAGOGI', null],
  ];
  for (const [nome,preco,estoque,cidade,tipo_moto] of pecas) {
    await db.run('INSERT INTO pecas(nome,preco,estoque,cidade,tipo_moto) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [nome,preco,estoque,cidade,tipo_moto]);
  }
  console.log('✅ Peças criadas');

  console.log('\n═══════════════════════════════════');
  console.log('  Banco populado com sucesso!');
  console.log('  diretoria / admin123');
  console.log('  escada / filial123');
  console.log('═══════════════════════════════════\n');
  process.exit(0);
}
seed().catch(e => { console.error(e); process.exit(1); });
