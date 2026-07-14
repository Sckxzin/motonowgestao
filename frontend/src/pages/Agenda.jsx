import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, isDir, FILIAIS, FORMAS_PGTO } from '../utils';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const TIPOS = [
  { value: 'REVISAO',    label: '🔧 Revisão',       cor: '#3b82f6' },
  { value: 'ENTREGA',    label: '🚗 Entrega',        cor: '#2ecc71' },
  { value: 'GARANTIA',   label: '🛡 Garantia',       cor: '#f59e0b' },
  { value: 'ORCAMENTO',  label: '📋 Orçamento',      cor: '#8b5cf6' },
  { value: 'OUTRO',      label: '📌 Outro',          cor: '#6b7280' },
];

const STATUS_CORES = {
  AGENDADO:   '#3b82f6',
  CONFIRMADO: '#2ecc71',
  REALIZADO:  '#6b7280',
  CANCELADO:  '#e63946',
};

function pad(n) { return String(n).padStart(2, '0'); }

function getDiasDoMes(ano, mes) {
  const primeiro = new Date(ano, mes, 1);
  const ultimo = new Date(ano, mes + 1, 0);
  const dias = [];
  // dias do mês anterior para completar a primeira semana
  for (let i = 0; i < primeiro.getDay(); i++) {
    const d = new Date(ano, mes, -primeiro.getDay() + i + 1);
    dias.push({ data: d, outro: true });
  }
  for (let d = 1; d <= ultimo.getDate(); d++) {
    dias.push({ data: new Date(ano, mes, d), outro: false });
  }
  // dias do mês seguinte para completar a última semana
  const restantes = 7 - (dias.length % 7);
  if (restantes < 7) {
    for (let d = 1; d <= restantes; d++) {
      dias.push({ data: new Date(ano, mes + 1, d), outro: true });
    }
  }
  return dias;
}

function dataStr(date) {
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}

