import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, isDir, fmtDate, formatBRL, FORMAS_PGTO } from '../utils';

export default function Revisoes() {
  const nav = useNavigate();
  const user = getUser();
  const [searchParams] = useSearchParams();
  const { show, Toast } = useToast();
  const [lista, setLista] = useState([]);
  const [modal, setModal] = useState(false);
  const [modalFinalizar, setModalFinalizar] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pecasDisponiveis, setPecasDisponiveis] = useState([]);

  // form nova revisão
  const emptyForm = { cliente_nome:'', cliente_telefone:'', modelo_moto:'', chassi_moto:'', km:'', tipo_revisao:'', observacao:'' };

  // Pré-preenche pelo chassi vindo da URL
  const initForm = { ...emptyForm,
    chassi_moto: searchParams.get('chassi') || '',
    cliente_nome: searchParams.get('cliente') || '',
    cliente_telefone: searchParams.get('tel') || '',
    modelo_moto: searchParams.get('modelo') || '',
  };
  const [form, setForm] = useState(initForm);

  // form finalizar
  const [ff, setFf] = useState({ mao_de_obra:'', desconto:'', forma_pagamento:'', observacao:'' });
  const [itensFinalizar, setItensFinalizar] = useState([]);
  const [pecaBusca, setPecaBusca] = useState('');

  useEffect(() => {
    if (!user) { nav('/'); return; }
    carregarRevisoes();
    api.get('/pecas').then(r => setPecasDisponiveis(r.data || [])).catch(() => {});
  }, []);

  async function carregarRevisoes() {
    api.get('/revisoes').then(r => setLista(r.data)).catch(e => show(String(e), 'err'));
  }

  async function criar() {
    if (!form.cliente_nome) { show('Nome do cliente obrigatório', 'err'); return; }
    setSaving(true);
    try {
      const r = await api.post('/revisoes', form);
      setLista(p => [r.data, ...p]);
      setModal(false);
      setForm(emptyForm);
      show('Revisão criada!');
    } catch (e) { show(String(e), 'err'); }
    finally { setSaving(false); }
  }

  function abrirFinalizar(rev) {
    setModalFinalizar(rev);
    setFf({ mao_de_obra:'', desconto:'', forma_pagamento:'', observacao:'' });
    setItensFinalizar([]);
    setPecaBusca('');
  }

  function adicionarPeca(peca) {
    const existe = itensFinalizar.find(i => i.peca_id === peca.id);
    if (existe) {
      setItensFinalizar(p => p.map(i => i.peca_id === peca.id ? { ...i, quantidade: i.quantidade + 1 } : i));
    } else {
      setItensFinalizar(p => [...p, { peca_id: peca.id, nome_peca: peca.nome, quantidade: 1, preco_unitario: Number(peca.preco) }]);
    }
    setPecaBusca('');
  }

  function removerItemFinalizar(peca_id) {
    setItensFinalizar(p => p.filter(i => i.peca_id !== peca_id));
  }

  const totalPecas = itensFinalizar.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const totalFinal = totalPecas + Number(ff.mao_de_obra || 0) - Number(ff.desconto || 0);

  async function finalizar() {
    if (!ff.forma_pagamento) { show('Selecione a forma de pagamento', 'err'); return; }
    setSaving(true);
    try {
      const r = await api.put(`/revisoes/${modalFinalizar.id}/finalizar`, {
        mao_de_obra: Number(ff.mao_de_obra || 0),
        desconto: Number(ff.desconto || 0),
        forma_pagamento: ff.forma_pagamento,
        observacao: ff.observacao || null,
        itens: itensFinalizar,
      });
      setLista(p => p.map(rev => rev.id === modalFinalizar.id ? r.data : rev));
      setModalFinalizar(null);
      show('Revisão finalizada!');
    } catch (e) { show(String(e), 'err'); }
    finally { setSaving(false); }
  }

  const pecasFiltradas = pecaBusca.length >= 2
    ? pecasDisponiveis.filter(p =>
        p.nome.toLowerCase().includes(pecaBusca.toLowerCase()) &&
        (!user || isDir(user) || p.cidade === user.cidade)
      ).slice(0, 8)
    : [];

  if (!user) return null;

  return (
    <div className="page">
      {Toast}
      <Topbar />
      <div className="pc">
        <div className="sh">
          <span className="sh-t">🔧 Revisões</span>
          <button className="btn btn-p btn-sm" onClick={() => setModal(true)}>+ Nova revisão</button>
        </div>

        <div className="gf" style={{ marginBottom: 18 }}>
          <div className="stat blu"><div className="sv">{lista.filter(r => r.status === 'ABERTA').length}</div><div className="sl">Abertas</div></div>
          <div className="stat grn"><div className="sv">{lista.filter(r => r.status === 'FINALIZADA').length}</div><div className="sl">Finalizadas</div></div>
          <div className="stat"><div className="sv">{lista.length}</div><div className="sl">Total</div></div>
        </div>

        <div className="tw">
          <table className="t">
            <thead>
              <tr><th>Data</th><th>Cliente</th><th>Moto</th><th>Tipo</th><th>KM</th><th>Total</th><th>Status</th><th>Filial</th><th>Ação</th></tr>
            </thead>
            <tbody>
              {lista.length === 0 && <tr><td colSpan={9}><div className="empty"><p>Nenhuma revisão.</p></div></td></tr>}
              {lista.map(r => (
                <tr key={r.id}>
                  <td style={{ fontSize: 12 }}>{fmtDate(r.created_at)}</td>
                  <td>
                    <b>{r.cliente_nome}</b>
                    {r.cliente_telefone && <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{r.cliente_telefone}</div>}
                  </td>
                  <td>
                    {r.modelo_moto || '—'}
                    {r.chassi_moto && <div className="mono">{r.chassi_moto}</div>}
                  </td>
                  <td>{r.tipo_revisao || '—'}</td>
                  <td>{r.km ? `${r.km} km` : '—'}</td>
                  <td>{r.total ? <b style={{ color: 'var(--grn)' }}>{formatBRL(r.total)}</b> : '—'}</td>
                  <td><span className={`badge st-${(r.status || '').toLowerCase()}`}>{r.status}</span></td>
                  <td>{r.cidade}</td>
                  <td>
                    {r.status === 'ABERTA' && (
                      <button className="ab grn" onClick={() => abrirFinalizar(r)}>✅ Finalizar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL NOVA REVISÃO */}
      {modal && (
        <div className="mbg" onClick={() => setModal(false)}>
          <div className="mbox" onClick={e => e.stopPropagation()}>
            <div className="mhd"><h3>Nova revisão</h3><button className="mclose" onClick={() => setModal(false)}>×</button></div>
            <div className="field"><label>Cliente *</label><input className="inp" autoFocus value={form.cliente_nome} onChange={e => setForm({ ...form, cliente_nome: e.target.value })} /></div>
            <div className="field"><label>Telefone</label><input className="inp" value={form.cliente_telefone} onChange={e => setForm({ ...form, cliente_telefone: e.target.value })} /></div>
            <div className="g2">
              <div className="field"><label>Modelo da moto</label><input className="inp" value={form.modelo_moto} onChange={e => setForm({ ...form, modelo_moto: e.target.value })} /></div>
              <div className="field"><label>Chassi</label><input className="inp" value={form.chassi_moto} onChange={e => setForm({ ...form, chassi_moto: e.target.value })} /></div>
            </div>
            <div className="g2">
              <div className="field"><label>KM</label><input className="inp" type="number" value={form.km} onChange={e => setForm({ ...form, km: e.target.value })} /></div>
              <div className="field"><label>Tipo de revisão</label><input className="inp" placeholder="Ex: Revisão 5.000km" value={form.tipo_revisao} onChange={e => setForm({ ...form, tipo_revisao: e.target.value })} /></div>
            </div>
            <div className="field"><label>Observações</label><textarea className="inp" value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} /></div>
            <div className="mfoot">
              <button className="btn btn-g" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={criar} disabled={saving}>{saving ? <span className="spin" /> : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FINALIZAR REVISÃO */}
      {modalFinalizar && (
        <div className="mbg" onClick={() => setModalFinalizar(null)}>
          <div className="mbox wide" onClick={e => e.stopPropagation()}>
            <div className="mhd">
              <h3>✅ Finalizar Revisão</h3>
              <button className="mclose" onClick={() => setModalFinalizar(null)}>×</button>
            </div>

            <div className="ibox">
              <p><b>Cliente:</b> {modalFinalizar.cliente_nome} {modalFinalizar.cliente_telefone && `· ${modalFinalizar.cliente_telefone}`}</p>
              <p><b>Moto:</b> {modalFinalizar.modelo_moto || '—'} {modalFinalizar.chassi_moto && `· ${modalFinalizar.chassi_moto}`}</p>
              {modalFinalizar.tipo_revisao && <p><b>Tipo:</b> {modalFinalizar.tipo_revisao}</p>}
            </div>

            {/* Busca de peças usadas */}
            <div className="clabel" style={{ marginBottom: 8 }}>Peças utilizadas</div>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <input
                className="inp"
                placeholder="Buscar peça pelo nome..."
                value={pecaBusca}
                onChange={e => setPecaBusca(e.target.value)}
              />
              {pecasFiltradas.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--s2)', border: '1px solid var(--bd2)', borderRadius: 'var(--r)', zIndex: 100, maxHeight: 200, overflowY: 'auto' }}>
                  {pecasFiltradas.map(p => (
                    <div key={p.id} onClick={() => adicionarPeca(p)} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--bd)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--s3)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <span><b>{p.nome}</b> <span style={{ color: 'var(--tx3)', fontSize: 11 }}>· {p.cidade}</span></span>
                      <span style={{ color: 'var(--grn)', fontWeight: 600 }}>{formatBRL(p.preco)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {itensFinalizar.length > 0 && (
              <div className="tw" style={{ marginBottom: 14 }}>
                <table className="t">
                  <thead><tr><th>Peça</th><th>Qtd</th><th>Preço</th><th>Subtotal</th><th></th></tr></thead>
                  <tbody>
                    {itensFinalizar.map(it => (
                      <tr key={it.peca_id}>
                        <td>{it.nome_peca}</td>
                        <td>
                          <input type="number" min={1} className="inp" style={{ width: 64 }} value={it.quantidade}
                            onChange={e => setItensFinalizar(p => p.map(i => i.peca_id === it.peca_id ? { ...i, quantidade: Math.max(1, Number(e.target.value)) } : i))} />
                        </td>
                        <td>{formatBRL(it.preco_unitario)}</td>
                        <td><b style={{ color: 'var(--grn)' }}>{formatBRL(it.quantidade * it.preco_unitario)}</b></td>
                        <td><button className="ab red" onClick={() => removerItemFinalizar(it.peca_id)}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="g2">
              <div className="field"><label>Mão de obra (R$)</label><input className="inp" type="number" step="0.01" placeholder="0,00" value={ff.mao_de_obra} onChange={e => setFf({ ...ff, mao_de_obra: e.target.value })} /></div>
              <div className="field"><label>Desconto (R$)</label><input className="inp" type="number" step="0.01" placeholder="0,00" value={ff.desconto} onChange={e => setFf({ ...ff, desconto: e.target.value })} /></div>
            </div>
            <div className="field"><label>Forma de pagamento *</label>
              <select className="inp" value={ff.forma_pagamento} onChange={e => setFf({ ...ff, forma_pagamento: e.target.value })}>
                <option value="">Selecione</option>
                {FORMAS_PGTO.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div className="field"><label>Observação</label><textarea className="inp" rows={2} value={ff.observacao} onChange={e => setFf({ ...ff, observacao: e.target.value })} /></div>

            {/* TOTAL */}
            <div className="tbar">
              <div>
                <div className="lbl">Total da revisão</div>
                <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>
                  Peças: {formatBRL(totalPecas)} · M.O.: {formatBRL(ff.mao_de_obra || 0)} · Desc: -{formatBRL(ff.desconto || 0)}
                </div>
              </div>
              <span className="val">{formatBRL(totalFinal)}</span>
            </div>

            <div className="mfoot">
              <button className="btn btn-g" onClick={() => setModalFinalizar(null)}>Cancelar</button>
              <button className="btn btn-s" onClick={finalizar} disabled={saving}>
                {saving ? <span className="spin" /> : '✅ Confirmar finalização'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
