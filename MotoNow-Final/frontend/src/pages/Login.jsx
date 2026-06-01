import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { saveAuth } from '../utils';

export default function Login() {
  const nav = useNavigate();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function login() {
    if (!u || !p) { setErr('Informe usuário e senha'); return; }
    setLoading(true); setErr('');
    try {
      const { data } = await api.post('/login', { username: u, password: p });
      saveAuth(data.token, data.user);
      nav('/home');
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <div style={{ width:340,flexShrink:0,background:'var(--s1)',borderRight:'1px solid var(--bd)',display:'flex',flexDirection:'column',justifyContent:'center',padding:'52px 40px' }}>
        <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:32 }}>
          <div className="tb-mark" style={{ width:44,height:44,fontSize:20 }}>M</div>
          <span className="tb-name" style={{ fontSize:26 }}>Moto<span>Now</span></span>
        </div>
        <p style={{ fontSize:13,color:'var(--tx3)',lineHeight:1.8,marginBottom:32 }}>
          Sistema completo de gestão para concessionárias Shineray.
        </p>
        {[['📦','Estoque de peças e motos'],['👥','CRM de clientes'],['📊','Dashboard executivo'],['🔧','Controle de revisões'],['🪪','Emplacamentos']].map(([i,t])=>(
          <div key={t} style={{ display:'flex',alignItems:'center',gap:10,fontSize:13,color:'var(--tx2)',marginBottom:10 }}>
            <span style={{ fontSize:16 }}>{i}</span>{t}
          </div>
        ))}
      </div>

      <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:24 }}>
        <div style={{ width:'100%',maxWidth:380 }}>
          <h2 style={{ fontSize:24,fontWeight:800,marginBottom:6 }}>Entrar na conta</h2>
          <p style={{ fontSize:13,color:'var(--tx3)',marginBottom:26 }}>Use suas credenciais de acesso</p>

          {err && <div style={{ background:'var(--reddim)',border:'1px solid var(--redbd)',color:'var(--red)',fontSize:13,fontWeight:500,padding:'10px 14px',borderRadius:'var(--r)',marginBottom:16 }}>⚠ {err}</div>}

          <div className="field"><label>Usuário</label>
            <input className="inp" autoFocus placeholder="Seu usuário" value={u} onChange={e=>setU(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} />
          </div>
          <div className="field"><label>Senha</label>
            <input className="inp" type="password" placeholder="••••••••" value={p} onChange={e=>setP(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} />
          </div>

          <button className="btn btn-p btn-full btn-lg" style={{ marginTop:8 }} onClick={login} disabled={loading}>
            {loading ? <span className="spin" /> : 'Entrar'}
          </button>


        </div>
      </div>
    </div>
  );
}
