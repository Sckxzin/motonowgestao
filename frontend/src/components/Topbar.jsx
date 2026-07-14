import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { getUser, logout, isDir } from '../utils';
import useTheme from '../hooks/useTheme';
import api from '../api';

export default function Topbar({ cartCount = 0 }) {
  const nav = useNavigate();
  const [light, toggleTheme] = useTheme();
  const loc = useLocation();
  const user = getUser();
  const at = p => loc.pathname.startsWith(p) ? 'tn act' : 'tn';

  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef();

  useEffect(() => {
    if (!user) return;
    function buscar() {
      api.get('/notificacoes').then(r => setNotifs(r.data||[])).catch(()=>{});
    }
    buscar();
    const t = setInterval(buscar, 30000); // polling a cada 30s
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function fechar(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
    }
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  async function lerNotif(id) {
    await api.put(`/notificacoes/${id}/ler`).catch(()=>{});
    setNotifs(p => p.filter(n => n.id !== id));
  }

  async function lerTodas() {
    await api.put('/notificacoes/ler-todas').catch(()=>{});
    setNotifs([]);
    setShowNotifs(false);
  }

  function sair() { logout(); nav('/'); }

  return (
    <div className="tb">
      <div className="tb-logo" onClick={() => nav('/home')}>
        <img src="/logo.jpg" alt="MotoNow" style={{ height:38, width:'auto', borderRadius:4, objectFit:'contain' }} />
        {user && <span className="tb-pill">{user.role} · {user.cidade}</span>}
      </div>
      <nav className="tb-nav">
        {isDir(user) && <button className={at('/admin')} onClick={() => nav('/admin')}>⚙️ Admin</button>}
        {isDir(user) && <button className={at('/vendas-motos')} onClick={() => nav('/vendas-motos')}>🏍 Hist.</button>}
        {isDir(user) && <button className={at('/vendas')} onClick={() => nav('/vendas')}>🧾 Vendas</button>}
        {isDir(user) && <button className={at('/pendentes')} onClick={() => nav('/pendentes')}>🕒 Aprovar</button>}
        {isDir(user) && <button className={at('/emplacamentos')} onClick={() => nav('/emplacamentos')}>🪪</button>}
        {isDir(user) && <button className={at('/financeiro')} onClick={() => nav('/financeiro')}>💰</button>}
        {isDir(user) && <button className={at('/reciclagem')} onClick={() => nav('/reciclagem')}>♻️</button>}
        {isDir(user) && <button className={at('/dashboard')} onClick={() => nav('/dashboard')} title="Dashboard TV">📺</button>}
        <button className={at('/chassi')} onClick={() => nav('/chassi')}>🔍 Chassi</button>
        <button className={at('/clientes')} onClick={() => nav('/clientes')}>👥 Clientes</button>
        <button className={at('/oficina')} onClick={() => nav('/oficina')}>🔧 Oficina</button>
        <button className={at('/agenda')} onClick={() => nav('/agenda')}>📅 Agenda</button>
        <button className={at('/carrinho')} onClick={() => nav('/carrinho')}>
          🛒 {cartCount > 0 && <span className="cpill">{cartCount}</span>}
        </button>

        {/* NOTIFICAÇÕES */}
        <div style={{position:'relative'}} ref={notifRef}>
          <button className="tn" style={{position:'relative',fontSize:16,padding:'4px 8px'}} onClick={()=>setShowNotifs(s=>!s)}>
            🔔
            {notifs.length > 0 && (
              <span style={{position:'absolute',top:0,right:0,background:'var(--red)',color:'#fff',borderRadius:999,fontSize:9,fontWeight:700,minWidth:16,height:16,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 3px'}}>
                {notifs.length > 9 ? '9+' : notifs.length}
              </span>
            )}
          </button>
          {showNotifs && (
            <div style={{position:'absolute',right:0,top:'100%',zIndex:300,width:320,background:'var(--s2)',border:'1px solid var(--bd2)',borderRadius:'var(--r)',boxShadow:'0 8px 32px rgba(0,0,0,.4)',overflow:'hidden'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 14px',borderBottom:'1px solid var(--bd)'}}>
                <b style={{fontSize:13}}>🔔 Notificações</b>
                {notifs.length > 0 && <button className="ab" style={{fontSize:11}} onClick={lerTodas}>Marcar todas lidas</button>}
              </div>
              {notifs.length === 0
                ? <div style={{padding:'20px 14px',textAlign:'center',fontSize:13,color:'var(--tx3)'}}>Nenhuma notificação</div>
                : <div style={{maxHeight:320,overflowY:'auto'}}>
                    {notifs.map(n => (
                      <div key={n.id} style={{padding:'12px 14px',borderBottom:'1px solid var(--bd)',display:'flex',gap:10,alignItems:'flex-start'}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{n.titulo}</div>
                          {n.mensagem && <div style={{fontSize:12,color:'var(--tx2)'}}>{n.mensagem}</div>}
                          <div style={{fontSize:10,color:'var(--tx3)',marginTop:4}}>{new Date(n.created_at).toLocaleString('pt-BR')}</div>
                        </div>
                        <button className="ab" style={{fontSize:11,flexShrink:0}} onClick={()=>lerNotif(n.id)}>✓</button>
                      </div>
                    ))}
                  </div>
              }
            </div>
          )}
        </div>

        <button className="tn" onClick={toggleTheme} title={light ? "Modo escuro" : "Modo claro"} style={{fontSize:16,padding:"4px 8px"}}>{light ? "🌙" : "☀️"}</button>
        <button className="tn danger" onClick={sair}>Sair</button>
      </nav>
    </div>
  );
}
