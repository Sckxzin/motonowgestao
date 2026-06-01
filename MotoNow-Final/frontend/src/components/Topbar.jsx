import { useNavigate, useLocation } from 'react-router-dom';
import { getUser, logout, isDir } from '../utils';

export default function Topbar({ cartCount = 0 }) {
  const nav = useNavigate();
  const loc = useLocation();
  const user = getUser();
  const at = p => loc.pathname.startsWith(p) ? 'tn act' : 'tn';

  function sair() { logout(); nav('/'); }

  return (
    <div className="tb">
      <div className="tb-logo" onClick={() => nav('/home')}>
        <div className="tb-mark">M</div>
        <span className="tb-name">Moto<span>Now</span></span>
        {user && <span className="tb-pill">{user.role} · {user.cidade}</span>}
      </div>
      <nav className="tb-nav">
        {isDir(user) && <button className={at('/admin')} onClick={() => nav('/admin')}>⚙️ Admin</button>}
        {isDir(user) && <button className={at('/vendas-motos')} onClick={() => nav('/vendas-motos')}>🏍 Hist.</button>}
        {isDir(user) && <button className={at('/vendas')} onClick={() => nav('/vendas')}>🧾 Vendas</button>}
        {isDir(user) && <button className={at('/pendentes')} onClick={() => nav('/pendentes')}>🕒 Aprovar</button>}
        {isDir(user) && <button className={at('/emplacamentos')} onClick={() => nav('/emplacamentos')}>🪪</button>}
        {isDir(user) && <button className={at('/financeiro')} onClick={() => nav('/financeiro')}>💰</button>}
        <button className={at('/chassi')} onClick={() => nav('/chassi')}>🔍 Chassi</button>
        <button className={at('/clientes')} onClick={() => nav('/clientes')}>👥 Clientes</button>
        <button className={at('/oficina')} onClick={() => nav('/oficina')}>🔧 Oficina</button>
        <button className={at('/agenda')} onClick={() => nav('/agenda')}>📅 Agenda</button>
        <button className={at('/carrinho')} onClick={() => nav('/carrinho')}>
          🛒 {cartCount > 0 && <span className="cpill">{cartCount}</span>}
        </button>
        <button className="tn danger" onClick={sair}>Sair</button>
      </nav>
    </div>
  );
}
