import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, formatBRL, fmtDateTime } from '../utils';

export default function Pendentes() {
  const nav = useNavigate(); const user = getUser();
  const { show, Toast } = useToast();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recusando, setRecusando] = useState(null);
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (!user) nav('/');
    api.get('/pendentes').then(r=>{ setLista(r.data); setLoading(false); }).catch(e=>{ show(String(e),'err'); setLoading(false); });
  }, []);

  async function aprovar(id) {
    try { await api.post(`/pendentes/${id}/aprovar`,{}); setLista(p=>p.filter(x=>x.id!==id)); show('Venda aprovada!'); }
    catch(e){ show(String(e),'err'); }
  }

  async function recusar() {
    try { await api.post(`/pendentes/${recusando}/recusar`,{motivo_recusa:motivo}); setLista(p=>p.filter(x=>x.id!==recusando)); setRecusando(null); setMotivo(''); show('Venda recusada — moto liberada.'); }
    catch(e){ show(String(e),'err'); }
  }

  if (!user) return null;
  return (
    <div className="page">{Toast}<Topbar />
      <div className="pc">
        <div className="sh"><span className="sh-t">🕒 Aprovações Pendentes</span><span className="badge b-yel">{lista.length} pendente{lista.length!==1?'s':''}</span></div>
        {loading?<div style={{display:'flex',justifyContent:'center',padding:60}}><span className="spin spin-lg" /></div>
        :lista.length===0?<div className="card"><div className="empty"><div className="empty-i">✅</div><p>Nenhuma aprovação pendente!</p></div></div>
        :<div style={{display:'flex',flexDirection:'column',gap:12}}>
          {lista.map(p=>(
            <div key={p.id} className="card">
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                    <span className="badge b-yel">Pendente</span>
                    <span style={{fontSize:12,color:'var(--tx3)'}}>{fmtDateTime(p.created_at)}</span>
                  </div>
                  <div className="g2" style={{gap:8}}>
                    {[['Moto',`${p.modelo} · ${p.cor}`],['Chassi',p.chassi],['Cliente',p.nome_cliente],['Valor',formatBRL(p.valor)],['Filial venda',p.filial_venda],['Pagamento',p.forma_pagamento||'—'],['Gasolina',p.gasolina?formatBRL(p.gasolina):'—'],['Brinde',p.brinde?'Sim':'Não'],['Como chegou',p.como_chegou||'—'],['WhatsApp',p.numero_cliente||'—']].map(([l,v])=>(
                      <div key={l}><span style={{fontSize:11,color:'var(--tx3)'}}>{l}</span><div style={{fontSize:13,fontWeight:500,marginTop:2}}>{v}</div></div>
                    ))}
                  </div>
                </div>
                <div style={{display:'flex',gap:8,flexShrink:0}}>
                  <button className="btn btn-s" onClick={()=>aprovar(p.id)}>✅ Aprovar</button>
                  <button className="btn btn-g" style={{color:'var(--red)',borderColor:'var(--redbd)'}} onClick={()=>{setRecusando(p.id);setMotivo('')}}>✕ Recusar</button>
                </div>
              </div>
            </div>
          ))}
        </div>}
      </div>
      {recusando&&<div className="mbg" onClick={()=>setRecusando(null)}><div className="mbox" onClick={e=>e.stopPropagation()}>
        <div className="mhd"><h3>Recusar venda</h3><button className="mclose" onClick={()=>setRecusando(null)}>×</button></div>
        <div className="field"><label>Motivo (opcional)</label><textarea className="inp" autoFocus value={motivo} onChange={e=>setMotivo(e.target.value)} /></div>
        <div className="mfoot"><button className="btn btn-g" onClick={()=>setRecusando(null)}>Cancelar</button><button className="btn btn-p" onClick={recusar}>Confirmar recusa</button></div>
      </div></div>}
    </div>
  );
}
