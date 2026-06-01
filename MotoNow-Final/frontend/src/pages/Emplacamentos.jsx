import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, formatBRL, fmtDate, FILIAIS } from '../utils';

export default function Emplacamentos() {
  const nav = useNavigate(); const user = getUser();
  const { show, Toast } = useToast();
  const [lista, setLista] = useState([]);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const empty = {cliente:'',moto:'',cidade:'',data:'',valor:'',custo:'',forma_pagamento:'',pago:false,entregue:false};
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!user) nav('/');
    api.get('/emplacamentos').then(r=>setLista(r.data)).catch(e=>show(String(e),'err'));
  }, []);

  const stats = useMemo(()=>({total:lista.length,lucro:lista.reduce((s,e)=>s+(Number(e.valor||0)-Number(e.custo||0)),0),pendentes:lista.filter(e=>!e.entregue).length}),[lista]);

  function abrir(e=null) { if(e){setEdit(e);setForm({cliente:e.cliente,moto:e.moto,cidade:e.cidade,data:e.data,valor:String(e.valor),custo:String(e.custo),forma_pagamento:e.forma_pagamento||'',pago:!!e.pago,entregue:!!e.entregue});}else{setEdit(null);setForm(empty);} setModal(true); }

  async function salvar() {
    if (!form.cliente||!form.moto||!form.cidade||!form.data) { show('Preencha os campos obrigatórios','err'); return; }
    setSaving(true);
    try {
      const payload={...form,valor:Number(form.valor||0),custo:Number(form.custo||0)};
      if(edit){const r=await api.put(`/emplacamentos/${edit.id}`,payload);setLista(p=>p.map(e=>e.id===edit.id?r.data:e));}
      else{const r=await api.post('/emplacamentos',payload);setLista(p=>[...p,r.data]);}
      setModal(false);setEdit(null);setForm(empty);show(edit?'Atualizado!':'Cadastrado!');
    } catch(e){show(String(e),'err');}finally{setSaving(false);}
  }

  if (!user) return null;
  return (
    <div className="page">{Toast}<Topbar />
      <div className="pc">
        <div className="sh"><span className="sh-t">🪪 Emplacamentos</span><button className="btn btn-p btn-sm" onClick={()=>abrir()}>+ Novo</button></div>
        <div className="gf" style={{marginBottom:18}}>
          <div className="stat"><div className="sv">{stats.total}</div><div className="sl">Total</div></div>
          <div className="stat grn"><div className="sv" style={{fontSize:18}}>{formatBRL(stats.lucro)}</div><div className="sl">Lucro total</div></div>
          <div className="stat yel"><div className="sv">{stats.pendentes}</div><div className="sl">Pendentes entrega</div></div>
        </div>
        <div className="tw"><table className="t">
          <thead><tr><th>Data</th><th>Cliente</th><th>Moto</th><th>Filial</th><th>Valor</th><th>Custo</th><th>Lucro</th><th>Pago</th><th>Entregue</th><th>✏️</th></tr></thead>
          <tbody>
            {lista.length===0&&<tr><td colSpan={10}><div className="empty"><p>Nenhum emplacamento.</p></div></td></tr>}
            {lista.map(e=>(
              <tr key={e.id}>
                <td style={{fontSize:12}}>{fmtDate(e.data)}</td>
                <td><b>{e.cliente}</b></td>
                <td>{e.moto}</td>
                <td>{e.cidade}</td>
                <td>{formatBRL(e.valor)}</td>
                <td style={{color:'var(--tx3)'}}>{formatBRL(e.custo)}</td>
                <td><b style={{color:'var(--grn)'}}>{formatBRL(Number(e.valor)-Number(e.custo))}</b></td>
                <td><span className={`badge ${e.pago?'b-grn':'b-yel'}`}>{e.pago?'Sim':'Não'}</span></td>
                <td><span className={`badge ${e.entregue?'b-grn':'b-yel'}`}>{e.entregue?'Sim':'Não'}</span></td>
                <td><button className="ab" onClick={()=>abrir(e)}>✏️</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
      {modal&&<div className="mbg" onClick={()=>setModal(false)}><div className="mbox" onClick={e=>e.stopPropagation()}>
        <div className="mhd"><h3>{edit?'Editar':'Novo'} emplacamento</h3><button className="mclose" onClick={()=>setModal(false)}>×</button></div>
        <div className="g2">
          <div className="field"><label>Cliente *</label><input className="inp" autoFocus value={form.cliente} onChange={e=>setForm({...form,cliente:e.target.value})} /></div>
          <div className="field"><label>Moto *</label><input className="inp" value={form.moto} onChange={e=>setForm({...form,moto:e.target.value})} /></div>
        </div>
        <div className="g2">
          <div className="field"><label>Filial *</label><select className="inp" value={form.cidade} onChange={e=>setForm({...form,cidade:e.target.value})}><option value="">Selecione</option>{FILIAIS.map(f=><option key={f}>{f}</option>)}</select></div>
          <div className="field"><label>Data *</label><input className="inp" type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})} /></div>
        </div>
        <div className="g2">
          <div className="field"><label>Valor cobrado *</label><input className="inp" type="number" step="0.01" value={form.valor} onChange={e=>setForm({...form,valor:e.target.value})} /></div>
          <div className="field"><label>Custo *</label><input className="inp" type="number" step="0.01" value={form.custo} onChange={e=>setForm({...form,custo:e.target.value})} /></div>
        </div>
        <div className="field"><label>Forma de pagamento</label><input className="inp" value={form.forma_pagamento} onChange={e=>setForm({...form,forma_pagamento:e.target.value})} /></div>
        <div style={{display:'flex',gap:20,marginTop:4}}>
          <label className="ck"><input type="checkbox" checked={form.pago} onChange={e=>setForm({...form,pago:e.target.checked})} /> Pago</label>
          <label className="ck"><input type="checkbox" checked={form.entregue} onChange={e=>setForm({...form,entregue:e.target.checked})} /> Entregue</label>
        </div>
        <div className="mfoot"><button className="btn btn-g" onClick={()=>setModal(false)}>Cancelar</button><button className="btn btn-p" onClick={salvar} disabled={saving}>{saving?<span className="spin" />:'Salvar'}</button></div>
      </div></div>}
    </div>
  );
}
