import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, formatBRL, FORMAS_PGTO } from '../utils';

const norm = s => String(s||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const isIsentoDesc = nome => { const n = norm(nome); return n.includes('OLEO') || n.includes('REVISAO'); };
const isDescAtivo = fp => { const f = norm(fp); return f === 'PIX' || f === 'A VISTA' || f === 'À VISTA'; };

export default function Carrinho() {
  const nav = useNavigate();
  const user = getUser();
  const { show, Toast } = useToast();

  const [itens, setItens] = useState([]);
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [tel, setTel] = useState('');
  const [pgto, setPgto] = useState('');
  const [descManual, setDescManual] = useState('');
  const [obs, setObs] = useState('');
  const [loading, setLoading] = useState(false);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [pecas, setPecas] = useState([]);
  const [buscaPeca, setBuscaPeca] = useState('');
  const [mostrarBusca, setMostrarBusca] = useState(false);

  useEffect(() => {
    if (!user) { nav('/'); return; }
    const c = JSON.parse(localStorage.getItem('mn_cart') || '[]');
    setItens(c);
    api.get('/pecas').then(r => setPecas(r.data || [])).catch(() => {});
  }, []);

  const save = (novo) => { setItens(novo); localStorage.setItem('mn_cart', JSON.stringify(novo)); };
  const altQtd = (i, v) => { const n = [...itens]; n[i].quantidade = Math.max(1, Number(v||1)); save(n); };
  const altPreco = (i, v) => { const n = [...itens]; n[i].preco_unitario = Number(v||0); save(n); };
  const remover = (i) => save(itens.filter((_,idx) => idx !== i));

  const adicionarPeca = (p) => {
    const existe = itens.findIndex(it => it.peca_id === p.id);
    if (existe >= 0) {
      const n = [...itens]; n[existe].quantidade += 1; save(n);
    } else {
      save([...itens, { peca_id: p.id, nome: p.nome, quantidade: 1, preco_unitario: p.preco }]);
    }
    setBuscaPeca('');
    setMostrarBusca(false);
  };

  const bruto    = useMemo(() => itens.reduce((s,i) => s + i.quantidade * i.preco_unitario, 0), [itens]);
  const baseDesc = useMemo(() => itens.reduce((s,i) => isIsentoDesc(i.nome) ? s : s + i.quantidade * i.preco_unitario, 0), [itens]);
  const descAuto = useMemo(() => isDescAtivo(pgto) ? baseDesc * 0.05 : 0, [pgto, baseDesc]);
  const descExtra = Number(descManual || 0);
  const descTotal = descAuto + descExtra;
  const total    = useMemo(() => Math.max(0, bruto - descAuto - descExtra), [bruto, descAuto, descExtra]);

  async function buscarCliente(q) {
    if (!q || q.length < 3) { setClienteEncontrado(null); return; }
    setBuscandoCliente(true);
    try {
      const r = await api.get('/clientes/buscar', { params: { q } });
      if (r.data) {
        setClienteEncontrado(r.data);
        setNome(r.data.nome);
        setTel(r.data.telefone || '');
        setCpf(r.data.cpf || '');
      } else setClienteEncontrado(null);
    } catch { setClienteEncontrado(null); }
    finally { setBuscandoCliente(false); }
  }

  async function finalizar() {
    if (!itens.length) { show('Carrinho vazio', 'err'); return; }
    if (!nome || !pgto) { show('Preencha nome e forma de pagamento', 'err'); return; }
    setLoading(true);
    try {
      const obsFinal = [
        descAuto > 0 ? `Desconto 5% PIX/À VISTA: -${formatBRL(descAuto)}` : '',
        descExtra > 0 ? `Desconto adicional: -${formatBRL(descExtra)}` : '',
        obs,
      ].filter(Boolean).join(' | ');

      const res = await api.post('/vendas', {
        cliente_nome: nome,
        cliente_telefone: tel || null,
        cliente_cpf: cpf || null,
        forma_pagamento: pgto,
        itens,
        total: Number(total.toFixed(2)),
        cidade: user.cidade,
        observacao: obsFinal || null,
      });
      localStorage.removeItem('mn_cart');
      nav(`/nota?id=${res.data.vendaId}`);
    } catch (e) { show(String(e), 'err'); }
    finally { setLoading(false); }
  }

  const pecasFiltradas = buscaPeca.length >= 2
    ? pecas.filter(p => p.nome.toLowerCase().includes(buscaPeca.toLowerCase()) && p.estoque > 0).slice(0, 8)
    : [];

  if (!user) return null;

  return (
    <div className="page">
      {Toast}
      <Topbar cartCount={itens.length} />
      <div className="pc">
        <div className="sh">
          <span className="sh-t">🛒 Venda de Peças</span>
          <button className="btn btn-p btn-sm" onClick={() => setMostrarBusca(v => !v)}>
            + Adicionar peça
          </button>
        </div>

        {/* BUSCA DE PEÇA */}
        {mostrarBusca && (
          <div className="card card-sm" style={{ marginBottom: 16, position: 'relative' }}>
            <div className="clabel" style={{ marginBottom: 8 }}>🔍 Buscar peça no estoque</div>
            <input
              className="inp" autoFocus
              placeholder="Digite o nome da peça..."
              value={buscaPeca}
              onChange={e => setBuscaPeca(e.target.value)}
            />
            {pecasFiltradas.length > 0 && (
              <div style={{ marginTop: 6, border: '1px solid var(--bd2)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                {pecasFiltradas.map(p => (
                  <div key={p.id} onClick={() => adicionarPeca(p)}
                    style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--bd)', fontSize: 13 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--s3)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <div>
                      <b>{p.nome}</b>
                      <span style={{ fontSize: 11, color: 'var(--tx3)', marginLeft: 8 }}>· estoque: {p.estoque}</span>
                    </div>
                    <span style={{ color: 'var(--grn)', fontWeight: 600 }}>{formatBRL(p.preco)}</span>
                  </div>
                ))}
              </div>
            )}
            {buscaPeca.length >= 2 && pecasFiltradas.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--tx3)', marginTop: 8 }}>Nenhuma peça encontrada com estoque disponível.</p>
            )}
          </div>
        )}

        {itens.length === 0 ? (
          <div className="card">
            <div className="empty">
              <div className="empty-i">🛒</div>
              <p>Carrinho vazio. Adicione peças usando o botão acima.</p>
              <button className="btn btn-p" style={{ marginTop: 16 }} onClick={() => nav('/home')}>
                Ver estoque
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18, alignItems: 'start' }}>

            {/* ITENS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="card">
                <div className="clabel" style={{ marginBottom: 12 }}>📦 Itens ({itens.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {itens.map((it, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 100px 36px', gap: 8, alignItems: 'center', padding: '10px 12px', background: 'var(--s2)', borderRadius: 'var(--r)', border: '1px solid var(--bd)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{it.nome}</div>
                        {isIsentoDesc(it.nome) && <span style={{ fontSize: 10, color: 'var(--tx3)' }}>isento de desconto</span>}
                      </div>
                      <input type="number" className="inp" style={{ textAlign: 'center', padding: '4px 6px' }}
                        min={1} value={it.quantidade} onChange={e => altQtd(i, e.target.value)} />
                      <input type="number" className="inp" style={{ padding: '4px 6px' }}
                        step="0.01" value={it.preco_unitario} onChange={e => altPreco(i, e.target.value)} />
                      <div style={{ fontWeight: 700, color: 'var(--grn)', fontSize: 14, textAlign: 'right' }}>
                        {formatBRL(it.quantidade * it.preco_unitario)}
                      </div>
                      <button className="ab red" onClick={() => remover(i)}>✕</button>
                    </div>
                  ))}
                </div>

                {/* TOTAIS */}
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--bd)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: 'var(--tx2)' }}>
                    <span>Subtotal</span><span>{formatBRL(bruto)}</span>
                  </div>
                  {descAuto > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: 'var(--grn)' }}>
                      <span>Desconto 5% PIX/À VISTA</span><span>-{formatBRL(descAuto)}</span>
                    </div>
                  )}
                  {descExtra > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: 'var(--grn)' }}>
                      <span>Desconto adicional</span><span>-{formatBRL(descExtra)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 20, borderTop: '1px solid var(--bd)', paddingTop: 10, marginTop: 6 }}>
                    <span>Total</span>
                    <span style={{ color: 'var(--grn)' }}>{formatBRL(total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* DADOS DA VENDA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* CLIENTE */}
              <div className="card card-sm">
                <div className="clabel" style={{ marginBottom: 10 }}>👤 Cliente</div>

                {/* Busca rápida */}
                <div style={{ position: 'relative', marginBottom: 10 }}>
                  <input className="inp" placeholder="Buscar cliente cadastrado..."
                    onChange={e => buscarCliente(e.target.value)} />
                  {buscandoCliente && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}><span className="spin" style={{ width: 14, height: 14 }} /></span>}
                </div>

                {clienteEncontrado && (
                  <div style={{ padding: '8px 12px', background: 'var(--grndim)', border: '1px solid var(--grnbd)', borderRadius: 'var(--r)', fontSize: 12, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--grn)', fontWeight: 600 }}>✅ {clienteEncontrado.nome}</span>
                    <button className="ab" style={{ fontSize: 10 }} onClick={() => { setClienteEncontrado(null); setNome(''); setTel(''); setCpf(''); }}>✕</button>
                  </div>
                )}

                <div className="field"><label>Nome *</label><input className="inp" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" /></div>
                <div className="field"><label>CPF</label><input className="inp" value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" /></div>
                <div className="field"><label>Telefone</label><input className="inp" value={tel} onChange={e => setTel(e.target.value)} placeholder="(81) 9..." /></div>
              </div>

              {/* PAGAMENTO */}
              <div className="card card-sm">
                <div className="clabel" style={{ marginBottom: 10 }}>💳 Pagamento</div>
                <div className="field">
                  <label>Forma *</label>
                  <select className="inp" value={pgto} onChange={e => setPgto(e.target.value)}>
                    <option value="">Selecione</option>
                    {FORMAS_PGTO.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                {isDescAtivo(pgto) && (
                  <div style={{ padding: '8px 12px', background: 'var(--grndim)', border: '1px solid var(--grnbd)', borderRadius: 'var(--r)', fontSize: 12, color: 'var(--grn)', marginTop: 4 }}>
                    ✅ Desconto de 5% ativo (exceto óleos/revisão)
                  </div>
                )}
                <div className="field" style={{ marginTop: 10 }}>
                  <label>Desconto adicional (R$)</label>
                  <input className="inp" type="number" step="0.01" placeholder="0,00" value={descManual} onChange={e => setDescManual(e.target.value)} />
                </div>
                <div className="field">
                  <label>Observações</label>
                  <textarea className="inp" rows={3} value={obs} onChange={e => setObs(e.target.value)} placeholder="Observações da venda..." />
                </div>
              </div>

              {/* BOTÃO FINALIZAR */}
              <button className="btn btn-s btn-lg" onClick={finalizar} disabled={loading} style={{ width: '100%' }}>
                {loading ? <span className="spin" /> : `✅ Finalizar — ${formatBRL(total)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
