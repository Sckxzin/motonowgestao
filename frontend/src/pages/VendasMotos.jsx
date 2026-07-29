import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, isDir, formatBRL, fmtDate, FILIAIS, FILIAIS_VENDA, FORMAS_PGTO } from '../utils';

const COLS_DEFAULT = ['data','modelo','chassi','cliente','valor','compra','repasse','a_repassar','liquido','filial','empresa','comissao','rp','acoes'];

function getEmpresa(v) { return (v.santander === true || v.santander === 1) ? 'EMENEZES' : 'MOTONOW'; }

const REPASSE_MOTONOW = {
  'PHOENIX 50':610,'PHOENIX S 50':610,'PHOENIX 50S':610,'PHOENIX 50 S EFI':610,'PHONEIX S 50':610,
  'JET 50':510,'RIO 125':510,'JET 125SS':510,'JET 125 SS':510,'NEW JET 50':510,
  'NEW JET 125':600,'NEW JET 125 EFI':610,'JET 125 EFI':610,
  'JEF 150S':1110,'JEF 150':1110,'JEF 150 EFI':1110,
  'NEW JEF':1210,'NEW JEF 150':1210,
  'SHI 175':1110,'SHI 175 EFI':1110,'SHI 175 CARB':1110,'SHI 175S EFI':1110,
  'NEW SHI':1110,'NEW SHI EFI':1310,'NEW SHI 175 EFI':1310,'NEW SHI 175 CARB':1110,
  'FREE 150 EFI':610,'URBAN 150 EFI':1110,'URBAN':1110,
  'SHI 250 EFI':1410,'STORM 200':1110,'STORM':1110,'FLASH 250':1410,
  'TITANIUM':1110,'DENVER':1110,'IRON':1110,'IRON 250':1110,'SBM 250':0,
  'PT1':800,'PT1 S':1000,'PT1S':1000,
  'ATV 125':2810,'ATV 125 EFI':3610,'ATV 200':2010,'ATV EFI 200':2010,'NEW ATV 200 EFI':2010,
};

function getRepasseFixo(modelo) {
  if (!modelo) return 0;
  const m = modelo.toUpperCase().trim();
  for (const [k,v] of Object.entries(REPASSE_MOTONOW)) if (k.toUpperCase()===m) return v;
  for (const [k,v] of Object.entries(REPASSE_MOTONOW)) if (m.includes(k.toUpperCase())||k.toUpperCase().includes(m)) return v;
  return 0;
}

const FILIAIS_COM_REPASSE = ['CATENDE','SAO JOSE','XEXEU','MARAGOGI'];

function temRepasseObrig(v) {
  return FILIAIS_COM_REPASSE.includes((v.filial_venda||'').toUpperCase().trim());
}

function getARepassar(v) {
  if (!temRepasseObrig(v)) return 0;
  const rep = Number(v.repasse || 0);
  if (!rep || rep <= 0) return 0;
  return Number(v.valor||0) - rep - (v.brinde?100:0) - Number(v.gasolina||0) - Number(v.comissao_valor||0);
}

function getLiquido(v) {
  const isEmenezes = v.santander === true || v.santander === 1;
  const val = Number(v.valor||0), compra = Number(v.valor_compra||0), comissao = Number(v.comissao_valor||0), brinde = v.brinde ? 100 : 0;
  if (temRepasseObrig(v)) { if (isEmenezes) return 0; return getRepasseFixo(v.modelo); }
  return val - compra - brinde - comissao;
}

function getBruto(v) {
  return temRepasseObrig(v) ? getLiquido(v) : Number(v.valor||0) - Number(v.valor_compra||0);
}

const ALL_COLS = [
  { key:'data',        label:'Data',         fixed:true,  w:90  },
  { key:'modelo',      label:'Modelo',        fixed:true,  w:160 },
  { key:'chassi',      label:'Chassi',        fixed:false, w:160 },
  { key:'cliente',     label:'Cliente',       fixed:true,  w:160 },
  { key:'valor',       label:'Venda',         fixed:false, w:100 },
  { key:'compra',      label:'Compra',        fixed:false, w:100 },
  { key:'repasse',     label:'Repasse',       fixed:false, w:100 },
  { key:'a_repassar',  label:'A repassar',    fixed:false, w:110 },
  { key:'liquido',     label:'Líquido',       fixed:false, w:110 },
  { key:'filial',      label:'Filial',        fixed:false, w:110 },
  { key:'empresa',     label:'Empresa',       fixed:false, w:90  },
  { key:'comissao',    label:'Comissão',      fixed:false, w:90  },
  { key:'emplacamento',label:'Emplacamento',  fixed:false, w:130 },
  { key:'gasolina',    label:'Gasolina',      fixed:false, w:90  },
  { key:'brinde',      label:'Brinde',        fixed:false, w:70  },
  { key:'pagamento',   label:'Pagamento',     fixed:false, w:180 },
  { key:'chegou',      label:'Como chegou',   fixed:false, w:120 },
  { key:'rp',          label:'RP',            fixed:false, w:50  },
  { key:'rr',          label:'RR',            fixed:false, w:50  },
  { key:'acoes',       label:'Ações',         fixed:true,  w:80  },
];

