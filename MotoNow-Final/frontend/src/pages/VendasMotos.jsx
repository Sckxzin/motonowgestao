import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, formatBRL, fmtDate, FILIAIS } from '../utils';

const CIDADES_PADRAO = ['ESCADA','IPOJUCA','RIBEIRAO','SAO JOSE','CATENDE','XEXEU','MARAGOGI','IPOJUCA RICO','CHA GRANDE','TENDA'];

const TODAS_COLUNAS = [
  { key:'data',          label:'Data'          },
  { key:'modelo',        label:'Modelo'        },
  { key:'cor',           label:'Cor'           },
  { key:'chassi',        label:'Chassi'        },
  { key:'cliente',       label:'Cliente'       },
  { key:'telefone',      label:'Telefone'      },
  { key:'valor',         label:'Valor'         },
  { key:'compra',        label:'Compra'        },
  { key:'repasse',       label:'Repasse'       },
  { key:'a_repassar',   label:'A repassar'    },
  { key:'liquido',       label:'Líquido'       },
  { key:'pagamento',     label:'Pagamento'     },
  { key:'gasolina',      label:'Gasolina'      },
  { key:'filial',        label:'Filial venda'  },
  { key:'origem',        label:'Filial origem' },
  { key:'empresa',       label:'Empresa'       },
  { key:'cnpj',          label:'CNPJ'          },
  { key:'brinde',        label:'Brinde'        },
  { key:'rp',            label:'RP'            },
  { key:'rr',            label:'RR'            },
  { key:'comissao',      label:'Comissão'      },
  { key:'como_chegou',   label:'Como chegou'   },
  { key:'emplacamento',  label:'Emplacamento'  },
  { key:'acoes',         label:'Ações'         },
];

const COLS_DEFAULT = ['data','modelo','chassi','cliente','valor','compra','repasse','a_repassar','liquido','filial','empresa','comissao','rp','acoes'];

function getEmpresa(v) { return (v.santander === true || v.santander === 1) ? 'EMENEZES' : 'MOTONOW'; }
function getCNPJ(v)    { return (v.santander === true || v.santander === 1) ? '-' : (v.cnpj_empresa || '-'); }

function getARepassar(v) {
  const rep = Number(v.repasse || 0);
  if (!rep || rep <= 0) return 0;
  return Number(v.valor||0) - rep - Number(v.comissao_valor||0) - (v.brinde ? 100 : 0);
}

