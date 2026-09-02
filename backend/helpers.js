// ═══════════════════════════════════════════
// FILIAIS
// ═══════════════════════════════════════════
const FILIAIS = [
  'ESCADA','IPOJUCA','RIBEIRAO','SAO JOSE','CATENDE',
  'XEXEU','MARAGOGI','IPOJUCA RICARDO','CHA GRANDE','FABRICA','TENDA',
];
const FILIAIS_REPASSE = ['SAO JOSE','MARAGOGI','CATENDE','XEXEU'];
// ═══════════════════════════════════════════
// REPASSE SANTANDER
// ═══════════════════════════════════════════
function normKey(s) {
  return String(s||'').toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^A-Z0-9]/g,'');
}
const REPASSE_MAP = {
  [normKey('JET 125 SS')]:        8900,
  [normKey('SHI 175 EFI')]:      14900,
  [normKey('STORM 200')]:        19199,
  [normKey('JEF 150')]:          12200,
  [normKey('JET 50')]:            8500,
  [normKey('NEW JET 125')]:       9500,
  [normKey('URBAN 150 EFI')]:    18100,
  [normKey('IRON 250')]:         19600,
  [normKey('ATV 125 EFI')]:      16000,
  [normKey('SHI 175 CARB')]:     12900,
  [normKey('NEW JEF')]:          12600,
  [normKey('PHOENIX 50s')]:       7100,
  [normKey('JEF 150 EFI')]:      13800,
  [normKey('NEW ATV 200 EFI')]:  23600,
  [normKey('NEW SHI 175 CARB')]: 14100,
  [normKey('NEW SHI 175 EFI')]:  15300,
  [normKey('PT1')]:               5590,
  [normKey('PT1S')]:              5790,
  [normKey('PT4 PRO')]:           8300,
  [normKey('PT3 TRICICLO')]:     11590,
  [normKey('NEW JET 50')]:        9100,
  [normKey('RIO 125')]:          10600,
  [normKey('JEF 170')]:          13100,  
  [normKey('SHI 250 EFI')]:      18400,
  [normKey('SBM 150')]:          14700,
  [normKey('NEW JET 125 EFI')]:  11100,
  [normKey('PHOENIX 50')]:       7100,
};
function isRepasseObrigatorio(filial) {
  const f = String(filial||'').toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  return FILIAIS_REPASSE.includes(f);
}
function getRepasse(modelo) {
  return REPASSE_MAP[normKey(modelo)];
}
// ═══════════════════════════════════════════
// COMISSÕES
// ═══════════════════════════════════════════
const COMISSAO = {
  [normKey('JET 125 SS')]:     { v30:10500, v50:11000, v100:11700 },
  [normKey('SHI 175 EFI')]:    { v30:16800, v50:17000, v100:18300 },
  [normKey('STORM 200')]:      { v30:20390, v50:21000, v100:22990 },
  [normKey('JEF 150')]:        { v30:13990, v50:14500, v100:15290 },
  [normKey('JET 50')]:         { v30:9800,  v50:10000, v100:10800 },
  [normKey('URBAN 150 EFI')]:  { v30:20000, v50:21000, v100:22990 },
  [normKey('NEW JET 125')]:    { v30:11300, v50:11600, v100:12390 },
  [normKey('IRON 250')]:       { v30:23490, v50:23490, v100:25839 },
  [normKey('ATV 125 EFI')]:    { v30:17000, v50:17000, v100:18700 },
  [normKey('JEF 150 EFI')]:    { v30:15500, v50:16800, v100:17160 },
};
function calcularComissao(modelo, valor) {
  const r = COMISSAO[normKey(modelo)];
  const v = Number(valor||0);
  if (!r || !v) return 30;
  if (v >= r.v100) return 100;
  if (v >= r.v50)  return 50;
  if (v >= r.v30)  return 30;
  return 30;
}
// ═══════════════════════════════════════════
// COMISSÃO SOBRE VALOR LÍQUIDO
// ═══════════════════════════════════════════
const CUSTO_CAPACETE = 145;
function calcularValorLiquido({ valor, brinde, gasolina, entrega_valor, emplacamento }) {
  return Number(valor||0)
    - (brinde ? CUSTO_CAPACETE : 0)
    - Number(gasolina||0)
    - Number(entrega_valor||0)
    - Number(emplacamento||0);
}
function tierComissao(comissaoRow, valorLiquido) {
  if (!comissaoRow) return 30;
  const v = Number(valorLiquido||0);
  if (v >= comissaoRow.v100) return 100;
  if (v >= comissaoRow.v50)  return 50;
  if (v >= comissaoRow.v30)  return 30;
  return 30;
}
// Comissão de verdade: valor da faixa + acréscimo por cada R$100 que o valor
// líquido passar do mínimo daquela faixa. tierComissao (acima) fica só pra
// mostrar o valor fixo do sistema antigo, como comparação.
const INCREMENTO_POR_TIER = { 30: 4, 50: 7, 100: 25 };
function calcularComissaoComExcedente(comissaoRow, valorLiquido) {
  if (!comissaoRow) return 30;
  const v = Number(valorLiquido||0);
  let tier, minimo;
  if (v >= comissaoRow.v100) { tier = 100; minimo = comissaoRow.v100; }
  else if (v >= comissaoRow.v50) { tier = 50; minimo = comissaoRow.v50; }
  else { tier = 30; minimo = comissaoRow.v30; }
  const excedente = Math.max(0, v - minimo);
  return Math.round((tier + INCREMENTO_POR_TIER[tier] * (excedente / 100)) * 100) / 100;
}
module.exports = { FILIAIS, isRepasseObrigatorio, getRepasse, calcularComissao, calcularValorLiquido, tierComissao, calcularComissaoComExcedente, CUSTO_CAPACETE };
