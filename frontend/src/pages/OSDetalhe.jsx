import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, formatBRL, fmtDate, fmtDateTime, FORMAS_PGTO } from '../utils';

const STATUS_INFO = {
  ABERTA:       { cor:'#3b82f6', label:'Aberta'       },
  EM_ANDAMENTO: { cor:'#f59e0b', label:'Em andamento'  },
  AGUARDANDO:   { cor:'#8b5cf6', label:'Aguardando'    },
  FINALIZADA:   { cor:'#2ecc71', label:'Finalizada'    },
  CANCELADA:    { cor:'#6b7280', label:'Cancelada'     },
};

const CHECKLIST_STATUS = [
  { v:'OK',      l:'✅ OK'      },
  { v:'ATENCAO', l:'⚠️ Atenção' },
  { v:'TROCAR',  l:'❌ Trocar'  },
  { v:'NA',      l:'➖ N/A'     },
];

export default function OSDetalhe() {
  const { id } = useParams();
  const nav = useNavigate();
  const user = getUser();
  const { show, Toast } = useToast();

  const [os, setOs] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [orcamento, setOrcamento] = useState(null);
  const [sugestoes, setSugestoes] = useState([]);
  const [pecasDisponiveis, setPecasDisponiveis] = useState([]);
  const [pecaBusca, setPecaBusca] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingCheck, setSavingCheck] = useState(false);
  const [modalFinalizar, setModalFinalizar] = useState(false);
  const [modalOrcamento, setModalOrcamento] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('servico');
  const printRef = useRef();

  const [editKm, setEditKm] = useState('');
  const [editProblema, setEditProblema] = useState('');
  const [editServico, setEditServico] = useState('');
  const [editObs, setEditObs] = useState('');
  const [ff, setFf] = useState({ mao_de_obra:'', desconto:'', forma_pagamento:'', servico_realizado:'' });
  const [orcObs, setOrcObs] = useState('');

  async function carregar() {
    try {
      const [osR, checkR, orcR] = await Promise.all([
        api.get('/os/' + id),
        api.get('/os/' + id + '/checklist'),
        api.get('/os/' + id + '/orcamento'),
      ]);
      setOs(osR.data);
      setChecklist(checkR.data);
      setOrcamento(orcR.data);
      setEditKm(osR.data.km || '');
      setEditProblema(osR.data.problema_relatado || '');
      setEditServico(osR.data.servico_realizado || '');
      setEditObs(osR.data.observacao || '');
      setFf(f => ({ ...f, servico_realizado: osR.data.servico_realizado || '' }));
      if (osR.data.modelo_moto) {
        api.get('/os/sugestoes/' + encodeURIComponent(osR.data.modelo_moto)).then(r => setSugestoes(r.data || [])).catch(() => {});
      }
    } catch { nav('/oficina'); }
  }

  useEffect(() => {
    if (!user) { nav('/'); return; }
    carregar();
    // Busca peças apenas da própria filial do usuário
    api.get('/pecas', { params: { cidade: user.cidade } }).then(r => setPecasDisponiveis(r.data || [])).catch(() => {});
  }, [id]);

  async function alterarStatus(status) {
    try { await api.put('/os/' + id, { status }); carregar(); show('Status: ' + (STATUS_INFO[status]?.label || status)); }
    catch (e) { show(String(e), 'err'); }
  }

  async function salvarCampos() {
    try { await api.put('/os/' + id, { km: editKm, problema_relatado: editProblema, servico_realizado: editServico, observacao: editObs }); show('Salvo!'); carregar(); }
    catch (e) { show(String(e), 'err'); }
  }

  async function salvarChecklist() {
    setSavingCheck(true);
    try { await api.put('/os/' + id + '/checklist', { items: checklist }); show('Checklist salvo!'); }
    catch (e) { show(String(e), 'err'); }
    finally { setSavingCheck(false); }
  }

  function atualizarCheck(idx, campo, valor) {
    setChecklist(p => p.map((it, i) => i === idx ? { ...it, [campo]: valor } : it));
  }

  async function adicionarPeca(peca) {
    try { await api.post('/os/' + id + '/itens', { peca_id: peca.id || peca.peca_id, nome_peca: peca.nome || peca.nome_peca, quantidade: 1, preco_unitario: peca.preco }); setPecaBusca(''); carregar(); }
    catch (e) { show(String(e), 'err'); }
  }

  async function removerItem(itemId) {
    try { await api.delete('/os/' + id + '/itens/' + itemId); carregar(); }
    catch (e) { show(String(e), 'err'); }
  }

  async function finalizar() {
    if (!ff.forma_pagamento) { show('Selecione a forma de pagamento', 'err'); return; }
    setSaving(true);
    try { await api.post('/os/' + id + '/finalizar', ff); show('OS finalizada!'); setModalFinalizar(false); carregar(); }
    catch (e) { show(String(e), 'err'); }
    finally { setSaving(false); }
  }

  async function responderOrcamento(aprovado) {
    try { await api.post('/os/' + id + '/orcamento', { aprovado, observacao: orcObs }); show(aprovado ? 'Aprovado!' : 'Recusado'); setModalOrcamento(false); carregar(); }
    catch (e) { show(String(e), 'err'); }
  }

  function imprimir() {
    const conteudo = printRef.current?.innerHTML;
    if (!conteudo) return;
    const janela = window.open('', '_blank');
    janela.document.write('<html><head><title>OS ' + (os?.numero||'') + '</title><style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px;color:#000}h1{font-size:16px;margin-bottom:4px}h2{font-size:14px;margin:16px 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px}table{width:100%;border-collapse:collapse;margin-bottom:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:11px}th{background:#f5f5f5;font-weight:600}.total{font-size:16px;font-weight:700;text-align:right;margin-top:12px}.assinatura{margin-top:40px;border-top:1px solid #000;padding-top:8px;text-align:center;font-size:11px}.ok{color:green}.atencao{color:orange}.trocar{color:red}</style></head><body>' + conteudo + '<div class="assinatura">Assinatura do cliente: _________________________ Data: ___/___/______</div></body></html>');
    janela.document.close();
    janela.print();
  }

  const pecasFiltradas = pecaBusca.length >= 2
    ? pecasDisponiveis.filter(p => p.nome.toLowerCase().includes(pecaBusca.toLowerCase()) && p.estoque > 0).slice(0, 8)
    : [];

  if (!os) return <div className="page"><Topbar /><div style={{ display:'flex', justifyContent:'center', padding:80 }}><span className="spin spin-lg" /></div></div>;

  const statusInfo = STATUS_INFO[os.status] || { cor:'#6b7280', label: os.status };
  const totalPecas = (os.itens || []).reduce((s, i) => s + i.preco_unitario * i.quantidade, 0);
  const totalFinal = totalPecas + Number(os.mao_de_obra || 0) - Number(os.desconto || 0);
  const finalizada = os.status === 'FINALIZADA' || os.status === 'CANCELADA';
  const checkOk = checklist.filter(c => c.status === 'OK').length;
  const checkTrocar = checklist.filter(c => c.status === 'TROCAR').length;
  const checkAtencao = checklist.filter(c => c.status === 'ATENCAO').length;

  return (
    <div className="page">
      {Toast}
      <Topbar />
      <div className="pc">
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16, gap:12, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button className="btn btn-g btn-sm" onClick={() => nav('/oficina')}>← Oficina</button>
            <div>
              <div style={{ fontSize:20, fontWeight:700 }}>OS {os.numero}</div>
              <div style={{ fontSize:12, color:'var(--tx3)', marginTop:2 }}>{os.tipo} · {fmtDate(os.created_at)} · {os.cidade}</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <span className="badge" style={{ background:statusInfo.cor+'22', color:statusInfo.cor, border:'1px solid '+statusInfo.cor+'44', fontSize:13 }}>{statusInfo.label}</span>
            {os.em_garantia ? <span className="badge b-yel">🛡 Garantia</span> : null}
            <button className="ab" onClick={imprimir}>🖨️ Imprimir</button>
            {!finalizada && <>
              {os.status === 'ABERTA' && <button className="ab" onClick={() => setModalOrcamento(true)}>📋 Orçamento</button>}
              {os.status === 'ABERTA' && <button className="ab" onClick={() => alterarStatus('EM_ANDAMENTO')}>▶ Iniciar</button>}
              {os.status === 'EM_ANDAMENTO' && <button className="ab" onClick={() => alterarStatus('AGUARDANDO')}>⏸ Aguardar</button>}
              {os.status === 'AGUARDANDO' && <button className="ab" onClick={() => alterarStatus('EM_ANDAMENTO')}>▶ Retomar</button>}
              {(os.status === 'ABERTA' || os.status === 'EM_ANDAMENTO') && <button className="btn btn-s btn-sm" onClick={() => { setFf(f => ({...f, servico_realizado: editServico})); setModalFinalizar(true); }}>✅ Finalizar</button>}
              <button className="ab red" onClick={() => { if(window.confirm('Cancelar?')) alterarStatus('CANCELADA'); }}>✕</button>
            </>}
          </div>
        </div>

        <div style={{ display:'flex', gap:4, marginBottom:16, borderBottom:'1px solid var(--bd)' }}>
          {[
            {k:'servico',   l:'📋 Serviço'},
            {k:'checklist', l:'🔍 Checklist' + (checkTrocar > 0 ? ' ('+checkTrocar+' ❌)' : '')},
            {k:'pecas',     l:'📦 Peças ('+((os.itens||[]).length)+')'},
            {k:'orcamento', l:'💰 Orçamento'},
          ].map(a => (
            <button key={a.k} onClick={() => setAbaAtiva(a.k)} style={{ padding:'8px 16px', border:'none', borderBottom: abaAtiva===a.k ? '2px solid var(--red)' : '2px solid transparent', background:'none', color: abaAtiva===a.k ? 'var(--tx)' : 'var(--tx3)', cursor:'pointer', fontSize:13, fontWeight: abaAtiva===a.k ? 600 : 400 }}>{a.l}</button>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:18, alignItems:'start' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div className="card">
              <div className="clabel">👤 Cliente</div>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>{os.cliente_nome}</div>
              {os.cliente_telefone && <div style={{ fontSize:13, color:'var(--tx2)' }}>📞 {os.cliente_telefone}</div>}
              {os.cliente_id && <button className="ab" style={{ marginTop:6 }} onClick={() => nav('/clientes/'+os.cliente_id)}>Ver perfil →</button>}
              {os.motos_cliente?.length > 1 && (
                <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid var(--bd)' }}>
                  <div style={{ fontSize:11, color:'var(--tx3)', marginBottom:6 }}>Outras motos</div>
                  {os.motos_cliente.filter(m => m.chassi !== os.chassi).map(m => (
                    <div key={m.id} style={{ fontSize:12, color:'var(--tx2)', padding:'3px 0' }}>🏍 {m.modelo} · <span style={{ fontFamily:'var(--mono)', fontSize:11 }}>{m.chassi}</span></div>
                  ))}
                </div>
              )}
            </div>
            <div className="card">
              <div className="clabel">🏍 Moto</div>
              {os.modelo_moto && <div style={{ fontSize:14, fontWeight:600, marginBottom:3 }}>{os.modelo_moto} {os.cor_moto && '· '+os.cor_moto} {os.ano_moto && '· '+os.ano_moto}</div>}
              {os.chassi && <div style={{ fontSize:12, fontFamily:'var(--mono)', color:'var(--tx3)', marginBottom:8 }}>{os.chassi}</div>}
              <div className="field"><label>KM entrada</label><input className="inp" type="number" value={editKm} onChange={e=>setEditKm(e.target.value)} disabled={finalizada} /></div>
              {os.garantia && (
                <div style={{ padding:'8px 12px', borderRadius:'var(--r)', background: os.garantia.em_garantia ? 'var(--grndim)' : 'var(--reddim)', border:'1px solid '+(os.garantia.em_garantia ? 'var(--grnbd)' : 'var(--redbd)'), fontSize:12, marginTop:4 }}>
                  {os.garantia.em_garantia ? <span style={{ color:'var(--grn)' }}>🛡 Em garantia · {os.garantia.dias_restantes} dias</span> : <span style={{ color:'var(--red)' }}>❌ Garantia expirada</span>}
                </div>
              )}
            </div>
            <div className="card">
              <div className="clabel">💰 Resumo</div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}><span style={{ color:'var(--tx3)' }}>Peças</span><span>{formatBRL(totalPecas)}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}><span style={{ color:'var(--tx3)' }}>Mão de obra</span><span>{formatBRL(os.mao_de_obra||0)}</span></div>
              {Number(os.desconto||0) > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}><span style={{ color:'var(--tx3)' }}>Desconto</span><span style={{ color:'var(--red)' }}>-{formatBRL(os.desconto)}</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:16, borderTop:'1px solid var(--bd)', paddingTop:8, marginTop:4 }}><span>Total</span><span style={{ color:'var(--grn)' }}>{formatBRL(os.total || totalFinal)}</span></div>
              {os.forma_pagamento && <div style={{ fontSize:11, color:'var(--tx3)', marginTop:4 }}>{os.forma_pagamento}</div>}
            </div>
          </div>

          <div>
            {abaAtiva === 'servico' && (
              <div className="card">
                <div className="clabel">📋 Serviço</div>
                <div className="field"><label>Problema relatado</label><textarea className="inp" rows={3} value={editProblema} onChange={e=>setEditProblema(e.target.value)} disabled={finalizada} /></div>
                <div className="field"><label>Serviço realizado</label><textarea className="inp" rows={3} value={editServico} onChange={e=>setEditServico(e.target.value)} disabled={finalizada} /></div>
                <div className="field"><label>Observações internas</label><textarea className="inp" rows={2} value={editObs} onChange={e=>setEditObs(e.target.value)} disabled={finalizada} /></div>
                {!finalizada && <button className="btn btn-d btn-sm" onClick={salvarCampos}>💾 Salvar</button>}
              </div>
            )}

            {abaAtiva === 'checklist' && (
              <div className="card">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div>
                    <div className="clabel" style={{ marginBottom:4 }}>🔍 Checklist</div>
                    <div style={{ fontSize:12, color:'var(--tx3)' }}>✅ {checkOk} · ⚠️ {checkAtencao} · ❌ {checkTrocar}</div>
                  </div>
                  {!finalizada && <button className="btn btn-p btn-sm" onClick={salvarChecklist} disabled={savingCheck}>{savingCheck ? <span className="spin" /> : '💾 Salvar'}</button>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {checklist.map((it, idx) => (
                    <div key={it.id} style={{ display:'grid', gridTemplateColumns:'1fr 160px', gap:8, alignItems:'center', padding:'8px 12px', background:'var(--s2)', borderRadius:'var(--r)', border:'1px solid '+(it.status==='TROCAR'?'var(--redbd)':it.status==='ATENCAO'?'rgba(245,158,11,.25)':'var(--bd)') }}>
                      <div style={{ fontSize:13 }}>{it.item}</div>
                      <select className="inp" style={{ padding:'4px 8px', fontSize:12 }} value={it.status} disabled={finalizada} onChange={e => atualizarCheck(idx, 'status', e.target.value)}>
                        {CHECKLIST_STATUS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {abaAtiva === 'pecas' && (
              <div className="card">
                <div className="clabel" style={{ marginBottom:12 }}>📦 Peças</div>
                {sugestoes.length > 0 && !finalizada && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:12, color:'var(--tx3)', marginBottom:8 }}>💡 Mais usadas neste modelo:</div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {sugestoes.filter(s => s.peca_id && s.estoque > 0).slice(0,5).map(s => (
                        <button key={s.nome_peca} className="ab" style={{ fontSize:11 }} onClick={() => adicionarPeca({ id: s.peca_id, nome: s.nome_peca, preco: s.preco || s.preco_medio })}>
                          + {s.nome_peca} ({formatBRL(s.preco || s.preco_medio)})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!finalizada && (
                  <div style={{ position:'relative', marginBottom:12 }}>
                    <input className="inp" placeholder="Buscar peça da sua filial..." value={pecaBusca} onChange={e=>setPecaBusca(e.target.value)} />
                    {pecasFiltradas.length > 0 && (
                      <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--s2)', border:'1px solid var(--bd2)', borderRadius:'var(--r)', zIndex:100, maxHeight:200, overflowY:'auto' }}>
                        {pecasFiltradas.map(p => (
                          <div key={p.id} onClick={() => adicionarPeca(p)}
                            style={{ padding:'10px 14px', cursor:'pointer', fontSize:13, display:'flex', justifyContent:'space-between', borderBottom:'1px solid var(--bd)' }}
                            onMouseEnter={e=>e.currentTarget.style.background='var(--s3)'}
                            onMouseLeave={e=>e.currentTarget.style.background=''}>
                            <span><b>{p.nome}</b> <span style={{ fontSize:11, color:'var(--tx3)' }}>· estoque: {p.estoque}</span></span>
                            <span style={{ color:'var(--grn)', fontWeight:600 }}>{formatBRL(p.preco)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {pecaBusca.length >= 2 && pecasFiltradas.length === 0 && (
                      <div style={{ marginTop:6, fontSize:12, color:'var(--tx3)' }}>Nenhuma peça encontrada na sua filial.</div>
                    )}
                  </div>
                )}
                {(os.itens||[]).length === 0
                  ? <p style={{ fontSize:13, color:'var(--tx3)', textAlign:'center', padding:'16px 0' }}>Nenhuma peça adicionada.</p>
                  : (
                    <div className="tw">
                      <table className="t">
                        <thead><tr><th>Peça</th><th>Qtd</th><th>Unit.</th><th>Subtotal</th>{!finalizada&&<th></th>}</tr></thead>
                        <tbody>
                          {os.itens.map(it => (
                            <tr key={it.id}>
                              <td><b>{it.nome_peca}</b>{it.baixou_estoque ? <span className="badge b-grn" style={{ fontSize:9, marginLeft:6 }}>✓</span> : null}</td>
                              <td>{it.quantidade}</td>
                              <td>{formatBRL(it.preco_unitario)}</td>
                              <td><b style={{ color:'var(--grn)' }}>{formatBRL(it.preco_unitario * it.quantidade)}</b></td>
                              {!finalizada && <td><button className="ab red" onClick={() => removerItem(it.id)}>✕</button></td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              </div>
            )}

            {abaAtiva === 'orcamento' && (
              <div className="card">
                <div className="clabel" style={{ marginBottom:12 }}>💰 Orçamento</div>
                {orcamento ? (
                  <div style={{ padding:'16px', background: orcamento.aprovado ? 'var(--grndim)' : 'var(--reddim)', borderRadius:'var(--r)', border:'1px solid '+(orcamento.aprovado ? 'var(--grnbd)' : 'var(--redbd)') }}>
                    <div style={{ fontSize:15, fontWeight:700, color: orcamento.aprovado ? 'var(--grn)' : 'var(--red)', marginBottom:6 }}>{orcamento.aprovado ? '✅ Aprovado pelo cliente' : '❌ Recusado'}</div>
                    {orcamento.observacao && <div style={{ fontSize:13, marginTop:8 }}>{orcamento.observacao}</div>}
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize:13, color:'var(--tx3)', marginBottom:12 }}>Nenhum orçamento registrado. Use "📋 Orçamento" no topo.</p>
                    <div style={{ padding:'14px', background:'var(--s2)', borderRadius:'var(--r)' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}><span style={{ color:'var(--tx3)' }}>Peças</span><span>{formatBRL(totalPecas)}</span></div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:16, borderTop:'1px solid var(--bd)', paddingTop:8, marginTop:4 }}><span>Total estimado</span><span style={{ color:'var(--grn)' }}>{formatBRL(totalFinal)}</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* IMPRESSÃO */}
      <div ref={printRef} style={{ display:'none' }}>
        <h1>OS {os.numero}</h1>
        <p>{os.tipo} · {fmtDate(os.created_at)} · {os.cidade}</p>
        <h2>Cliente</h2>
        <p><b>{os.cliente_nome}</b> {os.cliente_telefone && '· '+os.cliente_telefone}</p>
        <h2>Moto</h2>
        <p>{os.modelo_moto} {os.cor_moto} {os.ano_moto} · Chassi: {os.chassi} {os.km && '· KM: '+os.km}</p>
        <h2>Problema relatado</h2><p>{os.problema_relatado || '—'}</p>
        <h2>Serviço realizado</h2><p>{os.servico_realizado || editServico || '—'}</p>
        {(os.itens||[]).length > 0 && <>
          <h2>Peças</h2>
          <table><thead><tr><th>Peça</th><th>Qtd</th><th>Unit.</th><th>Subtotal</th></tr></thead>
          <tbody>{os.itens.map(it=><tr key={it.id}><td>{it.nome_peca}</td><td>{it.quantidade}</td><td>R$ {Number(it.preco_unitario).toFixed(2)}</td><td>R$ {(it.preco_unitario*it.quantidade).toFixed(2)}</td></tr>)}</tbody></table>
        </>}
        {checklist.length > 0 && <>
          <h2>Checklist</h2>
          <table><thead><tr><th>Item</th><th>Status</th></tr></thead>
          <tbody>{checklist.map(it=><tr key={it.id}><td>{it.item}</td><td className={it.status==='OK'?'ok':it.status==='ATENCAO'?'atencao':'trocar'}>{it.status==='OK'?'✅ OK':it.status==='ATENCAO'?'⚠️ Atenção':it.status==='TROCAR'?'❌ Trocar':'N/A'}</td></tr>)}</tbody></table>
        </>}
        <div className="total">Total: R$ {(os.total||totalFinal).toFixed(2)}{os.forma_pagamento && ' · '+os.forma_pagamento}</div>
      </div>

      {/* MODAL ORÇAMENTO */}
      {modalOrcamento && (
        <div className="mbg" onClick={() => setModalOrcamento(false)}>
          <div className="mbox" onClick={e=>e.stopPropagation()}>
            <div className="mhd"><h3>📋 Orçamento</h3><button className="mclose" onClick={() => setModalOrcamento(false)}>×</button></div>
            <div className="ibox"><p><b>Cliente:</b> {os.cliente_nome}</p><p><b>Valor estimado:</b> {formatBRL(totalFinal)}</p></div>
            <div className="field"><label>Observação</label><textarea className="inp" rows={2} value={orcObs} onChange={e=>setOrcObs(e.target.value)} placeholder="Ex: Cliente aprovou por telefone..." /></div>
            <div className="mfoot">
              <button className="btn btn-g" onClick={() => responderOrcamento(false)}>❌ Recusou</button>
              <button className="btn btn-s" onClick={() => responderOrcamento(true)}>✅ Aprovou</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FINALIZAR */}
      {modalFinalizar && (
        <div className="mbg" onClick={() => setModalFinalizar(false)}>
          <div className="mbox" onClick={e=>e.stopPropagation()}>
            <div className="mhd"><h3>✅ Finalizar OS {os.numero}</h3><button className="mclose" onClick={() => setModalFinalizar(false)}>×</button></div>
            <div className="ibox">
              <p><b>Cliente:</b> {os.cliente_nome} · <b>Moto:</b> {os.modelo_moto || '—'}</p>
              {checkTrocar > 0 && <p style={{ color:'var(--red)' }}>⚠️ {checkTrocar} item(ns) para trocar no checklist!</p>}
            </div>
            <div className="g2">
              <div className="field"><label>Mão de obra (R$)</label><input className="inp" type="number" step="0.01" placeholder="0,00" value={ff.mao_de_obra} onChange={e=>setFf({...ff,mao_de_obra:e.target.value})} autoFocus /></div>
              <div className="field"><label>Desconto (R$)</label><input className="inp" type="number" step="0.01" placeholder="0,00" value={ff.desconto} onChange={e=>setFf({...ff,desconto:e.target.value})} /></div>
            </div>
            <div className="field"><label>Forma de pagamento *</label>
              <select className="inp" value={ff.forma_pagamento} onChange={e=>setFf({...ff,forma_pagamento:e.target.value})}>
                <option value="">Selecione</option>
                {FORMAS_PGTO.map(f=><option key={f}>{f}</option>)}
              </select>
            </div>
            <div className="field"><label>Serviço realizado</label><textarea className="inp" rows={3} value={ff.servico_realizado} onChange={e=>setFf({...ff,servico_realizado:e.target.value})} /></div>
            <div className="tbar">
              <div><div className="lbl">Total final</div><div style={{ fontSize:11, color:'var(--tx3)' }}>Peças {formatBRL(totalPecas)} + M.O. {formatBRL(ff.mao_de_obra||0)} - Desc {formatBRL(ff.desconto||0)}</div></div>
              <span className="val">{formatBRL(totalPecas + Number(ff.mao_de_obra||0) - Number(ff.desconto||0))}</span>
            </div>
            {os.em_garantia && <div style={{ background:'var(--yeldim)', border:'1px solid rgba(245,158,11,.25)', borderRadius:'var(--r)', padding:'10px 14px', fontSize:13, color:'var(--yel)', marginBottom:12 }}>⚠️ Moto em garantia — verifique se deve cobrar.</div>}
            <div className="mfoot">
              <button className="btn btn-g" onClick={() => setModalFinalizar(false)}>Cancelar</button>
              <button className="btn btn-s" onClick={finalizar} disabled={saving}>{saving ? <span className="spin" /> : '✅ Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
