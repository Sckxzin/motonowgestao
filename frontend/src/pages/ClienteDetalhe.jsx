import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { formatBRL, initials, fmtDate, FILIAIS } from '../utils';

export default function ClienteDetalhe() {
  const { id } = useParams(); const nav = useNavigate();
  const { show, Toast } = useToast();
  const [dados, setDados] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [modMoto, setModMoto] = useState(false);
  const [mf, setMf] = useState({ chassi:'', modelo:'', cor:'', ano:'' });

  async function load() {
    try { const r = await api.get(`/clientes/${id}`); setDados(r.data); const c=r.data.cliente; setForm({nome:c.nome,cpf:c.cpf||'',telefone:c.telefone||'',cidade:c.cidade||'',observacao:c.observacao||''}); }
    catch { nav('/clientes'); }
  }
  useEffect(()=>{ load(); }, [id]);

  async function salvar() { setSaving(true); try { await api.put(`/clientes/${id}`,form); show('Salvo!'); setEditing(false); load(); } catch(e){show(String(e),'err');} finally{setSaving(false);} }
  async function addMoto() { if(!mf.chassi&&!mf.modelo){show('Informe chassi ou modelo','err');return;} try { await api.post(`/clientes/${id}/motos`,mf); show('Moto adicionada!'); setModMoto(false); setMf({chassi:'',modelo:'',cor:'',ano:''}); load(); } catch(e){show(String(e),'err');} }
  async function delMoto(mid) { if(!window.confirm('Remover?'))return; try{await api.delete(`/clientes/${id}/motos/${mid}`);show('Removida!');load();}catch(e){show(String(e),'err');} }

  if (!dados) return <div className="page"><Topbar /><div style={{display:'flex',justifyContent:'center',padding:80}}><span className="spin spin-lg" /></div></div>;
  const { cliente, motos, vendas, revisoes, stats } = dados;

  return (
    <div className="page">
      {Toast}
      <Topbar />
      <div className="pc">
        <div className="sh">
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button className="btn btn-g btn-sm" onClick={()=>nav('/clientes')}>← Clientes</button>
            <span className="sh-t">{cliente.nome}</span>
          </div>
          <div style={{display:'flex',gap:8}}>
            {!editing?<button className="btn btn-g btn-sm" onClick={()=>setEditing(true)}>✏️ Editar</button>:<>
              <button className="btn btn-g btn-sm" onClick={()=>setEditing(false)}>Cancelar</button>
              <button className="btn btn-p btn-sm" onClick={salvar} disabled={saving}>{saving?<span className="spin" />:'Salvar'}</button>
            </>}
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'320px 1fr',gap:20,alignItems:'start'}}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div className="card">
              <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:18}}>
                <div className="av" style={{width:52,height:52,fontSize:18}}>{initials(cliente.nome)}</div>
                <div>
                  {editing?<input className="inp" value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} />:<div style={{fontSize:17,fontWeight:700}}>{cliente.nome}</div>}
                  <div style={{fontSize:12,color:'var(--tx3)',marginTop:3}}>Desde {fmtDate(cliente.created_at)}</div>
                </div>
              </div>
              {editing?(<>
                <div className="field"><label>CPF</label><input className="inp" value={form.cpf} onChange={e=>setForm({...form,cpf:e.target.value})} /></div>
                <div className="field"><label>Telefone</label><input className="inp" value={form.telefone} onChange={e=>setForm({...form,telefone:e.target.value})} /></div>
                <div className="field"><label>Cidade</label><select className="inp" value={form.cidade} onChange={e=>setForm({...form,cidade:e.target.value})}><option value="">Selecione</option>{FILIAIS.map(f=><option key={f}>{f}</option>)}</select></div>
                <div className="field"><label>Obs</label><textarea className="inp" value={form.observacao} onChange={e=>setForm({...form,observacao:e.target.value})} /></div>
              </>):<>
                <table style={{width:'100%',fontSize:13,borderCollapse:'collapse'}}>
                  <tbody>
                    {[['Telefone',cliente.telefone],['CPF',cliente.cpf],['Cidade',cliente.cidade]].filter(([,v])=>v).map(([l,v])=>(
                      <tr key={l}><td style={{color:'var(--tx3)',padding:'5px 0',width:80}}>{l}</td><td style={{color:'var(--tx)'}}>{v}</td></tr>
                    ))}
                  </tbody>
                </table>
                {cliente.observacao&&<div style={{marginTop:12,background:'var(--s2)',borderRadius:'var(--r)',padding:'10px 12px',fontSize:12,color:'var(--tx2)',lineHeight:1.6}}>{cliente.observacao}</div>}
              </>}
            </div>
            <div className="g2">
              <div className="stat grn"><div className="sv" style={{fontSize:16}}>{formatBRL(stats.totalGasto)}</div><div className="sl">Gasto total</div></div>
              <div className="stat"><div className="sv" style={{fontSize:20}}>{stats.qtdVendas}</div><div className="sl">Compras</div></div>
              <div className="stat"><div className="sv" style={{fontSize:20}}>{stats.qtdRevisoes}</div><div className="sl">Revisões</div></div>
              <div className="stat"><div className="sv" style={{fontSize:20}}>{motos.length}</div><div className="sl">Motos</div></div>
            </div>
            <div className="card">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                <div className="clabel" style={{marginBottom:0}}>Motos cadastradas</div>
                <button className="ab" onClick={()=>setModMoto(true)}>+ Add</button>
              </div>
              {motos.length===0?<p style={{fontSize:13,color:'var(--tx3)',textAlign:'center',padding:'10px 0'}}>Nenhuma moto</p>:motos.map(m=>(
                <div key={m.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderTop:'1px solid var(--bd)'}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600}}>{m.modelo} {m.ano&&`· ${m.ano}`} {m.cor&&`· ${m.cor}`}</div>
                    {m.chassi&&<div style={{fontSize:11,color:'var(--tx3)',fontFamily:'JetBrains Mono,monospace',marginTop:2}}>{m.chassi}</div>}
                  </div>
                  <button className="ab red" onClick={()=>delMoto(m.id)}>✕</button>
                </div>
              ))}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <button className="btn btn-p" onClick={()=>nav('/carrinho')}>🛒 Vender peça</button>
              <button className="btn btn-g" onClick={()=>nav(`/oficina?cliente=${cliente.id}`)}>🔧 Nova OS / Revisão</button>
              <button className="btn btn-g btn-sm" onClick={()=>nav(`/chassi`)}>🔍 Buscar chassi</button>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div className="card">
              <div className="clabel">Histórico de compras</div>
              {vendas.length===0?<div className="empty" style={{padding:'20px 0'}}><p>Nenhuma compra</p></div>:
              <div className="tw"><table className="t">
                <thead><tr><th>Data</th><th>Total</th><th>Pagamento</th><th>Moto</th><th>Cidade</th></tr></thead>
                <tbody>{vendas.map(v=>(
                  <tr key={v.id}>
                    <td style={{fontSize:12}}>{fmtDate(v.created_at)}</td>
                    <td><b style={{color:'var(--grn)'}}>{formatBRL(v.total)}</b></td>
                    <td>{v.forma_pagamento||'—'}</td>
                    <td className="mono">{v.chassi_moto||v.modelo_moto||'—'}</td>
                    <td>{v.cidade}</td>
                  </tr>
                ))}</tbody>
              </table></div>}
            </div>
            <div className="card">
              <div className="clabel">Histórico de revisões</div>
              {revisoes.length===0?<div className="empty" style={{padding:'20px 0'}}><p>Nenhuma revisão</p></div>:
              <div className="tw"><table className="t">
                <thead><tr><th>Data</th><th>Tipo</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>{revisoes.map(r=>(
                  <tr key={r.id}>
                    <td style={{fontSize:12}}>{fmtDate(r.created_at)}</td>
                    <td>{r.tipo_revisao||'—'}</td>
                    <td>{r.total?formatBRL(r.total):'—'}</td>
                    <td><span className={`badge st-${(r.status||'').toLowerCase()}`}>{r.status}</span></td>
                  </tr>
                ))}</tbody>
              </table></div>}
            </div>
          </div>
        </div>
      </div>
      {modMoto&&<div className="mbg" onClick={()=>setModMoto(false)}><div className="mbox" onClick={e=>e.stopPropagation()}>
        <div className="mhd"><h3>Adicionar moto</h3><button className="mclose" onClick={()=>setModMoto(false)}>×</button></div>
        <div className="field"><label>Chassi</label><input className="inp" autoFocus value={mf.chassi} onChange={e=>setMf({...mf,chassi:e.target.value})} /></div>
        <div className="field"><label>Modelo</label><input className="inp" value={mf.modelo} onChange={e=>setMf({...mf,modelo:e.target.value})} /></div>
        <div className="g2">
          <div className="field"><label>Cor</label><input className="inp" value={mf.cor} onChange={e=>setMf({...mf,cor:e.target.value})} /></div>
          <div className="field"><label>Ano</label><input className="inp" type="number" value={mf.ano} onChange={e=>setMf({...mf,ano:e.target.value})} /></div>
        </div>
        <div className="mfoot">
          <button className="btn btn-g" onClick={()=>setModMoto(false)}>Cancelar</button>
          <button className="btn btn-p" onClick={addMoto}>Adicionar</button>
        </div>
      </div></div>}
    </div>
  );
}
