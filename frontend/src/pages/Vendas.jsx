import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, isDir, formatBRL, fmtDate, FILIAIS } from '../utils';

const ATALHOS = [
  { label:'Hoje',        fn:() => { const d=new Date().toISOString().slice(0,10); return [d,d]; } },
  { label:'Ontem',       fn:() => { const d=new Date(Date.now()-86400000).toISOString().slice(0,10); return [d,d]; } },
  { label:'7 dias',      fn:() => { const e=new Date().toISOString().slice(0,10); const i=new Date(Date.now()-6*86400000).toISOString().slice(0,10); return [i,e]; } },
  { label:'30 dias',     fn:() => { const e=new Date().toISOString().slice(0,10); const i=new Date(Date.now()-29*86400000).toISOString().slice(0,10); return [i,e]; } },
  { label:'Mês atual',   fn:() => { const n=new Date(); const i=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`; const e=new Date(n.getFullYear(),n.getMonth()+1,0).toISOString().slice(0,10); return [i,e]; } },
  { label:'Mês passado', fn:() => { const n=new Date(); const m=n.getMonth()===0?new Date(n.getFullYear()-1,11,1):new Date(n.getFullYear(),n.getMonth()-1,1); const i=m.toISOString().slice(0,10); const e=new Date(m.getFullYear(),m.getMonth()+1,0).toISOString().slice(0,10); return [i,e]; } },
];

export default function Vendas() {
  const nav = useNavigate(); const user = getUser();
  const { show, Toast } = useToast();
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aberta, setAberta] = useState(null);

  // Filtros
  const [filtCidade, setFiltCidade] = useState('TODAS');
  const [filtDi, setFiltDi] = useState('');
  const [filtDf, setFiltDf] = useState('');
  const [filtBusca, setFiltBusca] = useState('');
  const [atalhoAtivo, setAtalhoAtivo] = useState('');

  // Edit
  const [edit, setEdit] = useState(null);
  const [ef, setEf] = useState({});

  useEffect(() => {
    if (!user) nav('/');
    api.get('/vendas').then(r => { setVendas(r.data); setLoading(false); }).catch(e => { show(String(e),'err'); setLoading(false); });
  }, []);

  function aplicarAtalho(label, fn) {
    const [i, e] = fn();
    setFiltDi(i); setFiltDf(e); setAtalhoAtivo(label);
  }

  const filt = useMemo(() => vendas.filter(v => {
    if (filtCidade !== 'TODAS' && v.cidade !== filtCidade) return false;
    const data = (v.created_at||'').slice(0,10);
    if (filtDi && data < filtDi) return false;
    if (filtDf && data > filtDf) return false;
    if (filtBusca) {
      const q = filtBusca.toLowerCase();
      if (!(v.cliente_nome||'').toLowerCase().includes(q) &&
          !(v.cliente_telefone||'').toLowerCase().includes(q) &&
          !(v.forma_pagamento||'').toLowerCase().includes(q) &&
          !(v.observacao||'').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [vendas, filtCidade, filtDi, filtDf, filtBusca]);

  const fat = useMemo(() => filt.reduce((s,v) => s + Number(v.total||0), 0), [filt]);
  const tkm = filt.length ? fat / filt.length : 0;

  async function salvarEdit() {
    try {
      const r = await api.put(`/vendas/${edit.id}`, ef);
      setVendas(prev => prev.map(v => v.id===edit.id ? {...v,...r.data} : v));
      show('Salvo!'); setEdit(null);
    } catch(e) { show(String(e),'err'); }
  }

  async function excluirVenda(id) {
    if (!window.confirm('Excluir esta venda?')) return;
    try {
      await api.delete('/vendas/'+id);
      setVendas(p => p.filter(v => v.id !== id));
      show('Venda excluída!');
    } catch(e) { show(String(e),'err'); }
  }

  if (!user) return null;

  return (
    <div className="page">{Toast}<Topbar />
      <div className="pc">
        <div className="sh"><span className="sh-t">🧾 Histórico de Vendas de Peças</span></div>

        {/* Totais */}
        <div className="gf" style={{marginBottom:18}}>
          <div className="stat red"><div className="sv" style={{fontSize:18}}>{formatBRL(fat)}</div><div className="sl">Faturamento</div></div>
          <div className="stat"><div className="sv">{filt.length}</div><div className="sl">Vendas</div></div>
          <div className="stat grn"><div className="sv" style={{fontSize:18}}>{formatBRL(tkm)}</div><div className="sl">Ticket médio</div></div>
        </div>

        {/* Filtros */}
        <div className="card card-sm" style={{marginBottom:14}}>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:10}}>
            {/* Cidade */}
            <select className="inp" style={{width:'auto'}} value={filtCidade} onChange={e=>setFiltCidade(e.target.value)}>
              <option value="TODAS">Todas as filiais</option>
              {FILIAIS.map(f=><option key={f}>{f}</option>)}
            </select>

            {/* Datas */}
            <input className="inp" type="date" style={{width:'auto'}} value={filtDi} onChange={e=>{setFiltDi(e.target.value);setAtalhoAtivo('');}} />
            <span style={{lineHeight:'38px',color:'var(--tx3)'}}>até</span>
            <input className="inp" type="date" style={{width:'auto'}} value={filtDf} onChange={e=>{setFiltDf(e.target.value);setAtalhoAtivo('');}} />
            {(filtDi||filtDf) && <button className="btn btn-g btn-sm" onClick={()=>{setFiltDi('');setFiltDf('');setAtalhoAtivo('');}}>✕ Datas</button>}

            {/* Busca */}
            <input className="inp" style={{flex:1,minWidth:200}} placeholder="Buscar cliente, pagamento, obs..." value={filtBusca} onChange={e=>setFiltBusca(e.target.value)} />
            {filtBusca && <button className="btn btn-g btn-sm" onClick={()=>setFiltBusca('')}>✕ Busca</button>}
          </div>

          {/* Atalhos de data */}
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {ATALHOS.map(a=>(
              <button key={a.label} className={`btn btn-sm ${atalhoAtivo===a.label?'btn-p':'btn-g'}`}
                onClick={()=>aplicarAtalho(a.label,a.fn)}>{a.label}</button>
            ))}
          </div>
        </div>

        {/* Tabela */}
        {loading ? <div style={{display:'flex',justifyContent:'center',padding:60}}><span className="spin spin-lg" /></div> :
        <div className="tw"><table className="t">
          <thead><tr><th>#</th><th>Data</th><th>Cliente</th><th>Total</th><th>Pagamento</th><th>Cidade</th><th>RP</th><th>Itens</th><th>Nota</th><th>Ações</th></tr></thead>
          <tbody>
            {filt.length===0 && <tr><td colSpan={10}><div className="empty"><p>Nenhuma venda com esses filtros.</p></div></td></tr>}
            {filt.flatMap(v=>[
              <tr key={v.id}>
                <td><span className="badge b-gray">#{v.id}</span></td>
                <td style={{fontSize:12}}>{fmtDate(v.created_at)}</td>
                <td><b>{v.cliente_nome}</b><div style={{fontSize:11,color:'var(--tx3)'}}>{v.cliente_telefone}</div></td>
                <td><b style={{color:'var(--grn)'}}>{formatBRL(v.total)}</b></td>
                <td style={{maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.forma_pagamento||'—'}</td>
                <td>{v.cidade}</td>
                <td><span className={`badge ${v.rp?'b-grn':'b-gray'}`}>{v.rp?'Sim':'Não'}</span></td>
                <td><button className="ab" onClick={()=>setAberta(aberta===v.id?null:v.id)}>{aberta===v.id?'▲':'▼'}</button></td>
                <td><button className="ab" onClick={()=>nav(`/nota?id=${v.id}`)}>🧾</button></td>
                <td style={{display:'flex',gap:6}}>
                  <button className="ab" onClick={()=>{setEdit(v);setEf({cliente_nome:v.cliente_nome,cliente_telefone:v.cliente_telefone||'',forma_pagamento:v.forma_pagamento||'',cidade:v.cidade,observacao:v.observacao||'',total:v.total,rp:!!v.rp,rr:!!v.rr})}}>✏️</button>
                  {isDir(user) && <button className="ab red" onClick={()=>excluirVenda(v.id)}>🗑</button>}
                </td>
              </tr>,
              aberta===v.id && <tr key={`${v.id}-d`}><td colSpan={10}>
                <div style={{padding:'12px 16px',background:'var(--s2)',fontSize:13}}>
                  <b>Itens:</b>
                  <ul style={{margin:'6px 0 0',paddingLeft:20}}>
                    {(v.itens||[]).map((it,i)=><li key={i}>{it.nome_peca} — {it.quantidade}× {formatBRL(it.preco_unitario)}</li>)}
                  </ul>
                  {v.observacao && <div style={{marginTop:8}}><b>Obs:</b> {v.observacao}</div>}
                </div>
              </td></tr>,
            ])}
          </tbody>
        </table></div>}
      </div>

      {/* Modal editar */}
      {edit && <div className="mbg" onClick={()=>setEdit(null)}><div className="mbox" onClick={e=>e.stopPropagation()}>
        <div className="mhd"><h3>✏️ Editar #{edit.id}</h3><button className="mclose" onClick={()=>setEdit(null)}>×</button></div>
        <div className="field"><label>Cliente</label><input className="inp" value={ef.cliente_nome||''} onChange={e=>setEf({...ef,cliente_nome:e.target.value})} /></div>
        <div className="field"><label>Telefone</label><input className="inp" value={ef.cliente_telefone||''} onChange={e=>setEf({...ef,cliente_telefone:e.target.value})} /></div>
        <div className="field"><label>Pagamento</label><input className="inp" value={ef.forma_pagamento||''} onChange={e=>setEf({...ef,forma_pagamento:e.target.value})} /></div>
        <div className="field"><label>Cidade</label>
          <select className="inp" value={ef.cidade||''} onChange={e=>setEf({...ef,cidade:e.target.value})}>
            {FILIAIS.map(f=><option key={f}>{f}</option>)}
          </select>
        </div>
        <div className="field"><label>Total (R$)</label><input className="inp" type="number" step="0.01" value={ef.total||0} onChange={e=>setEf({...ef,total:Number(e.target.value)})} /></div>
        <div className="field"><label>Obs</label><textarea className="inp" rows={2} value={ef.observacao||''} onChange={e=>setEf({...ef,observacao:e.target.value})} /></div>
        <div style={{display:'flex',gap:20,marginTop:4}}>
          <label className="ck"><input type="checkbox" checked={!!ef.rp} onChange={e=>setEf({...ef,rp:e.target.checked})} /> RP</label>
          <label className="ck"><input type="checkbox" checked={!!ef.rr} onChange={e=>setEf({...ef,rr:e.target.checked})} /> RR</label>
        </div>
        <div className="mfoot">
          <button className="btn btn-g" onClick={()=>setEdit(null)}>Cancelar</button>
          <button className="btn btn-p" onClick={salvarEdit}>💾 Salvar</button>
        </div>
      </div></div>}
    </div>
  );
}
