import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getUser, isDir } from './utils';
import Login          from './pages/Login';
import Home           from './pages/Home';
import Carrinho       from './pages/Carrinho';
import Nota           from './pages/Nota';
import Clientes       from './pages/Clientes';
import ClienteDetalhe from './pages/ClienteDetalhe';
import Oficina        from './pages/Oficina';
import OSDetalhe      from './pages/OSDetalhe';
import Vendas         from './pages/Vendas';
import VendasMotos    from './pages/VendasMotos';
import Pendentes      from './pages/Pendentes';
import Admin          from './pages/Admin';
import Emplacamentos  from './pages/Emplacamentos';
import Financeiro     from './pages/Financeiro';
import Agenda         from './pages/Agenda';
import BuscaChassi    from './pages/BuscaChassi';

function Guard({ children, adminOnly = false }) {
  const u = getUser();
  if (!u) return <Navigate to="/" replace />;
  if (adminOnly && !isDir(u)) return <Navigate to="/home" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"              element={<Login />} />
        <Route path="/home"          element={<Guard><Home /></Guard>} />
        <Route path="/carrinho"      element={<Guard><Carrinho /></Guard>} />
        <Route path="/nota"          element={<Guard><Nota /></Guard>} />
        <Route path="/clientes"      element={<Guard><Clientes /></Guard>} />
        <Route path="/clientes/:id"  element={<Guard><ClienteDetalhe /></Guard>} />
        <Route path="/oficina"       element={<Guard><Oficina /></Guard>} />
        <Route path="/oficina/:id"   element={<Guard><OSDetalhe /></Guard>} />
        <Route path="/agenda"        element={<Guard><Agenda /></Guard>} />
        <Route path="/chassi"        element={<Guard><BuscaChassi /></Guard>} />
        <Route path="/vendas"        element={<Guard adminOnly><Vendas /></Guard>} />
        <Route path="/vendas-motos"  element={<Guard adminOnly><VendasMotos /></Guard>} />
        <Route path="/pendentes"     element={<Guard adminOnly><Pendentes /></Guard>} />
        <Route path="/admin"         element={<Guard adminOnly><Admin /></Guard>} />
        <Route path="/emplacamentos" element={<Guard adminOnly><Emplacamentos /></Guard>} />
        <Route path="/financeiro"    element={<Guard adminOnly><Financeiro /></Guard>} />
        <Route path="*"              element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
