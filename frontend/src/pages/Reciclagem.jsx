import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, formatBRL, fmtDate } from '../utils';

const TIPOS = [
  { v:'FERRO',   l:'⚙️ Ferro',    cor:'#6b7280' },
  { v:'PAPELAO', l:'📦 Papelão',  cor:'#f59e0b' },
  { v:'OLEO',    l:'🛢 Óleo usado', cor:'#1d4ed8' },
  { v:'OUTRO',   l:'🗑 Outro',     cor:'#8b5cf6' },
];

export default function Reciclagem() {
  const nav = useNavigate();
  const user = getUser();
  const { show, Toast } = useToast();

  const [registros, setRegistros] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('');

  const vazio = { tipo:'FERRO', descricao:'', valor:'', data: new Date().toISOString().slice(0,10), observacao:'' };
  const [form, setForm] = useState(vazio);

  useEffect(() => {
    if (!user) { nav('/'); return; }
    carregar();
  }, []);

  async function carregar() {
    setLoading(true);
    try {
      const r = await api.get('/reciclagem');
      setRegistros(r.data || []);
    } catch(e) { show(String(e),'err'); }
    finally { setLoading(false); }
  }

  async function salvar() {
    if (!form.valor || !form.data) { show('Preencha valor e data','err'); return; }
    setSaving(true);
    try {
      const r = await api.post('/reciclagem', { ...form, valor: Number(form.valor) });
      setRegistros(p => [r.data, ...p]);
      setModal(false);
      setForm(vazio);
      show('Registrado!');
    } catch(e) { show(String(e),'err'); }
    finally { setSaving(false); }
  }

  async function excluir(id) {
    if (!window.confirm('Excluir este registro?')) return;
    try {
      await api.delete(`/reciclagem/${id}`);
      setRegistros(p => p.filter(r => r.id !== id));
      show('Excluído!');
    } catch(e) { show(String(e),'err'); }
  }

  const filtrado = filtroTipo ? registros.filter(r => r.tipo === filtroTipo) : registros;

  const totais = TIPOS.reduce((acc, t) => {
    acc[t.v] = registros.filter(r => r.tipo === t.v).reduce((s,r) => s + Number(r.valor||0), 0);
    return acc;
  }, {});
  const totalGeral = Object.values(totais).reduce((s,v) => s+v, 0);

  if (!user) return null;

  return (
    <div className="page">
      {Toast}
      <Topbar />
      <div className="pc">
        <div className="sh">
          <span className="sh-t">♻️ Reciclagem & Resíduos</span>
          <button className="btn btn-p btn-sm" onClick={() => { setForm(vazio); setModal(true); }}>+ Novo registro</button>
        </div>

        {/* TOTAIS POR TIPO */}
        <div className="gf" style={{ marginBottom: 18 }}>
          {TIPOS.map(t => (
            <div key={t.v} className="stat" style={{ borderColor: t.cor+'44', cursor:'pointer' }}
              onClick={() => setFiltroTipo(p => p === t.v ? '' : t.v)}>
              <div className="sv" style={{ color: t.cor, fontSize: 16 }}>{formatBRL(totais[t.v] || 0)}</div>
              <div className="sl">{t.l}</div>
            </div>
          ))}
          <div className="stat grn">
            <div className="sv" style={{ fontSize: 16 }}>{formatBRL(totalGeral)}</div>
            <div className="sl">Total geral</div>
          </div>
        </div>

        {/* FILTRO */}
        {filtroTipo && (
          <div style={{ marginBottom: 12, display:'flex', alignItems:'center', gap: 10 }}>
            <span style={{ fontSize: 13, color:'var(--tx2)' }}>
              Filtrando: <b>{TIPOS.find(t=>t.v===filtroTipo)?.l}</b>
            </span>
            <button className="ab" onClick={() => setFiltroTipo('')}>✕ Limpar</button>
          </div>
        )}

        {/* LISTA */}
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding: 60 }}><span className="spin spin-lg" /></div>
        ) : filtrado.length === 0 ? (
          <div className="card">
            <div className="empty">
              <div className="empty-i">♻️</div>
              <p>Nenhum registro ainda. Clique em "+ Novo registro" para começar.</p>
            </div>
          </div>
        ) : (
          <div className="tw">
            <table className="t">
              <thead>
                <tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Observação</th><th></th></tr>
              </thead>
              <tbody>
                {filtrado.map(r => {
                  const tipo = TIPOS.find(t => t.v === r.tipo);
                  return (
                    <tr key={r.id}>
                      <td style={{ fontSize:12 }}>{fmtDate(r.data)}</td>
                      <td>
                        <span className="badge" style={{ background: tipo?.cor+'22', color: tipo?.cor, border:`1px solid ${tipo?.cor}44` }}>
                          {tipo?.l || r.tipo}
                        </span>
                      </td>
                      <td>{r.descricao || '—'}</td>
                      <td><b style={{ color:'var(--grn)' }}>{formatBRL(r.valor)}</b></td>
                      <td style={{ fontSize:12, color:'var(--tx3)', maxWidth:200 }}>{r.observacao || '—'}</td>
                      <td><button className="ab red" onClick={() => excluir(r.id)}>🗑</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL */}
      {modal && (
        <div className="mbg" onClick={() => setModal(false)}>
          <div className="mbox" onClick={e => e.stopPropagation()}>
            <div className="mhd">
              <h3>♻️ Novo registro</h3>
              <button className="mclose" onClick={() => setModal(false)}>×</button>
            </div>

            <div className="g2">
              <div className="field">
                <label>Tipo *</label>
                <select className="inp" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                  {TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Data *</label>
                <input className="inp" type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} />
              </div>
            </div>

            <div className="field">
              <label>Descrição</label>
              <input className="inp" placeholder="Ex: 50kg de ferro, 3 caixas de papelão..." value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} />
            </div>

            <div className="field">
              <label>Valor recebido (R$) *</label>
              <input className="inp" type="number" step="0.01" placeholder="0,00" autoFocus value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} />
            </div>

            <div className="field">
              <label>Observações</label>
              <textarea className="inp" rows={2} placeholder="Detalhes adicionais..." value={form.observacao} onChange={e => setForm({...form, observacao: e.target.value})} />
            </div>

            <div className="mfoot">
              <button className="btn btn-g" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={salvar} disabled={saving}>
                {saving ? <span className="spin" /> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
