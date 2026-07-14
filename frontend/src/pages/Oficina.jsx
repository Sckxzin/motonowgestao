import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, isDir, fmtDate, formatBRL, FILIAIS, FORMAS_PGTO } from '../utils';

const TIPOS_OS = [
  { v:'REVISAO',   l:'🔧 Revisão',        cor:'#3b82f6' },
  { v:'GARANTIA',  l:'🛡 Garantia',        cor:'#f59e0b' },
  { v:'REPARO',    l:'🔩 Reparo',          cor:'#8b5cf6' },
  { v:'PECAS',     l:'📦 Venda de peças',  cor:'#2ecc71' },
  { v:'ORCAMENTO', l:'📋 Orçamento',       cor:'#6b7280' },
];

const STATUS_INFO = {
  ABERTA:        { cor:'#3b82f6', label:'Aberta'      },
  EM_ANDAMENTO:  { cor:'#f59e0b', label:'Em andamento' },
  AGUARDANDO:    { cor:'#8b5cf6', label:'Aguardando'   },
  FINALIZADA:    { cor:'#2ecc71', label:'Finalizada'   },
  CANCELADA:     { cor:'#6b7280', label:'Cancelada'    },
};

const ATALHOS = [
  {label:'Hoje',        fn:()=>{ const d=new Date().toISOString().slice(0,10); return [d,d]; }},
  {label:'Ontem',       fn:()=>{ const d=new Date(Date.now()-86400000).toISOString().slice(0,10); return [d,d]; }},
  {label:'7 dias',      fn:()=>{ const e=new Date().toISOString().slice(0,10); const i=new Date(Date.now()-6*86400000).toISOString().slice(0,10); return [i,e]; }},
  {label:'30 dias',     fn:()=>{ const e=new Date().toISOString().slice(0,10); const i=new Date(Date.now()-29*86400000).toISOString().slice(0,10); return [i,e]; }},
  {label:'Mês atual',   fn:()=>{ const n=new Date(); const i=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`; const e=new Date(n.getFullYear(),n.getMonth()+1,0).toISOString().slice(0,10); return [i,e]; }},
  {label:'Mês passado', fn:()=>{ const n=new Date(); const m=n.getMonth()===0?new Date(n.getFullYear()-1,11,1):new Date(n.getFullYear(),n.getMonth()-1,1); const i=m.toISOString().slice(0,10); const e=new Date(m.getFullYear(),m.getMonth()+1,0).toISOString().slice(0,10); return [i,e]; }},
];

function StatusBadge({ status }) {
  const s = STATUS_INFO[status] || { cor:'#6b7280', label: status };
  return <span className="badge" style={{ background: s.cor+'22', color: s.cor, border:`1px solid ${s.cor}44` }}>{s.label}</span>;
}

export default function Oficina() {
  const nav = useNavigate();
  const user = getUser();
  const { show, Toast } = useToast();

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [busca, setBusca] = useState('');
  const [filtDi, setFiltDi] = useState('');
  const [filtDf, setFiltDf] = useState('');
  const [atalhoAtivo, setAtalhoAtivo] = useState('');
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const vazio = {
    cliente_nome:'', cliente_telefone:'', cliente_cpf:'',
    chassi:'', modelo_moto:'', cor_moto:'', ano_moto:'', km:'',
    tipo:'REVISAO', problema_relatado:'', observacao:'',
    data_agendada:'', hora_agendada:'', cliente_id: null,
  };
  const [form, setForm] = useState(vazio);
  const [buscandoChassi, setBuscandoChassi] = useState(false);
  const [dadosChassi, setDadosChassi] = useState(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [sugestoesCliente, setSugestoesCliente] = useState([]);
  const [motosCliente, setMotosCliente] = useState([]);
  const chassiRef = useRef();

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filtroStatus) params.status = filtroStatus;
      const r = await api.get('/os', { params });
      setLista(r.data || []);
    } catch (e) { show(String(e), 'err'); }
    finally { setLoading(false); }
  }, [filtroStatus]);

  useEffect(() => { if (!user) nav('/'); else carregar(); }, [filtroStatus, carregar]);

  function aplicarAtalho(label, fn) {
    const [i, e] = fn();
    setFiltDi(i); setFiltDf(e); setAtalhoAtivo(label);
  }

  // Filtro local por data e busca
  const listaFiltrada = useMemo(() => lista.filter(os => {
    const data = (os.created_at||'').slice(0,10);
    if (filtDi && data < filtDi) return false;
    if (filtDf && data > filtDf) return false;
    if (busca) {
      const q = busca.toLowerCase();
      if (!(os.cliente_nome||'').toLowerCase().includes(q) &&
          !(os.chassi||'').toLowerCase().includes(q) &&
          !(os.numero||'').toLowerCase().includes(q) &&
          !(os.modelo_moto||'').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [lista, filtDi, filtDf, busca]);

  const stats = {
    abertas:       lista.filter(o => o.status === 'ABERTA').length,
    em_andamento:  lista.filter(o => o.status === 'EM_ANDAMENTO').length,
    aguardando:    lista.filter(o => o.status === 'AGUARDANDO').length,
    finalizadas:   lista.filter(o => o.status === 'FINALIZADA').length,
  };

  const fat = useMemo(() => listaFiltrada.reduce((s,o) => s + Number(o.total||0), 0), [listaFiltrada]);

  async function buscarChassi(chassi) {
    if (!chassi || chassi.length < 4) return;
    setBuscandoChassi(true);
    try {
      const r = await api.get(`/chassi/${encodeURIComponent(chassi.toUpperCase())}`);
      const d = r.data;
      setDadosChassi(d);
      setForm(f => ({
        ...f,
        chassi: chassi.toUpperCase(),
        modelo_moto:      d.moto?.modelo      || f.modelo_moto,
        cor_moto:         d.moto?.cor         || f.cor_moto,
        ano_moto:         d.moto?.ano_moto    || f.ano_moto,
        cliente_nome:     d.cliente?.nome     || f.cliente_nome,
        cliente_telefone: d.cliente?.telefone || f.cliente_telefone,
        cliente_cpf:      d.cliente?.cpf      || f.cliente_cpf,
        cliente_id:       d.cliente?.id       || f.cliente_id,
        tipo: d.garantia?.em_garantia ? 'GARANTIA' : f.tipo,
      }));
    } catch { setDadosChassi(null); }
    finally { setBuscandoChassi(false); }
  }

  async function buscarCliente(q) {
    if (!q || q.length < 3) { setSugestoesCliente([]); return; }
    setBuscandoCliente(true);
    try {
      const r = await api.get('/clientes', { params: { q } });
      setSugestoesCliente(r.data.slice(0, 6));
    } catch { setSugestoesCliente([]); }
    finally { setBuscandoCliente(false); }
  }

  async function selecionarCliente(c) {
    let motos = [];
    try {
      const r = await api.get('/clientes/buscar', { params: { q: c.nome } });
      if (r.data && r.data.motos) motos = r.data.motos;
    } catch {}
    const primeiraMoto = motos[0];
    setForm(f => ({
      ...f,
      cliente_nome: c.nome,
      cliente_telefone: c.telefone || '',
      cliente_cpf: c.cpf || '',
      cliente_id: c.id,
      chassi:      primeiraMoto ? primeiraMoto.chassi.toUpperCase() : f.chassi,
      modelo_moto: primeiraMoto ? primeiraMoto.modelo : f.modelo_moto,
      cor_moto:    primeiraMoto ? primeiraMoto.cor : f.cor_moto,
      ano_moto:    primeiraMoto ? primeiraMoto.ano : f.ano_moto,
    }));
    setSugestoesCliente([]);
    if (motos.length > 1) setMotosCliente(motos);
    else setMotosCliente([]);
  }

  async function criarOS() {
    if (!form.cliente_nome) { show('Informe o nome do cliente', 'err'); return; }
    setSaving(true);
    try {
      const r = await api.post('/os', form);
      show('OS criada!');
      setModal(false); setForm(vazio); setDadosChassi(null); setSugestoesCliente([]);
      nav(`/oficina/${r.data.id}`);
    } catch (e) { show(String(e), 'err'); }
    finally { setSaving(false); }
  }

  if (!user) return null;

  return (
    <div className="page">
      {Toast}
      <Topbar />
      <div className="pc">
        <div className="sh">
          <span className="sh-t">🔧 Oficina — Ordens de Serviço</span>
          <button className="btn btn-p btn-sm" onClick={() => { setModal(true); setForm(vazio); setDadosChassi(null); }}>+ Nova OS</button>
        </div>

        {/* STATS */}
        <div className="gf" style={{ marginBottom: 18 }}>
          <div className="stat blu" style={{ cursor:'pointer' }} onClick={() => setFiltroStatus(filtroStatus==='ABERTA'?'':'ABERTA')}>
            <div className="sv">{stats.abertas}</div><div className="sl">Abertas</div>
          </div>
          <div className="stat yel" style={{ cursor:'pointer' }} onClick={() => setFiltroStatus(filtroStatus==='EM_ANDAMENTO'?'':'EM_ANDAMENTO')}>
            <div className="sv">{stats.em_andamento}</div><div className="sl">Em andamento</div>
          </div>
          <div className="stat" style={{ cursor:'pointer', borderColor:'rgba(139,92,246,.25)' }} onClick={() => setFiltroStatus(filtroStatus==='AGUARDANDO'?'':'AGUARDANDO')}>
            <div className="sv" style={{ color:'#8b5cf6' }}>{stats.aguardando}</div><div className="sl">Aguardando</div>
          </div>
          <div className="stat grn" style={{ cursor:'pointer' }} onClick={() => setFiltroStatus(filtroStatus==='FINALIZADA'?'':'FINALIZADA')}>
            <div className="sv">{stats.finalizadas}</div><div className="sl">Finalizadas</div>
          </div>
          <div className="stat yel">
            <div className="sv" style={{fontSize:16}}>{formatBRL(fat)}</div><div className="sl">Faturamento filtrado</div>
          </div>
        </div>

        {/* FILTROS */}
        <div className="card card-sm" style={{ marginBottom: 14 }}>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:10 }}>
            <div className="srch" style={{ flex:1, minWidth:200 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input className="srchi" placeholder="Buscar por cliente, chassi, modelo ou número..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            <select className="inp" style={{ width:'auto' }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS_INFO).map(([v,s]) => <option key={v} value={v}>{s.label}</option>)}
            </select>
            <input className="inp" type="date" style={{width:'auto'}} value={filtDi} onChange={e=>{setFiltDi(e.target.value);setAtalhoAtivo('');}} />
            <span style={{lineHeight:'38px',color:'var(--tx3)'}}>até</span>
            <input className="inp" type="date" style={{width:'auto'}} value={filtDf} onChange={e=>{setFiltDf(e.target.value);setAtalhoAtivo('');}} />
            {(filtDi||filtDf) && <button className="btn btn-g btn-sm" onClick={()=>{setFiltDi('');setFiltDf('');setAtalhoAtivo('');}}>✕ Datas</button>}
            {filtroStatus && <button className="ab" onClick={() => setFiltroStatus('')}>✕ Status</button>}
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {ATALHOS.map(a=>(
              <button key={a.label} className={`btn btn-sm ${atalhoAtivo===a.label?'btn-p':'btn-g'}`}
                onClick={()=>aplicarAtalho(a.label,a.fn)}>{a.label}</button>
            ))}
          </div>
        </div>

        {/* LISTA */}
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:60 }}><span className="spin spin-lg" /></div>
        ) : listaFiltrada.length === 0 ? (
          <div className="card">
            <div className="empty">
              <div className="empty-i">🔧</div>
              <p>{filtroStatus ? `Nenhuma OS ${STATUS_INFO[filtroStatus]?.label?.toLowerCase()}.` : 'Nenhuma ordem de serviço com esses filtros.'}</p>
              <button className="btn btn-p" style={{ marginTop:16 }} onClick={() => setModal(true)}>+ Abrir primeira OS</button>
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {listaFiltrada.map(os => {
              const tipo = TIPOS_OS.find(t => t.v === os.tipo);
              return (
                <div key={os.id} className="card card-sm" style={{ cursor:'pointer', borderLeft:`3px solid ${tipo?.cor || '#3b82f6'}` }}
                  onClick={() => nav(`/oficina/${os.id}`)}>
                  <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                    <div style={{ minWidth:130 }}>
                      <div style={{ fontSize:12, fontFamily:'var(--mono)', color:'var(--tx3)', marginBottom:2 }}>{os.numero}</div>
                      <div style={{ fontSize:11, color: tipo?.cor }}>{tipo?.l}</div>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:14 }}>{os.cliente_nome}</div>
                      <div style={{ fontSize:12, color:'var(--tx2)', marginTop:2, display:'flex', gap:12 }}>
                        {os.modelo_moto && <span>🏍 {os.modelo_moto}</span>}
                        {os.chassi && <span style={{ fontFamily:'var(--mono)', fontSize:11 }}>{os.chassi}</span>}
                        {os.km && <span>📍 {os.km} km</span>}
                      </div>
                      {os.problema_relatado && (
                        <div style={{ fontSize:11, color:'var(--tx3)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:400 }}>
                          {os.problema_relatado}
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
                      <StatusBadge status={os.status} />
                      <div style={{ fontSize:11, color:'var(--tx3)' }}>{fmtDate(os.created_at)}</div>
                      {os.em_garantia ? <span className="badge b-grn" style={{ fontSize:10 }}>🛡 Garantia</span> : null}
                      {os.total > 0 && <span style={{ fontSize:12, fontWeight:600, color:'var(--grn)' }}>{formatBRL(os.total)}</span>}
                    </div>
                    <span style={{ color:'var(--tx3)', fontSize:18 }}>›</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL NOVA OS */}
      {modal && (
        <div className="mbg" onClick={() => setModal(false)}>
          <div className="mbox wide" onClick={e => e.stopPropagation()}>
            <div className="mhd">
              <h3>Nova Ordem de Serviço</h3>
              <button className="mclose" onClick={() => setModal(false)}>×</button>
            </div>

            {motosCliente.length > 1 && (
              <div style={{ background:'var(--yeldim)', border:'1px solid rgba(245,158,11,.25)', borderRadius:'var(--r)', padding:'10px 14px', marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--yel)', marginBottom:8 }}>
                  ⚠️ Cliente tem {motosCliente.length} motos — selecione qual vai entrar:
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {motosCliente.map((m, i) => (
                    <button key={i} className="ab" style={{ textAlign:'left', fontSize:12, padding:'6px 10px' }}
                      onClick={() => {
                        setForm(f => ({ ...f, chassi: m.chassi.toUpperCase(), modelo_moto: m.modelo, cor_moto: m.cor, ano_moto: m.ano }));
                        setMotosCliente([]);
                      }}>
                      🏍 <b>{m.modelo}</b> · {m.cor} · <span style={{ fontFamily:'var(--mono)' }}>{m.chassi}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ background:'var(--s2)', borderRadius:'var(--rl)', padding:'14px 16px', marginBottom:16 }}>
              <div className="clabel" style={{ marginBottom:8 }}>🔍 Busca rápida por chassi</div>
              <div style={{ display:'flex', gap:8 }}>
                <input ref={chassiRef} className="inp" placeholder="Digite o chassi..." style={{ flex:1, letterSpacing:1 }}
                  onChange={e => setForm(f => ({ ...f, chassi: e.target.value.toUpperCase() }))}
                  onKeyDown={e => e.key === 'Enter' && buscarChassi(chassiRef.current?.value)}
                  defaultValue={form.chassi}
                />
                <button className="btn btn-p btn-sm" onClick={() => buscarChassi(chassiRef.current?.value)} disabled={buscandoChassi}>
                  {buscandoChassi ? <span className="spin" /> : '🔍 Buscar'}
                </button>
              </div>
              {dadosChassi && (
                <div style={{ marginTop:10, padding:'10px 14px', background:'var(--grndim)', borderRadius:'var(--r)', border:'1px solid var(--grnbd)', fontSize:13 }}>
                  <div style={{ fontWeight:600, color:'var(--grn)', marginBottom:4 }}>✅ Chassi encontrado — dados preenchidos automaticamente</div>
                  <div style={{ display:'flex', gap:16, fontSize:12, color:'var(--tx2)', flexWrap:'wrap' }}>
                    {dadosChassi.moto && <span>🏍 {dadosChassi.moto.modelo} · {dadosChassi.moto.cor}</span>}
                    {dadosChassi.cliente && <span>👤 {dadosChassi.cliente.nome}</span>}
                    {dadosChassi.garantia && (
                      <span style={{ color: dadosChassi.garantia.em_garantia ? 'var(--grn)' : 'var(--red)' }}>
                        {dadosChassi.garantia.em_garantia ? `🛡 ${dadosChassi.garantia.dias_restantes} dias de garantia` : '❌ Fora de garantia'}
                      </span>
                    )}
                    {dadosChassi.revisoes?.length > 0 && <span>📋 {dadosChassi.revisoes.length} revisão(ões)</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="clabel">👤 Cliente</div>
            <div style={{ position:'relative', marginBottom:14 }}>
              <input className="inp" placeholder="Buscar cliente por nome ou telefone..." value={form.cliente_nome}
                onChange={e => { setForm(f=>({...f, cliente_nome:e.target.value, cliente_id:null})); buscarCliente(e.target.value); }}
              />
              {buscandoCliente && <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)' }}><span className="spin" style={{ width:14, height:14 }} /></span>}
              {sugestoesCliente.length > 0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--s2)', border:'1px solid var(--bd2)', borderRadius:'var(--r)', zIndex:100, maxHeight:200, overflowY:'auto' }}>
                  {sugestoesCliente.map(c => (
                    <div key={c.id} onClick={() => selecionarCliente(c)}
                      style={{ padding:'10px 14px', cursor:'pointer', fontSize:13, borderBottom:'1px solid var(--bd)', display:'flex', justifyContent:'space-between' }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--s3)'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <span><b>{c.nome}</b></span>
                      <span style={{ color:'var(--tx3)', fontSize:12 }}>{c.telefone} · {c.cidade}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="g2">
              <div className="field"><label>Telefone</label><input className="inp" placeholder="(81) 9..." value={form.cliente_telefone} onChange={e=>setForm({...form,cliente_telefone:e.target.value})} /></div>
              <div className="field"><label>CPF</label><input className="inp" placeholder="000.000.000-00" value={form.cliente_cpf} onChange={e=>setForm({...form,cliente_cpf:e.target.value})} /></div>
            </div>

            <div className="clabel" style={{ marginTop:4 }}>🏍 Moto</div>
            <div className="g2">
              <div className="field"><label>Chassi</label><input className="inp" style={{ letterSpacing:1 }} placeholder="Chassi" value={form.chassi} onChange={e=>setForm({...form,chassi:e.target.value.toUpperCase()})} /></div>
              <div className="field"><label>Modelo</label><input className="inp" placeholder="SHI 175 EFI" value={form.modelo_moto} onChange={e=>setForm({...form,modelo_moto:e.target.value})} /></div>
            </div>
            <div className="g2">
              <div className="field"><label>Cor</label><input className="inp" placeholder="Preto" value={form.cor_moto} onChange={e=>setForm({...form,cor_moto:e.target.value})} /></div>
              <div className="field"><label>KM atual</label><input className="inp" type="number" placeholder="Ex: 10500" value={form.km} onChange={e=>setForm({...form,km:e.target.value})} /></div>
            </div>

            <div className="g2">
              <div className="field"><label>Tipo de serviço</label>
                <select className="inp" value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}>
                  {TIPOS_OS.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
              <div className="field"><label>Agendado para</label>
                <div style={{ display:'flex', gap:6 }}>
                  <input className="inp" type="date" value={form.data_agendada} onChange={e=>setForm({...form,data_agendada:e.target.value})} />
                  <input className="inp" type="time" value={form.hora_agendada} onChange={e=>setForm({...form,hora_agendada:e.target.value})} style={{ width:100 }} />
                </div>
              </div>
            </div>

            <div className="field"><label>Problema relatado pelo cliente</label>
              <textarea className="inp" rows={3} placeholder="Descreva o problema ou serviço solicitado..." value={form.problema_relatado} onChange={e=>setForm({...form,problema_relatado:e.target.value})} />
            </div>

            <div className="mfoot">
              <button className="btn btn-g" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={criarOS} disabled={saving}>
                {saving ? <span className="spin" /> : 'Abrir OS'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
