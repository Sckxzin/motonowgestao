export const FILIAIS = [
  'ESCADA','IPOJUCA','RIBEIRAO','SAO JOSE','CATENDE',
  'XEXEU','MARAGOGI','IPOJUCA RICO','CHA GRANDE','TENDA','FABRICA',
];

export const FILIAIS_VENDA = [...FILIAIS, 'DIRETORIA', 'DISTRIBUIÇÃO'];

export const LOJAS_RETIRADA = [
  'ESCADA','IPOJUCA','RIBEIRAO','SAO JOSE','CATENDE',
  'XEXEU','MARAGOGI','IPOJUCA RICO','CHA GRANDE',
  'DIRETORIA','DISTRIBUIÇÃO',
];

export const VALOR_MINIMO_VENDA = {
  'PHONEIX S 50':       8500,
  'PHOENIX S 50':       8500,
  'PHOENIX 50S':        8500,
  'PHOENIX 50 S EFI':   9800,
  'JET 50':             9800,
  'NEW JET 50':         10300,
  'NEW JET 50 EFI':     10300,
  'RIO 125':            10650,
  'JET 125SS':          10500,
  'JET 125 SS':         10500,
  'NEW JET 125':        11300,
  'JET 125 EFI':        12390,
  'NEW JET EFI':        12390,
  'JEF 150S':           13990,
  'JEF 150':            13990,
  'JEF 150 EFI':        15500,
  'NEW JEF':            15000,
  'SHI 175':            14390,
  'SHI 175 CARB':       14390,
  'NEW SHI':            15600,
  'NEW SHI 175 EFI':    17200,
  'NEW SHI 175 CARB':   15600,
  'NEW SHI EFI':        17200,
  'SHI 175S EFI':       16800,
  'SHI 175 EFI':        16800,
  'FREE 150 EFI':       12000,
  'URBAN 150 EFI':      20000,
  'SHI 250 EFI':        22500,
  'STORM 200':          20390,
  'FLASH 250':          22800,
  'TITANIUM':           25428,
  'DENVER':             25428,
  'IRON':               23490,
  'IRON 250':           23490,
  'SBM 250':            0,
  'PT1':                6800,
  'PT1 S':              7000,
  'PT1S':               7000,
  'ATV 125':            15500,
  'ATV 125 EFI':        17000,
  'ATV 200':            22788,
  'ATV EFI 200':        25000,
  'NEW ATV 200 EFI':    25000,
  'NEW JET 125 EFI':    12000,
};

export function getValorMinimoVenda(modelo) {
  if (!modelo) return '';
  const m = modelo.toUpperCase().trim();
  if (VALOR_MINIMO_VENDA[m] != null) return VALOR_MINIMO_VENDA[m];
  for (const [k, v] of Object.entries(VALOR_MINIMO_VENDA)) {
    if (m.includes(k.toUpperCase()) || k.toUpperCase().includes(m)) return v;
  }
  return '';
}

export const MODELOS_MOTOS = [
  { modelo:'JET 125 SS',       motonow:8390,  santander:8900,  sant:false },
  { modelo:'SHI 175 EFI',      motonow:13790, santander:14900, sant:true  },
  { modelo:'STORM 200',        motonow:17990, santander:19100, sant:true  },
  { modelo:'JEF 150',          motonow:11090, santander:12200, sant:true  },
  { modelo:'JET 50',           motonow:7990,  santander:8500,  sant:true  },
  { modelo:'URBAN 150 EFI',    motonow:16990, santander:18100, sant:true  },
  { modelo:'NEW JET 125',      motonow:8889,  santander:9500,  sant:true  },
  { modelo:'SHI 175 CARB',     motonow:11790, santander:12900, sant:true  },
  { modelo:'IRON 250',         motonow:18490, santander:19600, sant:true  },
  { modelo:'ATV 125 EFI',      motonow:11989, santander:15000, sant:true  },
  { modelo:'NEW JEF',          motonow:11390, santander:12600, sant:true  },
  { modelo:'PHOENIX 50',      motonow:6490,  santander:7100,  sant:true  },
  { modelo:'JEF 150 EFI',      motonow:11390, santander:13800, sant:true  },
  { modelo:'NEW ATV 200 EFI',  motonow:21490, santander:23600, sant:true  },
  { modelo:'NEW SHI 175 CARB', motonow:12990, santander:14100, sant:true  },
  { modelo:'NEW SHI 175 EFI',  motonow:13990, santander:15300, sant:true  },
  { modelo:'PT1',              motonow:4790,  santander:5590,  sant:true  },
  { modelo:'PT1S',             motonow:4790,  santander:5790,  sant:true  },
  { modelo:'PT4 PRO',          motonow:7990,  santander:8300,  sant:true  },
  { modelo:'NEW JET 50',       motonow:8489,  santander:9100,  sant:true  },
  { modelo:'RIO 125 EFI',      motonow:9990,  santander:10600, sant:true  },
  { modelo:'RIO 125',          motonow:8390,  santander:8900,  sant:true  },
  { modelo:'JEF 170',          motonow:11990, santander:13100, sant:true },
  { modelo:'SHI 250 EFI',      motonow:16990, santander:18400, sant:true },
  { modelo:'SBM 150',          motonow:13989, santander:14700, sant:true },
  { modelo:'NEW JET 125 EFI',  motonow:10490, santander:11100, sant: true},
];

const REPASSE = {
  JET125SS:8900, SHI175EFI:14900, STORM200:19199, JEF150:12200, JET50:8500,
  NEWJET125:9500, URBAN150EFI:18100, IRON250:19600, ATV125EFI:16000,
  SHI175CARB:12900, NEWJEF:12600, PHOENIX50:7100, JEF150EFI:13800,
  NEWATV200EFI:23600, NEWSHI175CARB:14100, NEWSHI175EFI:15300,
  NEWJET50:9100, RIO125EFI:10600, RIO125:8900, SBM150:14700, NEWJET125EFI:11100
};

export const FILIAIS_REPASSE = ['SAO JOSE','MARAGOGI','CATENDE','XEXEU'];
export const FORMAS_PGTO = ['PIX','À VISTA','DÉBITO','CRÉDITO','GARANTIA','E-commerce'];
export const COMO_CHEGOU = ['Tenda','Veio em loja','Leads'];

function normKey(s) {
  return String(s||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/g,'');
}

export function isRepasseObrig(f) {
  return FILIAIS_REPASSE.includes(String(f||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim());
}
export function getRepasse(m) { return REPASSE[normKey(m)]; }
export function getValorCompra(modelo, santander) {
  const cfg = MODELOS_MOTOS.find(m => m.modelo === modelo);
  if (!cfg) return '';
  return santander ? cfg.santander : cfg.motonow;
}

export function formatBRL(v) {
  return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}
export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}
export function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR');
}
export function initials(n) {
  return String(n||'?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
}
export function cidadeClass(c) {
  return String(c||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').trim();
}

export function getUser() {
  try {
    const raw = localStorage.getItem('mn_user');
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d?.role) return null;
    return d;
  } catch { return null; }
}
export function isDir(u) { return (u?.role||'').toUpperCase() === 'DIRETORIA'; }
export function saveAuth(token, user) {
  localStorage.setItem('mn_token', token);
  localStorage.setItem('mn_user', JSON.stringify(user));
}
export function logout() { localStorage.clear(); }