export default function Agenda() {
  const nav = useNavigate();
  const user = getUser();
  const { show, Toast } = useToast();

  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [agendamentos, setAgendamentos] = useState([]);
  const [diaSel, setDiaSel] = useState(null);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('mes'); // 'mes' | 'semana'

  const vazio = {
    titulo: '', data: dataStr(hoje), hora_inicio: '08:00', hora_fim: '09:00',
    cliente_nome: '', cliente_tel: '', chassi: '', modelo_moto: '',
    tipo: 'REVISAO', observacao: '', cor: '#3b82f6', status: 'AGENDADO',
  };
  const [form, setForm] = useState(vazio);
  const [buscaChassi, setBuscaChassi] = useState('');
  const [dadosChassi, setDadosChassi] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const r = await api.get('/agendamentos', { params: { mes: mes + 1, ano } });
      setAgendamentos(r.data || []);
    } catch (e) { show(String(e), 'err'); }
  }, [mes, ano]);

  useEffect(() => { if (!user) nav('/'); else carregar(); }, [mes, ano, carregar]);

  function navMes(delta) {
    const novoMes = mes + delta;
    if (novoMes < 0) { setAno(a => a - 1); setMes(11); }
    else if (novoMes > 11) { setAno(a => a + 1); setMes(0); }
    else setMes(novoMes);
  }

  function abrirNovo(data) {
    setEditando(null);
    setForm({ ...vazio, data: dataStr(data || new Date()) });
    setDadosChassi(null);
    setBuscaChassi('');
    setModal(true);
  }

  function abrirEditar(ag) {
    setEditando(ag);
    setForm({ titulo: ag.titulo, data: ag.data, hora_inicio: ag.hora_inicio, hora_fim: ag.hora_fim || '',
      cliente_nome: ag.cliente_nome || '', cliente_tel: ag.cliente_tel || '',
      chassi: ag.chassi || '', modelo_moto: ag.modelo_moto || '',
      tipo: ag.tipo, observacao: ag.observacao || '', cor: ag.cor || '#3b82f6', status: ag.status });
    setDadosChassi(null);
    setBuscaChassi(ag.chassi || '');
    setModal(true);
  }

  async function buscarChassi(chassi) {
    if (!chassi || chassi.length < 4) return;
    try {
      const r = await api.get(`/chassi/${encodeURIComponent(chassi.toUpperCase())}`);
      setDadosChassi(r.data);
      const d = r.data;
      setForm(f => ({
        ...f,
        chassi: chassi.toUpperCase(),
        modelo_moto: d.moto?.modelo || f.modelo_moto,
        cliente_nome: d.cliente?.nome || f.cliente_nome,
        cliente_tel: d.cliente?.telefone || f.cliente_tel,
        titulo: f.titulo || `${d.moto?.modelo || 'Revisão'} — ${d.cliente?.nome || chassi}`,
      }));
    } catch { setDadosChassi(null); }
  }

  async function salvar() {
    if (!form.titulo || !form.data || !form.hora_inicio) { show('Preencha título, data e horário', 'err'); return; }
    setSaving(true);
    try {
      if (editando) {
        const r = await api.put(`/agendamentos/${editando.id}`, form);
        setAgendamentos(p => p.map(a => a.id === editando.id ? r.data : a));
        show('Agendamento atualizado!');
      } else {
        const r = await api.post('/agendamentos', form);
        setAgendamentos(p => [...p, r.data]);
        show('Agendado!');
      }
      setModal(false);
    } catch (e) { show(String(e), 'err'); }
    finally { setSaving(false); }
  }

  async function excluir(id) {
    if (!window.confirm('Excluir este agendamento?')) return;
    try {
      await api.delete(`/agendamentos/${id}`);
      setAgendamentos(p => p.filter(a => a.id !== id));
      setModal(false);
      show('Excluído!');
    } catch (e) { show(String(e), 'err'); }
  }

  async function alterarStatus(id, status) {
    try {
      const ag = agendamentos.find(a => a.id === id);
      if (!ag) return;
      const r = await api.put(`/agendamentos/${id}`, { ...ag, status });
      setAgendamentos(p => p.map(a => a.id === id ? r.data : a));
    } catch (e) { show(String(e), 'err'); }
  }

  const dias = getDiasDoMes(ano, mes);
  const agPorData = agendamentos.reduce((acc, a) => {
    if (!acc[a.data]) acc[a.data] = [];
    acc[a.data].push(a);
    return acc;
  }, {});

  const diaSelData = diaSel ? dataStr(diaSel) : null;
  const agsDia = diaSelData ? (agPorData[diaSelData] || []) : [];

  const hojeStr = dataStr(hoje);
  const totalMes = agendamentos.length;
  const confirmados = agendamentos.filter(a => a.status === 'CONFIRMADO').length;
  const realizados  = agendamentos.filter(a => a.status === 'REALIZADO').length;

  if (!user) return null;

  return (
    <div className="page">
      {Toast}
      <Topbar />
      <div className="pc">
        {/* CABEÇALHO */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="ab" onClick={() => navMes(-1)}>‹</button>
            <h2 style={{ fontSize: 18, fontWeight: 700, minWidth: 200, textAlign: 'center' }}>
              {MESES[mes]} {ano}
            </h2>
            <button className="ab" onClick={() => navMes(1)}>›</button>
            <button className="ab" onClick={() => { setAno(hoje.getFullYear()); setMes(hoje.getMonth()); }}>Hoje</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--tx3)', alignSelf: 'center' }}>
              {totalMes} agendado{totalMes !== 1 ? 's' : ''} · {confirmados} confirmado{confirmados !== 1 ? 's' : ''} · {realizados} realizado{realizados !== 1 ? 's' : ''}
            </span>
            <button className="btn btn-p btn-sm" onClick={() => abrirNovo(hoje)}>+ Novo agendamento</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: diaSel ? '1fr 320px' : '1fr', gap: 16 }}>
          {/* CALENDÁRIO */}
          <div>
            {/* Cabeçalho dos dias da semana */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
              {DIAS_SEMANA.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--tx3)', padding: '6px 0', textTransform: 'uppercase', letterSpacing: '.06em' }}>{d}</div>
              ))}
            </div>

            {/* Grid dos dias */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {dias.map(({ data, outro }, i) => {
                const ds = dataStr(data);
                const ags = agPorData[ds] || [];
                const isHoje = ds === hojeStr;
                const isSel = diaSel && dataStr(diaSel) === ds;
                const isWeekend = data.getDay() === 0 || data.getDay() === 6;

                return (
                  <div
                    key={i}
                    onClick={() => { setDiaSel(isSel ? null : data); }}
                    style={{
                      minHeight: 90, padding: '6px 8px', borderRadius: 8, cursor: 'pointer',
                      background: isSel ? 'var(--reddim)' : outro ? 'var(--bg)' : 'var(--s1)',
                      border: `1px solid ${isSel ? 'var(--redbd)' : isHoje ? 'var(--red)' : 'var(--bd)'}`,
                      opacity: outro ? 0.4 : 1,
                      transition: 'all .12s',
                    }}
                  >
                    <div style={{
                      fontSize: 12, fontWeight: isHoje ? 700 : 500,
                      color: isHoje ? 'var(--red)' : isWeekend ? 'var(--tx2)' : 'var(--tx)',
                      marginBottom: 4,
                    }}>
                      {isHoje ? (
                        <span style={{ background: 'var(--red)', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                          {data.getDate()}
                        </span>
                      ) : data.getDate()}
                    </div>
                    {ags.slice(0, 3).map(a => (
                      <div key={a.id} style={{
                        fontSize: 10, padding: '2px 5px', borderRadius: 4, marginBottom: 2,
                        background: (STATUS_CORES[a.status] || a.cor) + '22',
                        color: STATUS_CORES[a.status] || a.cor,
                        borderLeft: `2px solid ${STATUS_CORES[a.status] || a.cor}`,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {a.hora_inicio} {a.titulo}
                      </div>
                    ))}
                    {ags.length > 3 && (
                      <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 2 }}>+{ags.length - 3} mais</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* LEGENDA */}
            <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
              {TIPOS.map(t => (
                <div key={t.value} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--tx3)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: t.cor }} />
                  {t.label}
                </div>
              ))}
            </div>
          </div>

          {/* PAINEL LATERAL — DIA SELECIONADO */}
          {diaSel && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>
                  {diaSel.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="ab grn" onClick={() => abrirNovo(diaSel)}>+ Ag.</button>
                  <button className="ab" onClick={() => setDiaSel(null)}>✕</button>
                </div>
              </div>

              {agsDia.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--tx3)', fontSize: 13 }}>
                  Nenhum agendamento neste dia.
                  <br />
                  <button className="btn btn-p btn-sm" style={{ marginTop: 12 }} onClick={() => abrirNovo(diaSel)}>+ Agendar</button>
                </div>
              ) : agsDia.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)).map(a => (
                <div key={a.id} className="card card-sm" style={{ borderLeft: `3px solid ${STATUS_CORES[a.status] || a.cor}`, cursor: 'pointer' }} onClick={() => abrirEditar(a)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{a.titulo}</div>
                      <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>
                        🕐 {a.hora_inicio}{a.hora_fim ? ` – ${a.hora_fim}` : ''}
                      </div>
                      {a.cliente_nome && <div style={{ fontSize: 12, color: 'var(--tx2)' }}>👤 {a.cliente_nome}</div>}
                      {a.chassi && <div style={{ fontSize: 11, color: 'var(--tx3)', fontFamily: 'var(--mono)' }}>🔧 {a.chassi}</div>}
                      {a.modelo_moto && <div style={{ fontSize: 11, color: 'var(--tx3)' }}>🏍 {a.modelo_moto}</div>}
                    </div>
                    <span className={`badge`} style={{ background: (STATUS_CORES[a.status] || '#3b82f6') + '22', color: STATUS_CORES[a.status] || '#3b82f6', border: `1px solid ${(STATUS_CORES[a.status] || '#3b82f6')}44`, fontSize: 10, flexShrink: 0 }}>
                      {a.status}
                    </span>
                  </div>

                  {/* Ações rápidas de status */}
                  {a.status !== 'REALIZADO' && a.status !== 'CANCELADO' && (
                    <div style={{ display: 'flex', gap: 5, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--bd)' }} onClick={e => e.stopPropagation()}>
                      {a.status !== 'CONFIRMADO' && <button className="ab grn" style={{ fontSize: 10 }} onClick={() => alterarStatus(a.id, 'CONFIRMADO')}>✅ Confirmar</button>}
                      <button className="ab" style={{ fontSize: 10 }} onClick={() => alterarStatus(a.id, 'REALIZADO')}>✔ Realizado</button>
                      <button className="ab red" style={{ fontSize: 10 }} onClick={() => alterarStatus(a.id, 'CANCELADO')}>✕ Cancelar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL NOVO / EDITAR */}
      {modal && (
        <div className="mbg" onClick={() => setModal(false)}>
          <div className="mbox wide" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="mhd">
              <h3>{editando ? 'Editar agendamento' : 'Novo agendamento'}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {editando && <button className="ab red" onClick={() => excluir(editando.id)}>🗑 Excluir</button>}
                <button className="mclose" onClick={() => setModal(false)}>×</button>
              </div>
            </div>

            {/* Busca por chassi */}
            <div className="field">
              <label>Chassi (busca automática)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="inp" placeholder="Digite o chassi..." value={buscaChassi}
                  onChange={e => { setBuscaChassi(e.target.value.toUpperCase()); setForm(f => ({ ...f, chassi: e.target.value.toUpperCase() })); }}
                  onKeyDown={e => e.key === 'Enter' && buscarChassi(buscaChassi)} />
                <button className="ab" onClick={() => buscarChassi(buscaChassi)}>🔍</button>
              </div>
              {dadosChassi && (
                <div style={{ marginTop: 6, padding: '8px 12px', background: 'var(--grndim)', borderRadius: 'var(--r)', border: '1px solid var(--grnbd)', fontSize: 12 }}>
                  ✅ <b>{dadosChassi.moto?.modelo}</b> · {dadosChassi.cliente?.nome || 'sem cliente'}
                  {dadosChassi.garantia && <span style={{ marginLeft: 8, color: dadosChassi.garantia.em_garantia ? 'var(--grn)' : 'var(--red)' }}>
                    {dadosChassi.garantia.em_garantia ? '🛡 Em garantia' : '❌ Fora de garantia'}
                  </span>}
                </div>
              )}
            </div>

            <div className="field">
              <label>Título *</label>
              <input className="inp" autoFocus placeholder="Ex: Revisão 10.000km — João" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} />
            </div>

            <div className="g2">
              <div className="field"><label>Data *</label><input className="inp" type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} /></div>
              <div className="field">
                <label>Tipo</label>
                <select className="inp" value={form.tipo} onChange={e => {
                  const t = TIPOS.find(x => x.value === e.target.value);
                  setForm({ ...form, tipo: e.target.value, cor: t?.cor || form.cor });
                }}>
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div className="g2">
              <div className="field"><label>Horário início *</label><input className="inp" type="time" value={form.hora_inicio} onChange={e => setForm({ ...form, hora_inicio: e.target.value })} /></div>
              <div className="field"><label>Horário fim</label><input className="inp" type="time" value={form.hora_fim} onChange={e => setForm({ ...form, hora_fim: e.target.value })} /></div>
            </div>

            <div className="g2">
              <div className="field"><label>Cliente</label><input className="inp" placeholder="Nome do cliente" value={form.cliente_nome} onChange={e => setForm({ ...form, cliente_nome: e.target.value })} /></div>
              <div className="field"><label>Telefone</label><input className="inp" placeholder="(81) 9..." value={form.cliente_tel} onChange={e => setForm({ ...form, cliente_tel: e.target.value })} /></div>
            </div>

            <div className="field"><label>Modelo da moto</label><input className="inp" placeholder="Ex: SHI 175 EFI" value={form.modelo_moto} onChange={e => setForm({ ...form, modelo_moto: e.target.value })} /></div>

            {editando && (
              <div className="field">
                <label>Status</label>
                <select className="inp" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="AGENDADO">AGENDADO</option>
                  <option value="CONFIRMADO">CONFIRMADO</option>
                  <option value="REALIZADO">REALIZADO</option>
                  <option value="CANCELADO">CANCELADO</option>
                </select>
              </div>
            )}

            <div className="field"><label>Observações</label><textarea className="inp" rows={2} placeholder="Observações sobre o agendamento..." value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} /></div>

            <div className="mfoot">
              <button className="btn btn-g" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={salvar} disabled={saving}>
                {saving ? <span className="spin" /> : (editando ? 'Salvar alterações' : 'Agendar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
