import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, formatBRL, fmtDate, FILIAIS } from '../utils';

const ATALHOS = [
  { label:'Hoje',        fn:() => { const d=new Date().toISOString().slice(0,10); return [d,d]; } },
  { label:'Ontem',       fn:() => { const d=new Date(Date.now()-86400000).toISOString().slice(0,10); return [d,d]; } },
  { label:'7 dias',      fn:() => { const e=new Date().toISOString().slice(0,10); const i=new Date(Date.now()-6*86400000).toISOString().slice(0,10); return [i,e]; } },
  { label:'30 dias',     fn:() => { const e=new Date().toISOString().slice(0,10); const i=new Date(Date.now()-29*86400000).toISOString().slice(0,10); return [i,e]; } },
  { label:'Mês atual',   fn:() => { const n=new Date(); const i=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`; const e=new Date(n.getFullYear(),n.getMonth()+1,0).toISOString().slice(0,10); return [i,e]; } },
  { label:'Mês passado', fn:() => { const n=new Date(); const m=n.getMonth()===0?new Date(n.getFullYear()-1,11,1):new Date(n.getFullYear(),n.getMonth()-1,1); const i=m.toISOString().slice(0,10); const e=new Date(m.getFullYear(),m.getMonth()+1,0).toISOString().slice(0,10); return [i,e]; } },
];

const STATUS_OS = {
  ABERTA:        { cor:'#3b82f6', label:'Aberta'      },
  EM_ANDAMENTO:  { cor:'#f59e0b', label:'Em andamento' },
  AGUARDANDO:    { cor:'#8b5cf6', label:'Aguardando'   },
  FINALIZADA:    { cor:'#2ecc71', label:'Finalizada'   },
  CANCELADA:     { cor:'#6b7280', label:'Cancelada'    },
};

export default function VendasGerais() {
  const nav = useNavigate(); const user = getUser();
  const { show, Toast } = useToast();

  const [tab, setTab] = useState('motos');
  const [motos, setMotos] = useState([]);
  const [pecas, setPecas] = useState([]);
  const [oficina, setOficina] = useState([]);
  const [loading, setLoading] = useState(true);
  const [abertaP, setAbertaP] = useState(null);
  const [abertaO, setAbertaO] = useState(null);

  const [filtFilial, setFiltFilial] = useState('TODAS');
  const [filtDi, setFiltDi] = useState('');
  const [filtDf, setFiltDf] = useState('');
  const [filtBusca, setFiltBusca] = useState('');
  const [atalhoAtivo, setAtalhoAtivo] = useState('');

  useEffect(() => {
    if (!user) { nav('/'); return; }
    setLoading(true);
    Promise.all([
      api.get('/vendas-motos').catch(() => ({ data: [] })),
      api.get('/vendas').catch(() => ({ data: [] })),
      api.get('/os').catch(() => ({ data: [] })),
    ]).then(([m, p, o]) => {
      setMotos(m.data || []); setPecas(p.data || []); setOficina(o.data || []);
      setLoading(false);
    }).catch(e => { show(String(e), 'err'); setLoading(false); });
  }, []);

  function aplicarAtalho(label, fn) {
    const [i, e] = fn();
    setFiltDi(i); setFiltDf(e); setAtalhoAtivo(label);
  }

  const motosFilt = useMemo(() => motos.filter(v => {
    if (filtFilial !== 'TODAS' && v.filial_venda !== filtFilial) return false;
    const data = (v.data_venda || v.created_at || '').slice(0, 10);
    if (filtDi && data < filtDi) return false;
    if (filtDf && data > filtDf) return false;
    if (filtBusca) {
      const q = filtBusca.toLowerCase();
      if (!(v.nome_cliente||'').toLowerCase().includes(q) && !(v.chassi||'').toLowerCase().includes(q) &&
          !(v.modelo||'').toLowerCase().includes(q) && !(v.cpf||'').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [motos, filtFilial, filtDi, filtDf, filtBusca]);

  const pecasFilt = useMemo(() => pecas.filter(v => {
    if (filtFilial !== 'TODAS' && v.cidade !== filtFilial) return false;
    const data = (v.created_at || '').slice(0, 10);
    if (filtDi && data < filtDi) return false;
    if (filtDf && data > filtDf) return false;
    if (filtBusca) {
      const q = filtBusca.toLowerCase();
      if (!(v.cliente_nome||'').toLowerCase().includes(q) && !(v.forma_pagamento||'').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [pecas, filtFilial, filtDi, filtDf, filtBusca]);

  const oficinaFilt = useMemo(() => oficina.filter(o => {
    if (filtFilial !== 'TODAS' && o.cidade !== filtFilial) return false;
    const data = (o.created_at || '').slice(0, 10);
    if (filtDi && data < filtDi) return false;
    if (filtDf && data > filtDf) return false;
    if (filtBusca) {
      const q = filtBusca.toLowerCase();
      if (!(o.cliente_nome||'').toLowerCase().includes(q) && !(o.chassi||'').toLowerCase().includes(q) &&
          !(o.modelo_moto||'').toLowerCase().includes(q) && !(o.numero||'').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [oficina, filtFilial, filtDi, filtDf, filtBusca]);

  const totMotos   = useMemo(() => motosFilt.reduce((s,v) => s + Number(v.valor||0), 0), [motosFilt]);
  const totPecas   = useMemo(() => pecasFilt.reduce((s,v) => s + Number(v.total||0), 0), [pecasFilt]);
  const totOficina = useMemo(() => oficinaFilt.reduce((s,o) => s + Number(o.total||0), 0), [oficinaFilt]);

  if (!user) return null;

  return (
    <div className="page">
      {Toast}<Topbar />
      <div className="pc">
        <div className="sh"><span className="sh-t">📊 Vendas Gerais</span></div>

        {/* TOTAIS GERAIS */}
        <div className="gf" style={{marginBottom:18}}>
          <div className="stat grn"><div className="sv" style={{fontSize:16}}>{formatBRL(totMotos+totPecas+totOficina)}</div><div className="sl">Faturamento total</div></div>
          <div className="stat blu"><div className="sv" style={{fontSize:15}}>{formatBRL(totMotos)}</div><div className="sl">Motos ({motosFilt.length})</div></div>
          <div className="stat"><div className="sv" style={{fontSize:15}}>{formatBRL(totPecas)}</div><div className="sl">Peças ({pecasFilt.length})</div></div>
          <div className="stat yel"><div className="sv" style={{fontSize:15}}>{formatBRL(totOficina)}</div><div className="sl">Oficina ({oficinaFilt.length})</div></div>
        </div>

        {/* FILTROS (compartilhados entre as abas) */}
        <div className="card card-sm" style={{marginBottom:14}}>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:10}}>
            <select className="inp" style={{width:'auto'}} value={filtFilial} onChange={e=>setFiltFilial(e.target.value)}>
              <option value="TODAS">Todas as filiais</option>
              {FILIAIS.map(f=><option key={f}>{f}</option>)}
            </select>
            <input className="inp" type="date" style={{width:'auto'}} value={filtDi} onChange={e=>{setFiltDi(e.target.value);setAtalhoAtivo('');}} />
            <span style={{lineHeight:'38px',color:'var(--tx3)'}}>até</span>
            <input className="inp" type="date" style={{width:'auto'}} value={filtDf} onChange={e=>{setFiltDf(e.target.value);setAtalhoAtivo('');}} />
            {(filtDi||filtDf) && <button className="btn btn-g btn-sm" onClick={()=>{setFiltDi('');setFiltDf('');setAtalhoAtivo('');}}>✕ Datas</button>}
            <input className="inp" style={{flex:1,minWidth:200}} placeholder="Buscar cliente, chassi, modelo, CPF..." value={filtBusca} onChange={e=>setFiltBusca(e.target.value)} />
            {filtBusca && <button className="btn btn-g btn-sm" onClick={()=>setFiltBusca('')}>✕ Busca</button>}
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {ATALHOS.map(a=>(
              <button key={a.label} className={`btn btn-sm ${atalhoAtivo===a.label?'btn-p':'btn-g'}`}
                onClick={()=>aplicarAtalho(a.label,a.fn)}>{a.label}</button>
            ))}
          </div>
        </div>

        <div className="tabs" style={{marginBottom:14}}>
          <button className={`tab ${tab==='motos'?'act':''}`}   onClick={()=>setTab('motos')}>🏍 Motos ({motosFilt.length})</button>
          <button className={`tab ${tab==='pecas'?'act':''}`}   onClick={()=>setTab('pecas')}>📦 Peças ({pecasFilt.length})</button>
          <button className={`tab ${tab==='oficina'?'act':''}`} onClick={()=>setTab('oficina')}>🔧 Oficina ({oficinaFilt.length})</button>
        </div>

        {loading ? <div style={{display:'flex',justifyContent:'center',padding:60}}><span className="spin spin-lg" /></div> : <>

        {/* MOTOS */}
        {tab==='motos' && (
          <div className="tw"><table className="t">
            <thead><tr>
              <th>Data</th><th>Modelo</th><th>Cor</th><th>Chassi</th><th>Cliente</th><th>Telefone</th><th>CPF</th>
              <th>Valor</th><th>Compra</th><th>Repasse</th><th>Comissão</th><th>Pagamento</th><th>Como chegou</th>
              <th>Filial venda</th><th>Filial origem</th><th>Retirada</th><th>Santander</th><th>CNPJ</th><th>RP</th><th>RR</th>
            </tr></thead>
            <tbody>
              {motosFilt.length===0 && <tr><td colSpan={20}><div className="empty"><p>Nenhuma venda de moto com esses filtros.</p></div></td></tr>}
              {motosFilt.map(v => (
                <tr key={v.id}>
                  <td style={{fontSize:12}}>{fmtDate(v.data_venda||v.created_at)}</td>
                  <td><b>{v.modelo}</b></td>
                  <td>{v.cor}</td>
                  <td style={{fontFamily:'var(--mono)',fontSize:11}}>{v.chassi}</td>
                  <td>{v.nome_cliente}</td>
                  <td>{v.telefone||v.numero_cliente}</td>
                  <td style={{fontFamily:'var(--mono)',fontSize:11}}>{v.cpf||'—'}</td>
                  <td><b style={{color:'var(--grn)'}}>{formatBRL(v.valor)}</b></td>
                  <td>{formatBRL(v.valor_compra)}</td>
                  <td>{formatBRL(v.repasse)}</td>
                  <td>{formatBRL(v.comissao_valor)}</td>
                  <td style={{maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.forma_pagamento||'—'}</td>
                  <td>{v.como_chegou||'—'}</td>
                  <td>{v.filial_venda}</td>
                  <td>{v.filial_origem||'—'}</td>
                  <td>{v.local_retirada||v.filial_retirada||'—'}</td>
                  <td><span className={`badge ${v.santander?'b-grn':'b-gray'}`}>{v.santander?'Sim':'Não'}</span></td>
                  <td style={{fontSize:11}}>{v.cnpj_empresa||'—'}</td>
                  <td><span className={`badge ${v.rp?'b-grn':'b-gray'}`}>{v.rp?'Sim':'Não'}</span></td>
                  <td><span className={`badge ${v.rr?'b-grn':'b-gray'}`}>{v.rr?'Sim':'Não'}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}

        {/* PEÇAS */}
        {tab==='pecas' && (
          <div className="tw"><table className="t">
            <thead><tr><th>#</th><th>Data</th><th>Cliente</th><th>Telefone</th><th>Total</th><th>Pagamento</th><th>Filial</th><th>RP</th><th>Itens</th><th>Nota</th></tr></thead>
            <tbody>
              {pecasFilt.length===0 && <tr><td colSpan={10}><div className="empty"><p>Nenhuma venda de peças com esses filtros.</p></div></td></tr>}
              {pecasFilt.flatMap(v => [
                <tr key={v.id}>
                  <td><span className="badge b-gray">#{v.id}</span></td>
                  <td style={{fontSize:12}}>{fmtDate(v.created_at)}</td>
                  <td><b>{v.cliente_nome}</b></td>
                  <td>{v.cliente_telefone||'—'}</td>
                  <td><b style={{color:'var(--grn)'}}>{formatBRL(v.total)}</b></td>
                  <td style={{maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.forma_pagamento||'—'}</td>
                  <td>{v.cidade}</td>
                  <td><span className={`badge ${v.rp?'b-grn':'b-gray'}`}>{v.rp?'Sim':'Não'}</span></td>
                  <td><button className="ab" onClick={()=>setAbertaP(abertaP===v.id?null:v.id)}>{abertaP===v.id?'▲':'▼'}</button></td>
                  <td><button className="ab" onClick={()=>nav(`/nota?id=${v.id}`)}>🧾</button></td>
                </tr>,
                abertaP===v.id && <tr key={`${v.id}-d`}><td colSpan={10}>
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
          </table></div>
        )}

        {/* OFICINA */}
        {tab==='oficina' && (
          <div className="tw"><table className="t">
            <thead><tr>
              <th>Número</th><th>Data</th><th>Tipo</th><th>Status</th><th>Cliente</th><th>Telefone</th><th>CPF</th>
              <th>Moto</th><th>Chassi</th><th>KM</th><th>Mão de obra</th><th>Desconto</th><th>Total</th><th>Pagamento</th><th>Garantia</th><th>Filial</th><th>Peças usadas</th><th>Detalhes</th><th></th>
            </tr></thead>
            <tbody>
              {oficinaFilt.length===0 && <tr><td colSpan={19}><div className="empty"><p>Nenhuma OS com esses filtros.</p></div></td></tr>}
              {oficinaFilt.flatMap(o => {
                const st = STATUS_OS[o.status] || { cor:'#6b7280', label:o.status };
                return [
                  <tr key={o.id}>
                    <td style={{fontFamily:'var(--mono)',fontSize:11}}>{o.numero}</td>
                    <td style={{fontSize:12}}>{fmtDate(o.created_at)}</td>
                    <td>{o.tipo}</td>
                    <td><span className="badge" style={{background:st.cor+'22',color:st.cor,border:`1px solid ${st.cor}44`}}>{st.label}</span></td>
                    <td><b>{o.cliente_nome}</b></td>
                    <td>{o.cliente_telefone||'—'}</td>
                    <td style={{fontFamily:'var(--mono)',fontSize:11}}>{o.cliente_cpf||'—'}</td>
                    <td>{o.modelo_moto||'—'}</td>
                    <td style={{fontFamily:'var(--mono)',fontSize:11}}>{o.chassi||'—'}</td>
                    <td>{o.km||'—'}</td>
                    <td>{formatBRL(o.mao_de_obra)}</td>
                    <td>{formatBRL(o.desconto)}</td>
                    <td><b style={{color:'var(--grn)'}}>{formatBRL(o.total)}</b></td>
                    <td style={{maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.forma_pagamento||'—'}</td>
                    <td>{o.em_garantia ? <span className="badge b-grn">🛡 Sim</span> : <span className="badge b-gray">Não</span>}</td>
                    <td>{o.cidade}</td>
                    <td>{o.qtd_itens||0}</td>
                    <td><button className="ab" onClick={()=>setAbertaO(abertaO===o.id?null:o.id)}>{abertaO===o.id?'▲':'▼'}</button></td>
                    <td><button className="ab" onClick={()=>nav(`/oficina/${o.id}`)}>Abrir ›</button></td>
                  </tr>,
                  abertaO===o.id && <tr key={`${o.id}-d`}><td colSpan={19}>
                    <div style={{padding:'12px 16px',background:'var(--s2)',fontSize:13}}>
                      {o.problema_relatado && <div style={{marginBottom:6}}><b>Problema relatado:</b> {o.problema_relatado}</div>}
                      {o.servico_realizado && <div style={{marginBottom:6}}><b>Serviço realizado:</b> {o.servico_realizado}</div>}
                      {o.observacao && <div><b>Obs:</b> {o.observacao}</div>}
                      {!o.problema_relatado && !o.servico_realizado && !o.observacao && <div style={{color:'var(--tx3)'}}>Sem detalhes adicionais.</div>}
                    </div>
                  </td></tr>,
                ];
              })}
            </tbody>
          </table></div>
        )}
        </>}
      </div>
    </div>
  );
}
