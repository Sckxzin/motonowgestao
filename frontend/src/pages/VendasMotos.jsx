import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, formatBRL, fmtDate, FILIAIS, calcularValorLiquido, tierComissao, calcularComissaoComExcedente, findComissaoRow } from '../utils';

const CIDADES_PADRAO = ['ESCADA','IPOJUCA','RIBEIRAO','SAO JOSE','CATENDE','XEXEU','MARAGOGI','IPOJUCA RICO','CHA GRANDE','TENDA'];

const TODAS_COLUNAS = [
  { key:'data',          label:'Data',          fixed:true,  w:88  },
  { key:'modelo',        label:'Modelo',        fixed:true,  w:110 },
  { key:'cor',           label:'Cor',           fixed:false, w:80  },
  { key:'chassi',        label:'Chassi',        fixed:false, w:160 },
  { key:'cliente',       label:'Cliente',       fixed:true,  w:140 },
  { key:'telefone',      label:'Telefone',      fixed:false, w:120 },
  { key:'valor',         label:'Valor',         fixed:true,  w:90  },
  { key:'compra',        label:'Compra',        fixed:false, w:90  },
  { key:'repasse',       label:'Repasse',       fixed:false, w:90  },
  { key:'a_repassar',   label:'A repassar',    fixed:false, w:90  },
  { key:'liquido',       label:'Líquido',       fixed:false, w:90  },
  { key:'pagamento',     label:'Pagamento',     fixed:false, w:160 },
  { key:'gasolina',      label:'Gasolina',      fixed:false, w:80  },
  { key:'entrega',       label:'Entrega',       fixed:false, w:80  },
  { key:'filial',        label:'Filial venda',  fixed:false, w:100 },
  { key:'origem',        label:'Filial origem', fixed:false, w:110 },
  { key:'empresa',       label:'Empresa',       fixed:false, w:90  },
  { key:'cnpj',          label:'CNPJ',          fixed:false, w:90  },
  { key:'brinde',        label:'Brinde',        fixed:false, w:60  },
  { key:'rp',            label:'RP',            fixed:false, w:50  },
  { key:'rr',            label:'RR',            fixed:false, w:50  },
  { key:'comissao',      label:'Comissão',      fixed:false, w:90  },
  { key:'comissao_antiga', label:'Comissão (sistema antigo)', fixed:false, w:130 },
  { key:'como_chegou',   label:'Como chegou',   fixed:false, w:110 },
  { key:'emplacamento',  label:'Emplacamento',  fixed:false, w:100 },
  { key:'acoes',         label:'Ações',         fixed:true,  w:90  },
];

const COLS_DEFAULT = ['data','modelo','chassi','cliente','valor','compra','repasse','a_repassar','liquido','filial','empresa','comissao','rp','acoes'];

function getEmpresa(v) { return (v.santander === true || v.santander === 1) ? 'EMENEZES' : 'MOTONOW'; }
function getCNPJ(v)    { return (v.santander === true || v.santander === 1) ? '-' : (v.cnpj_empresa || '-'); }

// Tabela de repasse fixo MotoNow por modelo
const REPASSE_MOTONOW = {
  'PHOENIX 50':       610, 'PHOENIX S 50':      610, 'PHOENIX 50S':       610,
  'PHOENIX 50 S EFI': 610, 'PHONEIX S 50':      610,
  'JET 50':           510,
  'RIO 125':          510,
  'JET 125SS':        510, 'JET 125 SS':        510, 'Jet 125SS':         510,
  'NEW JET 125':      600, 'New jet 125':       600, 'NEW JET 125SS':     600,
  'JET 125 EFI':      610, 'NEW JET 125 EFI':   610,
  'JEF 150S':        1110, 'JEF 150s':         1110, 'JEF 150':          1110,
  'JEF 150 EFI':     1110,
  'NEW JEF':         1210, 'NEW JEF 150':      1210,
  'SHI 175':         1110, 'SHI 175 EFI':      1110, 'SHI 175 CARB':     1110,
  'SHI 175S EFI':    1110, 'SHI 175s EFi':     1110, 'SHI 175 CARBURADA':1110,
  'NEW SHI':         1110, 'NEW SHI EFI':      1310,
  'FREE 150 EFI':     610,
  'URBAN 150 EFI':   1110, 'URBAN':            1110,
  'SHI 250 EFI':     1410,
  'STORM 200':       1110, 'STORM':            1110,
  'FLASH 250':       1410,
  'TITANIUM':        1110, 'Titanium':         1110,
  'DENVER':          1110, 'Denver':           1110,
  'IRON':            1110,
  'SBM 250':            0,
  'PT1':              800, 'PT1S':              800,
  'PT1 S':           1000,
  'ATV 125':         2810,
  'ATV 125 EFI':     3610,
  'ATV 200':         2010, 'ATV 200 EFI':      2010, 'ATV EFI 200':      2010,
};

function getRepasseFixo(modelo) {
  if (!modelo) return 0;
  const m = modelo.toUpperCase().trim();
  // Busca exata primeiro
  for (const [k, v] of Object.entries(REPASSE_MOTONOW)) {
    if (k.toUpperCase() === m) return v;
  }
  // Busca parcial
  for (const [k, v] of Object.entries(REPASSE_MOTONOW)) {
    if (m.includes(k.toUpperCase()) || k.toUpperCase().includes(m)) return v;
  }
  return 0;
}

const FILIAIS_COM_REPASSE = ['CATENDE','SAO JOSE','XEXEU','MARAGOGI'];

