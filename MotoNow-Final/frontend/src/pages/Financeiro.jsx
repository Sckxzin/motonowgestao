import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, formatBRL, fmtDate } from '../utils';

export default function Financeiro() {
  const nav = useNavigate(); const user = getUser();
  const { show, Toast } = useToast();
  const hoje = new Date().toISOString().slice(0,10);
  const [data, setData] = useState(hoje);
  const [hist, setHist] = useState([]);
  const [form, setForm] = useState({saldo:'',a_receber:'',estoque_compra:'',estoque_venda:'',qtd_estoque:'',shineray:'',eduardo:'',fornecedor:'',jota_compra:'',jota_venda:'',observacao:''});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) nav('/');
    api.get('/financeiro').then(r=>setHist(r.data||[])).catch(e=>show(String(e),'err'));
  }, []);

  useEffect(() => {
    api.get('/financeiro',{params:{data}}).then(r=>{
      const d=r.data;
      if(d) setForm({saldo:String(d.saldo||''),a_receber:String(d.a_receber||''),estoque_compra:String(d.estoque_compra||''),estoque_venda:String(d.estoque_venda||''),qtd_estoque:String(d.qtd_estoque||''),shineray:String(d.shineray||''),eduardo:String(d.eduardo||''),fornecedor:String(d.fornecedor||''),jota_compra:String(d.jota_compra||''),jota_venda:String(d.jota_venda||''),observacao:d.observacao||''});
      else setForm({saldo:'',a_receber:'',estoque_compra:'',estoque_venda:'',qtd_estoque:'',shineray:'',eduardo:'',fornecedor:'',jota_compra:'',jota_venda:'',observacao:''});
    }).catch(()=>{});
  }, [data]);

  async function salvar() {
    setSaving(true);
    try {
      const payload={data,...Object.fromEntries(Object.entries(form).map(([k,v])=>k==='observacao'?[k,v||null]:[k,v===''?0:Number(v)]))};
      await api.post('/financeiro',payload);
      show('Salvo!');
      api.get('/financeiro').then(r=>setHist(r.data||[]));
    } catch(e){show(String(e),'err');}finally{setSaving(false);}
  }

  const campos = [['saldo','Saldo'],['a_receber','A Receber'],['estoque_compra','Estoque Compra'],['estoque_venda','Estoque Venda'],['qtd_estoque','Qtd Estoque'],['shineray','Shineray'],['eduardo','Eduardo'],['fornecedor','Fornecedor'],['jota_compra','Jota Compra'],['jota_venda','Jota Venda']];

  if (!user) return null;
  return (
    <div className="page">{Toast}<Topbar />
      <div className="pc">
        <div className="sh"><span className="sh-t">💰 Controle Financeiro</span></div>
        <div className="g2" style={{alignItems:'start'}}>
          <div className="card">
            <div className="clabel">Registro diário</div>
            <div className="field"><label>Data</label><input className="inp" type="date" value={data} onChange={e=>setData(e.target.value)} /></div>
            <div className="g2">
              {campos.map(([k,l])=>(
                <div key={k} className="field"><label>{l}</label><input className="inp" type="number" step="0.01" placeholder="0" value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} /></div>
              ))}
            </div>
            <div className="field"><label>Observação</label><textarea className="inp" value={form.observacao} onChange={e=>setForm({...form,observacao:e.target.value})} /></div>
            <button className="btn btn-p btn-full" onClick={salvar} disabled={saving}>{saving?<span className="spin" />:'Salvar'}</button>
          </div>
          <div className="card">
            <div className="clabel">Histórico (últimos 90 dias)</div>
            <div className="tw"><table className="t">
              <thead><tr><th>Data</th><th>Saldo</th><th>A Receber</th><th>Est. Venda</th></tr></thead>
              <tbody>
                {hist.length===0&&<tr><td colSpan={4}><div className="empty" style={{padding:'20px 0'}}><p>Sem registros.</p></div></td></tr>}
                {hist.map(h=>(
                  <tr key={h.id} style={{cursor:'pointer'}} onClick={()=>setData(h.data)}>
                    <td><b>{fmtDate(h.data)}</b></td>
                    <td style={{color:'var(--grn)'}}>{formatBRL(h.saldo)}</td>
                    <td>{formatBRL(h.a_receber)}</td>
                    <td>{formatBRL(h.estoque_venda)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>
      </div>
    </div>
  );
}
