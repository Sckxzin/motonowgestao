import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, formatBRL, fmtDate, FILIAIS } from '../utils';

export default function Vendas() {
  const nav = useNavigate(); const user = getUser();
  const { show, Toast } = useToast();
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aberta, setAberta] = useState(null);
  const [filtC, setFiltC] = useState('TODAS');
  const [filtD, setFiltD] = useState('');
  const [edit, setEdit] = useState(null);
  const [ef, setEf] = useState({});

  useEffect(() => {
    if (!user) nav('/');
    api.get('/vendas').then(r=>{ setVendas(r.data); setLoading(false); }).catch(e=>{ show(String(e),'err'); setLoading(false); });
  }, []);

  const filt = useMemo(() => vendas.filter(v=>(filtC==='TODAS'||v.cidade===filtC)&&(!filtD||v.created_at?.startsWith(filtD))), [vendas,filtC,filtD]);
  const fat  = useMemo(() => filt.reduce((s,v)=>s+Number(v.total||0),0), [filt]);

  async function salvarEdit() {
    try { const r=await api.put(`/vendas/${edit.id}`,ef); setVendas(prev=>prev.map(v=>v.id===edit.id?{...v,...r.data}:v)); show('Salvo!'); setEdit(null); }
    catch(e){show(String(e),'err');}
  }

  if (!user) return null;

  return (
    <div className="page">{Toast}<Topbar />
      <div className="pc">
        <div className="sh"><span className="sh-t">🧾 Histórico de Vendas</span></div>
        <div className="gf" style={{marginBottom:18}}>
          <div className="stat red"><div className="sv" style={{fontSize:18}}>{formatBRL(fat)}</div><div className="sl">Faturamento</div></div>
          <div className="stat"><div className="sv">{filt.length}</div><div className="sl">Vendas</div></div>
          <div className="stat grn"><div className="sv" style={{fontSize:18}}>{formatBRL(filt.length?fat/filt.length:0)}</div><div className="sl">Ticket médio</div></div>
        </div>
        <div className="card card-sm" style={{marginBottom:14}}>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <select className="inp" style={{width:'auto'}} value={filtC} onChange={e=>setFiltC(e.target.value)}>
              <option value="TODAS">Todas filiais</option>
              {FILIAIS.map(f=><option key={f}>{f}</option>)}
            </select>
            <input className="inp" type="date" style={{width:'auto'}} value={filtD} onChange={e=>setFiltD(e.target.value)} />
            {filtD&&<button className="btn btn-g btn-sm" onClick={()=>setFiltD('')}>Limpar</button>}
          </div>
        </div>
        {loading?<div style={{display:'flex',justifyContent:'center',padding:60}}><span className="spin spin-lg" /></div>:
        <div className="tw"><table className="t">
          <thead><tr><th>#</th><th>Data</th><th>Cliente</th><th>Total</th><th>Pagamento</th><th>Cidade</th><th>RP</th><th>Itens</th><th>Nota</th><th>✏️</th></tr></thead>
          <tbody>
            {filt.length===0&&<tr><td colSpan={10}><div className="empty"><p>Nenhuma venda.</p></div></td></tr>}
            {filt.flatMap(v=>[
              <tr key={v.id}>
                <td><span className="badge b-gray">#{v.id}</span></td>
                <td style={{fontSize:12}}>{fmtDate(v.created_at)}</td>
                <td><b>{v.cliente_nome}</b><div style={{fontSize:11,color:'var(--tx3)'}}>{v.cliente_telefone}</div></td>
                <td><b style={{color:'var(--grn)'}}>{formatBRL(v.total)}</b></td>
                <td>{v.forma_pagamento||'—'}</td>
                <td>{v.cidade}</td>
                <td><span className={`badge ${v.rp?'b-grn':'b-gray'}`}>{v.rp?'Sim':'Não'}</span></td>
                <td><button className="ab" onClick={()=>setAberta(aberta===v.id?null:v.id)}>{aberta===v.id?'▲':'▼'}</button></td>
                <td><button className="ab" onClick={()=>nav(`/nota?id=${v.id}`)}>🧾</button></td>
                <td><button className="ab" onClick={()=>{setEdit(v);setEf({cliente_nome:v.cliente_nome,cliente_telefone:v.cliente_telefone||'',forma_pagamento:v.forma_pagamento||'',cidade:v.cidade,observacao:v.observacao||'',total:v.total,rp:!!v.rp,rr:!!v.rr})}}>✏️</button></td>
              </tr>,
              aberta===v.id&&<tr key={`${v.id}-d`}><td colSpan={10}><div style={{padding:'12px 16px',background:'var(--s2)',fontSize:13}}><b>Itens:</b><ul style={{margin:'6px 0 0',paddingLeft:20}}>{(v.itens||[]).map((it,i)=><li key={i}>{it.nome_peca} — {it.quantidade}× {formatBRL(it.preco_unitario)}</li>)}</ul>{v.observacao&&<div style={{marginTop:8}}><b>Obs:</b> {v.observacao}</div>}</div></td></tr>,
            ])}
          </tbody>
        </table></div>}
      </div>
      {edit&&<div className="mbg" onClick={()=>setEdit(null)}><div className="mbox" onClick={e=>e.stopPropagation()}>
        <div className="mhd"><h3>Editar #{edit.id}</h3><button className="mclose" onClick={()=>setEdit(null)}>×</button></div>
        <div className="field"><label>Cliente</label><input className="inp" value={ef.cliente_nome||''} onChange={e=>setEf({...ef,cliente_nome:e.target.value})} /></div>
        <div className="field"><label>Pagamento</label><input className="inp" value={ef.forma_pagamento||''} onChange={e=>setEf({...ef,forma_pagamento:e.target.value})} /></div>
        <div className="field"><label>Total</label><input className="inp" type="number" step="0.01" value={ef.total||0} onChange={e=>setEf({...ef,total:Number(e.target.value)})} /></div>
        <div className="field"><label>Obs</label><textarea className="inp" value={ef.observacao||''} onChange={e=>setEf({...ef,observacao:e.target.value})} /></div>
        <div style={{display:'flex',gap:20,marginTop:4}}>
          <label className="ck"><input type="checkbox" checked={!!ef.rp} onChange={e=>setEf({...ef,rp:e.target.checked})} /> RP</label>
          <label className="ck"><input type="checkbox" checked={!!ef.rr} onChange={e=>setEf({...ef,rr:e.target.checked})} /> RR</label>
        </div>
        <div className="mfoot"><button className="btn btn-g" onClick={()=>setEdit(null)}>Cancelar</button><button className="btn btn-p" onClick={salvarEdit}>Salvar</button></div>
      </div></div>}
    </div>
  );
}
