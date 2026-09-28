import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, formatBRL, fmtDateTime, calcularValorLiquido, tierComissao, calcularComissaoComExcedente, findComissaoRow } from '../utils';

export default function Pendentes() {
  const nav = useNavigate(); const user = getUser();
  const { show, Toast } = useToast();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recusando, setRecusando] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [comissoes, setComissoes] = useState([]);
  const [edits, setEdits] = useState({}); // { [pendenciaId]: { entrega_valor, emplacamento } }
  const [aprovando, setAprovando] = useState(null);
  const [enviandoGC, setEnviandoGC] = useState(null);
  const [marcandoManual, setMarcandoManual] = useState(null);
  const [codigoManual, setCodigoManual] = useState('');
  const [salvandoManual, setSalvandoManual] = useState(false);

  useEffect(() => {
    if (!user) nav('/');
    api.get('/pendentes').then(r=>{ setLista(r.data); setLoading(false); }).catch(e=>{ show(String(e),'err'); setLoading(false); });
    api.get('/comissoes').then(r=>setComissoes(r.data)).catch(()=>{});
  }, []);

  function setEdit(id, campo, valor) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }));
  }
  function valorLiquidoPrevisto(p) {
    const ed = edits[p.id] || {};
    const entrega_valor = ed.entrega_valor!=null ? ed.entrega_valor : (p.entrega_valor||0);
    const emplacamento = ed.emplacamento!=null ? ed.emplacamento : (p.emplacamento||0);
    return calcularValorLiquido({ valor:p.valor, brinde:p.brinde, gasolina:p.gasolina, entrega_valor, emplacamento });
  }
  function comissaoPrevista(p) {
    return calcularComissaoComExcedente(findComissaoRow(comissoes, p.modelo), valorLiquidoPrevisto(p));
  }
  // Sistema antigo: comparava direto o valor bruto da venda, sem descontar nada
  function comissaoAntiga(p) {
    return tierComissao(findComissaoRow(comissoes, p.modelo), p.valor);
  }

  async function aprovar(id) {
    const ed = edits[id] || {};
    setAprovando(id);
    try {
      await api.post(`/pendentes/${id}/aprovar`, { entrega_valor:Number(ed.entrega_valor||0), emplacamento:Number(ed.emplacamento||0) });
      setLista(p=>p.filter(x=>x.id!==id));
      show('Venda aprovada!');
    }
    catch(e){ show(String(e),'err'); }
    finally { setAprovando(null); }
  }

  async function enviarParaGestaoClick(p) {
    if (!window.confirm(`Enviar essa venda (${p.modelo}, ${p.nome_cliente}) pro GestãoClick? Cria o cliente (se precisar) e a venda concretizada lá — a nota fiscal continua manual, quem emite é a diretoria depois.`)) return;
    setEnviandoGC(p.id);
    try {
      const r = await api.post(`/gc/pendentes/${p.id}/criar`, {});
      setLista(prev => prev.map(x => x.id===p.id ? { ...x, gc_venda_id:r.data.venda_criada?.id, gc_venda_codigo:r.data.venda_criada?.codigo } : x));
      show(`Enviada! Venda #${r.data.venda_criada?.codigo} no GestãoClick — agora pode aprovar.`);
    } catch(e) { show(String(e),'err'); }
    finally { setEnviandoGC(null); }
  }

  async function marcarManual() {
    if (!codigoManual.trim()) { show('Informe o código da venda no GestãoClick', 'err'); return; }
    setSalvandoManual(true);
    try {
      const r = await api.post(`/gc/pendentes/${marcandoManual}/marcar-manual`, { codigo: codigoManual.trim() });
      setLista(prev => prev.map(x => x.id===marcandoManual ? { ...x, gc_venda_id:r.data.gc_venda_codigo, gc_venda_codigo:r.data.gc_venda_codigo, gc_manual:1 } : x));
      show('Marcada como enviada manualmente — agora pode aprovar.');
      setMarcandoManual(null); setCodigoManual('');
    } catch(e) { show(String(e),'err'); }
    finally { setSalvandoManual(false); }
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
                    {[['Moto',`${p.modelo} · ${p.cor}`],['Chassi',p.chassi],['Cliente',p.nome_cliente],['Valor',formatBRL(p.valor)],['Filial venda',p.filial_venda],['Pagamento',p.forma_pagamento||'—'],['Gasolina',p.gasolina?formatBRL(p.gasolina):'—'],['Brinde',p.brinde?'Sim':'Não'],['Como chegou',p.como_chegou||'—'],['WhatsApp',p.numero_cliente||'—'],['Retirada',p.local_retirada==='ENTREGA'?`Entrega${p.entrega_km?` (~${p.entrega_km}km)`:''}`:(p.local_retirada||'—')]].map(([l,v])=>(
                      <div key={l}><span style={{fontSize:11,color:'var(--tx3)'}}>{l}</span><div style={{fontSize:13,fontWeight:500,marginTop:2}}>{v}</div></div>
                    ))}
                  </div>
                  <div style={{marginTop:10,fontSize:12,color:'var(--tx3)'}}>
                    <span style={{fontWeight:600}}>📍 Endereço: </span>
                    {p.end_rua ? `${p.end_rua}${p.end_numero?', '+p.end_numero:''}${p.end_bairro?' · '+p.end_bairro:''}${p.end_cidade?' · '+p.end_cidade:''}${p.end_uf?'/'+p.end_uf:''}${p.end_cep?' · CEP '+p.end_cep:''}` : 'não informado pelo vendedor'}
                  </div>
                  <div className="g2" style={{gap:8,marginTop:12,paddingTop:12,borderTop:'1px dashed var(--bd)'}}>
                    <div className="field" style={{margin:0}}><label>Entrega (R$)</label>
                      <input className="inp" type="number" step="0.01" placeholder="0,00" value={edits[p.id]?.entrega_valor??''} onChange={e=>setEdit(p.id,'entrega_valor',e.target.value)} />
                    </div>
                    <div className="field" style={{margin:0}}><label>Emplacamento (R$)</label>
                      <input className="inp" type="number" step="0.01" placeholder="0,00" value={edits[p.id]?.emplacamento??''} onChange={e=>setEdit(p.id,'emplacamento',e.target.value)} />
                    </div>
                  </div>
                  <div style={{marginTop:10,fontSize:13,display:'flex',gap:16,flexWrap:'wrap'}}>
                    <span><span style={{color:'var(--tx3)'}}>Valor líquido (venda − descontos): </span><b>{formatBRL(valorLiquidoPrevisto(p))}</b></span>
                  </div>
                  <div style={{marginTop:6,fontSize:13,display:'flex',gap:16,flexWrap:'wrap'}}>
                    <span><span style={{color:'var(--tx3)'}}>Sistema antigo (valor bruto, fixo): </span><b style={{color:'var(--tx2)'}}>{formatBRL(comissaoAntiga(p))}</b></span>
                    <span><span style={{color:'var(--tx3)'}}>Comissão (valor líquido + excedente): </span><b style={{color:'var(--grn)'}}>{formatBRL(comissaoPrevista(p))}</b></span>
                  </div>
                  {!findComissaoRow(comissoes, p.modelo) && (
                    <div style={{marginTop:6,fontSize:12,color:'var(--red)'}}>
                      ⚠️ "{p.modelo}" não tem faixa de comissão cadastrada — usando padrão fixo R$30, ignorando o valor. Cadastre o modelo em Admin → Comissões.
                    </div>
                  )}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8,flexShrink:0,alignItems:'flex-end'}}>
                  {p.gc_venda_id
                    ? <span className="badge b-grn" title={p.gc_manual?'Marcada como criada manualmente no GestãoClick':'Enviada pro GestãoClick'}>✓ GC #{p.gc_venda_codigo}{p.gc_manual?' (manual)':''}</span>
                    : <>
                        <button className="btn btn-g btn-sm" disabled={enviandoGC===p.id} onClick={()=>enviarParaGestaoClick(p)}>
                          {enviandoGC===p.id ? <span className="spin" /> : '📤 Enviar pro GestãoClick'}
                        </button>
                        <button className="linklike" style={{fontSize:11,color:'var(--tx3)',background:'none',border:'none',cursor:'pointer',padding:0}} onClick={()=>{setMarcandoManual(p.id);setCodigoManual('')}}>
                          não achou? marcar manual →
                        </button>
                      </>}
                  <div style={{display:'flex',gap:8}}>
                    <button className="btn btn-s" disabled={aprovando===p.id} onClick={()=>aprovar(p.id)}>
                      {aprovando===p.id ? <span className="spin" /> : '✅ Aprovar'}
                    </button>
                    <button className="btn btn-g" style={{color:'var(--red)',borderColor:'var(--redbd)'}} disabled={aprovando===p.id} onClick={()=>{setRecusando(p.id);setMotivo('')}}>✕ Recusar</button>
                  </div>
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
      {marcandoManual&&<div className="mbg" onClick={()=>setMarcandoManual(null)}><div className="mbox" onClick={e=>e.stopPropagation()}>
        <div className="mhd"><h3>Marcar como enviada manualmente</h3><button className="mclose" onClick={()=>setMarcandoManual(null)}>×</button></div>
        <p style={{fontSize:13,color:'var(--tx3)',marginBottom:12}}>Use isso só quando o botão automático não funcionar (ex: produto existe no GestãoClick mas a busca não acha — bug conhecido de lá). Crie a venda à mão direto no GestãoClick e cola o código dela aqui.</p>
        <div className="field"><label>Código da venda no GestãoClick</label><input className="inp" autoFocus placeholder="Ex: 11205" value={codigoManual} onChange={e=>setCodigoManual(e.target.value)} /></div>
        <div className="mfoot"><button className="btn btn-g" onClick={()=>setMarcandoManual(null)}>Cancelar</button><button className="btn btn-p" disabled={salvandoManual} onClick={marcarManual}>{salvandoManual?'Salvando...':'Confirmar'}</button></div>
      </div></div>}
    </div>
  );
}