function temRepasseObrig(v) {
  const filial = (v.filial_venda||'').toUpperCase().trim();
  return FILIAIS_COM_REPASSE.includes(filial);
}

function getARepassar(v) {
  if (!temRepasseObrig(v)) return 0;
  const rep = Number(v.repasse || 0);
  if (!rep || rep <= 0) return 0;
  return Number(v.valor||0) - rep - (v.brinde?100:0) - Number(v.gasolina||0) - Number(v.comissao_valor||0);
}


function getLiquido(v) {
  const isEmenezes = v.santander === true || v.santander === 1;
  const val = Number(v.valor||0);
  const compra = Number(v.valor_compra||0);
  const comissao = Number(v.comissao_valor||0);
  const brinde = v.brinde ? 100 : 0;

  if (temRepasseObrig(v)) {
    if (isEmenezes) return 0; // Emenezes com repasse → líquido 0
    return getRepasseFixo(v.modelo); // MotoNow com repasse → valor tabelado
  }

  // Filiais sem repasse: cálculo normal
  return val - compra - brinde - comissao;
}

export default function VendasMotos() {
  const nav = useNavigate();
  const user = getUser();
  const { show, Toast } = useToast();

  const [vendas, setVendas]   = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [empresa,    setEmpresa]    = useState('TODAS');
  const [cidades,    setCidades]    = useState([]);
  const [dataIni,    setDataIni]    = useState('');
  const [dataFim,    setDataFim]    = useState('');
  const [busca,      setBusca]      = useState('');
  const [showCids,   setShowCids]   = useState(false);
  const [showCols,   setShowCols]   = useState(false);
  const [soDuplicados, setSoDuplicados] = useState(false);

  // Colunas (persiste localStorage)
  const [compacto, setCompacto] = useState(() => localStorage.getItem('mn_vm_compact') === '1');
  const [cols, setCols] = useState(() => {
    try { const s = localStorage.getItem('mn_vm_cols'); return s ? JSON.parse(s) : COLS_DEFAULT; } catch { return COLS_DEFAULT; }
  });

  useEffect(() => { try { localStorage.setItem('mn_vm_cols', JSON.stringify(cols)); } catch {} }, [cols]);
  useEffect(() => { localStorage.setItem('mn_vm_compact', compacto ? '1' : '0'); }, [compacto]);

  // Modal editar
  const [edit, setEdit] = useState(null);
  const [ef, setEf]     = useState({});
  const [comissoes, setComissoes] = useState([]);

  useEffect(() => { api.get('/comissoes').then(r=>setComissoes(r.data)).catch(()=>{}); }, []);
  const valorLiquidoCalculado = useMemo(() => {
    if (!edit) return 0;
    return calcularValorLiquido({ valor:ef.valor, brinde:ef.brinde, gasolina:ef.gasolina, entrega_valor:ef.entrega_valor, emplacamento:ef.emplacamento });
  }, [edit, ef.valor, ef.brinde, ef.gasolina, ef.entrega_valor, ef.emplacamento]);
  const comissaoCalculada = useMemo(() => {
    if (!edit) return 0;
    return calcularComissaoComExcedente(findComissaoRow(comissoes, ef.modelo), valorLiquidoCalculado);
  }, [edit, valorLiquidoCalculado, ef.modelo, comissoes]);
  const comissaoAntigaCalculada = useMemo(() => {
    if (!edit) return 0;
    return tierComissao(findComissaoRow(comissoes, ef.modelo), ef.valor);
  }, [edit, ef.valor, ef.modelo, comissoes]);

  // Relatório de verificação pós-exclusão de duplicados
  const [verificacao, setVerificacao] = useState(null); // array de {chassi, modelo, status, filial} | null

  useEffect(() => {
    if (!user) { nav('/'); return; }
    api.get('/vendas-motos')
      .then(r => { setVendas(r.data || []); setLoading(false); })
      .catch(e => { show(String(e), 'err'); setLoading(false); });
  }, []);

  // Filtros rápidos de data
  const hoje = () => { const d = new Date().toISOString().slice(0,10); setDataIni(d); setDataFim(d); };
  const ontem = () => { const d = new Date(); d.setDate(d.getDate()-1); const s=d.toISOString().slice(0,10); setDataIni(s); setDataFim(s); };
  const dias7 = () => { const f=new Date(); const i=new Date(); i.setDate(f.getDate()-7); setDataIni(i.toISOString().slice(0,10)); setDataFim(f.toISOString().slice(0,10)); };
  const dias30 = () => { const f=new Date(); const i=new Date(); i.setDate(f.getDate()-30); setDataIni(i.toISOString().slice(0,10)); setDataFim(f.toISOString().slice(0,10)); };
  const mesAtual = () => { const h=new Date(); setDataIni(new Date(h.getFullYear(),h.getMonth(),1).toISOString().slice(0,10)); setDataFim(new Date(h.getFullYear(),h.getMonth()+1,0).toISOString().slice(0,10)); };
  const mesPassado = () => { const h=new Date(); setDataIni(new Date(h.getFullYear(),h.getMonth()-1,1).toISOString().slice(0,10)); setDataFim(new Date(h.getFullYear(),h.getMonth(),0).toISOString().slice(0,10)); };

  function toggleCidade(v) {
    if (v === 'TODAS') { setCidades(p => p.includes('TODAS') ? [] : ['TODAS']); return; }
    setCidades(p => { const b = p.filter(x=>x!=='TODAS'); return b.includes(v) ? b.filter(x=>x!==v) : [...b,v]; });
  }

  // Chassis duplicados no histórico (mesmo chassi em mais de uma venda)
  const chassisDuplicados = useMemo(() => {
    const contagem = {};
    vendas.forEach(v => {
      const c = (v.chassi||'').trim().toUpperCase();
      if (!c) return;
      contagem[c] = (contagem[c]||0) + 1;
    });
    return new Set(Object.keys(contagem).filter(c => contagem[c] > 1));
  }, [vendas]);

  // Filtragem
  const filtered = useMemo(() => vendas.filter(v => {
    const emp = getEmpresa(v);
    const dv  = new Date(v.data_venda || v.created_at);
    const filial = (v.filial_venda || '').trim();

    if (empresa !== 'TODAS' && emp !== empresa) return false;

    if (cidades.length > 0 && !cidades.includes('TODAS')) {
      const temEspec = cidades.filter(x=>x!=='SEM_CIDADE'&&x!=='OUTRAS'&&x!=='TODAS');
      const temOutras = cidades.includes('OUTRAS');
      const temSem    = cidades.includes('SEM_CIDADE');
      const matchEspec = temEspec.includes(filial);
      const matchOutras = temOutras && filial !== '' && !CIDADES_PADRAO.includes(filial);
      const matchSem    = temSem && filial === '';
      if (!matchEspec && !matchOutras && !matchSem) return false;
    }

    if (dataIni && dv < new Date(dataIni)) return false;
    if (dataFim && dv > new Date(dataFim + 'T23:59:59')) return false;

    if (busca.trim()) {
      const t = busca.toLowerCase();
      const match = (v.chassi||'').toLowerCase().includes(t)
        || (v.modelo||'').toLowerCase().includes(t)
        || (v.nome_cliente||'').toLowerCase().includes(t)
        || (v.filial_venda||'').toLowerCase().includes(t);
      if (!match) return false;
    }

    if (soDuplicados && !chassisDuplicados.has((v.chassi||'').trim().toUpperCase())) return false;

    return true;
  }).sort((a,b)=>{
    const da = (a.data_venda||a.created_at||'').slice(0,10);
    const db2 = (b.data_venda||b.created_at||'').slice(0,10);
    return db2.localeCompare(da);
  }), [vendas, empresa, cidades, dataIni, dataFim, busca, soDuplicados, chassisDuplicados]);

  // Totais
  const totais = useMemo(() => {
    let fatE=0, fatM=0, repE=0, repM=0, liqE=0, liqM=0, bruto=0, comissao=0, comissaoAntiga=0;
    filtered.forEach(v => {
      const e = getEmpresa(v) === 'EMENEZES';
      const val = Number(v.valor||0);
      const compra = Number(v.valor_compra||0);
      const rep = getARepassar(v);
      const liq = getLiquido(v);
      if (e) { fatE+=val; repE+=rep; liqE+=liq; }
      else   { fatM+=val; repM+=rep; liqM+=liq; }
      // Bruto geral: com repasse usa líquido, sem repasse usa valor - compra
      if (temRepasseObrig(v)) {
        bruto += liq;
      } else {
        bruto += val - compra;
      }
      comissao += Number(v.comissao_valor||0);
      comissaoAntiga += tierComissao(findComissaoRow(comissoes, v.modelo), v.valor);
    });
    return { fatE, fatM, repE, repM, liqE, liqM, bruto, comissao, comissaoAntiga };
  }, [filtered, comissoes]);

  // Colunas ativas ordenadas
  const colsAtivas = useMemo(() => {
    const ativas = TODAS_COLUNAS.filter(c => cols.includes(c.key));
    // Calcula posição left acumulada para colunas fixas
    let left = 0;
    return ativas.map(col => {
      const c2 = { ...col, leftPos: col.fixed ? left : null };
      if (col.fixed) left += col.w;
      return c2;
    });
  }, [cols]);

  function toggleCol(key) {
    setCols(p => p.includes(key) ? (p.length > 1 ? p.filter(k=>k!==key) : p) : [...p, key]);
  }

  function getCellValue(v, key) {
    switch(key) {
      case 'data':        return <span style={{fontSize:12}}>{fmtDate(v.data_venda||v.created_at)}</span>;
      case 'modelo':      return <b>{v.modelo}</b>;
      case 'cor':         return v.cor || '-';
      case 'chassi':      return <span style={{fontFamily:'var(--mono)',fontSize:11}}>{(v.chassi||'').trim()}</span>;
      case 'cliente':     return v.nome_cliente || '-';
      case 'telefone':    return v.numero_cliente || '-';
      case 'valor':       return <b style={{color:'var(--grn)'}}>{formatBRL(v.valor)}</b>;
      case 'compra':      return formatBRL(v.valor_compra);
      case 'repasse':     return v.repasse ? formatBRL(v.repasse) : '-';
      case 'a_repassar':  return getARepassar(v) > 0 ? <b style={{color:'var(--red)'}}>{formatBRL(getARepassar(v))}</b> : '-';
      case 'liquido':     return <b style={{color: getLiquido(v) >= 0 ? 'var(--grn)' : 'var(--red)'}}>{formatBRL(getLiquido(v))}</b>;
      case 'pagamento': return <span style={{fontSize:11,wordBreak:'break-word'}}>{v.forma_pagamento||'—'}</span>;
      case 'gasolina':    return v.gasolina ? formatBRL(v.gasolina) : '-';
      case 'entrega':     return v.entrega_valor ? formatBRL(v.entrega_valor) : '-';
      case 'filial':      return v.filial_venda || '-';
      case 'origem':      return v.filial_origem || '-';
      case 'empresa':     return <span className={`badge ${getEmpresa(v)==='EMENEZES'?'b-yel':'b-blu'}`}>{getEmpresa(v)}</span>;
      case 'cnpj':        return getCNPJ(v);
      case 'brinde':      return v.brinde ? <span className="badge b-grn">SIM</span> : '-';
      case 'rp':          return v.rp ? <span className="badge b-blu">SIM</span> : '-';
      case 'rr':          return v.rr ? <span className="badge b-blu">SIM</span> : '-';
      case 'comissao': {
        const semFaixa = !findComissaoRow(comissoes, v.modelo);
        return <span title={semFaixa?`"${v.modelo}" sem faixa de comissão cadastrada`:undefined} style={semFaixa?{color:'var(--red)'}:undefined}>
          {v.comissao_valor > 0 ? formatBRL(v.comissao_valor) : '-'}{semFaixa?' ⚠️':''}
        </span>;
      }
      case 'comissao_antiga': {
        const antiga = tierComissao(findComissaoRow(comissoes, v.modelo), v.valor);
        return <span style={{color:'var(--tx3)'}}>{formatBRL(antiga)}</span>;
      }
      case 'como_chegou': return v.como_chegou || '-';
      case 'emplacamento': {
        const emp = Number(v.emplacamento||0);
        if (!emp) return '-';
        const venda = Number(v.valor||0);
        const resultado = venda - emp;
        return (
          <div style={{fontSize:11,lineHeight:1.5}}>
            <div style={{color:'var(--tx3)'}}>📋 {formatBRL(emp)}</div>
            <div style={{fontSize:10,color:'var(--tx3)'}}>Venda: {formatBRL(venda)}</div>
            <div style={{fontWeight:600,color:resultado>=0?'var(--grn)':'var(--red)'}}>→ {formatBRL(resultado)}</div>
          </div>
        );
      }
      case 'acoes':       return <div style={{display:'flex',gap:6}}>
        <button className="ab" onClick={() => { setEdit(v); setEf({
          modelo:v.modelo||'', cor:v.cor||'', chassi:(v.chassi||'').trim(),
          filial_venda:v.filial_venda||'', filial_origem:v.filial_origem||'',
          nome_cliente:v.nome_cliente||'', numero_cliente:v.numero_cliente||'',
          valor:v.valor||'', valor_compra:v.valor_compra||'', repasse:v.repasse||'',
          forma_pagamento:v.forma_pagamento||'', como_chegou:v.como_chegou||'',
          gasolina:v.gasolina||0, brinde:!!v.brinde, santander:!!v.santander,
          cnpj_empresa:v.cnpj_empresa||'',
          rp:!!v.rp, rr:!!v.rr, emplacamento:v.emplacamento||0, entrega_valor:v.entrega_valor||0,
          data_venda:v.data_venda?v.data_venda.slice(0,10):''
        }); }}>✏️ Editar</button>
        <button className="ab red" onClick={()=>excluirVenda(v.id)}>🗑</button>
      </div>;
      default: return '';
    }
  }

  function exportarCSV() {
    const headers = colsAtivas.filter(c=>c.key!=='acoes').map(c=>c.label);
    const rows = filtered.map(v => colsAtivas.filter(c=>c.key!=='acoes').map(c => {
      switch(c.key) {
        case 'data':       return fmtDate(v.data_venda||v.created_at);
        case 'valor':      return Number(v.valor||0).toFixed(2);
        case 'compra':     return Number(v.valor_compra||0).toFixed(2);
        case 'repasse':    return Number(v.repasse||0).toFixed(2);
        case 'a_repassar': return getARepassar(v).toFixed(2);
        case 'liquido':    return getLiquido(v).toFixed(2);
        case 'pagamento':  return v.forma_pagamento || '';
        case 'gasolina':   return Number(v.gasolina||0).toFixed(2);
        case 'entrega':    return Number(v.entrega_valor||0).toFixed(2);
        case 'comissao':   return Number(v.comissao_valor||0).toFixed(2);
        case 'comissao_antiga': return Number(tierComissao(findComissaoRow(comissoes, v.modelo), v.valor)).toFixed(2);
        case 'empresa':    return getEmpresa(v);
        case 'brinde':     return v.brinde ? 'SIM' : 'NÃO';
        case 'rp':         return v.rp ? 'SIM' : 'NÃO';
        case 'rr':         return v.rr ? 'SIM' : 'NÃO';
        case 'emplacamento': return Number(v.emplacamento||0).toFixed(2);
        case 'chassi':     return (v.chassi||'').trim();
        default:           return v[c.key] ?? '';
      }
    }));
    const csv = [headers.join(';'), ...rows.map(r => r.map(c=>`"${c}"`).join(';'))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
    a.download = 'historico_vendas_motos.csv';
    a.click();
  }

  async function excluirVenda(id) {
    if (!window.confirm('Excluir esta venda? A moto voltará para o estoque como Disponível.')) return;
    try {
      await api.delete('/vendas-motos/'+id);
      setVendas(v => v.filter(x => x.id !== id));
      show('Venda excluída!');
    } catch(e) { show(String(e),'err'); }
  }

  async function verificarEstoqueAtual() {
    if (filtered.length === 0) { show('Nenhuma venda nos filtros atuais para conferir.', 'err'); return; }
    if (filtered.length > 50 && !window.confirm(`${filtered.length} vendas nos filtros atuais. Isso vai listar bastante coisa — quer filtrar por chassi/período antes? Clique OK para continuar mesmo assim.`)) return;
    try {
      const r = await api.get('/motos');
      const estoque = r.data || [];
      const chassisAlvo = [...new Set(filtered.map(v => (v.chassi||'').trim().toUpperCase()).filter(Boolean))];
      const relatorio = chassisAlvo.map(c => {
        const m = estoque.find(x => (x.chassi||'').trim().toUpperCase() === c);
        return {
          chassi: c,
          modelo: m ? m.modelo : (filtered.find(v=>(v.chassi||'').trim().toUpperCase()===c)?.modelo || '—'),
          filial: m ? m.filial : '—',
          status: m ? m.status : 'NÃO ENCONTRADA NO ESTOQUE',
        };
      });
      setVerificacao(relatorio);
    } catch (e) { show(String(e), 'err'); }
  }

  async function excluirTodosDuplicados() {
    // Agrupa por chassi, mantém a venda mais recente (maior data_venda/created_at, desempate por maior id) de cada grupo
    const grupos = {};
    vendas.forEach(v => {
      const c = (v.chassi||'').trim().toUpperCase();
      if (!c) return;
      if (!grupos[c]) grupos[c] = [];
      grupos[c].push(v);
    });
    const paraExcluir = [];
    const mantidas = [];
    Object.values(grupos).forEach(grupo => {
      if (grupo.length < 2) return;
      const ordenado = [...grupo].sort((a,b) => {
        const da = (a.data_venda||a.created_at||'');
        const db2 = (b.data_venda||b.created_at||'');
        if (da !== db2) return db2.localeCompare(da);
        return (b.id||0) - (a.id||0);
      });
      mantidas.push(ordenado[0]);
      paraExcluir.push(...ordenado.slice(1));
    });
    if (paraExcluir.length === 0) { show('Nenhum duplicado encontrado.'); return; }
    if (!window.confirm(`Excluir ${paraExcluir.length} venda(s) duplicada(s)? Será mantida a mais recente de cada chassi. A moto continuará marcada como Vendida.`)) return;
    let ok = 0, falhas = 0;
    for (const v of paraExcluir) {
      try { await api.delete('/vendas-motos/'+v.id); ok++; }
      catch { falhas++; }
    }
    // A exclusão pode reverter a moto para "Disponível" no estoque — como ainda resta
    // uma venda válida do mesmo chassi, reforça o status de volta para VENDIDA.
    for (const v of mantidas) {
      if (!v.moto_id) continue;
      try { await api.put(`/motos/${v.moto_id}/status`, { status:'VENDIDA' }); } catch {}
    }
    setVendas(prev => prev.filter(v => !paraExcluir.some(p => p.id === v.id)));
    show(falhas === 0 ? `${ok} duplicado(s) excluído(s)!` : `${ok} excluído(s), ${falhas} falharam.`, falhas ? 'err' : undefined);

    // Verificação: busca o estoque atual e confere o status dos chassis afetados
    try {
      const r = await api.get('/motos');
      const estoque = r.data || [];
      const chassisAfetados = [...new Set(mantidas.map(v => (v.chassi||'').trim().toUpperCase()).filter(Boolean))];
      const relatorio = chassisAfetados.map(c => {
        const m = estoque.find(x => (x.chassi||'').trim().toUpperCase() === c);
        return {
          chassi: c,
          modelo: m ? m.modelo : (mantidas.find(v=>(v.chassi||'').trim().toUpperCase()===c)?.modelo || '—'),
          filial: m ? m.filial : '—',
          status: m ? m.status : 'NÃO ENCONTRADA NO ESTOQUE',
        };
      });
      setVerificacao(relatorio);
    } catch { /* verificação é best-effort; a exclusão em si já foi concluída */ }
  }

  async function salvarEdit() {
    try {
      const r = await api.put(`/vendas-motos/${edit.id}`, ef);
      setVendas(p => p.map(v => v.id===edit.id ? {...v,...r.data} : v));
      show('Salvo!'); setEdit(null);
    } catch(e) { show(String(e),'err'); }
  }

  if (!user) return null;

  const opcoesCidades = [
    { value:'TODAS', label:'Todas cidades' },
    ...CIDADES_PADRAO.map(c=>({value:c,label:c})),
    { value:'OUTRAS', label:'Outras cidades' },
    { value:'SEM_CIDADE', label:'Sem cidade' },
  ];

  return (
    <div className="page">
      {Toast}
      <Topbar />
      <div className="pc">
        <div className="sh">
          <span className="sh-t">🏍 Histórico de Vendas de Motos</span>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {chassisDuplicados.size > 0 && (
              <>
                <button className={`btn btn-sm ${soDuplicados?'btn-p':'btn-g'}`} onClick={()=>setSoDuplicados(v=>!v)}>
                  ⚠️ {soDuplicados ? 'Ver todos' : `Ver duplicados (${chassisDuplicados.size})`}
                </button>
                <button className="btn btn-sm" style={{background:'var(--red)',color:'#fff'}} onClick={excluirTodosDuplicados}>
                  🗑 Apagar duplicados
                </button>
              </>
            )}
            <button className="btn btn-g btn-sm" onClick={verificarEstoqueAtual}>🔍 Verificar estoque</button>
            <button className="btn btn-g btn-sm" onClick={()=>setShowCols(v=>!v)}>🧩 Colunas</button>
            <button className="btn btn-p btn-sm" onClick={exportarCSV}>📥 CSV</button>
          </div>
        </div>

        {/* COLUNAS */}
        {showCols && (
          <div className="card" style={{marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
              <b>Escolha as colunas</b>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                <button className="ab" onClick={()=>setCols(TODAS_COLUNAS.map(c=>c.key))}>Todas</button>
                <button className="ab" onClick={()=>setCols(COLS_DEFAULT)}>Padrão</button>
                <button className={`ab ${compacto?'act':''}`} onClick={()=>setCompacto(v=>!v)}>⬛ Compacto</button>
                <button className="ab" onClick={()=>setCols(['data','modelo','chassi','cliente','filial'])}>Básico</button>
                <button className="ab" onClick={()=>setCols(['data','modelo','valor','compra','repasse','a_repassar','liquido','comissao','rp','empresa','acoes'])}>Financeiro</button>
                <button className="ab" onClick={()=>setCols(COLS_DEFAULT)}>Reset</button>
                <button className="ab" onClick={()=>setShowCols(false)}>Fechar</button>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:8}}>
              {TODAS_COLUNAS.map(c=>(
                <label key={c.key} style={{display:'flex',gap:8,alignItems:'center',fontSize:13,cursor:'pointer'}}>
                  <input type="checkbox" checked={cols.includes(c.key)} onChange={()=>toggleCol(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* FILTROS */}
        <div className="card" style={{marginBottom:14}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 2fr',gap:10,marginBottom:12,flexWrap:'wrap'}}>
            <div className="field" style={{marginBottom:0}}>
              <label>Empresa</label>
              <select className="inp" value={empresa} onChange={e=>setEmpresa(e.target.value)}>
                <option value="TODAS">Todas</option>
                <option value="EMENEZES">Emenezes</option>
                <option value="MOTONOW">MotoNow</option>
              </select>
            </div>
            <div className="field" style={{marginBottom:0}}>
              <label>Data início</label>
              <input className="inp" type="date" value={dataIni} onChange={e=>setDataIni(e.target.value)} />
            </div>
            <div className="field" style={{marginBottom:0}}>
              <label>Data fim</label>
              <input className="inp" type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)} />
            </div>
            <div className="field" style={{marginBottom:0}}>
              <label>Buscar</label>
              <input className="inp" placeholder="Chassi, modelo, cliente ou filial..." value={busca} onChange={e=>setBusca(e.target.value)} />
            </div>
          </div>

          {/* Atalhos de data */}
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
            {[['Hoje',hoje],['Ontem',ontem],['7 dias',dias7],['30 dias',dias30],['Mês atual',mesAtual],['Mês passado',mesPassado]].map(([l,fn])=>(
              <button key={l} className="ab" onClick={fn}>{l}</button>
            ))}
            <button className="ab red" onClick={()=>{setDataIni('');setDataFim('');}}>✕ Datas</button>
            <button className="ab red" onClick={()=>setBusca('')}>✕ Busca</button>
            <button className="ab" onClick={()=>setShowCids(v=>!v)}>{showCids?'▲':'▼'} Cidades {cidades.length>0&&!cidades.includes('TODAS')?`(${cidades.length})`:''}</button>
            {cidades.length>0 && <button className="ab red" onClick={()=>setCidades([])}>✕ Cidades</button>}
          </div>

          {/* Seletor de cidades */}
          {showCids && (
            <div style={{background:'var(--s2)',borderRadius:'var(--r)',padding:'12px 14px',marginBottom:4}}>
              <div style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:10}}>
                {opcoesCidades.map(opt=>(
                  <label key={opt.value} style={{display:'flex',gap:6,alignItems:'center',fontSize:13,cursor:'pointer'}}>
                    <input type="checkbox"
                      checked={cidades.includes(opt.value)||(opt.value==='TODAS'&&cidades.includes('TODAS'))}
                      onChange={()=>toggleCidade(opt.value)} />
                    {opt.label}
                  </label>
                ))}
              </div>
              {/* Chips */}
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {cidades.length===0 && <span style={{fontSize:12,color:'var(--tx3)'}}>Mostrando todas as cidades</span>}
                {cidades.map(c=>(
                  <button key={c} onClick={()=>setCidades(p=>p.filter(x=>x!==c))}
                    style={{padding:'3px 10px',borderRadius:20,border:'1px solid var(--bd2)',background:'var(--s3)',fontSize:12,cursor:'pointer',color:'var(--tx)'}}>
                    {c} ✕
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* TOTAIS */}
        <div className="gf" style={{marginBottom:16}}>
          <div className="stat yel"><div className="sv" style={{fontSize:15}}>{formatBRL(totais.fatE)}</div><div className="sl">Fat. Emenezes</div></div>
          <div className="stat blu"><div className="sv" style={{fontSize:15}}>{formatBRL(totais.fatM)}</div><div className="sl">Fat. MotoNow</div></div>
          <div className="stat" style={{background:'rgba(249,115,22,.1)',border:'1px solid rgba(249,115,22,.25)'}}><div className="sv" style={{fontSize:15,color:'#f97316'}}>{formatBRL(totais.bruto)}</div><div className="sl" style={{color:'#f97316'}}>Bruto</div></div>
          <div className="stat" style={{background:'rgba(168,85,247,.1)',border:'1px solid rgba(168,85,247,.25)'}}><div className="sv" style={{fontSize:15,color:'#a855f7'}}>{formatBRL(totais.comissao)}</div><div className="sl" style={{color:'#a855f7'}}>Comissões</div></div>
          <div className="stat"><div className="sv" style={{fontSize:15,color:'var(--tx3)'}}>{formatBRL(totais.comissaoAntiga)}</div><div className="sl">Comissões (sistema antigo)</div></div>
          <div className="stat" style={{background: totais.comissao-totais.comissaoAntiga>=0 ? 'rgba(46,204,113,.1)' : 'rgba(230,57,70,.1)', border:`1px solid ${totais.comissao-totais.comissaoAntiga>=0?'var(--grnbd)':'var(--redbd)'}`}}>
            <div className="sv" style={{fontSize:15,color: totais.comissao-totais.comissaoAntiga>=0 ? 'var(--grn)' : 'var(--red)'}}>{totais.comissao-totais.comissaoAntiga>=0?'+':''}{formatBRL(totais.comissao-totais.comissaoAntiga)}</div>
            <div className="sl">Diferença (novo − antigo)</div>
          </div>
          <div className="stat"><div className="sv">{filtered.length}</div><div className="sl">Motos</div></div>
          <div className="stat red"><div className="sv" style={{fontSize:15}}>{formatBRL(totais.repE)}</div><div className="sl">A repassar Emenezes</div></div>
          <div className="stat red"><div className="sv" style={{fontSize:15}}>{formatBRL(totais.repM)}</div><div className="sl">A repassar MotoNow</div></div>
          <div className="stat grn"><div className="sv" style={{fontSize:15}}>{formatBRL(totais.liqE)}</div><div className="sl">Líquido Emenezes</div></div>
          <div className="stat grn"><div className="sv" style={{fontSize:15}}>{formatBRL(totais.liqM)}</div><div className="sl">Líquido MotoNow</div></div>
        </div>

        {/* TABELA */}
        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:60}}><span className="spin spin-lg" /></div>
        ) : (
          <div style={{overflowX:'auto',borderRadius:'var(--rl)',border:'1px solid var(--bd)'}}>
            <table style={{
              borderCollapse:'separate', borderSpacing:0,
              fontSize: compacto ? 11 : 13,
              whiteSpace:'nowrap',
              tableLayout:'auto',
            }}>
              <thead>
                <tr>
                  {colsAtivas.map(col => (
                    <th key={col.key} style={{
                      position: col.fixed ? 'sticky' : 'relative',
                      left: col.fixed ? col.leftPos : undefined,
                      zIndex: col.fixed ? 3 : 1,
                      background: 'var(--s2)',
                      boxShadow: col.fixed && col.key==='acoes' ? '-2px 0 0 var(--bd)' : col.fixed ? '2px 0 0 var(--bd)' : undefined,
                      minWidth: col.w,
                      padding: compacto ? '5px 8px' : '8px 12px',
                      fontSize: compacto ? 10 : 11,
                    }}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length===0 && <tr><td colSpan={colsAtivas.length}><div className="empty"><p>Nenhuma venda com esses filtros.</p></div></td></tr>}
                {filtered.map(v=>(
                  <tr key={v.id}>
                    {colsAtivas.map(col=>(
                      <td key={col.key} style={{
                        position: col.fixed ? 'sticky' : 'relative',
                        left: col.fixed ? col.leftPos : undefined,
                        zIndex: col.fixed ? 2 : 0,
                        background: 'var(--s1)',
                        boxShadow: col.fixed && col.key==='acoes' ? '-2px 0 0 var(--bd)' : col.fixed ? '2px 0 0 var(--bd)' : undefined,
                        minWidth: col.w,
                        padding: compacto ? '4px 8px' : '8px 12px',
                      }}>{getCellValue(v,col.key)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL EDITAR */}
      {edit && (
        <div className="mbg" onClick={()=>setEdit(null)}>
          <div className="mbox" onClick={e=>e.stopPropagation()}>
            <div className="mhd"><h3>✏️ Editar venda — {edit.modelo}</h3><button className="mclose" onClick={()=>setEdit(null)}>×</button></div>
            <div className="g2">
              <div className="field"><label>Modelo</label><input className="inp" value={ef.modelo} onChange={e=>setEf({...ef,modelo:e.target.value})} /></div>
              <div className="field"><label>Cor</label><input className="inp" value={ef.cor} onChange={e=>setEf({...ef,cor:e.target.value})} /></div>
            </div>
            <div className="g2">
              <div className="field"><label>Chassi</label><input className="inp" value={ef.chassi} onChange={e=>setEf({...ef,chassi:e.target.value.toUpperCase()})} /></div>
              <div className="field"><label>Data venda</label><input className="inp" type="date" value={ef.data_venda} onChange={e=>setEf({...ef,data_venda:e.target.value})} /></div>
            </div>
            <div className="g2">
              <div className="field"><label>Cliente</label><input className="inp" value={ef.nome_cliente} onChange={e=>setEf({...ef,nome_cliente:e.target.value})} /></div>
              <div className="field"><label>Telefone</label><input className="inp" value={ef.numero_cliente} onChange={e=>setEf({...ef,numero_cliente:e.target.value})} /></div>
            </div>
            <div className="g2">
              <div className="field"><label>Filial venda</label>
                <select className="inp" value={ef.filial_venda} onChange={e=>setEf({...ef,filial_venda:e.target.value})}>
                  {['ESCADA','IPOJUCA','RIBEIRAO','SAO JOSE','CATENDE','XEXEU','MARAGOGI','CHA GRANDE','DIRETORIA','DISTRIBUIÇÃO'].map(f=><option key={f}>{f}</option>)}
                </select>
              </div>
              <div className="field"><label>Filial origem</label><input className="inp" value={ef.filial_origem} onChange={e=>setEf({...ef,filial_origem:e.target.value})} /></div>
            </div>
            <div className="g2">
              <div className="field"><label>Valor venda (R$)</label><input className="inp" type="number" step="0.01" value={ef.valor} onChange={e=>setEf({...ef,valor:e.target.value})} /></div>
              <div className="field"><label>Valor compra (R$)</label><input className="inp" type="number" step="0.01" value={ef.valor_compra} onChange={e=>setEf({...ef,valor_compra:e.target.value})} /></div>
            </div>
            <div className="g2">
              <div className="field"><label>Repasse (R$)</label><input className="inp" type="number" step="0.01" value={ef.repasse} onChange={e=>setEf({...ef,repasse:e.target.value})} /></div>
              <div className="field"><label>Comissão (calculada)</label>
                <div className="inp" style={{display:'flex',alignItems:'center',fontWeight:600,color:'var(--grn)'}}>{formatBRL(comissaoCalculada)}</div>
                <div style={{fontSize:11,marginTop:4,color:'var(--tx3)'}}>Valor líquido: {formatBRL(valorLiquidoCalculado)} · Sistema antigo (valor bruto, fixo): {formatBRL(comissaoAntigaCalculada)}</div>
                {!findComissaoRow(comissoes, ef.modelo) && (
                  <div style={{fontSize:11,marginTop:4,color:'var(--red)'}}>⚠️ "{ef.modelo}" sem faixa cadastrada — usando padrão fixo R$30. Cadastre em Admin → Comissões.</div>
                )}
              </div>
            </div>
            <div className="g2">
              <div className="field"><label>Forma pagamento</label><input className="inp" value={ef.forma_pagamento} onChange={e=>setEf({...ef,forma_pagamento:e.target.value})} /></div>
              <div className="field"><label>Como chegou</label>
                <select className="inp" value={ef.como_chegou} onChange={e=>setEf({...ef,como_chegou:e.target.value})}>
                  <option value="">-</option>
                  {['Tenda','Veio em loja','Leads'].map(f=><option key={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="g2">
              <div className="field"><label>⛽ Gasolina (R$)</label><input className="inp" type="number" value={ef.gasolina} onChange={e=>setEf({...ef,gasolina:e.target.value})} /></div>
              <div className="field"><label>🛵 Entrega (R$)</label><input className="inp" type="number" step="0.01" value={ef.entrega_valor} onChange={e=>setEf({...ef,entrega_valor:e.target.value})} /></div>
            </div>
            <div className="field"><label>📋 Emplacamento (R$)</label>
              <input className="inp" type="number" step="0.01" value={ef.emplacamento} onChange={e=>setEf({...ef,emplacamento:e.target.value})} />
            </div>
            <div className="field"><label>CNPJ empresa</label><input className="inp" value={ef.cnpj_empresa} onChange={e=>setEf({...ef,cnpj_empresa:e.target.value})} /></div>
            <div style={{display:'flex',gap:20,marginTop:8,flexWrap:'wrap'}}>
              {[['brinde','🎁 Brinde'],['rp','RP'],['rr','RR'],['santander','Santander']].map(([k,l])=>(
                <label key={k} style={{display:'flex',gap:8,alignItems:'center',fontSize:13,cursor:'pointer'}}>
                  <input type="checkbox" checked={!!ef[k]} onChange={e=>setEf({...ef,[k]:e.target.checked})} />{l}
                </label>
              ))}
            </div>
            <div className="mfoot">
              <button className="btn btn-g" onClick={()=>setEdit(null)}>Cancelar</button>
              <button className="btn btn-p" onClick={salvarEdit}>💾 Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VERIFICAÇÃO PÓS-EXCLUSÃO DE DUPLICADOS */}
      {verificacao && (
        <div className="mbg" onClick={()=>setVerificacao(null)}>
          <div className="mbox" onClick={e=>e.stopPropagation()}>
            <div className="mhd"><h3>🔍 Status das motos no estoque</h3><button className="mclose" onClick={()=>setVerificacao(null)}>×</button></div>
            <p style={{fontSize:12,color:'var(--tx3)',marginBottom:12}}>Status atual no estoque dos chassis do histórico filtrado. Vendas concluídas deveriam aparecer como <b style={{color:'var(--grn)'}}>VENDIDA</b>.</p>
            {verificacao.length === 0 && <p style={{fontSize:13,color:'var(--tx3)'}}>Nenhum chassi para conferir.</p>}
            {verificacao.map(r => {
              const ok = r.status === 'VENDIDA';
              return (
                <div key={r.chassi} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,padding:'8px 12px',marginBottom:6,borderRadius:'var(--r)',background: ok ? 'var(--grndim)' : 'var(--reddim)',border:`1px solid ${ok?'var(--grnbd)':'var(--redbd)'}`}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600}}>{r.modelo} <span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--tx3)',fontWeight:400}}>{r.chassi}</span></div>
                    <div style={{fontSize:11,color:'var(--tx3)'}}>{r.filial}</div>
                  </div>
                  <span className={`badge ${ok?'b-grn':'b-red'}`}>{r.status}</span>
                </div>
              );
            })}
            <div className="mfoot">
              <button className="btn btn-p" onClick={()=>setVerificacao(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
