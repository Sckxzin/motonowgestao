import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, formatBRL, FILIAIS, FILIAIS_VENDA, MODELOS_MOTOS } from '../utils';

export default function Admin() {
  const nav = useNavigate(); const user = getUser();
  const { show, Toast } = useToast();
  const [tab, setTab] = useState('dash');
  const [resumo, setResumo] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [ranking, setRanking] = useState({ pecas:[], motos:[] });
  const [modUser, setModUser] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uf, setUf] = useState({ username:'', password:'', role:'FILIAL', cidade:'' });

  // Peças
  const [pecas, setPecas] = useState([]);
  const [buscaPeca, setBuscaPeca] = useState('');
  const [editPeca, setEditPeca] = useState(null);
  const [ep, setEp] = useState({});

  // Motos estoque
  const [motosEst, setMotosEst] = useState([]);

  // Gastos motos
  const [gastos, setGastos] = useState([]);

  // Metas
  const [metas, setMetas] = useState([]);
  const [metaMes, setMetaMes] = useState(new Date().getMonth()+1);
  const [metaAno, setMetaAno] = useState(new Date().getFullYear());
  const [editMeta, setEditMeta] = useState({});
  const [savingMeta, setSavingMeta] = useState(false);

  // Log
  const [logAtiv, setLogAtiv] = useState([]);

  // Comissões
  const [comissoes, setComissoes] = useState([]);
  const [editCom, setEditCom] = useState(null);
  const [ec, setEc] = useState({});
  const [novaCom, setNovaCom] = useState({modelo:'',v30:'',v50:'',v100:''});
  const [addingCom, setAddingCom] = useState(false);
  const [editGasto, setEditGasto] = useState(null);
  const [eg, setEg] = useState({});
  const [filtroAnoGasto, setFiltroAnoGasto] = useState(new Date().getFullYear());
  const [filtroMesGasto, setFiltroMesGasto] = useState('');
  const [buscaMoto, setBuscaMoto] = useState('');
  const [editMoto, setEditMoto] = useState(null);
  const [em, setEm] = useState({});

  // Filiais
  const [filiais, setFiliais] = useState([]);
  const [novaFilial, setNovaFilial] = useState('');
  const [editFilial, setEditFilial] = useState(null);
  const [efNome, setEfNome] = useState('');

  useEffect(() => {
    if (!user) { nav('/'); return; }
    Promise.all([
      api.get('/admin/resumo').then(r=>setResumo(r.data)),
      api.get('/usuarios').then(r=>setUsuarios(r.data)),
      api.get('/admin/ranking').then(r=>setRanking(r.data)),
      api.get('/filiais').then(r=>setFiliais(r.data||[])),
    ]).catch(e=>show(String(e),'err'));
  }, []);

  useEffect(() => {
    if (tab === 'pecas') api.get('/pecas').then(r=>setPecas(r.data||[])).catch(()=>{});
    if (tab === 'motos') api.get('/motos').then(r=>setMotosEst(r.data||[])).catch(()=>{});
    if (tab === 'metas') api.get('/metas', {params:{mes:metaMes,ano:metaAno}}).then(r=>setMetas(r.data||[])).catch(()=>{});
    if (tab === 'log') api.get('/log-atividades',{params:{limite:200}}).then(r=>setLogAtiv(r.data||[])).catch(()=>{});
    if (tab === 'comissoes') api.get('/comissoes').then(r=>setComissoes(r.data||[])).catch(()=>{});
    if (tab === 'filiais') api.get('/filiais').then(r=>setFiliais(r.data||[])).catch(()=>{});
    if (tab === 'gastos') api.get('/vendas-motos').then(r => {
      const vendas = r.data || [];
      // Agrupa por filial_venda
      const FILIAIS = ['ESCADA','IPOJUCA','RIBEIRAO','SAO JOSE','CATENDE','XEXEU','MARAGOGI','CHA GRANDE','DIRETORIA'];
      const mapa = {};
      FILIAIS.forEach(f => { mapa[f] = { filial:f, capacetes:0, gasolina:0, emplacamento:0, vendas:[] }; });
      vendas.forEach(v => {
        const f = (v.filial_venda||'').toUpperCase().trim();
        if (!mapa[f]) mapa[f] = { filial:f, capacetes:0, gasolina:0, emplacamento:0, vendas:[] };
        if (v.brinde) mapa[f].capacetes += 1;
        mapa[f].gasolina += Number(v.gasolina||0);
        mapa[f].emplacamento += Number(v.emplacamento||0);
        mapa[f].vendas.push(v);
      });
      setGastos(Object.values(mapa).filter(g => g.capacetes > 0 || g.gasolina > 0 || g.emplacamento > 0));
    }).catch(()=>{});
  }, [tab]);

  async function salvarPeca() {
    try {
      await api.put('/pecas/'+editPeca.id, ep);
      setPecas(p => p.map(x => x.id===editPeca.id ? {...x,...ep} : x));
      setEditPeca(null); show('Peça atualizada!');
    } catch(e) { show(String(e),'err'); }
  }

  async function excluirPeca(id) {
    if (!window.confirm('Excluir esta peça?')) return;
    try {
      await api.delete('/pecas/'+id);
      setPecas(p => p.filter(x=>x.id!==id)); show('Peça excluída!');
    } catch(e) { show(String(e),'err'); }
  }

  async function salvarMoto() {
    try {
      await api.put('/motos/'+editMoto.id, em);
      setMotosEst(p => p.map(x => x.id===editMoto.id ? {...x,...em} : x));
      setEditMoto(null); show('Moto atualizada!');
    } catch(e) { show(String(e),'err'); }
  }

  async function excluirMoto(id) {
    if (!window.confirm('Excluir esta moto do estoque?')) return;
    try {
      await api.delete('/motos/'+id);
      setMotosEst(p => p.filter(x=>x.id!==id)); show('Moto excluída!');
    } catch(e) { show(String(e),'err'); }
  }

  async function criarUser() {
    if (!uf.username||!uf.password||!uf.cidade) { show('Preencha todos','err'); return; }
    setSaving(true);
    try { await api.post('/usuarios',uf); show('Criado!'); setModUser(false); setUf({username:'',password:'',role:'FILIAL',cidade:''}); api.get('/usuarios').then(r=>setUsuarios(r.data)); }
    catch(e){show(String(e),'err');}finally{setSaving(false);}
  }

  if (!resumo) return <div className="page"><Topbar /><div style={{display:'flex',justifyContent:'center',padding:80}}><span className="spin spin-lg" /></div></div>;

  const acoes = [
    ['🕒 Aprovar vendas','/pendentes',resumo.pendencias],
    ['🧾 Hist. vendas peças','/vendas',null],
    ['🏍 Hist. vendas motos','/vendas-motos',null],
    ['🪪 Emplacamentos','/emplacamentos',null],
    ['💰 Financeiro','/financeiro',null],
    ['👥 Clientes','/clientes',null],
    ['🔧 Revisões','/revisoes',null],
  ];

  return (
    <div className="page">
      {Toast}<Topbar />
      <div className="pc">
        <div className="sh"><span className="sh-t">⚙️ Admin</span></div>
        <div className="tabs">
          {[['dash','📊 Dashboard'],['usuarios','👥 Usuários'],['ranking','🏪 Ranking'],['pecas','📦 Peças'],['motos','🏍 Motos'],['gastos','💸 Gastos Motos'],['metas','🎯 Metas'],['log','📋 Log'],['comissoes','💵 Comissões'],['filiais','🏢 Filiais']].map(([k,l])=>(
            <button key={k} className={`tab ${tab===k?'act':''}`} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>

        {tab==='dash' && <>
          <div className="gf" style={{marginBottom:20}}>
            <div className="stat grn"><div className="sv">{resumo.motos_disponiveis}</div><div className="sl">Motos disponíveis</div></div>
            <div className="stat red"><div className="sv" style={{fontSize:18}}>{formatBRL(resumo.faturamento_hoje)}</div><div className="sl">Faturamento hoje</div></div>
            <div className="stat"><div className="sv">{resumo.vendas_hoje}</div><div className="sl">Vendas hoje</div></div>
            <div className="stat yel"><div className="sv">{resumo.pendencias}</div><div className="sl">Pendentes aprovação</div></div>
            <div className="stat yel"><div className="sv">{resumo.motos_pendentes}</div><div className="sl">Motos pendentes</div></div>
            <div className="stat red"><div className="sv">{resumo.pecas_zeradas}</div><div className="sl">Peças sem estoque</div></div>
            <div className="stat blu"><div className="sv">{resumo.total_clientes}</div><div className="sl">Clientes</div></div>
            <div className="stat"><div className="sv">{resumo.total_motos_vendidas}</div><div className="sl">Motos vendidas</div></div>
          </div>
          <div className="g2">
            <div className="card">
              <div className="clabel">Ações rápidas</div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {acoes.map(([l,p,b])=>(
                  <button key={l} className="btn btn-g" style={{justifyContent:'space-between'}} onClick={()=>nav(p)}>
                    <span>{l}</span>
                    {b>0&&<span className="badge b-yel">{b}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="clabel">Sessão</div>
              <table style={{width:'100%',fontSize:13}}>
                <tbody>
                  {[['Usuário',user.username],['Cargo',user.role],['Filial',user.cidade]].map(([l,v])=>(
                    <tr key={l}><td style={{color:'var(--tx3)',padding:'7px 0',width:100}}>{l}</td><td style={{color:'var(--tx)',fontWeight:500}}>{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>}

        {tab==='usuarios' && <>
          <div className="sh" style={{marginBottom:16}}>
            <span style={{color:'var(--tx2)',fontSize:13}}>{usuarios.length} usuários</span>
            <button className="btn btn-p btn-sm" onClick={()=>setModUser(true)}>+ Novo</button>
          </div>
          <div className="tw"><table className="t">
            <thead><tr><th>Usuário</th><th>Cargo</th><th>Filial</th><th>Ativo</th></tr></thead>
            <tbody>{usuarios.map(u=>(
              <tr key={u.id}>
                <td><b>{u.username}</b></td>
                <td><span className={`badge ${u.role==='DIRETORIA'?'b-red':'b-blu'}`}>{u.role}</span></td>
                <td>{u.cidade}</td>
                <td><span className={`badge ${u.ativo?'b-grn':'b-gray'}`}>{u.ativo?'Sim':'Não'}</span></td>
              </tr>
            ))}</tbody>
          </table></div>
        </>}

        {tab==='pecas' && <>
          <div className="sh"><span className="sh-t">📦 Gerenciar Peças</span></div>
          <div className="card" style={{marginBottom:14}}>
            <input className="inp" placeholder="Buscar por nome..." value={buscaPeca} onChange={e=>setBuscaPeca(e.target.value)} />
          </div>
          <div className="tw">
            <table className="t">
              <thead><tr><th>Nome</th><th>Preço</th><th>Estoque</th><th>Cidade</th><th>Tipo moto</th><th></th></tr></thead>
              <tbody>
                {pecas.filter(p=>!buscaPeca||p.nome.toLowerCase().includes(buscaPeca.toLowerCase())).map(p=>(
                  <tr key={p.id}>
                    <td><b>{p.nome}</b></td>
                    <td>{formatBRL(p.preco)}</td>
                    <td><span className={`badge ${p.estoque===0?'b-red':'b-grn'}`}>{p.estoque}</span></td>
                    <td>{p.cidade||'-'}</td>
                    <td style={{fontSize:12,color:'var(--tx3)'}}>{p.tipo_moto||'-'}</td>
                    <td style={{display:'flex',gap:6}}>
                      <button className="ab" onClick={()=>{setEditPeca(p);setEp({nome:p.nome,preco:p.preco,estoque:p.estoque,cidade:p.cidade||'',tipo_moto:p.tipo_moto||'',descricao:p.descricao||''});}}>✏️</button>
                      <button className="ab red" onClick={()=>excluirPeca(p.id)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {tab==='motos' && <>
          <div className="sh"><span className="sh-t">🏍 Gerenciar Estoque de Motos</span></div>
          <div className="card" style={{marginBottom:14}}>
            <input className="inp" placeholder="Buscar por modelo ou chassi..." value={buscaMoto} onChange={e=>setBuscaMoto(e.target.value)} />
          </div>
          <div className="tw">
            <table className="t">
              <thead><tr><th>Modelo</th><th>Cor</th><th>Chassi</th><th>Filial</th><th>Status</th><th>Compra</th><th></th></tr></thead>
              <tbody>
                {motosEst.filter(m=>!buscaMoto||m.modelo.toLowerCase().includes(buscaMoto.toLowerCase())||m.chassi.toLowerCase().includes(buscaMoto.toLowerCase())).map(m=>(
                  <tr key={m.id}>
                    <td><b>{m.modelo}</b></td>
                    <td>{m.cor||'-'}</td>
                    <td><span style={{fontFamily:'var(--mono)',fontSize:11}}>{m.chassi}</span></td>
                    <td>{m.filial||'-'}</td>
                    <td><span className={`badge ${m.status==='DISPONIVEL'?'b-grn':m.status==='VENDIDA'?'b-blu':'b-yel'}`}>{m.status}</span></td>
                    <td>{formatBRL(m.valor_compra)}</td>
                    <td style={{display:'flex',gap:6}}>
                      <button className="ab" onClick={()=>{setEditMoto(m);setEm({modelo:m.modelo,cor:m.cor||'',chassi:m.chassi,ano_moto:m.ano_moto||'',valor_compra:m.valor_compra||0,valor_minimo_venda:m.valor_minimo_venda||'',repasse:m.repasse||'',filial:m.filial||'',santander:!!m.santander,cnpj_empresa:m.cnpj_empresa||''});}}>✏️</button>
                      <button className="ab red" onClick={()=>excluirMoto(m.id)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {tab==='gastos' && <>
          <div className="sh" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span className="sh-t">💸 Gastos por Filial — Motos</span>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <select className="inp" style={{width:100}} value={filtroAnoGasto} onChange={e=>setFiltroAnoGasto(Number(e.target.value))}>
                {[2025,2026,2027].map(a=><option key={a}>{a}</option>)}
              </select>
              <select className="inp" style={{width:120}} value={filtroMesGasto} onChange={e=>setFiltroMesGasto(e.target.value)}>
                <option value="">Todos os meses</option>
                {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m,i)=>(
                  <option key={i+1} value={String(i+1).padStart(2,'0')}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="tw">
            <table className="t">
              <thead>
                <tr>
                  <th>Filial</th>
                  <th>🎁 Capacetes (brinde)</th>
                  <th>⛽ Gasolina (R$)</th>
                  <th>📋 Emplacamento (R$)</th>
                  <th>Total gastos (R$)</th><th></th>
                </tr>
              </thead>
              <tbody>
                {gastos.length === 0 && <tr><td colSpan={5}><div className="empty"><p>Nenhum dado.</p></div></td></tr>}
                {gastos.map((g,i) => {
                  const isEdit = editGasto?.filial === g.filial;
                  return (
                  <tr key={i}>
                    <td><b>{g.filial}</b></td>
                    <td>
                      {isEdit ? (
                        <input className="inp" type="number" style={{width:80}} value={eg.capacetes} onChange={e=>setEg({...eg,capacetes:Number(e.target.value)})} />
                      ) : (
                        <span className="badge b-yel">{g.capacetes} cap.</span>
                      )}
                    </td>
                    <td>
                      {isEdit ? (
                        <input className="inp" type="number" style={{width:100}} value={eg.gasolina} onChange={e=>setEg({...eg,gasolina:Number(e.target.value)})} />
                      ) : formatBRL(g.gasolina)}
                    </td>
                    <td>
                      {isEdit ? (
                        <input className="inp" type="number" style={{width:100}} value={eg.emplacamento} onChange={e=>setEg({...eg,emplacamento:Number(e.target.value)})} />
                      ) : formatBRL(g.emplacamento)}
                    </td>
                    <td><b style={{color:'var(--red)'}}>{formatBRL(g.gasolina + g.emplacamento + g.capacetes * 100)}</b></td>
                    <td>
                      {isEdit ? (
                        <div style={{display:'flex',gap:6}}>
                          <button className="btn btn-p btn-sm" onClick={async()=>{
                            // Atualiza cada venda da filial com os novos valores proporcionais
                            // Por ora apenas salva localmente
                            setGastos(prev=>prev.map(x=>x.filial===g.filial?{...x,...eg}:x));
                            setEditGasto(null);
                            show('Gastos atualizados!');
                          }}>✓</button>
                          <button className="btn btn-g btn-sm" onClick={()=>setEditGasto(null)}>✕</button>
                        </div>
                      ) : (
                        <button className="ab" onClick={()=>{setEditGasto(g);setEg({capacetes:g.capacetes,gasolina:g.gasolina,emplacamento:g.emplacamento});}}>✏️</button>
                      )}
                    </td>
                  </tr>
                  );
                })}
                <tr style={{borderTop:'2px solid var(--bd)'}}>
                  <td><b>TOTAL</b></td>
                  <td><b>{gastos.reduce((s,g)=>s+g.capacetes,0)} capacetes</b></td>
                  <td><b>{formatBRL(gastos.reduce((s,g)=>s+g.gasolina,0))}</b></td>
                  <td><b>{formatBRL(gastos.reduce((s,g)=>s+g.emplacamento,0))}</b></td>
                  <td><b style={{color:'var(--red)'}}>{formatBRL(gastos.reduce((s,g)=>s+g.gasolina+g.emplacamento+g.capacetes*180,0))}</b></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>}

        {tab==='metas' && <>
          <div className="sh" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span className="sh-t">🎯 Metas Mensais</span>
            <div style={{display:'flex',gap:8}}>
              <select className="inp" style={{width:120}} value={metaMes} onChange={e=>{setMetaMes(Number(e.target.value));api.get('/metas',{params:{mes:e.target.value,ano:metaAno}}).then(r=>setMetas(r.data||[])).catch(()=>{});}}>
                {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
              </select>
              <select className="inp" style={{width:90}} value={metaAno} onChange={e=>{setMetaAno(Number(e.target.value));api.get('/metas',{params:{mes:metaMes,ano:e.target.value}}).then(r=>setMetas(r.data||[])).catch(()=>{});}}>
                {[2025,2026,2027].map(a=><option key={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div className="tw"><table className="t">
            <thead><tr><th>Filial</th><th>Meta (motos)</th><th>Meta (R$)</th><th>Ações</th></tr></thead>
            <tbody>
              {FILIAIS.map(filial => {
                const m = metas.find(x=>x.filial===filial)||{};
                const isEdit = editMeta[filial] !== undefined;
                return (
                  <tr key={filial}>
                    <td><b>{filial}</b></td>
                    <td>
                      {isEdit ? <input className="inp" type="number" style={{width:100}} value={editMeta[filial]?.motos??m.meta_motos??''} onChange={e=>setEditMeta(p=>({...p,[filial]:{...p[filial],motos:e.target.value}}))} />
                        : <span>{m.meta_motos||<span style={{color:'var(--tx3)'}}>—</span>}</span>}
                    </td>
                    <td>
                      {isEdit ? <input className="inp" type="number" style={{width:120}} value={editMeta[filial]?.valor??m.meta_valor??''} onChange={e=>setEditMeta(p=>({...p,[filial]:{...p[filial],valor:e.target.value}}))} />
                        : <span>{m.meta_valor ? formatBRL(m.meta_valor) : <span style={{color:'var(--tx3)'}}>—</span>}</span>}
                    </td>
                    <td>
                      {isEdit ? (
                        <div style={{display:'flex',gap:6}}>
                          <button className="btn btn-p btn-sm" disabled={savingMeta} onClick={async()=>{
                            setSavingMeta(true);
                            try {
                              await api.post('/metas',{filial,mes:metaMes,ano:metaAno,meta_motos:editMeta[filial]?.motos||0,meta_valor:editMeta[filial]?.valor||0});
                              const r = await api.get('/metas',{params:{mes:metaMes,ano:metaAno}});
                              setMetas(r.data||[]);
                              setEditMeta(p=>{const x={...p};delete x[filial];return x;});
                              show('Meta salva!');
                            } catch(e){show(String(e),'err');}
                            finally{setSavingMeta(false);}
                          }}>✓ Salvar</button>
                          <button className="btn btn-g btn-sm" onClick={()=>setEditMeta(p=>{const x={...p};delete x[filial];return x;})}>✕</button>
                        </div>
                      ) : (
                        <button className="ab" onClick={()=>setEditMeta(p=>({...p,[filial]:{motos:m.meta_motos||'',valor:m.meta_valor||''}}))}>✏️</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </>}

        {tab==='log' && <>
          <div className="sh"><span className="sh-t">📋 Log de Atividades</span></div>
          <div className="tw"><table className="t">
            <thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Descrição</th></tr></thead>
            <tbody>
              {logAtiv.length===0 && <tr><td colSpan={4}><div className="empty"><p>Nenhuma atividade registrada.</p></div></td></tr>}
              {logAtiv.map(l=>(
                <tr key={l.id}>
                  <td style={{fontSize:11,whiteSpace:'nowrap'}}>{new Date(l.created_at).toLocaleString('pt-BR')}</td>
                  <td><b>{l.username}</b></td>
                  <td><span className={`badge ${l.acao.includes('RECUS')?'b-red':l.acao.includes('APROV')?'b-grn':'b-gray'}`} style={{fontSize:10}}>{l.acao}</span></td>
                  <td style={{fontSize:12}}>{l.descricao||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </>}

        {tab==='ranking' && <>
          <div className="g2">
            {[['Peças',ranking.pecas],['Motos',ranking.motos]].map(([titulo,dados])=>(
              <div key={titulo} className="card">
                <div className="clabel">Ranking — {titulo}</div>
                {dados.length===0?<p style={{fontSize:13,color:'var(--tx3)'}}>Sem dados</p>:dados.map((f,i)=>(
                  <div key={f.cidade} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid var(--bd)'}}>
                    <span style={{fontSize:13,fontWeight:700,color:'var(--tx3)',width:20}}>{i+1}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600}}>{f.cidade||'—'}</div>
                      <div style={{fontSize:11,color:'var(--tx3)'}}>{f.qtd} vendas</div>
                    </div>
                    <span style={{fontSize:13,fontWeight:700,color:'var(--grn)'}}>{formatBRL(f.faturamento)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>}
      </div>


      {/* MODAL EDITAR PEÇA */}
      {editPeca && <div className="mbg" onClick={()=>setEditPeca(null)}><div className="mbox" onClick={e=>e.stopPropagation()}>
        <div className="mhd"><h3>✏️ Editar peça</h3><button className="mclose" onClick={()=>setEditPeca(null)}>×</button></div>
        <div className="field"><label>Nome *</label><input className="inp" autoFocus value={ep.nome||''} onChange={e=>setEp({...ep,nome:e.target.value})} /></div>
        <div className="g2">
          <div className="field"><label>Preço (R$) *</label><input className="inp" type="number" step="0.01" value={ep.preco||''} onChange={e=>setEp({...ep,preco:e.target.value})} /></div>
          <div className="field"><label>Estoque</label><input className="inp" type="number" value={ep.estoque||0} onChange={e=>setEp({...ep,estoque:e.target.value})} /></div>
        </div>
        <div className="g2">
          <div className="field"><label>Cidade</label>
            <select className="inp" value={ep.cidade||''} onChange={e=>setEp({...ep,cidade:e.target.value})}>
              <option value="">Selecione</option>
              {FILIAIS.map(f=><option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="field"><label>Tipo moto</label><input className="inp" placeholder="Ex: SHI 175, JET 125..." value={ep.tipo_moto||''} onChange={e=>setEp({...ep,tipo_moto:e.target.value})} /></div>
        </div>
        <div className="field"><label>Descrição</label><textarea className="inp" rows={2} value={ep.descricao||''} onChange={e=>setEp({...ep,descricao:e.target.value})} /></div>
        <div className="mfoot">
          <button className="btn btn-g" onClick={()=>setEditPeca(null)}>Cancelar</button>
          <button className="btn btn-p" onClick={salvarPeca}>💾 Salvar</button>
        </div>
      </div></div>}

      {/* MODAL EDITAR MOTO */}
      {editMoto && <div className="mbg" onClick={()=>setEditMoto(null)}><div className="mbox" onClick={e=>e.stopPropagation()}>
        <div className="mhd"><h3>✏️ Editar moto</h3><button className="mclose" onClick={()=>setEditMoto(null)}>×</button></div>
        <div className="g2">
          <div className="field"><label>Modelo *</label><input className="inp" autoFocus value={em.modelo||''} onChange={e=>setEm({...em,modelo:e.target.value})} /></div>
          <div className="field"><label>Cor</label><input className="inp" value={em.cor||''} onChange={e=>setEm({...em,cor:e.target.value})} /></div>
        </div>
        <div className="g2">
          <div className="field"><label>Chassi *</label><input className="inp" value={em.chassi||''} onChange={e=>setEm({...em,chassi:e.target.value.toUpperCase()})} /></div>
          <div className="field"><label>Ano</label><input className="inp" type="number" value={em.ano_moto||''} onChange={e=>setEm({...em,ano_moto:e.target.value})} /></div>
        </div>
        <div className="g2">
          <div className="field"><label>Valor compra (R$)</label><input className="inp" type="number" step="0.01" value={em.valor_compra||''} onChange={e=>setEm({...em,valor_compra:e.target.value})} /></div>
          <div className="field"><label>Valor mínimo venda (R$)</label><input className="inp" type="number" step="0.01" value={em.valor_minimo_venda||''} onChange={e=>setEm({...em,valor_minimo_venda:e.target.value})} /></div>
        </div>
        <div className="g2">
          <div className="field"><label>Repasse (R$)</label><input className="inp" type="number" step="0.01" value={em.repasse||''} onChange={e=>setEm({...em,repasse:e.target.value})} /></div>
          <div className="field"><label>Filial</label>
            <select className="inp" value={em.filial||''} onChange={e=>setEm({...em,filial:e.target.value})}>
              <option value="">Selecione</option>
              {FILIAIS.map(f=><option key={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div className="g2">
          <div className="field"><label>CNPJ empresa</label><input className="inp" value={em.cnpj_empresa||''} onChange={e=>setEm({...em,cnpj_empresa:e.target.value})} /></div>
          <div className="field" style={{justifyContent:'flex-end',display:'flex',alignItems:'center',paddingTop:20}}>
            <label style={{display:'flex',gap:8,alignItems:'center',fontSize:13,cursor:'pointer'}}>
              <input type="checkbox" checked={!!em.santander} onChange={e=>setEm({...em,santander:e.target.checked})} /> Santander (Emenezes)
            </label>
          </div>
        </div>
        <div className="mfoot">
          <button className="btn btn-g" onClick={()=>setEditMoto(null)}>Cancelar</button>
          <button className="btn btn-p" onClick={salvarMoto}>💾 Salvar</button>
        </div>
      </div></div>}

      {modUser&&<div className="mbg" onClick={()=>setModUser(false)}><div className="mbox" onClick={e=>e.stopPropagation()}>
        <div className="mhd"><h3>Novo usuário</h3><button className="mclose" onClick={()=>setModUser(false)}>×</button></div>
        <div className="field"><label>Usuário *</label><input className="inp" autoFocus value={uf.username} onChange={e=>setUf({...uf,username:e.target.value})} /></div>
        <div className="field"><label>Senha *</label><input className="inp" type="password" value={uf.password} onChange={e=>setUf({...uf,password:e.target.value})} /></div>
        <div className="g2">
          <div className="field"><label>Cargo</label><select className="inp" value={uf.role} onChange={e=>setUf({...uf,role:e.target.value})}><option value="FILIAL">Filial</option><option value="DIRETORIA">Diretoria</option></select></div>
          <div className="field"><label>Filial *</label><select className="inp" value={uf.cidade} onChange={e=>setUf({...uf,cidade:e.target.value})}><option value="">Selecione</option>{filiais.filter(f=>f.ativa).map(f=><option key={f.id}>{f.nome}</option>)}</select></div>
        </div>
        <div className="mfoot">
          <button className="btn btn-g" onClick={()=>setModUser(false)}>Cancelar</button>
          <button className="btn btn-p" onClick={criarUser} disabled={saving}>{saving?<span className="spin" />:'Criar'}</button>
        </div>
      </div></div>}
        {tab==='comissoes' && <>
          <div className="sh" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span className="sh-t">💵 Tabela de Comissões</span>
            <button className="btn btn-p btn-sm" onClick={()=>setAddingCom(s=>!s)}>+ Adicionar modelo</button>
          </div>

          {addingCom && (
            <div className="card card-sm" style={{marginBottom:14}}>
              <div style={{fontSize:12,color:'var(--tx3)',marginBottom:8,fontWeight:600}}>Novo modelo de comissão</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end'}}>
                <div className="field" style={{flex:2,minWidth:150,margin:0}}><label>Modelo</label><input className="inp" value={novaCom.modelo} onChange={e=>setNovaCom({...novaCom,modelo:e.target.value})} placeholder="Ex: NEW SHI 175 EFI" /></div>
                <div className="field" style={{flex:1,minWidth:100,margin:0}}><label>Venda mín. R$30</label><input className="inp" type="number" value={novaCom.v30} onChange={e=>setNovaCom({...novaCom,v30:e.target.value})} /></div>
                <div className="field" style={{flex:1,minWidth:100,margin:0}}><label>Venda mín. R$50</label><input className="inp" type="number" value={novaCom.v50} onChange={e=>setNovaCom({...novaCom,v50:e.target.value})} /></div>
                <div className="field" style={{flex:1,minWidth:100,margin:0}}><label>Venda mín. R$100</label><input className="inp" type="number" value={novaCom.v100} onChange={e=>setNovaCom({...novaCom,v100:e.target.value})} /></div>
                <button className="btn btn-p btn-sm" style={{marginBottom:2}} onClick={async()=>{
                  try {
                    await api.post('/comissoes', novaCom);
                    const r = await api.get('/comissoes');
                    setComissoes(r.data||[]);
                    setNovaCom({modelo:'',v30:'',v50:'',v100:''});
                    setAddingCom(false);
                    show('Adicionado!');
                  } catch(e){show(String(e),'err');}
                }}>Salvar</button>
              </div>
            </div>
          )}

          <div style={{fontSize:12,color:'var(--tx3)',marginBottom:8}}>
            💡 Comissão pelo valor de venda: R$30 se ≥ V30, R$50 se ≥ V50, R$100 se ≥ V100.
          </div>

          <div className="tw"><table className="t">
            <thead><tr><th>Modelo</th><th style={{color:'var(--tx2)'}}>Venda mín. R$30</th><th style={{color:'var(--yel)'}}>Venda mín. R$50</th><th style={{color:'var(--grn)'}}>Venda mín. R$100</th><th>Ações</th></tr></thead>
            <tbody>
              {comissoes.length===0 && <tr><td colSpan={5}><div className="empty"><p>Nenhuma comissão cadastrada.</p></div></td></tr>}
              {comissoes.map(com=>(
                <tr key={com.id}>
                  <td><b>{com.modelo}</b></td>
                  <td>{editCom===com.id ? <input className="inp" type="number" style={{width:110}} value={ec.v30??''} onChange={e=>setEc({...ec,v30:e.target.value})} /> : <span style={{color:'var(--tx2)'}}>{formatBRL(com.v30)}</span>}</td>
                  <td>{editCom===com.id ? <input className="inp" type="number" style={{width:110}} value={ec.v50??''} onChange={e=>setEc({...ec,v50:e.target.value})} /> : <span style={{color:'var(--yel)'}}>{formatBRL(com.v50)}</span>}</td>
                  <td>{editCom===com.id ? <input className="inp" type="number" style={{width:110}} value={ec.v100??''} onChange={e=>setEc({...ec,v100:e.target.value})} /> : <span style={{color:'var(--grn)'}}>{formatBRL(com.v100)}</span>}</td>
                  <td>
                    {editCom===com.id ? (
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn btn-p btn-sm" onClick={async()=>{
                          try {
                            await api.post('/comissoes',{modelo:com.modelo,v30:ec.v30,v50:ec.v50,v100:ec.v100});
                            const r = await api.get('/comissoes'); setComissoes(r.data||[]); setEditCom(null); show('Salvo!');
                          } catch(e){show(String(e),'err');}
                        }}>✓</button>
                        <button className="btn btn-g btn-sm" onClick={()=>setEditCom(null)}>✕</button>
                      </div>
                    ) : (
                      <div style={{display:'flex',gap:6}}>
                        <button className="ab" onClick={()=>{setEditCom(com.id);setEc({v30:com.v30,v50:com.v50,v100:com.v100});}}>✏️</button>
                        <button className="ab red" onClick={async()=>{ if(!window.confirm('Excluir?')) return; await api.delete('/comissoes/'+com.id).catch(()=>{}); setComissoes(p=>p.filter(x=>x.id!==com.id)); show('Excluído!'); }}>🗑</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </>}

        {tab==='filiais' && <>
          <div className="sh" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span className="sh-t">🏢 Filiais</span>
          </div>

          <div style={{fontSize:12,color:'var(--tx3)',marginBottom:8}}>
            💡 Desativar uma filial some com ela das listas de cadastro (moto, venda, peça, usuário), mas mantém todo o histórico já registrado.
          </div>

          <div className="card card-sm" style={{marginBottom:14}}>
            <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
              <div className="field" style={{flex:1,margin:0}}><label>Nova filial</label>
                <input className="inp" value={novaFilial} onChange={e=>setNovaFilial(e.target.value)} placeholder="Ex: GARANHUNS" />
              </div>
              <button className="btn btn-p btn-sm" onClick={async()=>{
                if (!novaFilial.trim()) return;
                try {
                  const r = await api.post('/filiais', { nome:novaFilial });
                  setFiliais(p=>[...p,r.data].sort((a,b)=>b.ativa-a.ativa||a.nome.localeCompare(b.nome)));
                  setNovaFilial(''); show('Filial adicionada!');
                } catch(e){ show(String(e),'err'); }
              }}>+ Adicionar</button>
            </div>
          </div>

          <div className="tw"><table className="t">
            <thead><tr><th>Filial</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {filiais.length===0 && <tr><td colSpan={3}><div className="empty"><p>Nenhuma filial cadastrada.</p></div></td></tr>}
              {filiais.map(f=>(
                <tr key={f.id}>
                  <td>{editFilial===f.id ? <input className="inp" style={{width:180}} value={efNome} onChange={e=>setEfNome(e.target.value)} /> : <b>{f.nome}</b>}</td>
                  <td><span className={`badge ${f.ativa?'b-grn':'b-red'}`}>{f.ativa?'Ativa':'Inativa'}</span></td>
                  <td>
                    {editFilial===f.id ? (
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn btn-p btn-sm" onClick={async()=>{
                          try {
                            const r = await api.put('/filiais/'+f.id, { nome:efNome });
                            setFiliais(p=>p.map(x=>x.id===f.id?r.data:x)); setEditFilial(null); show('Salvo!');
                          } catch(e){show(String(e),'err');}
                        }}>✓</button>
                        <button className="btn btn-g btn-sm" onClick={()=>setEditFilial(null)}>✕</button>
                      </div>
                    ) : (
                      <div style={{display:'flex',gap:6}}>
                        <button className="ab" onClick={()=>{setEditFilial(f.id);setEfNome(f.nome);}}>✏️</button>
                        <button className="ab" onClick={async()=>{
                          try {
                            const r = await api.put('/filiais/'+f.id, { ativa: f.ativa?0:1 });
                            setFiliais(p=>p.map(x=>x.id===f.id?r.data:x));
                            show(r.data.ativa?'Filial reativada!':'Filial desativada!');
                          } catch(e){show(String(e),'err');}
                        }}>{f.ativa?'🚫 Desativar':'✅ Reativar'}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </>}

    </div>
  );
}
