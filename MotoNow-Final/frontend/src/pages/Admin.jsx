import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, formatBRL, FILIAIS } from '../utils';

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

  useEffect(() => {
    if (!user) { nav('/'); return; }
    Promise.all([
      api.get('/admin/resumo').then(r=>setResumo(r.data)),
      api.get('/usuarios').then(r=>setUsuarios(r.data)),
      api.get('/admin/ranking').then(r=>setRanking(r.data)),
    ]).catch(e=>show(String(e),'err'));
  }, []);

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
          {[['dash','📊 Dashboard'],['usuarios','👥 Usuários'],['ranking','🏪 Ranking']].map(([k,l])=>(
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

      {modUser&&<div className="mbg" onClick={()=>setModUser(false)}><div className="mbox" onClick={e=>e.stopPropagation()}>
        <div className="mhd"><h3>Novo usuário</h3><button className="mclose" onClick={()=>setModUser(false)}>×</button></div>
        <div className="field"><label>Usuário *</label><input className="inp" autoFocus value={uf.username} onChange={e=>setUf({...uf,username:e.target.value})} /></div>
        <div className="field"><label>Senha *</label><input className="inp" type="password" value={uf.password} onChange={e=>setUf({...uf,password:e.target.value})} /></div>
        <div className="g2">
          <div className="field"><label>Cargo</label><select className="inp" value={uf.role} onChange={e=>setUf({...uf,role:e.target.value})}><option value="FILIAL">Filial</option><option value="DIRETORIA">Diretoria</option></select></div>
          <div className="field"><label>Filial *</label><select className="inp" value={uf.cidade} onChange={e=>setUf({...uf,cidade:e.target.value})}><option value="">Selecione</option>{FILIAIS.map(f=><option key={f}>{f}</option>)}</select></div>
        </div>
        <div className="mfoot">
          <button className="btn btn-g" onClick={()=>setModUser(false)}>Cancelar</button>
          <button className="btn btn-p" onClick={criarUser} disabled={saving}>{saving?<span className="spin" />:'Criar'}</button>
        </div>
      </div></div>}
    </div>
  );
}
