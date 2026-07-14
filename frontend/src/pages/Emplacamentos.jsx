import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, formatBRL, fmtDate, FILIAIS } from '../utils';

export default function Emplacamentos() {
  const nav = useNavigate(); const user = getUser();
  const { show, Toast } = useToast();
  const [lista, setLista] = useState([]);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [vendaMoto, setVendaMoto] = useState(null); // venda de moto vinculada
  const [buscandoVenda, setBuscandoVenda] = useState(false);

  const empty = {cliente:'',moto:'',chassi:'',cidade:'',data:'',valor:'',custo:'',forma_pagamento:'',pago:false,entregue:false,valor_venda_moto:'',gasto_gasolina:'',gasto_capacete:'',gasto_outros:''};
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!user) nav('/');
    api.get('/emplacamentos').then(r=>setLista(r.data)).catch(e=>show(String(e),'err'));
  }, []);

  const stats = useMemo(()=>({
    total: lista.length,
    lucro: lista.reduce((s,e)=>s+(Number(e.valor||0)-Number(e.custo||0)),0),
    pendentes: lista.filter(e=>!e.entregue).length,
    faturado: lista.reduce((s,e)=>s+Number(e.valor||0),0),
  }),[lista]);

  function calcResultado(f) {
    const valorVenda = Number(f.valor_venda_moto||0);
    const emplacamento = Number(f.valor||0);
    const gasolina = Number(f.gasto_gasolina||0);
    const capacete = Number(f.gasto_capacete||0) * 100;
    const outros = Number(f.gasto_outros||0);
    const total_gastos = emplacamento + gasolina + capacete + outros;
    return { valorVenda, emplacamento, gasolina, capacete, outros, total_gastos, resultado: valorVenda - total_gastos };
  }

  async function buscarVendaMoto(chassi) {
    if (!chassi || chassi.length < 4) return;
    setBuscandoVenda(true);
    try {
      const r = await api.get('/vendas-motos');
      const v = r.data.find(x => x.chassi && x.chassi.trim().toUpperCase() === chassi.trim().toUpperCase());
      if (v) {
        setVendaMoto(v);
        setForm(f => ({...f, valor_venda_moto: String(v.valor||''), cliente: f.cliente||v.nome_cliente, moto: f.moto||v.modelo}));
        show(`Venda encontrada: ${v.nome_cliente} — ${formatBRL(v.valor)}`,'ok');
      } else {
        setVendaMoto(null);
        show('Nenhuma venda encontrada para esse chassi','err');
      }
    } catch(e) { show(String(e),'err'); }
    finally { setBuscandoVenda(false); }
  }

  function abrir(e=null) {
    if (e) {
      setEdit(e);
      setForm({
        cliente: e.cliente, moto: e.moto, chassi: e.chassi||'', cidade: e.cidade,
        data: e.data, valor: String(e.valor), custo: String(e.custo),
        forma_pagamento: e.forma_pagamento||'', pago: !!e.pago, entregue: !!e.entregue,
        valor_venda_moto: String(e.valor_venda_moto||''),
        gasto_gasolina: String(e.gasto_gasolina||''),
        gasto_capacete: String(e.gasto_capacete||''),
        gasto_outros: String(e.gasto_outros||''),
      });
    } else {
      setEdit(null); setForm(empty); setVendaMoto(null);
    }
    setModal(true);
  }

  async function salvar() {
    if (!form.cliente||!form.moto||!form.cidade||!form.data) { show('Preencha os campos obrigatórios','err'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        valor: Number(form.valor||0), custo: Number(form.custo||0),
        valor_venda_moto: Number(form.valor_venda_moto||0),
        gasto_gasolina: Number(form.gasto_gasolina||0),
        gasto_capacete: Number(form.gasto_capacete||0),
        gasto_outros: Number(form.gasto_outros||0),
      };
      if (edit) {
        const r = await api.put(`/emplacamentos/${edit.id}`, payload);
        setLista(p=>p.map(e=>e.id===edit.id?r.data:e));
      } else {
        const r = await api.post('/emplacamentos', payload);
        setLista(p=>[...p,r.data]);
      }
      setModal(false); setEdit(null); setForm(empty); setVendaMoto(null);
      show(edit?'Atualizado!':'Cadastrado!');
    } catch(e){show(String(e),'err');}finally{setSaving(false);}
  }

  if (!user) return null;
  return (
    <div className="page">{Toast}<Topbar />
      <div className="pc">
        <div className="sh">
          <span className="sh-t">🪪 Emplacamentos</span>
          <button className="btn btn-p btn-sm" onClick={()=>abrir()}>+ Novo</button>
        </div>

        {/* Totais */}
        <div className="gf" style={{marginBottom:18}}>
          <div className="stat"><div className="sv">{stats.total}</div><div className="sl">Total</div></div>
          <div className="stat yel"><div className="sv" style={{fontSize:18}}>{formatBRL(stats.faturado)}</div><div className="sl">Faturado</div></div>
          <div className="stat grn"><div className="sv" style={{fontSize:18}}>{formatBRL(stats.lucro)}</div><div className="sl">Lucro total</div></div>
          <div className="stat red"><div className="sv">{stats.pendentes}</div><div className="sl">Pendentes</div></div>
        </div>

        {/* Tabela */}
        <div className="tw"><table className="t">
          <thead>
            <tr>
              <th>Data</th><th>Cliente</th><th>Moto</th><th>Filial</th>
              <th>Valor empl.</th><th>Custo</th><th>Valor venda</th>
              <th>Gastos</th><th>Resultado</th>
              <th>Pago</th><th>Entregue</th><th>✏️</th>
            </tr>
          </thead>
          <tbody>
            {lista.length===0 && <tr><td colSpan={12}><div className="empty"><p>Nenhum emplacamento.</p></div></td></tr>}
            {lista.map(e => {
              const gastos = Number(e.valor||0) + Number(e.gasto_gasolina||0) + Number(e.gasto_capacete||0)*100 + Number(e.gasto_outros||0);
              const resultado = Number(e.valor_venda_moto||0) - gastos;
              const temVenda = Number(e.valor_venda_moto||0) > 0;
              return (
                <tr key={e.id}>
                  <td style={{fontSize:12}}>{fmtDate(e.data)}</td>
                  <td><b>{e.cliente}</b></td>
                  <td>{e.moto}</td>
                  <td>{e.cidade}</td>
                  <td>{formatBRL(e.valor)}</td>
                  <td style={{color:'var(--tx3)'}}>{formatBRL(e.custo)}</td>
                  <td>{temVenda ? formatBRL(e.valor_venda_moto) : <span style={{color:'var(--tx3)'}}>—</span>}</td>
                  <td style={{color:'var(--red)',fontSize:12}}>
                    {gastos > 0 ? <>
                      {Number(e.valor||0)>0 && <div>📋 {formatBRL(e.valor)}</div>}
                      {Number(e.gasto_gasolina||0)>0 && <div>⛽ {formatBRL(e.gasto_gasolina)}</div>}
                      {Number(e.gasto_capacete||0)>0 && <div>🪖 {e.gasto_capacete} cap.</div>}
                      {Number(e.gasto_outros||0)>0 && <div>➕ {formatBRL(e.gasto_outros)}</div>}
                    </> : <span style={{color:'var(--tx3)'}}>—</span>}
                  </td>
                  <td>
                    {temVenda ? (
                      <b style={{color: resultado >= 0 ? 'var(--grn)' : 'var(--red)'}}>
                        {formatBRL(resultado)}
                      </b>
                    ) : <span style={{color:'var(--tx3)'}}>—</span>}
                  </td>
                  <td><span className={`badge ${e.pago?'b-grn':'b-yel'}`}>{e.pago?'Sim':'Não'}</span></td>
                  <td><span className={`badge ${e.entregue?'b-grn':'b-yel'}`}>{e.entregue?'Sim':'Não'}</span></td>
                  <td><button className="ab" onClick={()=>abrir(e)}>✏️</button></td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>

      {/* Modal */}
      {modal && <div className="mbg" onClick={()=>setModal(false)}><div className="mbox" style={{maxWidth:560}} onClick={e=>e.stopPropagation()}>
        <div className="mhd"><h3>{edit?'Editar':'Novo'} emplacamento</h3><button className="mclose" onClick={()=>setModal(false)}>×</button></div>

        {/* Busca por chassi */}
        <div className="field">
          <label>Chassi (buscar venda de moto)</label>
          <div style={{display:'flex',gap:8}}>
            <input className="inp" style={{flex:1,fontFamily:'var(--mono)'}} value={form.chassi} onChange={e=>setForm({...form,chassi:e.target.value.toUpperCase()})} placeholder="Digite o chassi..." />
            <button className="btn btn-g btn-sm" onClick={()=>buscarVendaMoto(form.chassi)} disabled={buscandoVenda}>
              {buscandoVenda?<span className="spin"/>:'🔍 Buscar'}
            </button>
          </div>
        </div>

        {/* Info da venda vinculada */}
        {vendaMoto && (
          <div style={{background:'var(--grndim)',border:'1px solid var(--grnbd)',borderRadius:'var(--r)',padding:'10px 14px',marginBottom:10,fontSize:12}}>
            <b style={{color:'var(--grn)'}}>✅ Venda vinculada:</b> {vendaMoto.nome_cliente} — {vendaMoto.modelo} — <b>{formatBRL(vendaMoto.valor)}</b>
          </div>
        )}

        <div className="g2">
          <div className="field"><label>Cliente *</label><input className="inp" value={form.cliente} onChange={e=>setForm({...form,cliente:e.target.value})} /></div>
          <div className="field"><label>Moto *</label><input className="inp" value={form.moto} onChange={e=>setForm({...form,moto:e.target.value})} /></div>
        </div>
        <div className="g2">
          <div className="field"><label>Filial *</label>
            <select className="inp" value={form.cidade} onChange={e=>setForm({...form,cidade:e.target.value})}>
              <option value="">Selecione</option>
              {FILIAIS.map(f=><option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="field"><label>Data *</label><input className="inp" type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})} /></div>
        </div>

        {/* Emplacamento */}
        <div style={{fontSize:12,fontWeight:600,color:'var(--tx3)',textTransform:'uppercase',letterSpacing:'.05em',margin:'10px 0 6px'}}>📋 Emplacamento</div>
        <div className="g2">
          <div className="field"><label>Valor cobrado (R$)</label><input className="inp" type="number" step="0.01" value={form.valor} onChange={e=>setForm({...form,valor:e.target.value})} /></div>
          <div className="field"><label>Custo real (R$)</label><input className="inp" type="number" step="0.01" value={form.custo} onChange={e=>setForm({...form,custo:e.target.value})} /></div>
        </div>
        <div className="field"><label>Forma de pagamento</label><input className="inp" value={form.forma_pagamento} onChange={e=>setForm({...form,forma_pagamento:e.target.value})} /></div>

        {/* Gastos adicionais */}
        <div style={{fontSize:12,fontWeight:600,color:'var(--tx3)',textTransform:'uppercase',letterSpacing:'.05em',margin:'10px 0 6px'}}>💸 Gastos da venda</div>
        <div className="g2">
          <div className="field"><label>⛽ Gasolina (R$)</label><input className="inp" type="number" step="0.01" value={form.gasto_gasolina} onChange={e=>setForm({...form,gasto_gasolina:e.target.value})} /></div>
          <div className="field"><label>🪖 Capacetes (qtd × R$100)</label><input className="inp" type="number" value={form.gasto_capacete} onChange={e=>setForm({...form,gasto_capacete:e.target.value})} /></div>
        </div>
        <div className="field"><label>➕ Outros gastos (R$)</label><input className="inp" type="number" step="0.01" value={form.gasto_outros} onChange={e=>setForm({...form,gasto_outros:e.target.value})} /></div>

        {/* Valor da venda da moto */}
        <div style={{fontSize:12,fontWeight:600,color:'var(--tx3)',textTransform:'uppercase',letterSpacing:'.05em',margin:'10px 0 6px'}}>🏍 Resultado da venda</div>
        <div className="field">
          <label>Valor de venda da moto (R$)</label>
          <input className="inp" type="number" step="0.01" value={form.valor_venda_moto} onChange={e=>setForm({...form,valor_venda_moto:e.target.value})} />
        </div>

        {/* Preview do resultado */}
        {Number(form.valor_venda_moto||0) > 0 && (() => {
          const r = calcResultado(form);
          return (
            <div style={{background:'var(--s3)',borderRadius:'var(--r)',padding:'12px 14px',fontSize:13,marginTop:4}}>
              <div style={{marginBottom:6,color:'var(--tx2)'}}>
                <b>Valor de venda da moto:</b> {formatBRL(r.valorVenda)}
              </div>
              <div style={{fontSize:12,color:'var(--tx3)',marginBottom:4}}>Gastos abatidos:</div>
              {r.emplacamento>0 && <div style={{fontSize:12,color:'var(--tx3)'}}>📋 Emplacamento: − {formatBRL(r.emplacamento)}</div>}
              {r.gasolina>0 && <div style={{fontSize:12,color:'var(--tx3)'}}>⛽ Gasolina: − {formatBRL(r.gasolina)}</div>}
              {r.capacete>0 && <div style={{fontSize:12,color:'var(--tx3)'}}>🪖 Capacetes ({form.gasto_capacete}×R$100): − {formatBRL(r.capacete)}</div>}
              {r.outros>0 && <div style={{fontSize:12,color:'var(--tx3)'}}>➕ Outros: − {formatBRL(r.outros)}</div>}
              <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--bd)',fontWeight:700,fontSize:15,color: r.resultado>=0?'var(--grn)':'var(--red)'}}>
                Resultado: {formatBRL(r.resultado)}
              </div>
            </div>
          );
        })()}

        <div style={{display:'flex',gap:20,marginTop:10}}>
          <label className="ck"><input type="checkbox" checked={form.pago} onChange={e=>setForm({...form,pago:e.target.checked})} /> Pago</label>
          <label className="ck"><input type="checkbox" checked={form.entregue} onChange={e=>setForm({...form,entregue:e.target.checked})} /> Entregue</label>
        </div>
        <div className="mfoot">
          <button className="btn btn-g" onClick={()=>setModal(false)}>Cancelar</button>
          <button className="btn btn-p" onClick={salvar} disabled={saving}>{saving?<span className="spin"/>:'💾 Salvar'}</button>
        </div>
      </div></div>}
    </div>
  );
}