function getLiquido(v) {
  return Number(v.valor||0) - Number(v.valor_compra||0) - (v.brinde ? 100 : 0)
    - Number(v.gasolina||0) - Number(v.comissao_valor||0) - getARepassar(v);
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

  // Colunas (persiste localStorage)
  const [cols, setCols] = useState(() => {
    try { const s = localStorage.getItem('mn_vm_cols'); return s ? JSON.parse(s) : COLS_DEFAULT; } catch { return COLS_DEFAULT; }
  });

  useEffect(() => { try { localStorage.setItem('mn_vm_cols', JSON.stringify(cols)); } catch {} }, [cols]);

  // Modal editar
  const [edit, setEdit] = useState(null);
  const [ef, setEf]     = useState({});

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

    return true;
  }), [vendas, empresa, cidades, dataIni, dataFim, busca]);

  // Totais
  const totais = useMemo(() => {
    let fatE=0, fatM=0, repE=0, repM=0, liqE=0, liqM=0;
    filtered.forEach(v => {
      const e = getEmpresa(v) === 'EMENEZES';
      const val = Number(v.valor||0);
      const rep = getARepassar(v);
      const liq = getLiquido(v);
      if (e) { fatE+=val; repE+=rep; liqE+=liq; }
      else   { fatM+=val; repM+=rep; liqM+=liq; }
    });
    return { fatE, fatM, repE, repM, liqE, liqM };
  }, [filtered]);

  // Colunas ativas ordenadas
  const colsAtivas = useMemo(() => TODAS_COLUNAS.filter(c => cols.includes(c.key)), [cols]);

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
      case 'pagamento':   return <span style={{fontSize:11,maxWidth:180,display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.forma_pagamento||'-'}</span>;
      case 'gasolina':    return v.gasolina ? formatBRL(v.gasolina) : '-';
      case 'filial':      return v.filial_venda || '-';
      case 'origem':      return v.filial_origem || '-';
      case 'empresa':     return <span className={`badge ${getEmpresa(v)==='EMENEZES'?'b-yel':'b-blu'}`}>{getEmpresa(v)}</span>;
      case 'cnpj':        return getCNPJ(v);
      case 'brinde':      return v.brinde ? <span className="badge b-grn">SIM</span> : '-';
      case 'rp':          return v.rp ? <span className="badge b-blu">SIM</span> : '-';
      case 'rr':          return v.rr ? <span className="badge b-blu">SIM</span> : '-';
      case 'comissao':    return v.comissao_valor > 0 ? formatBRL(v.comissao_valor) : '-';
      case 'como_chegou': return v.como_chegou || '-';
      case 'emplacamento': return v.emplacamento ? <span className="badge b-grn">SIM</span> : '-';
      case 'acoes':       return <button className="ab" onClick={() => { setEdit(v); setEf({ valor:v.valor, rp:!!v.rp, rr:!!v.rr, forma_pagamento:v.forma_pagamento||'', gasolina:v.gasolina||'', brinde:!!v.brinde, comissao_valor:v.comissao_valor||0 }); }}>Editar</button>;
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
        case 'gasolina':   return Number(v.gasolina||0).toFixed(2);
        case 'comissao':   return Number(v.comissao_valor||0).toFixed(2);
        case 'empresa':    return getEmpresa(v);
        case 'brinde':     return v.brinde ? 'SIM' : 'NÃO';
        case 'rp':         return v.rp ? 'SIM' : 'NÃO';
        case 'rr':         return v.rr ? 'SIM' : 'NÃO';
        case 'emplacamento': return v.emplacamento ? 'SIM' : 'NÃO';
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
          <div style={{display:'flex',gap:8}}>
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
          <div className="tw">
            <table className="t">
              <thead>
                <tr>{colsAtivas.map(c=><th key={c.key}>{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.length===0 && <tr><td colSpan={colsAtivas.length}><div className="empty"><p>Nenhuma venda com esses filtros.</p></div></td></tr>}
                {filtered.map(v=>(
                  <tr key={v.id}>
                    {colsAtivas.map(c=><td key={c.key}>{getCellValue(v,c.key)}</td>)}
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
            <div className="mhd"><h3>Editar venda — {edit.modelo}</h3><button className="mclose" onClick={()=>setEdit(null)}>×</button></div>
            <div className="ibox"><p>Cliente: <b>{edit.nome_cliente}</b> · Chassi: <span style={{fontFamily:'var(--mono)'}}>{(edit.chassi||'').trim()}</span></p></div>
            <div className="g2">
              <div className="field"><label>Valor (R$)</label><input className="inp" type="number" step="0.01" value={ef.valor||''} onChange={e=>setEf({...ef,valor:e.target.value})} /></div>
              <div className="field"><label>Gasolina (R$)</label><input className="inp" type="number" step="0.01" value={ef.gasolina||''} onChange={e=>setEf({...ef,gasolina:e.target.value})} /></div>
            </div>
            <div className="field"><label>Forma de pagamento</label><input className="inp" value={ef.forma_pagamento||''} onChange={e=>setEf({...ef,forma_pagamento:e.target.value})} /></div>
            <div className="field"><label>Comissão (R$)</label><input className="inp" type="number" step="0.01" value={ef.comissao_valor||''} onChange={e=>setEf({...ef,comissao_valor:e.target.value})} /></div>
            <div style={{display:'flex',gap:20,marginTop:8,flexWrap:'wrap'}}>
              {[['brinde','Brinde'],['rp','RP'],['rr','RR']].map(([k,l])=>(
                <label key={k} style={{display:'flex',gap:8,alignItems:'center',fontSize:13,cursor:'pointer'}}>
                  <input type="checkbox" checked={!!ef[k]} onChange={e=>setEf({...ef,[k]:e.target.checked})} />{l}
                </label>
              ))}
            </div>
            <div className="mfoot">
              <button className="btn btn-g" onClick={()=>setEdit(null)}>Cancelar</button>
              <button className="btn btn-p" onClick={salvarEdit}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
