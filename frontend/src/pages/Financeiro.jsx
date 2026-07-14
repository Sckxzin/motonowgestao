import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import useToast from '../hooks/useToast';
import api from '../api';
import { getUser, formatBRL, fmtDate } from '../utils';

export default function Financeiro() {
  const nav = useNavigate(); const user = getUser();
  const { show, Toast } = useToast();
  const hoje = new Date().toISOString().slice(0,10);
  const [data, setData] = useState(hoje);
  const [hist, setHist] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingEstoque, setLoadingEstoque] = useState(false);

  // Campos manuais
  const [saldo, setSaldo]         = useState('');
  const [aReceber, setAReceber]   = useState('');
  const [shineray, setShineray]   = useState('');
  const [eduardo, setEduardo]     = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [observacao, setObs]      = useState('');

  // Estoque puxado do banco automaticamente
  const [estoqueCompra, setEstoqueCompra] = useState(0);
  const [estoqueVenda, setEstoqueVenda]   = useState(0);
  const [qtdEstoque, setQtdEstoque]       = useState(0);

  // Cálculos automáticos
  const jotaCompra = useMemo(() =>
    Number(saldo||0) + Number(aReceber||0) + Number(estoqueCompra||0)
    - Number(shineray||0) - Number(eduardo||0) - Number(fornecedor||0)
  , [saldo, aReceber, estoqueCompra, shineray, eduardo, fornecedor]);

  const jotaVenda = useMemo(() =>
    Number(saldo||0) + Number(aReceber||0) + Number(estoqueVenda||0)
    - Number(shineray||0) - Number(eduardo||0) - Number(fornecedor||0)
  , [saldo, aReceber, estoqueVenda, shineray, eduardo, fornecedor]);

  // Carrega histórico
  useEffect(() => {
    if (!user) nav('/');
    api.get('/financeiro').then(r=>setHist(r.data||[])).catch(()=>{});
  }, []);

  // Ao mudar data: carrega registro salvo + estoque real
  useEffect(() => {
    if (!data) return;

    // Carrega registro salvo para a data
    api.get('/financeiro', { params: { data } }).then(r => {
      const d = r.data;
      if (d) {
        setSaldo(String(d.saldo||''));
        setAReceber(String(d.a_receber||''));
        setShineray(String(d.shineray||''));
        setEduardo(String(d.eduardo||''));
        setFornecedor(String(d.fornecedor||''));
        setObs(d.observacao||'');
      } else {
        setSaldo(''); setAReceber(''); setShineray('');
        setEduardo(''); setFornecedor(''); setObs('');
      }
    }).catch(()=>{});

    // Puxar estoque real de motos disponíveis
    setLoadingEstoque(true);
    api.get('/motos').then(r => {
      const motos = (r.data||[]).filter(m => m.status === 'DISPONIVEL' || m.status === 'NEGOCIACAO');
      const totalCompra = motos.reduce((s,m) => s + Number(m.valor_compra||0), 0);
      const totalVenda  = motos.reduce((s,m) => s + Number(m.valor_minimo_venda||m.repasse||0), 0);
      setEstoqueCompra(totalCompra);
      setEstoqueVenda(totalVenda);
      setQtdEstoque(motos.length);
    }).catch(()=>{}).finally(()=>setLoadingEstoque(false));
  }, [data]);

  async function salvar() {
    setSaving(true);
    try {
      await api.post('/financeiro', {
        data,
        saldo: Number(saldo||0),
        a_receber: Number(aReceber||0),
        estoque_compra: Number(estoqueCompra||0),
        estoque_venda: Number(estoqueVenda||0),
        qtd_estoque: Number(qtdEstoque||0),
        shineray: Number(shineray||0),
        eduardo: Number(eduardo||0),
        fornecedor: Number(fornecedor||0),
        jota_compra: jotaCompra,
        jota_venda: jotaVenda,
        observacao: observacao||null,
      });
      show('Salvo!');
      api.get('/financeiro').then(r=>setHist(r.data||[]));
    } catch(e) { show(String(e),'err'); } finally { setSaving(false); }
  }

  if (!user) return null;
  return (
    <div className="page">{Toast}<Topbar />
      <div className="pc">
        <div className="sh"><span className="sh-t">💰 Controle Financeiro</span></div>

        <div className="g2" style={{alignItems:'start',gap:20}}>

          {/* FORMULÁRIO */}
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div className="card">
              <div className="clabel" style={{marginBottom:12}}>📅 Data do registro</div>
              <input className="inp" type="date" value={data} onChange={e=>setData(e.target.value)} />
            </div>

            {/* ENTRADAS */}
            <div className="card">
              <div className="clabel" style={{marginBottom:12}}>💵 Entradas</div>
              <div className="field"><label>Saldo em caixa (R$)</label>
                <input className="inp" type="number" step="0.01" placeholder="0" value={saldo} onChange={e=>setSaldo(e.target.value)} />
              </div>
              <div className="field"><label>A receber (R$)</label>
                <input className="inp" type="number" step="0.01" placeholder="0" value={aReceber} onChange={e=>setAReceber(e.target.value)} />
              </div>
            </div>

            {/* ESTOQUE — automático */}
            <div className="card">
              <div className="clabel" style={{marginBottom:12}}>
                🏍 Estoque de motos
                {loadingEstoque && <span className="spin" style={{marginLeft:8}} />}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                  <span style={{color:'var(--tx2)'}}>Quantidade disponível:</span>
                  <b>{qtdEstoque} motos</b>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                  <span style={{color:'var(--tx2)'}}>Valor de compra total:</span>
                  <b style={{color:'var(--yel)'}}>{formatBRL(estoqueCompra)}</b>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                  <span style={{color:'var(--tx2)'}}>Valor de venda total:</span>
                  <b style={{color:'var(--grn)'}}>{formatBRL(estoqueVenda)}</b>
                </div>
              </div>
            </div>

            {/* DÍVIDAS */}
            <div className="card">
              <div className="clabel" style={{marginBottom:12}}>📤 Dívidas / A pagar</div>
              <div className="field"><label>Shineray (R$)</label>
                <input className="inp" type="number" step="0.01" placeholder="0" value={shineray} onChange={e=>setShineray(e.target.value)} />
              </div>
              <div className="field"><label>Eduardo (R$)</label>
                <input className="inp" type="number" step="0.01" placeholder="0" value={eduardo} onChange={e=>setEduardo(e.target.value)} />
              </div>
              <div className="field"><label>Fornecedor (R$)</label>
                <input className="inp" type="number" step="0.01" placeholder="0" value={fornecedor} onChange={e=>setFornecedor(e.target.value)} />
              </div>
            </div>

            <div className="field"><label>Observação</label>
              <textarea className="inp" rows={2} value={observacao} onChange={e=>setObs(e.target.value)} />
            </div>
            <button className="btn btn-p btn-full" onClick={salvar} disabled={saving}>
              {saving ? <span className="spin" /> : '💾 Salvar'}
            </button>
          </div>

          {/* RESULTADOS + HISTÓRICO */}
          <div style={{display:'flex',flexDirection:'column',gap:14}}>

            {/* Cards de resultado */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div className="card" style={{background:'rgba(46,204,113,.08)',border:'1px solid var(--grnbd)'}}>
                <div style={{fontSize:12,color:'var(--tx3)',marginBottom:6,fontWeight:600}}>🟢 JOTA VENDA</div>
                <div style={{fontSize:22,fontWeight:700,color:'var(--grn)'}}>{formatBRL(jotaVenda)}</div>
                <div style={{fontSize:11,color:'var(--tx3)',marginTop:6}}>
                  Saldo + A receber + Estoque venda − Dívidas
                </div>
              </div>
              <div className="card" style={{background:'rgba(59,130,246,.08)',border:'1px solid rgba(59,130,246,.22)'}}>
                <div style={{fontSize:12,color:'var(--tx3)',marginBottom:6,fontWeight:600}}>🔵 JOTA COMPRA</div>
                <div style={{fontSize:22,fontWeight:700,color:'var(--blu)'}}>{formatBRL(jotaCompra)}</div>
                <div style={{fontSize:11,color:'var(--tx3)',marginTop:6}}>
                  Saldo + A receber + Estoque compra − Dívidas
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="card">
              <div className="clabel" style={{marginBottom:10}}>Detalhamento</div>
              {[
                ['💵 Saldo', saldo, 'var(--tx)'],
                ['📬 A receber', aReceber, 'var(--tx)'],
                ['🏍 Estoque (compra)', estoqueCompra, 'var(--yel)'],
                ['🏍 Estoque (venda)', estoqueVenda, 'var(--grn)'],
                ['➖ Shineray', shineray, 'var(--red)'],
                ['➖ Eduardo', eduardo, 'var(--red)'],
                ['➖ Fornecedor', fornecedor, 'var(--red)'],
              ].map(([label, val, color]) => (
                <div key={label} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--bd)',fontSize:13}}>
                  <span style={{color:'var(--tx2)'}}>{label}</span>
                  <b style={{color}}>{formatBRL(Number(val||0))}</b>
                </div>
              ))}
            </div>

            {/* Histórico */}
            <div className="card">
              <div className="clabel" style={{marginBottom:10}}>Histórico</div>
              <div className="tw"><table className="t">
                <thead><tr><th>Data</th><th>Jota Venda</th><th>Jota Compra</th><th>Saldo</th></tr></thead>
                <tbody>
                  {hist.length===0 && <tr><td colSpan={4}><div className="empty" style={{padding:'20px 0'}}><p>Sem registros.</p></div></td></tr>}
                  {hist.slice(0,20).map(h=>(
                    <tr key={h.id} style={{cursor:'pointer'}} onClick={()=>setData(h.data)}>
                      <td><b>{fmtDate(h.data)}</b></td>
                      <td style={{color:'var(--grn)'}}>{formatBRL(h.jota_venda)}</td>
                      <td style={{color:'var(--blu)'}}>{formatBRL(h.jota_compra)}</td>
                      <td>{formatBRL(h.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
