/* eslint-disable no-unused-vars */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from 'recharts';

/* ── HELPERS ── */
function n(v) { const x = Number(v); return isFinite(x) ? x : 0; }
function brl(v) { return n(v).toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); }
function isoOnly(d) { if (!d) return ''; const x = new Date(d); return isNaN(x)?'':x.toISOString().slice(0,10); }
function dtBR(iso) { if (!iso) return ''; const [y,m,d]=(iso||'').split('-'); return `${d}/${m}/${y}`; }

/* ── LÓGICA DE CÁLCULO (igual VendasMotos) ── */
const REPASSE_TAB = {
  'PHOENIX 50':610,'PHOENIX S 50':610,'PHOENIX 50S':610,'PHOENIX 50 S EFI':610,'PHONEIX S 50':610,
  'JET 50':510,'RIO 125':510,'JET 125SS':510,'JET 125 SS':510,
  'NEW JET 125':600,'NEW JET 125 EFI':610,'JET 125 EFI':610,
  'JEF 150S':1110,'JEF 150':1110,'JEF 150 EFI':1110,
  'NEW JEF':1210,'NEW JEF 150':1210,
  'SHI 175':1110,'SHI 175 EFI':1110,'SHI 175 CARB':1110,'SHI 175S EFI':1110,'NEW SHI':1110,'NEW SHI EFI':1310,
  'FREE 150 EFI':610,'URBAN 150 EFI':1110,'URBAN':1110,
  'SHI 250 EFI':1410,'STORM 200':1110,'STORM':1110,'FLASH 250':1410,
  'TITANIUM':1110,'DENVER':1110,'IRON':1110,'SBM 250':0,
  'PT1':800,'PT1 S':1000,'ATV 125':2810,'ATV 125 EFI':3610,'ATV 200':2010,'ATV EFI 200':2010,
};
const FILIAIS_REP = ['CATENDE','SAO JOSE','XEXEU','MARAGOGI'];

function getRepasseFixo(modelo) {
  if (!modelo) return 0;
  const m = modelo.toUpperCase().trim();
  for (const [k,v] of Object.entries(REPASSE_TAB)) if (k.toUpperCase()===m) return v;
  for (const [k,v] of Object.entries(REPASSE_TAB)) if (m.includes(k.toUpperCase())||k.toUpperCase().includes(m)) return v;
  return 0;
}

function temRepasse(v) { return FILIAIS_REP.includes((v.filial_venda||'').toUpperCase().trim()); }
function isEmenezes(v) { return v.santander===true||v.santander===1; }

function getARepassar(v) {
  if (!temRepasse(v)) return 0;
  const rep = n(v.repasse);
  if (!rep) return 0;
  return n(v.valor) - rep - (v.brinde?100:0) - n(v.gasolina);
}

function getLiquido(v) {
  const val=n(v.valor), compra=n(v.valor_compra), com=n(v.comissao_valor), brinde=v.brinde?100:0;
  if (temRepasse(v)) {
    if (isEmenezes(v)) return 0;
    return getRepasseFixo(v.modelo);
  }
  return val - compra - brinde - com;
}

function getBruto(v) {
  return temRepasse(v) ? getLiquido(v) : n(v.valor) - n(v.valor_compra);
}

/* ── THEME ── */
const T = {
  bg: 'radial-gradient(1100px 700px at 18% 8%,rgba(97,140,255,.12),transparent 60%),radial-gradient(900px 600px at 92% 20%,rgba(0,255,200,.10),transparent 55%),#07090c',
  card: 'linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02))',
  border: '1px solid rgba(255,255,255,.10)',
  text: 'rgba(255,255,255,.92)',
  shadow: '0 18px 50px rgba(0,0,0,.45)',
  grid: { stroke:'rgba(255,255,255,.02)', vertical:false },
  axis: { tick:{fill:'rgba(255,255,255,.60)',fontSize:11}, axisLine:{stroke:'rgba(255,255,255,.08)'}, tickLine:{stroke:'rgba(255,255,255,.05)'} },
};

function tip(fmt) {
  return {
    contentStyle:{background:'rgba(10,12,14,.96)',border:'1px solid rgba(255,255,255,.10)',borderRadius:14,color:'rgba(255,255,255,.92)',padding:12},
    labelStyle:{color:'rgba(255,255,255,.72)'},
    itemStyle:{color:'rgba(255,255,255,.92)'},
    formatter:fmt,
  };
}

