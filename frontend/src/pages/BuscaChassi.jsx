import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, formatBRL, fmtDate, fmtDateTime } from '../utils';

function GarantiaBadge({ garantia }) {
  if (!garantia) return <span className="badge b-gray">Sem info de venda</span>;
  if (garantia.em_garantia) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="badge b-grn">✅ Em garantia</span>
        <span style={{ fontSize: 12, color: 'var(--tx2)' }}>
          Expira em {fmtDate(garantia.data_expiracao)} · {garantia.dias_restantes} dias restantes
        </span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className="badge b-red">❌ Garantia expirada</span>
      <span style={{ fontSize: 12, color: 'var(--tx2)' }}>
        Expirou em {fmtDate(garantia.data_expiracao)}
      </span>
    </div>
  );
}

export default function BuscaChassi() {
  const nav = useNavigate();
  const user = getUser();
  const { show, Toast } = useToast();
  const [busca, setBusca] = useState('');
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  async function pesquisar(chassi) {
    const q = (chassi || busca).trim().toUpperCase();
    if (!q || q.length < 4) { show('Informe pelo menos 4 caracteres', 'err'); return; }
    setLoading(true);
    setResultado(null);
    try {
      const r = await api.get(`/chassi/${encodeURIComponent(q)}`);
      setResultado(r.data);
    } catch (e) {
      if (e?.response?.status === 404 || String(e).includes('404')) {
        setResultado({ notFound: true, chassi: q });
      } else {
        show(String(e), 'err');
      }
    } finally { setLoading(false); }
  }

  if (!user) return null;

  const { moto, cliente, clienteMotos, revisoes, vendasPecas, garantia } = resultado || {};

  return (
    <div className="page">
      {Toast}
      <Topbar />
      <div className="pc">
        <div className="sh"><span className="sh-t">🔍 Busca por Chassi</span></div>

        {/* CAMPO DE BUSCA */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              ref={inputRef}
              className="inp"
              style={{ flex: 1, fontSize: 15, letterSpacing: 1 }}
              placeholder="Digite o chassi... ex: 9BWA0001"
              value={busca}
              onChange={e => setBusca(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && pesquisar()}
              autoFocus
            />
            <button className="btn btn-p btn-lg" onClick={() => pesquisar()} disabled={loading}>
              {loading ? <span className="spin" /> : '🔍 Buscar'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 8 }}>
            Busca por chassi completo ou parcial. Retorna: cliente vinculado, status da garantia e histórico completo.
          </p>
        </div>

        {/* NÃO ENCONTRADO */}
        {resultado?.notFound && (
          <div className="card">
            <div className="empty">
              <div className="empty-i">🔍</div>
              <p>Chassi <b style={{ color: 'var(--tx2)' }}>{resultado.chassi}</b> não encontrado no sistema.</p>
              <button className="btn btn-p" style={{ marginTop: 16 }} onClick={() => nav('/clientes')}>
                + Cadastrar cliente
              </button>
            </div>
          </div>
        )}

        {resultado && !resultado.notFound && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* CABEÇALHO — MOTO + GARANTIA */}
            <div className="card" style={{ borderLeft: `4px solid ${garantia?.em_garantia ? 'var(--grn)' : garantia ? 'var(--red)' : 'var(--bd2)'}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                    {moto ? `${moto.modelo} · ${moto.cor} · ${moto.ano_moto || '—'}` : 'Moto não encontrada no estoque'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--tx3)', fontFamily: 'var(--mono)', marginBottom: 12 }}>
                    Chassi: {busca || resultado?.moto?.chassi}
                  </div>
                  <GarantiaBadge garantia={garantia} />
                </div>
                {moto && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 }}>
                    <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Status</div>
                    <span className={`badge st-${(moto.status || '').toLowerCase()}`} style={{ fontSize: 13 }}>
                      {moto.status}
                    </span>
                    {moto.filial && <span style={{ fontSize: 12, color: 'var(--tx2)' }}>📍 {moto.filial}</span>}
                    {moto.valor_compra && <span style={{ fontSize: 12, color: 'var(--tx3)' }}>Compra: {formatBRL(moto.valor_compra)}</span>}
                    {moto.valor_minimo_venda && <span style={{ fontSize: 12, color: 'var(--tx3)' }}>Mín. venda: {formatBRL(moto.valor_minimo_venda)}</span>}
                  </div>
                )}
              </div>
            </div>

            {/* CLIENTE */}
            {cliente ? (
              <div className="card">
                <div className="clabel">👤 Cliente vinculado</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--tx2)', flexShrink: 0 }}>
                    {cliente.nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{cliente.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 3, display: 'flex', gap: 14 }}>
                      {cliente.telefone && <span>📞 {cliente.telefone}</span>}
                      {cliente.cpf && <span>CPF: {cliente.cpf}</span>}
                      {cliente.cidade && <span>📍 {cliente.cidade}</span>}
                    </div>
                    {clienteMotos?.length > 1 && (
                      <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 4 }}>
                        {clienteMotos.length} moto{clienteMotos.length > 1 ? 's' : ''} cadastrada{clienteMotos.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="ab" onClick={() => nav(`/clientes/${cliente.id}`)}>Ver perfil →</button>
                    <button className="ab grn" onClick={() => {
                      setBusca('');
                      nav(`/revisoes?chassi=${moto?.chassi || ''}&cliente=${cliente.nome}&tel=${cliente.telefone || ''}&modelo=${moto?.modelo || ''}`);
                    }}>🔧 Revisão</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, color: 'var(--tx3)' }}>Nenhum cliente vinculado a este chassi.</div>
                <button className="btn btn-p btn-sm" onClick={() => nav('/clientes')}>+ Cadastrar cliente</button>
              </div>
            )}

            {/* HISTÓRICO DE REVISÕES */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div className="clabel" style={{ marginBottom: 0 }}>
                  🔧 Histórico de revisões ({revisoes?.length || 0})
                </div>
                <button className="ab grn" onClick={() => nav(`/revisoes?chassi=${moto?.chassi || busca}`)}>
                  + Nova revisão
                </button>
              </div>

              {!revisoes?.length ? (
                <p style={{ fontSize: 13, color: 'var(--tx3)', textAlign: 'center', padding: '16px 0' }}>
                  Nenhuma revisão registrada para este chassi.
                </p>
              ) : (
                <div className="tw">
                  <table className="t">
                    <thead>
                      <tr><th>Data</th><th>Tipo</th><th>KM</th><th>Total</th><th>Status</th><th>Filial</th></tr>
                    </thead>
                    <tbody>
                      {revisoes.map(r => (
                        <tr key={r.id}>
                          <td style={{ fontSize: 12 }}>{fmtDate(r.created_at)}</td>
                          <td>{r.tipo_revisao || '—'}</td>
                          <td>{r.km ? `${r.km} km` : '—'}</td>
                          <td>{r.total ? <b style={{ color: 'var(--grn)' }}>{formatBRL(r.total)}</b> : '—'}</td>
                          <td><span className={`badge st-${(r.status || '').toLowerCase()}`}>{r.status}</span></td>
                          <td>{r.cidade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* HISTÓRICO DE COMPRAS DE PEÇAS */}
            {vendasPecas?.length > 0 && (
              <div className="card">
                <div className="clabel" style={{ marginBottom: 14 }}>📦 Peças compradas ({vendasPecas.length})</div>
                <div className="tw">
                  <table className="t">
                    <thead><tr><th>Data</th><th>Total</th><th>Pagamento</th><th>Filial</th></tr></thead>
                    <tbody>
                      {vendasPecas.map(v => (
                        <tr key={v.id}>
                          <td style={{ fontSize: 12 }}>{fmtDate(v.created_at)}</td>
                          <td><b style={{ color: 'var(--grn)' }}>{formatBRL(v.total)}</b></td>
                          <td>{v.forma_pagamento || '—'}</td>
                          <td>{v.cidade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