export default function VendasMotos() {
  const nav = useNavigate();
  const user = getUser();
  const { show, Toast } = useToast();

  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null);
  const [ef, setEf] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [cols, setCols] = useState(COLS_DEFAULT);
  const [compacto, setCompacto] = useState(false);
  const [showColSel, setShowColSel] = useState(false);

  const [filtFiliais, setFiltFiliais] = useState([]);
  const [filtEmpresa, setFiltEmpresa] = useState('TODAS');
  const [filtDi, setFiltDi] = useState('');
  const [filtDf, setFiltDf] = useState('');
  const [filtBusca, setFiltBusca] = useState('');
  const [atalhoAtivo, setAtalhoAtivo] = useState('');

  const ATALHOS = [
    {label:'Hoje',        fn:()=>{ const d=new Date().toISOString().slice(0,10); return [d,d]; }},
    {label:'Ontem',       fn:()=>{ const d=new Date(Date.now()-86400000).toISOString().slice(0,10); return [d,d]; }},
    {label:'7 dias',      fn:()=>{ const e=new Date().toISOString().slice(0,10); const i=new Date(Date.now()-6*86400000).toISOString().slice(0,10); return [i,e]; }},
    {label:'30 dias',     fn:()=>{ const e=new Date().toISOString().slice(0,10); const i=new Date(Date.now()-29*86400000).toISOString().slice(0,10); return [i,e]; }},
    {label:'Mês atual',   fn:()=>{ const n=new Date(); const i=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`; const e=new Date(n.getFullYear(),n.getMonth()+1,0).toISOString().slice(0,10); return [i,e]; }},
    {label:'Mês passado', fn:()=>{ const n=new Date(); const m=n.getMonth()===0?new Date(n.getFullYear()-1,11,1):new Date(n.getFullYear(),n.getMonth()-1,1); const i=m.toISOString().slice(0,10); const e=new Date(m.getFullYear(),m.getMonth()+1,0).toISOString().slice(0,10); return [i,e]; }},
  ];

  useEffect(() => {
    function fecharDd(e) {
      const dd = document.getElementById('filial-dd');
      if (dd && !dd.contains(e.target) && !e.target.closest('[onclick]')) dd.classList.add('hidden');
    }
    document.addEventListener('mousedown', fecharDd);
    return () => document.removeEventListener('mousedown', fecharDd);
  }, []);

  useEffect(() => {
    if (!user) nav('/');
    api.get('/vendas-motos').then(r => { setVendas(r.data||[]); setLoading(false); }).catch(e => { show(String(e),'err'); setLoading(false); });
  }, []);

  function aplicarAtalho(label, fn) {
    const [i, e] = fn();
    setFiltDi(i); setFiltDf(e); setAtalhoAtivo(label);
  }

  const filtered = useMemo(() => vendas.filter(v => {
    if (filtFiliais.length > 0 && !filtFiliais.includes(v.filial_venda)) return false;
    if (filtEmpresa !== 'TODAS' && getEmpresa(v) !== filtEmpresa) return false;
    const data = (v.data_venda||v.created_at||'').slice(0,10);
    if (filtDi && data < filtDi) return false;
    if (filtDf && data > filtDf) return false;
    if (filtBusca) {
      const q = filtBusca.toLowerCase();
      if (!(v.nome_cliente||'').toLowerCase().includes(q) &&
          !(v.chassi||'').toLowerCase().includes(q) &&
          !(v.modelo||'').toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a,b) => {
    const da = (a.data_venda||a.created_at||'').slice(0,10);
    const db2 = (b.data_venda||b.created_at||'').slice(0,10);
    return db2.localeCompare(da);
  }), [vendas, filtFiliais, filtEmpresa, filtDi, filtDf, filtBusca]);

  const totais = useMemo(() => {
    let fatE=0, fatM=0, repE=0, repM=0, liqE=0, liqM=0, bruto=0, comissao=0;
    filtered.forEach(v => {
      const e = getEmpresa(v) === 'EMENEZES';
      const val = Number(v.valor||0);
      const rep = getARepassar(v);
      const liq = getLiquido(v);
      if (e) { fatE+=val; repE+=rep; liqE+=liq; }
      else   { fatM+=val; repM+=rep; liqM+=liq; }
      bruto += temRepasseObrig(v) ? liq : val - Number(v.valor_compra||0);
      comissao += Number(v.comissao_valor||0);
    });
    return { fatE, fatM, repE, repM, liqE, liqM, bruto, comissao };
  }, [filtered]);

  function getCellValue(v, key) {
    switch(key) {
      case 'data':       return <span style={{fontSize:11}}>{fmtDate(v.data_venda||v.created_at)}</span>;
      case 'modelo':     return <b style={{fontSize:12}}>{v.modelo}</b>;
      case 'chassi':     return <span style={{fontFamily:'var(--mono)',fontSize:11}}>{v.chassi}</span>;
      case 'cliente':    return <span style={{fontSize:12}}>{v.nome_cliente}</span>;
      case 'valor':      return <b style={{color:'var(--grn)',fontSize:12}}>{formatBRL(v.valor)}</b>;
      case 'compra':     return <span style={{fontSize:12,color:'var(--tx3)'}}>{formatBRL(v.valor_compra)}</span>;
      case 'repasse':    return <span style={{fontSize:12}}>{v.repasse ? formatBRL(v.repasse) : '—'}</span>;
      case 'a_repassar': {
        const ar = getARepassar(v);
        return ar ? <b style={{color:'var(--red)',fontSize:12}}>{formatBRL(ar)}</b> : <span style={{color:'var(--tx3)'}}>—</span>;
      }
      case 'liquido': {
        const liq = getLiquido(v);
        return <b style={{color: liq >= 0 ? 'var(--grn)' : 'var(--red)', fontSize:12}}>{formatBRL(liq)}</b>;
      }
      case 'filial':   return <span style={{fontSize:11}}>{v.filial_venda}</span>;
      case 'empresa':  return <span className={`badge ${getEmpresa(v)==='EMENEZES'?'b-yel':'b-gray'}`} style={{fontSize:10}}>{getEmpresa(v)}</span>;
      case 'comissao': return <span style={{fontSize:12,color:'#a855f7'}}>{v.comissao_valor ? formatBRL(v.comissao_valor) : '—'}</span>;
      case 'emplacamento': {
        const emp = Number(v.emplacamento||0);
        if (!emp) return <span style={{color:'var(--tx3)'}}>—</span>;
        const resultado = Number(v.valor||0) - emp;
        return (
          <div style={{fontSize:11,lineHeight:1.5}}>
            <div style={{color:'var(--tx3)'}}>📋 {formatBRL(emp)}</div>
            <div style={{fontSize:10,color:'var(--tx3)'}}>Venda: {formatBRL(v.valor)}</div>
            <div style={{fontWeight:600,color:resultado>=0?'var(--grn)':'var(--red)'}}>→ {formatBRL(resultado)}</div>
          </div>
        );
      }
      case 'gasolina': return v.gasolina ? <span style={{fontSize:12}}>{formatBRL(v.gasolina)}</span> : <span style={{color:'var(--tx3)'}}>—</span>;
      case 'brinde':   return v.brinde ? <span className="badge b-yel" style={{fontSize:10}}>SIM</span> : <span style={{color:'var(--tx3)'}}>—</span>;
      case 'pagamento': return <span style={{fontSize:11,wordBreak:'break-word'}}>{v.forma_pagamento||'—'}</span>;
      case 'chegou':   return <span style={{fontSize:11}}>{v.como_chegou||'—'}</span>;
      case 'rp':       return v.rp ? <span className="badge b-grn" style={{fontSize:10}}>RP</span> : '—';
      case 'rr':       return v.rr ? <span className="badge b-grn" style={{fontSize:10}}>RR</span> : '—';
      case 'acoes':    return (
        <div style={{display:'flex',gap:4}}>
          <button className="ab" onClick={()=>{
            setEdit(v);
            setEf({
              modelo:v.modelo,cor:v.cor,chassi:v.chassi,filial_venda:v.filial_venda,filial_origem:v.filial_origem,
              nome_cliente:v.nome_cliente,numero_cliente:v.numero_cliente,valor:v.valor,valor_compra:v.valor_compra,
              repasse:v.repasse,forma_pagamento:v.forma_pagamento||'',como_chegou:v.como_chegou||'',
              brinde:!!v.brinde,gasolina:v.gasolina||'',santander:!!v.santander,cnpj_empresa:v.cnpj_empresa||'',
              comissao_valor:v.comissao_valor||'',rp:!!v.rp,rr:!!v.rr,emplacamento:v.emplacamento||'',
              data_venda:v.data_venda||(v.created_at||'').slice(0,10),
            });
          }}>✏️</button>
          <button className="ab red" onClick={()=>setDeleting(v)}>🗑</button>
        </div>
      );
      default: return '—';
    }
  }

  async function salvarEdit() {
    setSaving(true);
    try {
      const r = await api.put(`/vendas-motos/${edit.id}`, ef);
      setVendas(prev => prev.map(v => v.id===edit.id ? {...v,...r.data} : v));
      show('Salvo!'); setEdit(null);
    } catch(e) { show(String(e),'err'); }
    finally { setSaving(false); }
  }

  async function deletarVenda() {
    try {
      await api.delete(`/vendas-motos/${deleting.id}`);
      setVendas(prev => prev.filter(v => v.id !== deleting.id));
      show('Venda excluída!'); setDeleting(null);
    } catch(e) { show(String(e),'err'); }
  }

  const colDefs = ALL_COLS.filter(c => cols.includes(c.key));

  if (!user) return null;

  return (
    <div className="page">{Toast}<Topbar />
      <div className="pc">
        <div className="sh">
          <span className="sh-t">🏍 Histórico de Vendas de Motos</span>
          <div style={{display:'flex',gap:6}}>
            <button className={`btn btn-sm ${compacto?'btn-p':'btn-g'}`} onClick={()=>setCompacto(c=>!c)}>{compacto?'Expandir':'Compacto'}</button>
            <button className="btn btn-g btn-sm" onClick={()=>setShowColSel(s=>!s)}>⚙️ Colunas</button>
          </div>
        </div>

        {showColSel && (
          <div className="card card-sm" style={{marginBottom:14}}>
            <div style={{fontSize:12,color:'var(--tx3)',marginBottom:8}}>Selecione as colunas visíveis:</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {ALL_COLS.map(c=>(
                <label key={c.key} style={{display:'flex',gap:5,alignItems:'center',fontSize:12,cursor:'pointer'}}>
                  <input type="checkbox" checked={cols.includes(c.key)} disabled={c.fixed}
                    onChange={e=>setCols(prev=>e.target.checked?[...prev,c.key]:prev.filter(k=>k!==c.key))} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="gf" style={{marginBottom:14}}>
          <div className="stat yel"><div className="sv" style={{fontSize:15}}>{formatBRL(totais.fatE)}</div><div className="sl">Fat. Emenezes</div></div>
          <div className="stat blu"><div className="sv" style={{fontSize:15}}>{formatBRL(totais.fatM)}</div><div className="sl">Fat. MotoNow</div></div>
          <div className="stat" style={{background:'rgba(249,115,22,.1)',border:'1px solid rgba(249,115,22,.25)'}}><div className="sv" style={{fontSize:15,color:'#f97316'}}>{formatBRL(totais.bruto)}</div><div className="sl" style={{color:'#f97316'}}>Bruto</div></div>
          <div className="stat" style={{background:'rgba(168,85,247,.1)',border:'1px solid rgba(168,85,247,.25)'}}><div className="sv" style={{fontSize:15,color:'#a855f7'}}>{formatBRL(totais.comissao)}</div><div className="sl" style={{color:'#a855f7'}}>Comissões</div></div>
          <div className="stat grn"><div className="sv" style={{fontSize:15}}>{formatBRL(totais.liqM + totais.liqE)}</div><div className="sl">Líquido total</div></div>
          <div className="stat red"><div className="sv" style={{fontSize:15}}>{formatBRL(totais.repE + totais.repM)}</div><div className="sl">A repassar</div></div>
        </div>

        <div className="card card-sm" style={{marginBottom:14}}>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:10}}>
            <div style={{position:'relative',display:'inline-block'}}>
              <button className="btn btn-g btn-sm" style={{minWidth:160}} onClick={e=>{e.stopPropagation();document.getElementById('filial-dd').classList.toggle('hidden')}}>
                {filtFiliais.length===0?'Todas as filiais':`${filtFiliais.length} filial(is)`} ▾
              </button>
              <div id="filial-dd" className="hidden" style={{position:'absolute',top:'100%',left:0,zIndex:200,background:'var(--s2)',border:'1px solid var(--bd2)',borderRadius:'var(--r)',padding:10,minWidth:180,maxHeight:280,overflowY:'auto',boxShadow:'0 8px 24px rgba(0,0,0,.4)'}}>
                <label style={{display:'flex',gap:8,alignItems:'center',fontSize:12,padding:'3px 0',cursor:'pointer'}}>
                  <input type="checkbox" checked={filtFiliais.length===0} onChange={()=>setFiltFiliais([])} /> Todas
                </label>
                {FILIAIS.map(f=>(
                  <label key={f} style={{display:'flex',gap:8,alignItems:'center',fontSize:12,padding:'3px 0',cursor:'pointer'}}>
                    <input type="checkbox" checked={filtFiliais.includes(f)} onChange={e=>{
                      setFiltFiliais(prev=>e.target.checked?[...prev,f]:prev.filter(x=>x!==f));
                    }} /> {f}
                  </label>
                ))}
              </div>
            </div>
            <select className="inp" style={{width:'auto'}} value={filtEmpresa} onChange={e=>setFiltEmpresa(e.target.value)}>
              <option value="TODAS">Todas as empresas</option>
              <option value="MOTONOW">MotoNow</option>
              <option value="EMENEZES">Emenezes</option>
            </select>
            <input className="inp" type="date" style={{width:'auto'}} value={filtDi} onChange={e=>{setFiltDi(e.target.value);setAtalhoAtivo('');}} />
            <span style={{lineHeight:'38px',color:'var(--tx3)'}}>até</span>
            <input className="inp" type="date" style={{width:'auto'}} value={filtDf} onChange={e=>{setFiltDf(e.target.value);setAtalhoAtivo('');}} />
            {(filtDi||filtDf) && <button className="btn btn-g btn-sm" onClick={()=>{setFiltDi('');setFiltDf('');setAtalhoAtivo('');}}>✕ Datas</button>}
            <input className="inp" style={{flex:1,minWidth:200}} placeholder="Buscar cliente, chassi ou modelo..." value={filtBusca} onChange={e=>setFiltBusca(e.target.value)} />
            {filtBusca && <button className="btn btn-g btn-sm" onClick={()=>setFiltBusca('')}>✕</button>}
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {ATALHOS.map(a=>(
              <button key={a.label} className={`btn btn-sm ${atalhoAtivo===a.label?'btn-p':'btn-g'}`}
                onClick={()=>aplicarAtalho(a.label,a.fn)}>{a.label}</button>
            ))}
          </div>
        </div>

        {loading ? <div style={{display:'flex',justifyContent:'center',padding:60}}><span className="spin spin-lg"/></div> :
        <div style={{overflowX:'auto'}}>
          <table className="t" style={{minWidth:800,fontSize:compacto?11:13}}>
            <thead>
              <tr>{colDefs.map(c=><th key={c.key} style={{minWidth:c.w,whiteSpace:'nowrap'}}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.length===0 && <tr><td colSpan={colDefs.length}><div className="empty"><p>Nenhuma venda com esses filtros.</p></div></td></tr>}
              {filtered.map(v=>(
                <tr key={v.id} style={{height:compacto?32:undefined}}>
                  {colDefs.map(c=>(
                    <td key={c.key} style={{padding:compacto?'4px 8px':undefined}}>{getCellValue(v,c.key)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
      </div>

      {edit && <div className="mbg" onClick={()=>setEdit(null)}>
        <div className="mbox wide" onClick={e=>e.stopPropagation()}>
          <div className="mhd"><h3>✏️ Editar venda — {edit.modelo}</h3><button className="mclose" onClick={()=>setEdit(null)}>×</button></div>
          <div className="g2">
            <div className="field"><label>Modelo</label><input className="inp" value={ef.modelo||''} onChange={e=>setEf({...ef,modelo:e.target.value})} /></div>
            <div className="field"><label>Cor</label><input className="inp" value={ef.cor||''} onChange={e=>setEf({...ef,cor:e.target.value})} /></div>
            <div className="field"><label>Chassi</label><input className="inp" value={ef.chassi||''} onChange={e=>setEf({...ef,chassi:e.target.value})} /></div>
            <div className="field"><label>Cliente</label><input className="inp" value={ef.nome_cliente||''} onChange={e=>setEf({...ef,nome_cliente:e.target.value})} /></div>
            <div className="field"><label>Telefone</label><input className="inp" value={ef.numero_cliente||''} onChange={e=>setEf({...ef,numero_cliente:e.target.value})} /></div>
            <div className="field"><label>Valor venda (R$)</label><input className="inp" type="number" value={ef.valor||''} onChange={e=>setEf({...ef,valor:e.target.value})} /></div>
            <div className="field"><label>Valor compra (R$)</label><input className="inp" type="number" value={ef.valor_compra||''} onChange={e=>setEf({...ef,valor_compra:e.target.value})} /></div>
            <div className="field"><label>Repasse (R$)</label><input className="inp" type="number" value={ef.repasse||''} onChange={e=>setEf({...ef,repasse:e.target.value})} /></div>
            <div className="field"><label>Comissão (R$)</label><input className="inp" type="number" value={ef.comissao_valor||''} onChange={e=>setEf({...ef,comissao_valor:e.target.value})} /></div>
            <div className="field"><label>⛽ Gasolina (R$)</label><input className="inp" type="number" step="0.01" value={ef.gasolina||''} onChange={e=>setEf({...ef,gasolina:e.target.value})} /></div>
            <div className="field"><label>📋 Emplacamento (R$)</label>
              <input className="inp" type="number" step="0.01" value={ef.emplacamento} onChange={e=>setEf({...ef,emplacamento:e.target.value})} />
              {Number(ef.emplacamento||0) > 0 && (
                <div style={{fontSize:11,marginTop:4,color:'var(--tx3)'}}>
                  {formatBRL(Number(ef.valor||0))} − {formatBRL(Number(ef.emplacamento||0))} = <b style={{color:'var(--grn)'}}>{formatBRL(Number(ef.valor||0)-Number(ef.emplacamento||0))}</b>
                </div>
              )}
            </div>
            <div className="field"><label>Data da venda</label><input className="inp" type="date" value={ef.data_venda||''} onChange={e=>setEf({...ef,data_venda:e.target.value})} /></div>
          </div>
          <div className="field"><label>Filial venda</label>
            <select className="inp" value={ef.filial_venda||''} onChange={e=>setEf({...ef,filial_venda:e.target.value})}>
              {FILIAIS_VENDA.map(f=><option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="field"><label>Pagamento</label><input className="inp" value={ef.forma_pagamento||''} onChange={e=>setEf({...ef,forma_pagamento:e.target.value})} /></div>
          <div className="field"><label>Como chegou</label><input className="inp" value={ef.como_chegou||''} onChange={e=>setEf({...ef,como_chegou:e.target.value})} /></div>
          <div style={{display:'flex',gap:20,marginTop:8,flexWrap:'wrap'}}>
            {[['brinde','🎁 Brinde'],['rp','RP'],['rr','RR'],['santander','Santander']].map(([k,l])=>(
              <label key={k} style={{display:'flex',gap:8,alignItems:'center',fontSize:13,cursor:'pointer'}}>
                <input type="checkbox" checked={!!ef[k]} onChange={e=>setEf({...ef,[k]:e.target.checked})} />{l}
              </label>
            ))}
          </div>
          <div className="mfoot">
            <button className="btn btn-g" onClick={()=>setEdit(null)}>Cancelar</button>
            <button className="btn btn-p" onClick={salvarEdit} disabled={saving}>{saving?<span className="spin"/>:'💾 Salvar'}</button>
          </div>
        </div>
      </div>}

      {deleting && <div className="mbg" onClick={()=>setDeleting(null)}>
        <div className="mbox" onClick={e=>e.stopPropagation()}>
          <div className="mhd"><h3>🗑 Excluir venda</h3><button className="mclose" onClick={()=>setDeleting(null)}>×</button></div>
          <div className="ibox">
            <p>Tem certeza que deseja excluir a venda de <b>{deleting.modelo}</b> para <b>{deleting.nome_cliente}</b>?</p>
            <p style={{color:'var(--tx3)',fontSize:12,marginTop:4}}>A moto voltará para o estoque como DISPONÍVEL.</p>
          </div>
          <div className="mfoot">
            <button className="btn btn-g" onClick={()=>setDeleting(null)}>Cancelar</button>
            <button className="btn btn-red" onClick={deletarVenda}>🗑 Confirmar exclusão</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