/* ── COMPONENTES ── */
function KpiCard({title,value,sub}) {
  return (
    <div style={{background:T.card,border:T.border,borderRadius:18,padding:16,boxShadow:T.shadow,backdropFilter:'blur(8px)',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
      <div style={{fontSize:12,opacity:.75,letterSpacing:.35}}>{title}</div>
      <div style={{fontSize:26,fontWeight:850,marginTop:8}}>{value}</div>
      {sub && <div style={{fontSize:11,opacity:.55,marginTop:4}}>{sub}</div>}
    </div>
  );
}
function Panel({title,hint,children}) {
  return (
    <div style={{height:'100%',background:T.card,border:T.border,borderRadius:20,padding:16,boxShadow:T.shadow,backdropFilter:'blur(8px)',overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:12}}>
        <div style={{fontSize:16,fontWeight:850}}>{title}</div>
        {hint && <div style={{fontSize:12,opacity:.65}}>{hint}</div>}
      </div>
      <div style={{marginTop:10,height:'calc(100% - 34px)'}}>{children}</div>
    </div>
  );
}
function BigStat({label,value}) {
  return (
    <div style={{background:T.card,border:T.border,borderRadius:18,padding:16,boxShadow:T.shadow}}>
      <div style={{fontSize:12,opacity:.72}}>{label}</div>
      <div style={{fontSize:30,fontWeight:900,marginTop:6}}>{value}</div>
    </div>
  );
}

const SLIDES = [
  {id:'kpis',       title:'Resumo executivo'},
  {id:'fat_dia',    title:'Faturamento por dia'},
  {id:'ultimos7',   title:'Últimos 7 dias'},
  {id:'estoque',    title:'Estoque atual'},
  {id:'hist_est',   title:'Fechamento de estoque'},
  {id:'financeiro', title:'Financeiro'},
  {id:'dividas',    title:'Dívidas — Shineray & Eduardo'},
  {id:'fechamento', title:'Fechamento por loja'},
  {id:'top',        title:'Top modelos e cidades'},
  {id:'resumo',     title:'Resumo final'},
  {id:'metas',      title:'Metas por filial'},
];

/* ── DASHBOARD ── */
export default function DashboardAuto() {
  const nav = useNavigate();
  const [vendas,  setVendas]  = useState([]);
  const [motos,   setMotos]   = useState([]);
  const [fin,     setFin]     = useState([]);
  const [metas,   setMetas]   = useState([]);
  const [histEst, setHistEst] = useState([]);

  const [di, setDi] = useState('');
  const [df, setDf] = useState('');
  const [empresa, setEmpresa] = useState('TODAS');
  const [slide, setSlide] = useState(0);
  const [auto, setAuto] = useState(true);
  const timer = useRef(null);

  useEffect(() => {
    api.get('/vendas-motos').then(r=>setVendas(r.data||[])).catch(()=>{});
    api.get('/motos').then(r=>setMotos(r.data||[])).catch(()=>{});
    api.get('/historico-estoque').then(r=>setHistEst(r.data||[])).catch(()=>{});
    api.get('/financeiro-dashboard').then(r=>setFin(r.data||[])).catch(()=>{});
    const now = new Date();
    api.get('/metas',{params:{mes:now.getMonth()+1,ano:now.getFullYear()}}).then(r=>setMetas(r.data||[])).catch(()=>{});
  }, []);

  useEffect(() => {
    if (!auto) return;
    timer.current = setInterval(()=>setSlide(s=>(s+1)%SLIDES.length), 8000);
    return ()=>clearInterval(timer.current);
  }, [auto]);

  useEffect(() => {
    function onKey(e) {
      if (e.key==='ArrowRight') setSlide(s=>(s+1)%SLIDES.length);
      if (e.key==='ArrowLeft')  setSlide(s=>(s-1+SLIDES.length)%SLIDES.length);
      if (e.key===' ') setAuto(a=>!a);
      if (e.key.toLowerCase()==='f') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    }
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  });

  function atalho(dias) {
    const fim = new Date().toISOString().slice(0,10);
    const ini = new Date(Date.now()-dias*86400000).toISOString().slice(0,10);
    setDi(ini); setDf(fim);
  }
  function mesAtual() {
    const now = new Date();
    setDi(new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10));
    setDf(new Date(now.getFullYear(),now.getMonth()+1,0).toISOString().slice(0,10));
  }
  function mesPassado() {
    const now = new Date();
    const m = now.getMonth()===0 ? new Date(now.getFullYear()-1,11,1) : new Date(now.getFullYear(),now.getMonth()-1,1);
    setDi(m.toISOString().slice(0,10));
    setDf(new Date(m.getFullYear(),m.getMonth()+1,0).toISOString().slice(0,10));
  }

  /* ── FILTRO VENDAS ── */
  const base = useMemo(()=>vendas.filter(v=>{
    const data = v.data_venda||v.created_at||'';
    const iso  = isoOnly(data);
    if (di && iso < di) return false;
    if (df && iso > df) return false;
    if (empresa!=='TODAS') {
      const emp = isEmenezes(v)?'EMENEZES':'MOTONOW';
      if (emp!==empresa) return false;
    }
    return true;
  }), [vendas,di,df,empresa]);

  /* ── KPIs ── */
  const kpis = useMemo(()=>({
    fat:    base.reduce((s,v)=>s+n(v.valor),0),
    liq:    base.reduce((s,v)=>s+getLiquido(v),0),
    bruto:  base.reduce((s,v)=>s+getBruto(v),0),
    com:    base.reduce((s,v)=>s+n(v.comissao_valor),0),
    qtd:    base.length,
    ticket: base.length ? base.reduce((s,v)=>s+n(v.valor),0)/base.length : 0,
  }),[base]);

  /* ── FAT POR DIA ── */
  const fatDia = useMemo(()=>{
    const map=new Map();
    base.forEach(v=>{
      const k=isoOnly(v.data_venda||v.created_at); if(!k)return;
      const cur=map.get(k)||{dia:dtBR(k),iso:k,fat:0,qtd:0};
      cur.fat+=n(v.valor); cur.qtd+=1; map.set(k,cur);
    });
    return [...map.values()].sort((a,b)=>a.iso.localeCompare(b.iso)).slice(-45);
  },[base]);

 const ult7 = useMemo(()=>{
  const arr=[];
  // Últimas 8 semanas
  for(let i=7;i>=0;i--){
    const fim = new Date(Date.now()-i*7*86400000);
    const ini = new Date(fim.getTime()-6*86400000);
    const isoIni = ini.toISOString().slice(0,10);
    const isoFim = fim.toISOString().slice(0,10);
    const label = `${ini.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})} - ${fim.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}`;
    const vs = vendas.filter(v=>{
      const iso = isoOnly(v.data_venda||v.created_at);
      return iso>=isoIni && iso<=isoFim && (empresa==='TODAS'||(isEmenezes(v)?'EMENEZES':'MOTONOW')===empresa);
    });
    arr.push({
      semana: label,
      fat:    vs.reduce((s,v)=>s+n(v.valor),0),
      bruto:  vs.reduce((s,v)=>s+getBruto(v),0),
      liq:    vs.reduce((s,v)=>s+getLiquido(v),0),
      qtd:    vs.length,
    });
  }
  return arr;
},[vendas,empresa]);

  /* ── ESTOQUE ── */
  const estoque = useMemo(()=>{
    const map=new Map();
    motos.filter(m=>m.status!=='VENDIDA').filter(m=>empresa==='TODAS'||(m.santander?'EMENEZES':'MOTONOW')===empresa).forEach(m=>{
      const f=(m.filial||'N/I').toUpperCase();
      const cur=map.get(f)||{loja:f,disp:0,neg:0,pend:0,total:0};
      cur.total++;
      if(m.status==='DISPONIVEL')cur.disp++;
      else if(m.status==='NEGOCIACAO')cur.neg++;
      else if(m.status==='PENDENTE_APROVACAO')cur.pend++;
      map.set(f,cur);
    });
    return [...map.values()].sort((a,b)=>b.total-a.total);
  },[motos,empresa]);

  const estTotal = useMemo(()=>estoque.reduce((a,e)=>({disp:a.disp+e.disp,neg:a.neg+e.neg,pend:a.pend+e.pend,total:a.total+e.total}),{disp:0,neg:0,pend:0,total:0}),[estoque]);

  /* ── FECHAMENTO POR LOJA ── */
  const porLoja = useMemo(()=>{
    const map=new Map();
    base.forEach(v=>{
      const f=(v.filial_venda||'N/I').toUpperCase();
      const cur=map.get(f)||{loja:f,fat:0,liq:0,bruto:0,com:0,qtd:0};
      cur.fat+=n(v.valor); cur.liq+=getLiquido(v); cur.bruto+=getBruto(v);
      cur.com+=n(v.comissao_valor); cur.qtd+=1; map.set(f,cur);
    });
    return [...map.values()].sort((a,b)=>b.fat-a.fat);
  },[base]);

  /* ── TOP MODELOS ── */
  const topModelos = useMemo(()=>{
    const map=new Map();
    base.forEach(v=>{const k=(v.modelo||'?').toUpperCase(); map.set(k,(map.get(k)||0)+1);});
    return [...map.entries()].map(([modelo,total])=>({modelo,total})).sort((a,b)=>b.total-a.total).slice(0,10);
  },[base]);

  const topCidades = useMemo(()=>{
    const map=new Map();
    base.forEach(v=>{const k=(v.filial_venda||'?').toUpperCase(); map.set(k,(map.get(k)||0)+1);});
    return [...map.entries()].map(([cidade,total])=>({cidade,total})).sort((a,b)=>b.total-a.total).slice(0,10);
  },[base]);

  /* ── FINANCEIRO GRAFICO ── */
  const finGraf = useMemo(()=>fin.map(f=>({
    data:dtBR(f.data),
    jotaCompra:n(f.jota_compra),
    jotaVenda:n(f.jota_venda),
    saldo:n(f.saldo),
  })),[fin]);

  /* ── DÍVIDAS GRAFICO ── */
  const dividasGraf = useMemo(()=>[...fin]
    .sort((a,b)=>a.data.localeCompare(b.data))
    .map(f=>({
      data: dtBR(f.data),
      shineray: n(f.shineray),
      eduardo:  n(f.eduardo),
      total:    n(f.shineray) + n(f.eduardo),
    }))
  ,[fin]);

  const finLast = fin.length ? [...fin].sort((a,b)=>b.data.localeCompare(a.data))[0] : null;

  const cur = SLIDES[slide];

  return (
    <div style={{width:'100vw',height:'100vh',overflow:'hidden',background:T.bg,color:T.text,display:'flex',flexDirection:'column',fontFamily:'Inter,-apple-system,sans-serif'}}>
      {/* HEADER */}
      <div style={{padding:'14px 22px 8px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:14,flexShrink:0}}>
        <div>
          <div style={{display:'flex',alignItems:'baseline',gap:10}}>
            <div style={{fontSize:20,fontWeight:800}}>MotoNow</div>
            <div style={{opacity:.7,fontWeight:600,fontSize:14}}>Dashboard • TV</div>
          </div>
          <div style={{fontSize:11,opacity:.6,marginTop:2}}>{cur?.title} • {empresa==='TODAS'?'Todas empresas':empresa} {di||df?`• ${di||'…'} → ${df||'…'}`:'• Todo período'}</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <select style={{height:34,borderRadius:10,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.10)',color:'rgba(255,255,255,.90)',padding:'0 10px',fontSize:12}} value={empresa} onChange={e=>setEmpresa(e.target.value)}>
            <option value="TODAS">Todas</option><option value="EMENEZES">Emenezes</option><option value="MOTONOW">MotoNow</option>
          </select>
          <input style={{height:34,borderRadius:10,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.10)',color:'rgba(255,255,255,.90)',padding:'0 10px',fontSize:12}} type="date" value={di} onChange={e=>setDi(e.target.value)} />
          <input style={{height:34,borderRadius:10,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.10)',color:'rgba(255,255,255,.90)',padding:'0 10px',fontSize:12}} type="date" value={df} onChange={e=>setDf(e.target.value)} />
          {[['Hoje',0],['7d',7],['30d',30]].map(([l,d])=>(
            <button key={l} onClick={()=>d===0?(()=>{const t=new Date().toISOString().slice(0,10);setDi(t);setDf(t);})():atalho(d)} style={{height:32,padding:'0 12px',borderRadius:999,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.10)',color:'rgba(255,255,255,.90)',cursor:'pointer',fontSize:12}}>{l}</button>
          ))}
          <button onClick={mesAtual}   style={{height:32,padding:'0 12px',borderRadius:999,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.10)',color:'rgba(255,255,255,.90)',cursor:'pointer',fontSize:12}}>Mês</button>
          <button onClick={mesPassado} style={{height:32,padding:'0 12px',borderRadius:999,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.10)',color:'rgba(255,255,255,.90)',cursor:'pointer',fontSize:12}}>Mês ant.</button>
          <button onClick={()=>{setDi('');setDf('');}} style={{height:32,padding:'0 12px',borderRadius:999,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.10)',color:'rgba(255,255,255,.90)',cursor:'pointer',fontSize:12}}>✕</button>
          <button onClick={()=>setSlide(s=>(s-1+SLIDES.length)%SLIDES.length)} style={{height:34,minWidth:40,borderRadius:10,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.10)',color:'rgba(255,255,255,.90)',cursor:'pointer'}}>◀</button>
          <button onClick={()=>setAuto(a=>!a)} style={{height:34,minWidth:40,borderRadius:10,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.10)',color:'rgba(255,255,255,.90)',cursor:'pointer'}}>{auto?'⏸':'▶'}</button>
          <button onClick={()=>setSlide(s=>(s+1)%SLIDES.length)} style={{height:34,minWidth:40,borderRadius:10,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.10)',color:'rgba(255,255,255,.90)',cursor:'pointer'}}>▶</button>
          <button onClick={()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.()} style={{height:34,minWidth:40,borderRadius:10,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.10)',color:'rgba(255,255,255,.90)',cursor:'pointer'}}>⛶</button>
          <button onClick={()=>nav('/home')} style={{height:34,minWidth:40,borderRadius:10,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.10)',color:'rgba(255,255,255,.90)',cursor:'pointer'}}>⬅</button>
        </div>
      </div>

      {/* DOTS */}
      <div style={{padding:'0 22px 8px',display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
        {SLIDES.map((s,i)=>(
          <button key={s.id} onClick={()=>setSlide(i)} title={s.title} style={{width:i===slide?24:9,height:9,borderRadius:999,border:'none',cursor:'pointer',background:i===slide?'rgba(255,255,255,.85)':'rgba(255,255,255,.22)',transition:'all .18s'}} />
        ))}
        <span style={{marginLeft:'auto',fontSize:11,opacity:.55}}>Espaço play/pausa • ←/→ troca • F tela cheia</span>
      </div>

      {/* CONTEÚDO */}
      <div style={{flex:1,padding:'0 22px 18px',minHeight:0}}>

        {cur?.id==='kpis' && (
          <div style={{height:'100%',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gridTemplateRows:'1fr 1fr',gap:12}}>
            <KpiCard title="Faturamento" value={brl(kpis.fat)} sub={`${kpis.qtd} motos`} />
            <KpiCard title="Bruto" value={brl(kpis.bruto)} sub="venda − compra (com lógica repasse)" />
            <KpiCard title="Líquido" value={brl(kpis.liq)} sub="após todos os abatimentos" />
            <KpiCard title="Comissões" value={brl(kpis.com)} />
            <KpiCard title="Ticket médio" value={brl(kpis.ticket)} />
            <KpiCard title="Estoque atual" value={`${estTotal.total} motos`} sub={`${estTotal.disp} disp • ${estTotal.neg} neg`} />
          </div>
        )}

        {cur?.id==='fat_dia' && (
          <Panel title="Faturamento por dia" hint="(período filtrado)">
            <ResponsiveContainer width="100%" height={470}>
              <BarChart data={fatDia} margin={{top:18,right:16,bottom:44,left:8}}>
                <CartesianGrid {...T.grid} />
                <XAxis dataKey="dia" angle={-30} textAnchor="end" height={60} {...T.axis} />
                <YAxis {...T.axis} />
                <Tooltip {...tip(v=>[brl(v),'Faturamento'])} />
                <Bar dataKey="fat" name="Faturamento" radius={[10,10,0,0]} fill="rgba(110,240,200,.82)" />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        )}

        {cur?.id==='ultimos7' && (
  <div style={{height:'100%',display:'grid',gridTemplateColumns:'1.3fr 1fr',gap:14}}>
    <Panel title="Motos vendidas por semana" hint="(últimas 8 semanas)">
      <ResponsiveContainer width="100%" height={470}>
        <BarChart data={ult7} margin={{top:18,right:16,bottom:60,left:8}}>
          <CartesianGrid {...T.grid} />
          <XAxis dataKey="semana" angle={-30} textAnchor="end" height={70} {...T.axis} />
          <YAxis allowDecimals={false} {...T.axis} />
          <Tooltip {...tip(v=>[v,'Motos vendidas'])} />
          <Bar dataKey="qtd" name="Motos vendidas" radius={[8,8,0,0]} fill="rgba(110,240,200,.82)" />
        </BarChart>
      </ResponsiveContainer>
    </Panel>
    <Panel title="Detalhe por semana">
      <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:470,overflowY:'auto',paddingRight:4}}>
        {[...ult7].reverse().map((s,i)=>(
          <div key={s.semana} style={{background:i===0?'rgba(110,240,200,.08)':'rgba(255,255,255,.04)',border:`1px solid ${i===0?'rgba(110,240,200,.25)':'rgba(255,255,255,.08)'}`,borderRadius:14,padding:12,fontSize:13}}>
            <b style={{fontSize:14}}>{i===0?'📅 Semana atual':s.semana}</b>
            {i!==0&&<div style={{fontSize:11,opacity:.5}}>{s.semana}</div>}
            <div style={{marginTop:6}}>
              🏍 <b style={{fontSize:18}}>{s.qtd}</b> <span style={{opacity:.6}}>motos vendidas</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  </div>
)}
        {cur?.id==='estoque' && (
          <div style={{height:'100%',display:'grid',gridTemplateColumns:'1.2fr 1fr',gap:14}}>
            <Panel title="Estoque por loja">
              <ResponsiveContainer width="100%" height={470}>
                <BarChart data={estoque} margin={{top:18,right:16,bottom:40,left:8}}>
                  <CartesianGrid {...T.grid} />
                  <XAxis dataKey="loja" angle={-20} textAnchor="end" height={60} {...T.axis} />
                  <YAxis allowDecimals={false} {...T.axis} />
                  <Tooltip {...tip((v,nm)=>[v,nm])} />
                  <Legend />
                  <Bar dataKey="disp" name="Disponível" fill="rgba(110,240,200,.82)" />
                  <Bar dataKey="neg"  name="Negociação" fill="rgba(255,190,90,.88)" />
                  <Bar dataKey="pend" name="Pendente"   fill="rgba(120,160,255,.88)" />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Resumo estoque">
              <div style={{display:'flex',flexDirection:'column',gap:10,maxHeight:470,overflowY:'auto',paddingRight:4}}>
                <div style={{background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.15)',borderRadius:14,padding:12}}>
                  <b style={{fontSize:15}}>GERAL — {estTotal.total} motos</b>
                  <div style={{marginTop:6,fontSize:13,opacity:.8}}>✅ {estTotal.disp} disponíveis • 🤝 {estTotal.neg} negociação • ⏳ {estTotal.pend} pendente</div>
                </div>
                {estoque.map(e=>(
                  <div key={e.loja} style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',borderRadius:14,padding:12}}>
                    <b style={{fontSize:13}}>{e.loja}</b>
                    <div style={{fontSize:12,marginTop:4,opacity:.8}}>✅ {e.disp} • 🤝 {e.neg} • ⏳ {e.pend} = <b>{e.total}</b></div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {cur?.id==='hist_est' && (
          <div style={{height:'100%',display:'grid',gridTemplateColumns:'1.3fr 1fr',gap:14}}>
            <Panel title="Fechamento de estoque por dia" hint="(calculado automaticamente)">
              <ResponsiveContainer width="100%" height={470}>
                <BarChart data={histEst} margin={{top:18,right:16,bottom:40,left:8}}>
                  <CartesianGrid {...T.grid} />
                  <XAxis dataKey="data" angle={-30} textAnchor="end" height={60} {...T.axis}
                    tickFormatter={v=>{ const p=v.split('-'); return p[2]+'/'+p[1]; }} />
                  <YAxis {...T.axis} />
                  <Tooltip {...tip((v,nm)=>nm==='quantidade'?[v+' motos',nm]:[brl(v),nm])} />
                  <Legend />
                  <Bar dataKey="quantidade"  name="Qtd motos"   radius={[6,6,0,0]} fill="rgba(120,160,255,.88)" />
                  <Bar dataKey="totalCompra" name="Est. compra" radius={[6,6,0,0]} fill="rgba(255,190,90,.85)" />
                  <Bar dataKey="totalVenda"  name="Est. venda"  radius={[6,6,0,0]} fill="rgba(110,240,200,.82)" />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Últimos fechamentos de estoque">
              <div style={{display:'flex',flexDirection:'column',gap:10,maxHeight:470,overflowY:'auto',paddingRight:4}}>
                {[...(histEst||[])].sort((a,b)=>b.data?.localeCompare(a.data)).slice(0,10).map(h=>(
                  <div key={h.data} style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',borderRadius:14,padding:12,fontSize:12}}>
                    <b style={{fontSize:14}}>{dtBR(h.data)}</b>
                    <div style={{marginTop:6,display:'flex',gap:16,flexWrap:'wrap'}}>
                      <span>🏍 <b>{h.quantidade}</b> motos</span>
                      <span>💰 <b style={{color:'rgba(255,190,90,.9)'}}>{brl(h.totalCompra)}</b></span>
                      <span>📈 <b style={{color:'rgba(110,240,200,.9)'}}>{brl(h.totalVenda)}</b></span>
                    </div>
                  </div>
                ))}
                {histEst.length===0 && <div style={{opacity:.6}}>Nenhum dado encontrado.</div>}
              </div>
            </Panel>
          </div>
        )}

        {cur?.id==='financeiro' && (
          <div style={{height:'100%',display:'grid',gridTemplateColumns:'1.3fr 1fr',gap:14}}>
            <Panel title="Evolução financeira" hint="(Jota Venda, Jota Compra e Saldo)">
              <ResponsiveContainer width="100%" height={470}>
                <LineChart data={finGraf} margin={{top:18,right:16,bottom:30,left:8}}>
                  <CartesianGrid {...T.grid} />
                  <XAxis dataKey="data" {...T.axis} />
                  <YAxis {...T.axis} />
                  <Tooltip {...tip((v,nm)=>[brl(v),nm])} />
                  <Legend />
                  <Line type="monotone" dataKey="jotaVenda"  name="Jota Venda"  stroke="rgba(110,240,200,.92)" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="jotaCompra" name="Jota Compra" stroke="rgba(120,160,255,.95)" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="saldo"      name="Saldo"       stroke="rgba(255,190,90,.95)"  strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Último registro financeiro">
              {finLast ? (
                <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:8}}>
                  <div style={{fontSize:13,opacity:.6,marginBottom:4}}>{dtBR(finLast.data)}</div>
                  {[
                    ['💵 Saldo',       brl(finLast.saldo)],
                    ['📬 A receber',   brl(finLast.a_receber)],
                    ['🏍 Est. compra', brl(finLast.estoque_compra)],
                    ['🏍 Est. venda',  brl(finLast.estoque_venda)],
                    ['➖ Shineray',    brl(finLast.shineray)],
                    ['➖ Eduardo',     brl(finLast.eduardo)],
                    ['➖ Fornecedor',  brl(finLast.fornecedor)],
                    ['🔵 Jota Compra', brl(finLast.jota_compra)],
                    ['🟢 Jota Venda',  brl(finLast.jota_venda)],
                  ].map(([l,v])=>(
                    <div key={l} style={{display:'flex',justifyContent:'space-between',background:'rgba(255,255,255,.04)',borderRadius:10,padding:'7px 12px',fontSize:13}}>
                      <span style={{opacity:.8}}>{l}</span><b>{v}</b>
                    </div>
                  ))}
                </div>
              ) : <div style={{opacity:.6,marginTop:20}}>Nenhum registro financeiro salvo.</div>}
            </Panel>
          </div>
        )}

        {cur?.id==='dividas' && (
          <div style={{height:'100%',display:'grid',gridTemplateColumns:'1.3fr 1fr',gap:14}}>
            <Panel title="Evolução das dívidas" hint="(Shineray, Eduardo e Total)">
              <ResponsiveContainer width="100%" height={470}>
                <LineChart data={dividasGraf} margin={{top:18,right:16,bottom:30,left:8}}>
                  <CartesianGrid {...T.grid} />
                  <XAxis dataKey="data" {...T.axis} />
                  <YAxis {...T.axis} />
                  <Tooltip {...tip((v,nm)=>[brl(v),nm])} />
                  <Legend />
                  <Line type="monotone" dataKey="shineray" name="Shineray" stroke="rgba(255,100,100,.92)"  strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="eduardo"  name="Eduardo"  stroke="rgba(255,190,90,.95)"   strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="total"    name="Total"    stroke="rgba(220,100,255,.90)"  strokeWidth={2} dot={false} strokeDasharray="6 3" />
                </LineChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Último registro de dívidas">
              {finLast ? (
                <div style={{display:'flex',flexDirection:'column',gap:12,marginTop:8}}>
                  <div style={{fontSize:13,opacity:.6}}>{dtBR(finLast.data)}</div>
                  <div style={{background:'rgba(255,100,100,.08)',border:'1px solid rgba(255,100,100,.20)',borderRadius:14,padding:14}}>
                    <div style={{fontSize:12,opacity:.7,marginBottom:4}}>Shineray</div>
                    <div style={{fontSize:28,fontWeight:900,color:'rgba(255,100,100,.95)'}}>{brl(finLast.shineray)}</div>
                  </div>
                  <div style={{background:'rgba(255,190,90,.08)',border:'1px solid rgba(255,190,90,.20)',borderRadius:14,padding:14}}>
                    <div style={{fontSize:12,opacity:.7,marginBottom:4}}>Eduardo</div>
                    <div style={{fontSize:28,fontWeight:900,color:'rgba(255,190,90,.95)'}}>{brl(finLast.eduardo)}</div>
                  </div>
                  <div style={{background:'rgba(220,100,255,.08)',border:'1px solid rgba(220,100,255,.20)',borderRadius:14,padding:14}}>
                    <div style={{fontSize:12,opacity:.7,marginBottom:4}}>Total (Shineray + Eduardo)</div>
                    <div style={{fontSize:28,fontWeight:900,color:'rgba(220,100,255,.95)'}}>{brl(n(finLast.shineray)+n(finLast.eduardo))}</div>
                  </div>
                  {n(finLast.fornecedor)>0 && (
                    <div style={{background:'rgba(120,160,255,.08)',border:'1px solid rgba(120,160,255,.20)',borderRadius:14,padding:14}}>
                      <div style={{fontSize:12,opacity:.7,marginBottom:4}}>Fornecedor</div>
                      <div style={{fontSize:28,fontWeight:900,color:'rgba(120,160,255,.95)'}}>{brl(finLast.fornecedor)}</div>
                    </div>
                  )}
                </div>
              ) : <div style={{opacity:.6,marginTop:20}}>Nenhum registro financeiro salvo.</div>}
            </Panel>
          </div>
        )}

        {cur?.id==='fechamento' && (
          <div style={{height:'100%',display:'grid',gridTemplateColumns:'1.2fr 1fr .9fr',gap:14}}>
            <Panel title="Fechamento por loja">
              <ResponsiveContainer width="100%" height={470}>
                <BarChart data={porLoja} margin={{top:18,right:16,bottom:40,left:8}}>
                  <CartesianGrid {...T.grid} />
                  <XAxis dataKey="loja" angle={-20} textAnchor="end" height={60} {...T.axis} />
                  <YAxis {...T.axis} />
                  <Tooltip {...tip((v,nm)=>[brl(v),nm])} />
                  <Legend />
                  <Bar dataKey="fat"   name="Faturamento" fill="rgba(120,160,255,.88)" />
                  <Bar dataKey="bruto" name="Bruto"       fill="rgba(255,190,90,.88)" />
                  <Bar dataKey="liq"   name="Líquido"     fill="rgba(110,240,200,.82)" />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Por loja">
              <div style={{display:'flex',flexDirection:'column',gap:10,maxHeight:470,overflowY:'auto',paddingRight:4}}>
                {porLoja.map(l=>(
                  <div key={l.loja} style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',borderRadius:14,padding:12,fontSize:12}}>
                    <b style={{fontSize:14}}>{l.loja}</b>
                    <div style={{marginTop:6}}>Fat: <b>{brl(l.fat)}</b></div>
                    <div>Bruto: <b style={{color:'rgba(255,190,90,.9)'}}>{brl(l.bruto)}</b></div>
                    <div>Líquido: <b style={{color:'rgba(110,240,200,.9)'}}>{brl(l.liq)}</b></div>
                    <div>Comissão: <b>{brl(l.com)}</b> • {l.qtd} motos</div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Geral">
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[
                  ['Faturamento', brl(porLoja.reduce((s,l)=>s+l.fat,0))],
                  ['Bruto',       brl(porLoja.reduce((s,l)=>s+l.bruto,0))],
                  ['Líquido',     brl(porLoja.reduce((s,l)=>s+l.liq,0))],
                  ['Comissões',   brl(porLoja.reduce((s,l)=>s+l.com,0))],
                  ['Motos',       porLoja.reduce((s,l)=>s+l.qtd,0)],
                  ['Lojas ativas',porLoja.length],
                ].map(([label,value])=>(
                  <BigStat key={label} label={label} value={value} />
                ))}
              </div>
            </Panel>
          </div>
        )}

        {cur?.id==='top' && (
          <div style={{height:'100%',display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <Panel title="Top 10 modelos">
              <ResponsiveContainer width="100%" height={470}>
                <BarChart data={topModelos} layout="vertical" margin={{top:12,right:18,bottom:12,left:22}}>
                  <CartesianGrid {...T.grid} />
                  <XAxis type="number" allowDecimals={false} {...T.axis} />
                  <YAxis type="category" dataKey="modelo" width={180} tick={{fill:'rgba(255,255,255,.72)',fontSize:11}} axisLine={{stroke:'rgba(255,255,255,.08)'}} tickLine={false} />
                  <Tooltip {...tip(v=>[v,'Vendas'])} />
                  <Bar dataKey="total" radius={[0,10,10,0]} fill="rgba(160,120,255,.88)" />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Vendas por cidade">
              <ResponsiveContainer width="100%" height={470}>
                <BarChart data={topCidades} layout="vertical" margin={{top:12,right:18,bottom:12,left:22}}>
                  <CartesianGrid {...T.grid} />
                  <XAxis type="number" allowDecimals={false} {...T.axis} />
                  <YAxis type="category" dataKey="cidade" width={120} tick={{fill:'rgba(255,255,255,.72)',fontSize:11}} axisLine={{stroke:'rgba(255,255,255,.08)'}} tickLine={false} />
                  <Tooltip {...tip(v=>[v,'Vendas'])} />
                  <Bar dataKey="total" radius={[0,10,10,0]} fill="rgba(110,240,200,.82)" />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>
        )}

        {cur?.id==='metas' && (
          <div style={{height:'100%',overflowY:'auto',display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
              {(() => {
                const FILIAIS_DASH = ['ESCADA','IPOJUCA','RIBEIRAO','SAO JOSE','CATENDE','XEXEU','MARAGOGI','CHA GRANDE'];
                return FILIAIS_DASH.map(filial => {
                  const m = metas.find(x=>x.filial===filial);
                  const vendasFilial = base.filter(v=>v.filial_venda===filial);
                  const qtdVendas = vendasFilial.length;
                  const fatVendas = vendasFilial.reduce((s,v)=>s+n(v.valor),0);
                  const pctMotos = m?.meta_motos > 0 ? Math.min(100, Math.round((qtdVendas/m.meta_motos)*100)) : 0;
                  const pctValor = m?.meta_valor > 0 ? Math.min(100, Math.round((fatVendas/m.meta_valor)*100)) : 0;
                  const cor = pctMotos>=100?'rgba(46,204,113,.9)':pctMotos>=70?'rgba(255,190,90,.9)':'rgba(231,76,60,.9)';
                  return (
                    <div key={filial} style={{background:T.card,border:T.border,borderRadius:18,padding:16,boxShadow:T.shadow}}>
                      <div style={{fontSize:15,fontWeight:700,marginBottom:10}}>{filial}</div>
                      <div style={{fontSize:12,opacity:.7,marginBottom:4}}>Motos: {qtdVendas} / {m?.meta_motos||'—'}</div>
                      <div style={{background:'rgba(255,255,255,.1)',borderRadius:999,height:10,overflow:'hidden',marginBottom:8}}>
                        <div style={{height:'100%',borderRadius:999,width:`${pctMotos}%`,background:cor,transition:'width .4s'}} />
                      </div>
                      <div style={{fontSize:12,opacity:.7,marginBottom:4}}>Faturamento: {brl(fatVendas)} / {m?.meta_valor?brl(m.meta_valor):'—'}</div>
                      <div style={{background:'rgba(255,255,255,.1)',borderRadius:999,height:10,overflow:'hidden'}}>
                        <div style={{height:'100%',borderRadius:999,width:`${pctValor}%`,background:'rgba(110,240,200,.82)',transition:'width .4s'}} />
                      </div>
                      <div style={{fontSize:11,opacity:.55,marginTop:6,textAlign:'right'}}>{pctMotos}% da meta</div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {cur?.id==='resumo' && (
          <div style={{height:'100%',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gridTemplateRows:'1fr 1fr',gap:12}}>
            <KpiCard title="Faturamento total"  value={brl(kpis.fat)}    sub={`${kpis.qtd} motos vendidas`} />
            <KpiCard title="Bruto total"        value={brl(kpis.bruto)}  />
            <KpiCard title="Líquido total"      value={brl(kpis.liq)}    />
            <KpiCard title="Comissões"          value={brl(kpis.com)}    />
            <KpiCard title="Ticket médio"       value={brl(kpis.ticket)} />
            <KpiCard title="Estoque atual"      value={`${estTotal.total} motos`} sub={`${estTotal.disp} disponíveis`} />
          </div>
        )}
      </div>
    </div>
  );
}
