import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, isDir, formatBRL, cidadeClass, MODELOS_MOTOS, FILIAIS, FILIAIS_VENDA, LOJAS_RETIRADA, FORMAS_PGTO, COMO_CHEGOU, isRepasseObrig, getRepasse, getValorCompra, getValorMinimoVenda } from '../utils';

function StatusBadge({ status = '', negociadoPor = null, usuarios = [] }) {
  const cls = `badge st-${status.toLowerCase()}`;
  const lbl = { DISPONIVEL:'Disponível', VENDIDA:'Vendida', NEGOCIACAO:'Negociação', PENDENTE_APROVACAO:'Pendente' };
  if (status === 'NEGOCIACAO' && negociadoPor) {
    const u = usuarios.find(x => x.id === negociadoPor);
    return (
      <div>
        <span className={cls}>Negociação</span>
        <div style={{fontSize:10,color:'var(--yel)',marginTop:2,fontWeight:500}}>
          🤝 {u ? u.username : `#${negociadoPor}`}
        </div>
      </div>
    );
  }
  return <span className={cls}>{lbl[status] || status}</span>;
}

export default function Home() {
  const nav = useNavigate();
  const user = getUser();
  const { show, Toast } = useToast();

  const [tab, setTab] = useState('pecas');
  const [pecas, setPecas] = useState([]);
  const [motos, setMotos] = useState([]);
  const [busca, setBusca] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [loadingP, setLoadingP] = useState(true);
  const [loadingM, setLoadingM] = useState(true);

  const [filtPCid, setFiltPCid] = useState('TODAS');
  const [filtMCid, setFiltMCid] = useState('TODAS');
  const [filtSant, setFiltSant] = useState('TODOS');
  const [filtCor, setFiltCor] = useState('TODAS');

  const [motoVenda, setMotoVenda] = useState(null);
  const [clienteBuscado, setClienteBuscado] = useState(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [meta, setMeta] = useState(null);
  const [recusadas, setRecusadas] = useState([]);
  const [vf, setVf] = useState({});
  const [motoTransf, setMotoTransf] = useState(null);
  const [transfDest, setTransfDest] = useState('');
  const [pecaTransf, setPecaTransf] = useState(null);
  const [ptQtd, setPtQtd] = useState('');
  const [ptDest, setPtDest] = useState('');
  const [pecaEst, setPecaEst] = useState(null);
  const [estQtd, setEstQtd] = useState('');
  const [estPreco, setEstPreco] = useState('');
  const [modCadP, setModCadP] = useState(false);
  const [cadPf, setCadPf] = useState({ nome:'', preco:'', cidade:'', valor_compra:'', codigo:'', tipo_moto:'' });
  const [modCadM, setModCadM] = useState(false);
  const [cadMf, setCadMf] = useState({ modelo:'', cor:'', chassi:'', ano:'', valorCompra:'', valorMinimoVenda:'', repasse:'', filial:'', cnpj:'', santander:false });

  const loadPecas = useCallback(async () => {
    setLoadingP(true);
    try { const r = await api.get('/pecas', { params: { cidade: filtPCid !== 'TODAS' ? filtPCid : undefined } }); setPecas(r.data); }
    catch (e) { show(String(e), 'err'); }
    finally { setLoadingP(false); }
  }, [filtPCid]);

  const loadMotos = useCallback(async () => {
    setLoadingM(true);
    try { const r = await api.get('/motos'); setMotos(r.data); }
    catch (e) { show(String(e), 'err'); }
    finally { setLoadingM(false); }
  }, []);

  useEffect(() => {
    if (!user) nav('/');
    else {
      loadPecas(); loadMotos();
      setCartCount(JSON.parse(localStorage.getItem('mn_cart')||'[]').length);
      api.get('/usuarios/publico').then(r => setUsuarios(r.data||[])).catch(()=>{});
      // Carregar meta do mês atual
      const now = new Date();
      api.get('/metas', {params:{mes:now.getMonth()+1,ano:now.getFullYear()}}).then(r => {
        const m = (r.data||[]).find(x=>x.filial===user.cidade);
        if (m) setMeta(m);
      }).catch(()=>{});
      if (user.role === 'FILIAL') {
        api.get('/minhas-pendentes').then(r => {
          setRecusadas((r.data||[]).filter(v => v.status === 'RECUSADA' && v.motivo_recusa));
        }).catch(()=>{});
      }
    }
  }, []);
  useEffect(() => { loadPecas(); }, [filtPCid]);

  function exportarPecasExcel() {
    const header = ['Nome','Codigo','Tipo','Filial','Estoque','Preco','Valor Compra'];
    const linhas = [header, ...pecasFilt.map(p => [p.nome, p.codigo||'', p.tipo_moto||'UNIVERSAL', p.cidade, p.estoque, Number(p.preco||0), Number(p.valor_compra||0)])];
    const csv = linhas.map(r => r.join(';')).join('\r\n');
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'pecas.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function addCart(p) {
    const c = JSON.parse(localStorage.getItem('mn_cart')||'[]');
    const ex = c.find(i=>i.peca_id===p.id);
    if (ex) ex.quantidade++; else c.push({ peca_id:p.id, nome:p.nome, quantidade:1, preco_unitario:p.preco });
    localStorage.setItem('mn_cart', JSON.stringify(c));
    setCartCount(c.length);
    show(`✅ ${p.nome} adicionada`);
  }

  async function alterarStatus(id, status) {
    try { await api.put(`/motos/${id}/status`, { status }); loadMotos(); }
    catch (e) { show(String(e), 'err'); }
  }

  async function buscarCliente(q) {
    if (!q || q.length < 3) { setClienteBuscado(null); return; }
    setBuscandoCliente(true);
    try {
      const r = await api.get('/clientes/buscar', { params: { q } });
      if (r.data) {
        setClienteBuscado(r.data);
        setVf(prev => ({ ...prev, clienteNome: r.data.nome, numero: r.data.telefone || prev.numero, cpf: r.data.cpf || prev.cpf }));
      } else { setClienteBuscado(null); }
    } catch { setClienteBuscado(null); }
    finally { setBuscandoCliente(false); }
  }

  async function venderMoto() {
    if (!vf.clienteNome || !vf.valor || !vf.filialVenda || !vf.numero) { show('Preencha os campos obrigatórios', 'err'); return; }
    try {
      await api.post('/motos/vender', { moto_id:motoVenda.id, nome_cliente:vf.clienteNome, cpf:vf.cpf||null, numero_cliente:vf.numero, valor:Number(vf.valor), forma_pagamento:vf.pagamento||null, brinde:!!vf.brinde, gasolina:vf.gasolina?Number(vf.gasolina):null, como_chegou:vf.chegou||null, filial_venda:vf.filialVenda, local_retirada:vf.localRet||null, filial_retirada:vf.localRet==='LOJA'?vf.lojaRet:null, emplacamento:!!vf.emplacamento });
      setMotoVenda(null); show('Solicitação enviada para aprovação!'); loadMotos();
    } catch (e) { show(String(e), 'err'); }
  }

  async function transferirMoto() {
    if (!transfDest) { show('Selecione a filial', 'err'); return; }
    try { await api.post('/motos/transferir', { moto_id:motoTransf.id, filial_destino:transfDest }); setMotoTransf(null); show('Moto transferida!'); loadMotos(); }
    catch (e) { show(String(e), 'err'); }
  }

  async function transferirPeca() {
    if (!ptQtd || !ptDest) { show('Preencha quantidade e destino', 'err'); return; }
    try { await api.post('/pecas/transferir', { peca_id:pecaTransf.id, filial_origem:pecaTransf.cidade, filial_destino:ptDest, quantidade:Number(ptQtd) }); setPecaTransf(null); show('Transferida!'); loadPecas(); }
    catch (e) { show(String(e), 'err'); }
  }

  async function entradaEstoque() {
    if (!estQtd || Number(estQtd)<=0) { show('Quantidade inválida', 'err'); return; }
    try { await api.put(`/pecas/${pecaEst.id}/estoque`, { quantidade:Number(estQtd), preco:estPreco?Number(estPreco):undefined }); setPecaEst(null); show('Estoque adicionado!'); loadPecas(); }
    catch (e) { show(String(e), 'err'); }
  }

  async function cadastrarPeca() {
    if (!cadPf.nome||!cadPf.preco||!cadPf.cidade) { show('Preencha todos os campos obrigatórios', 'err'); return; }
    try {
      await api.post('/pecas', {
        nome: cadPf.nome,
        preco: Number(cadPf.preco),
        cidade: cadPf.cidade,
        estoque: 0,
        valor_compra: cadPf.valor_compra ? Number(cadPf.valor_compra) : null,
        codigo: cadPf.codigo || null,
        tipo_moto: cadPf.tipo_moto || null,
      });
      setModCadP(false);
      setCadPf({nome:'',preco:'',cidade:'',valor_compra:'',codigo:'',tipo_moto:''});
      show('Peça cadastrada!');
      loadPecas();
    } catch (e) { show(String(e), 'err'); }
  }

  async function cadastrarMoto() {
    const {modelo,cor,chassi,ano,valorCompra,valorMinimoVenda,repasse,filial,cnpj,santander} = cadMf;
    if (!modelo||!cor||!chassi||!ano||!valorCompra||!filial||!cnpj) { show('Preencha todos os campos', 'err'); return; }
    let rep = repasse?Number(repasse):null;
    if (isRepasseObrig(filial)) { const r=getRepasse(modelo); if (!r) { show('Repasse não configurado para este modelo','err'); return; } rep=r; }
    try {
      await api.post('/motos', { modelo,cor,chassi,filial,santander:!!santander,cnpj_empresa:cnpj,ano_moto:Number(ano),valor_compra:Number(valorCompra),valor_minimo_venda:valorMinimoVenda?Number(valorMinimoVenda):null,repasse:rep });
      setModCadM(false);
      setCadMf({modelo:'',cor:'',chassi:'',ano:'',valorCompra:'',valorMinimoVenda:'',repasse:'',filial:'',cnpj:'',santander:false});
      show('Moto cadastrada!'); loadMotos();
    } catch (e) { show(String(e), 'err'); }
  }

  if (!user) return null;

  const pecasFilt = pecas.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()));
  const motosFilt = motos.filter(m =>
    m.status !== 'VENDIDA' &&
    (filtMCid==='TODAS'||m.filial===filtMCid) &&
    (!busca||m.modelo.toLowerCase().includes(busca.toLowerCase())||m.chassi.toLowerCase().includes(busca.toLowerCase())) &&
    (filtSant==='TODOS'||(filtSant==='MN'?!m.santander:!!m.santander)) &&
    (filtCor==='TODAS'||( m.cor||'').toUpperCase()===filtCor)
  );

  const coresUnicas = [...new Set(motos.filter(m=>m.status!=='VENDIDA').map(m=>(m.cor||'').toUpperCase().trim()).filter(Boolean))].sort();

  const resumo = motos.filter(m=>m.status!=='VENDIDA').reduce((a,m)=>{
    if(!a[m.filial]) a[m.filial]={d:0,n:0,p:0};
    if(m.status==='DISPONIVEL') a[m.filial].d++;
    else if(m.status==='NEGOCIACAO') a[m.filial].n++;
    else if(m.status==='PENDENTE_APROVACAO') a[m.filial].p++;
    return a;
  },{});

  return (
    <div className="page">
      {Toast}
      <Topbar cartCount={cartCount} />
      <div className="pc">
        {recusadas.length > 0 && (
          <div style={{marginBottom:16}}>
            {recusadas.map(v => (
              <div key={v.id} style={{background:'var(--reddim)',border:'1px solid var(--redbd)',borderRadius:'var(--r)',padding:'12px 16px',marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
                <div>
                  <div style={{fontWeight:600,color:'var(--red)',fontSize:13,marginBottom:4}}>❌ Venda recusada — {v.modelo} {v.cor} · {v.nome_cliente}</div>
                  <div style={{fontSize:12,color:'var(--tx2)'}}><b>Motivo:</b> {v.motivo_recusa}</div>
                </div>
                <button className="ab" style={{fontSize:11,flexShrink:0}} onClick={()=>setRecusadas(p=>p.filter(x=>x.id!==v.id))}>✕</button>
              </div>
            ))}
          </div>
        )}

        {meta && (() => {
          const now = new Date();
          const vendas_mes = motos.filter(m=>m.status==='VENDIDA').length; // aproximação visual
          const pct = meta.meta_motos > 0 ? Math.min(100, Math.round((vendas_mes/meta.meta_motos)*100)) : 0;
          return (
            <div className="card card-sm" style={{marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <span style={{fontSize:13,fontWeight:600}}>🎯 Meta do mês — {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][now.getMonth()]}</span>
                <span style={{fontSize:12,color:'var(--tx3)'}}>{meta.meta_motos} motos · {formatBRL(meta.meta_valor)}</span>
              </div>
              <div style={{background:'var(--s3)',borderRadius:999,height:10,overflow:'hidden'}}>
                <div style={{height:'100%',borderRadius:999,width:`${pct}%`,background:pct>=100?'var(--grn)':pct>=70?'var(--yel)':'var(--red)',transition:'width .4s'}} />
              </div>
              <div style={{fontSize:11,color:'var(--tx3)',marginTop:4,textAlign:'right'}}>{pct}% atingido</div>
            </div>
          );
        })()}

        <div className="tabs">
          <button className={`tab ${tab==='pecas'?'act':''}`} onClick={()=>{setTab('pecas');setBusca('')}}>📦 Peças</button>
          <button className={`tab ${tab==='motos'?'act':''}`} onClick={()=>{setTab('motos');setBusca('')}}>🏍 Motos</button>
        </div>

        {tab==='pecas' && <>
          <div className="sh">
            <span className="sh-t">Estoque de peças</span>
            <div style={{display:'flex',gap:6}}>
              <button className="btn btn-g btn-sm" onClick={exportarPecasExcel}>📊 Exportar Excel</button>
              {isDir(user) && <button className="btn btn-p btn-sm" onClick={()=>setModCadP(true)}>+ Cadastrar peça</button>}
            </div>
          </div>
          <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
            <div className="srch" style={{flex:1,minWidth:200}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input className="srchi" placeholder="Buscar peça..." value={busca} onChange={e=>setBusca(e.target.value)} />
            </div>
            {isDir(user) && <select className="inp" style={{width:'auto'}} value={filtPCid} onChange={e=>setFiltPCid(e.target.value)}>
              <option value="TODAS">Todas as filiais</option>
              {FILIAIS.map(f=><option key={f}>{f}</option>)}
            </select>}
          </div>
          {loadingP ? <div style={{display:'flex',justifyContent:'center',padding:60}}><span className="spin spin-lg" /></div> :
          <div className="tw"><table className="t">
            <thead><tr><th>Nome</th><th>Código</th><th>Tipo</th><th>Filial</th><th>Estoque</th><th>Preço</th><th>Ação</th></tr></thead>
            <tbody>
              {pecasFilt.length===0 && <tr><td colSpan={7}><div className="empty"><div className="empty-i">📦</div><p>Nenhuma peça.</p></div></td></tr>}
              {pecasFilt.map(p=>(
                <tr key={p.id}>
                  <td><b>{p.nome}</b></td>
                  <td style={{fontSize:12,color:'var(--tx3)',fontFamily:'var(--mono)'}}>{p.codigo||'—'}</td>
                  <td><span className="badge b-gray">{p.tipo_moto||'UNIVERSAL'}</span></td>
                  <td><span className={`ft ft-${cidadeClass(p.cidade)}`}>{p.cidade}</span></td>
                  <td><span className={`badge ${p.estoque>5?'b-grn':p.estoque>0?'b-yel':'b-red'}`}>{p.estoque}</span></td>
                  <td><b style={{color:'var(--grn)'}}>{formatBRL(p.preco)}</b></td>
                  <td><div style={{display:'flex',gap:5}}>
                    <button className="ab" onClick={()=>addCart(p)} disabled={p.estoque===0}>🛒</button>
                    {isDir(user) && <button className="ab" onClick={()=>{setPecaTransf(p);setPtQtd('');setPtDest('')}}>🔄</button>}
                    {isDir(user) && <button className="ab grn" onClick={()=>{setPecaEst(p);setEstQtd('');setEstPreco(String(p.preco))}}>➕</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table></div>}
        </>}

        {tab==='motos' && <>
          <div className="sh">
            <span className="sh-t">Estoque de motos</span>
            {isDir(user) && <button className="btn btn-p btn-sm" onClick={()=>setModCadM(true)}>+ Cadastrar moto</button>}
          </div>

          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
            {Object.entries(resumo).map(([f,d])=>(
              <div key={f} style={{background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:'var(--r)',padding:'8px 13px',fontSize:12}}>
                <div style={{fontWeight:700,color:'var(--tx2)',marginBottom:4,fontSize:11}}>{f}</div>
                <div style={{display:'flex',gap:8}}>
                  <span style={{color:'var(--grn)'}}>🟢{d.d}</span>
                  {d.n>0&&<span style={{color:'var(--blu)'}}>🔵{d.n}</span>}
                  {d.p>0&&<span style={{color:'var(--yel)'}}>🟡{d.p}</span>}
                </div>
              </div>
            ))}
          </div>

          <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
            <div className="srch" style={{flex:1,minWidth:200}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input className="srchi" placeholder="Modelo ou chassi..." value={busca} onChange={e=>setBusca(e.target.value)} />
            </div>
            <select className="inp" style={{width:'auto'}} value={filtMCid} onChange={e=>setFiltMCid(e.target.value)}>
              <option value="TODAS">Todas filiais</option>
              {FILIAIS.map(f=><option key={f}>{f}</option>)}
            </select>
            {isDir(user) && <select className="inp" style={{width:'auto'}} value={filtSant} onChange={e=>setFiltSant(e.target.value)}>
              <option value="TODOS">Todas empresas</option>
              <option value="MN">MotoNow</option>
              <option value="EM">Emenezes</option>
            </select>}
            <select className="inp" style={{width:'auto'}} value={filtCor} onChange={e=>setFiltCor(e.target.value)}>
              <option value="TODAS">Todas as cores</option>
              {coresUnicas.map(cor=><option key={cor} value={cor}>{cor}</option>)}
            </select>
          </div>

          {loadingM ? <div style={{display:'flex',justifyContent:'center',padding:60}}><span className="spin spin-lg" /></div> :
          <div className="tw"><table className="t">
            <thead><tr><th>Modelo</th><th>Ano</th><th>Cor</th><th>Chassi</th><th>Filial</th><th>Empresa</th><th>CNPJ</th><th>Status</th><th>Ação</th></tr></thead>
            <tbody>
              {motosFilt.length===0 && <tr><td colSpan={9}><div className="empty"><div className="empty-i">🏍</div><p>Nenhuma moto.</p></div></td></tr>}
              {motosFilt.map(m=>(
                <tr key={m.id}>
                  <td><b>{m.modelo}</b></td>
                  <td>{m.ano_moto}</td>
                  <td>{m.cor}</td>
                  <td className="mono">{m.chassi}</td>
                  <td><span className={`ft ft-${cidadeClass(m.filial)}`}>{m.filial}</span></td>
                  <td><span className={`badge ${m.santander?'b-blu':'b-gray'}`}>{m.santander?'EMENEZES':'MOTONOW'}</span></td>
                  <td style={{fontSize:12,color:'var(--tx2)',fontFamily:'var(--mono)'}}>{m.cnpj_empresa||<span style={{color:'var(--tx3)'}}>—</span>}</td>
                  <td><StatusBadge status={m.status} negociadoPor={m.negociacao_por} usuarios={usuarios} /></td>
                  <td><div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                    {m.status==='DISPONIVEL' && <>
                      <button className="ab red" onClick={()=>{setMotoVenda(m);setVf({clienteNome:'',cpf:'',valor:'',numero:'',gasolina:'',pagamento:'',chegou:'',filialVenda:'',localRet:'',lojaRet:'',brinde:false,emplacamento:false});setClienteBuscado(null);}}>Vender</button>
                      <button className="ab" onClick={()=>alterarStatus(m.id,'NEGOCIACAO')}>🤝</button>
                    </>}
                    {m.status==='NEGOCIACAO' && (isDir(user)||m.negociacao_por===user.id) && <button className="ab" onClick={()=>alterarStatus(m.id,'DISPONIVEL')}>↩</button>}
                    {isDir(user)&&m.status==='DISPONIVEL' && <button className="ab" onClick={()=>{setMotoTransf(m);setTransfDest('')}}>🔄</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table></div>}
        </>}
      </div>

      {/* MODAL VENDA MOTO */}
      {motoVenda && <div className="mbg" onClick={()=>setMotoVenda(null)}>
        <div className="mbox" onClick={e=>e.stopPropagation()}>
          <div className="mhd"><h3>Vender moto</h3><button className="mclose" onClick={()=>setMotoVenda(null)}>×</button></div>
          <div className="ibox"><p><b>{motoVenda.modelo}</b> · {motoVenda.cor} · {motoVenda.chassi}</p><p>Filial: {motoVenda.filial}{motoVenda.valor_minimo_venda ? ` · Mín. venda: ${formatBRL(motoVenda.valor_minimo_venda)}` : ''}</p></div>
          <div className="field">
            <label>Buscar cliente cadastrado (nome, telefone ou CPF)</label>
            <div style={{ position: 'relative' }}>
              <input className="inp" placeholder="Digite para buscar..." onChange={e => buscarCliente(e.target.value)} />
              {buscandoCliente && <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)' }}><span className="spin" /></span>}
            </div>
            {clienteBuscado && (
              <div style={{ marginTop:8, background:'var(--grndim)', borderRadius:'var(--r)', padding:'10px 14px', border:'1px solid var(--grnbd)', fontSize:13 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1 }}>
                    <b style={{ color:'var(--grn)', fontSize:14 }}>✅ {clienteBuscado.nome}</b>
                    {clienteBuscado.telefone && <span style={{ color:'var(--tx3)', marginLeft:8, fontSize:12 }}>{clienteBuscado.telefone}</span>}
                    {clienteBuscado.cpf && <span style={{ color:'var(--tx3)', marginLeft:8, fontSize:12 }}>CPF: {clienteBuscado.cpf}</span>}
                    {clienteBuscado.motos && clienteBuscado.motos.length > 0 && (
                      <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid var(--grnbd)' }}>
                        <div style={{ fontSize:11, color:'var(--tx3)', fontWeight:600, marginBottom:4 }}>MOTOS CADASTRADAS</div>
                        {clienteBuscado.motos.map((m,i) => (
                          <div key={i} style={{ fontSize:12, color:'var(--tx2)', padding:'4px 0', display:'flex', gap:8, alignItems:'center' }}>
                            <span>🏍</span>
                            <span><b>{m.modelo}</b> · {m.cor}{m.ano ? ' · '+m.ano : ''}</span>
                            <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--tx3)', background:'var(--s3)', padding:'1px 6px', borderRadius:4 }}>{m.chassi}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className="ab" onClick={() => { setClienteBuscado(null); setVf(prev=>({...prev,clienteNome:'',numero:'',cpf:''})); }} style={{ fontSize:11, marginLeft:8 }}>✕</button>
                </div>
              </div>
            )}
          </div>
          <div className="g2">
            <div className="field"><label>Cliente *</label><input className="inp" autoFocus placeholder="Nome" value={vf.clienteNome||''} onChange={e=>setVf({...vf,clienteNome:e.target.value})} /></div>
            <div className="field"><label>WhatsApp *</label><input className="inp" placeholder="(81) 9..." value={vf.numero||''} onChange={e=>setVf({...vf,numero:e.target.value})} /></div>
            <div className="field"><label>CPF</label><input className="inp" placeholder="000.000.000-00" value={vf.cpf||''} onChange={e=>setVf({...vf,cpf:e.target.value})} /></div>
            <div className="field"><label>Valor *</label><input className="inp" type="number" value={vf.valor||''} onChange={e=>setVf({...vf,valor:e.target.value})} /></div>
            <div className="field"><label>Gasolina</label><input className="inp" type="number" value={vf.gasolina||''} onChange={e=>setVf({...vf,gasolina:e.target.value})} /></div>
          </div>
          <div className="field"><label>Filial da venda *</label>
            <select className="inp" value={vf.filialVenda||''} onChange={e=>setVf({...vf,filialVenda:e.target.value})}>
              <option value="">Selecione</option>
              {FILIAIS_VENDA.map(f=><option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="g2">
            <div className="field"><label>Pagamento</label><input className="inp" placeholder="PIX + Crédito..." value={vf.pagamento||''} onChange={e=>setVf({...vf,pagamento:e.target.value})} /></div>
            <div className="field"><label>Como chegou</label>
              <select className="inp" value={vf.chegou||''} onChange={e=>setVf({...vf,chegou:e.target.value})}>
                <option value="">Selecione</option>
                {COMO_CHEGOU.map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>Loja de retirada</label>
            <select className="inp" value={vf.localRet||''} onChange={e=>setVf({...vf,localRet:e.target.value})}>
              <option value="">Selecione</option>
              <option value="LOJA">Retirada em loja</option>
              <option value="ENTREGA">Entrega ao cliente</option>
            </select>
          </div>
          {vf.localRet==='LOJA' && <div className="field"><label>Qual loja?</label>
            <select className="inp" value={vf.lojaRet||''} onChange={e=>setVf({...vf,lojaRet:e.target.value})}>
              <option value="">Selecione</option>
              {LOJAS_RETIRADA.map(f=><option key={f}>{f}</option>)}
            </select>
          </div>}
          <div style={{display:'flex',gap:20,marginBottom:16,flexWrap:'wrap'}}>
            <label className="ck"><input type="checkbox" checked={!!vf.brinde} onChange={e=>setVf({...vf,brinde:e.target.checked})} /> Capacete de brinde</label>
            <label className="ck"><input type="checkbox" checked={!!vf.emplacamento} onChange={e=>setVf({...vf,emplacamento:e.target.checked})} /> Inclui emplacamento</label>
          </div>
          <div className="mfoot">
            <button className="btn btn-g" onClick={()=>setMotoVenda(null)}>Cancelar</button>
            <button className="btn btn-p" onClick={venderMoto}>Confirmar</button>
          </div>
        </div>
      </div>}

      {/* MODAL TRANSFERIR MOTO */}
      {motoTransf && <div className="mbg" onClick={()=>setMotoTransf(null)}>
        <div className="mbox" onClick={e=>e.stopPropagation()}>
          <div className="mhd"><h3>Transferir moto</h3><button className="mclose" onClick={()=>setMotoTransf(null)}>×</button></div>
          <div className="ibox"><p><b>{motoTransf.modelo}</b> · {motoTransf.chassi}</p><p>Origem: {motoTransf.filial}</p></div>
          <div className="field"><label>Filial destino</label>
            <select className="inp" value={transfDest} onChange={e=>setTransfDest(e.target.value)}>
              <option value="">Selecione</option>
              {FILIAIS.filter(f=>f!==motoTransf.filial).map(f=><option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="mfoot">
            <button className="btn btn-g" onClick={()=>setMotoTransf(null)}>Cancelar</button>
            <button className="btn btn-p" onClick={transferirMoto}>Confirmar</button>
          </div>
        </div>
      </div>}

      {/* MODAL TRANSFERIR PEÇA */}
      {pecaTransf && <div className="mbg" onClick={()=>setPecaTransf(null)}>
        <div className="mbox" onClick={e=>e.stopPropagation()}>
          <div className="mhd"><h3>Transferir peça</h3><button className="mclose" onClick={()=>setPecaTransf(null)}>×</button></div>
          <div className="ibox"><p><b>{pecaTransf.nome}</b> · {pecaTransf.cidade} · Estoque: {pecaTransf.estoque}</p></div>
          <div className="field"><label>Quantidade</label><input className="inp" type="number" autoFocus value={ptQtd} onChange={e=>setPtQtd(e.target.value)} /></div>
          <div className="field"><label>Filial destino</label>
            <select className="inp" value={ptDest} onChange={e=>setPtDest(e.target.value)}>
              <option value="">Selecione</option>
              {FILIAIS.filter(f=>f!==pecaTransf.cidade).map(f=><option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="mfoot">
            <button className="btn btn-g" onClick={()=>setPecaTransf(null)}>Cancelar</button>
            <button className="btn btn-p" onClick={transferirPeca}>Confirmar</button>
          </div>
        </div>
      </div>}

      {/* MODAL ENTRADA ESTOQUE */}
      {pecaEst && <div className="mbg" onClick={()=>setPecaEst(null)}>
        <div className="mbox" onClick={e=>e.stopPropagation()}>
          <div className="mhd"><h3>Entrada de estoque</h3><button className="mclose" onClick={()=>setPecaEst(null)}>×</button></div>
          <div className="ibox"><p><b>{pecaEst.nome}</b> · {pecaEst.cidade} · Atual: {pecaEst.estoque}</p></div>
          <div className="field"><label>Quantidade a adicionar</label><input className="inp" type="number" autoFocus value={estQtd} onChange={e=>setEstQtd(e.target.value)} /></div>
          <div className="field"><label>Novo preço (opcional)</label><input className="inp" type="number" step="0.01" value={estPreco} onChange={e=>setEstPreco(e.target.value)} /></div>
          <div className="mfoot">
            <button className="btn btn-g" onClick={()=>setPecaEst(null)}>Cancelar</button>
            <button className="btn btn-s" onClick={entradaEstoque}>Salvar</button>
          </div>
        </div>
      </div>}

      {/* MODAL CADASTRAR PEÇA */}
      {modCadP && <div className="mbg" onClick={()=>setModCadP(false)}>
        <div className="mbox" onClick={e=>e.stopPropagation()}>
          <div className="mhd"><h3>Cadastrar peça</h3><button className="mclose" onClick={()=>setModCadP(false)}>×</button></div>
          <div className="field"><label>Nome *</label><input className="inp" autoFocus value={cadPf.nome} onChange={e=>setCadPf({...cadPf,nome:e.target.value})} /></div>
          <div className="g2">
            <div className="field"><label>Preço de venda (R$) *</label><input className="inp" type="number" step="0.01" value={cadPf.preco} onChange={e=>setCadPf({...cadPf,preco:e.target.value})} /></div>
            <div className="field"><label>Valor de compra (R$)</label><input className="inp" type="number" step="0.01" value={cadPf.valor_compra} onChange={e=>setCadPf({...cadPf,valor_compra:e.target.value})} /></div>
          </div>
          <div className="g2">
            <div className="field"><label>Código da peça</label><input className="inp" placeholder="Ex: SHI-001" value={cadPf.codigo} onChange={e=>setCadPf({...cadPf,codigo:e.target.value})} /></div>
            <div className="field"><label>Modelo da moto</label><input className="inp" placeholder="Ex: SHI 175 EFI" value={cadPf.tipo_moto} onChange={e=>setCadPf({...cadPf,tipo_moto:e.target.value})} /></div>
          </div>
          <div className="field"><label>Filial *</label>
            <select className="inp" value={cadPf.cidade} onChange={e=>setCadPf({...cadPf,cidade:e.target.value})}>
              <option value="">Selecione</option>
              {FILIAIS.map(f=><option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="mfoot">
            <button className="btn btn-g" onClick={()=>setModCadP(false)}>Cancelar</button>
            <button className="btn btn-p" onClick={cadastrarPeca}>Salvar</button>
          </div>
        </div>
      </div>}

      {/* MODAL CADASTRAR MOTO */}
      {modCadM && <div className="mbg" onClick={()=>setModCadM(false)}>
        <div className="mbox wide" onClick={e=>e.stopPropagation()}>
          <div className="mhd"><h3>Cadastrar moto</h3><button className="mclose" onClick={()=>setModCadM(false)}>×</button></div>
          <div className="field"><label>Modelo *</label>
            <select className="inp" value={cadMf.modelo} onChange={e=>{
              const m=e.target.value; const cfg=MODELOS_MOTOS.find(x=>x.modelo===m);
              const vmin=getValorMinimoVenda(m);
              if(cfg){const s=cfg.sant;setCadMf(p=>({...p,modelo:m,santander:s,valorCompra:String(s?cfg.santander:cfg.motonow),valorMinimoVenda:vmin?String(vmin):p.valorMinimoVenda}));}
              else { setCadMf(p=>({...p,modelo:m,valorMinimoVenda:vmin?String(vmin):p.valorMinimoVenda})); }
            }}>
              <option value="">Selecione</option>
              {MODELOS_MOTOS.map(m=><option key={m.modelo}>{m.modelo}</option>)}
            </select>
          </div>
          <div className="g2">
            <div className="field"><label>Cor *</label><input className="inp" value={cadMf.cor} onChange={e=>setCadMf({...cadMf,cor:e.target.value})} /></div>
            <div className="field"><label>Ano *</label><input className="inp" placeholder="2024" value={cadMf.ano} onChange={e=>setCadMf({...cadMf,ano:e.target.value})} /></div>
          </div>
          <div className="field"><label>Chassi *</label><input className="inp" value={cadMf.chassi} onChange={e=>setCadMf({...cadMf,chassi:e.target.value})} /></div>
          <div className="g2">
            <div className="field"><label>Valor compra *</label><input className="inp" type="number" value={cadMf.valorCompra} onChange={e=>setCadMf({...cadMf,valorCompra:e.target.value})} /></div>
            <div className="field"><label>Valor mínimo de venda</label><input className="inp" type="number" placeholder="Ex: 15500" value={cadMf.valorMinimoVenda} onChange={e=>setCadMf({...cadMf,valorMinimoVenda:e.target.value})} /></div>
          </div>
          <div className="field"><label>Repasse Santander</label><input className="inp" type="number" disabled={isRepasseObrig(cadMf.filial)} value={cadMf.repasse} onChange={e=>setCadMf({...cadMf,repasse:e.target.value})} /></div>
          <div className="g2">
            <div className="field"><label>Filial *</label>
              <select className="inp" value={cadMf.filial} onChange={e=>{
                const f=e.target.value;
                if(isRepasseObrig(f)){const r=getRepasse(cadMf.modelo);setCadMf(p=>({...p,filial:f,repasse:r?String(r):p.repasse}));}
                else setCadMf(p=>({...p,filial:f}));
              }}>
                <option value="">Selecione</option>
                {FILIAIS.map(f=><option key={f}>{f}</option>)}
              </select>
            </div>
            <div className="field"><label>CNPJ *</label><input className="inp" placeholder="00.000.000/0001-00" value={cadMf.cnpj} onChange={e=>setCadMf({...cadMf,cnpj:e.target.value})} /></div>
          </div>
          <label className="ck" style={{marginBottom:16}}>
            <input type="checkbox" checked={cadMf.santander} onChange={e=>{
              const s=e.target.checked; const vc=getValorCompra(cadMf.modelo,s);
              setCadMf(p=>({...p,santander:s,valorCompra:vc?String(vc):p.valorCompra}));
            }} /> Financiada Santander (EMENEZES)
          </label>
          <div className="mfoot">
            <button className="btn btn-g" onClick={()=>setModCadM(false)}>Cancelar</button>
            <button className="btn btn-p" onClick={cadastrarMoto}>Cadastrar</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
