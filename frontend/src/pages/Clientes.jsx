import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, initials, fmtDate, FILIAIS } from '../utils';

export default function Clientes() {
  const nav = useNavigate();
  const user = getUser();
  const { show, Toast } = useToast();
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nome:'', cpf:'', telefone:'', cidade:'', observacao:'' });

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/clientes', { params: busca?{q:busca}:{} }); setLista(r.data); }
    catch (e) { show(String(e),'err'); }
    finally { setLoading(false); }
  }, [busca]);

  useEffect(() => { if (!user) nav('/'); }, []);
  useEffect(() => { const t=setTimeout(load,350); return ()=>clearTimeout(t); }, [busca]);

  async function salvar() {
    if (!form.nome) { show('Nome obrigatório','err'); return; }
    setSaving(true);
    try { await api.post('/clientes', form); show('Cliente cadastrado!'); setModal(false); setForm({nome:'',cpf:'',telefone:'',cidade:'',observacao:''}); load(); }
    catch (e) { show(String(e),'err'); }
    finally { setSaving(false); }
  }

  if (!user) return null;

  return (
    <div className="page">
      {Toast}
      <Topbar />
      <div className="pc">
        <div className="sh"><span className="sh-t">👥 Clientes</span><button className="btn btn-p btn-sm" onClick={()=>setModal(true)}>+ Novo cliente</button></div>
        <div className="card card-sm" style={{marginBottom:14}}>
          <div className="srch">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input className="srchi" placeholder="Buscar por nome, CPF ou telefone..." value={busca} onChange={e=>setBusca(e.target.value)} />
          </div>
        </div>
        {loading?<div style={{display:'flex',justifyContent:'center',padding:60}}><span className="spin spin-lg" /></div>
        :lista.length===0?<div className="empty"><div className="empty-i">👥</div><p>Nenhum cliente encontrado.</p></div>
        :<div style={{display:'flex',flexDirection:'column',gap:8}}>
          {lista.map(c=>(
            <div key={c.id} className="cli" onClick={()=>nav(`/clientes/${c.id}`)}>
              <div style={{display:'flex',alignItems:'center',gap:13}}>
                <div className="av">{initials(c.nome)}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14}}>{c.nome}</div>
                  <div style={{fontSize:12,color:'var(--tx3)',marginTop:3,display:'flex',gap:12}}>
                    {c.telefone&&<span>📞 {c.telefone}</span>}
                    {c.cpf&&<span>CPF: {c.cpf}</span>}
                    {c.cidade&&<span>📍 {c.cidade}</span>}
                  </div>
                </div>
                <span style={{fontSize:11,color:'var(--tx3)'}}>{fmtDate(c.created_at)}</span>
                <span style={{color:'var(--tx3)'}}>›</span>
              </div>
            </div>
          ))}
        </div>}
      </div>
      {modal&&<div className="mbg" onClick={()=>setModal(false)}><div className="mbox" onClick={e=>e.stopPropagation()}>
        <div className="mhd"><h3>Novo cliente</h3><button className="mclose" onClick={()=>setModal(false)}>×</button></div>
        <div className="field"><label>Nome *</label><input className="inp" autoFocus value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} /></div>
        <div className="g2">
          <div className="field"><label>CPF</label><input className="inp" placeholder="000.000.000-00" value={form.cpf} onChange={e=>setForm({...form,cpf:e.target.value})} /></div>
          <div className="field"><label>Telefone</label><input className="inp" value={form.telefone} onChange={e=>setForm({...form,telefone:e.target.value})} /></div>
        </div>
        <div className="field"><label>Cidade</label><select className="inp" value={form.cidade} onChange={e=>setForm({...form,cidade:e.target.value})}><option value="">Selecione</option>{FILIAIS.map(f=><option key={f}>{f}</option>)}</select></div>
        <div className="field"><label>Observações</label><textarea className="inp" value={form.observacao} onChange={e=>setForm({...form,observacao:e.target.value})} /></div>
        <div className="mfoot">
          <button className="btn btn-g" onClick={()=>setModal(false)}>Cancelar</button>
          <button className="btn btn-p" onClick={salvar} disabled={saving}>{saving?<span className="spin" />:'Salvar'}</button>
        </div>
      </div></div>}
    </div>
  );
}
