import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { formatBRL, fmtDateTime } from '../utils';

export default function Nota() {
  const [params] = useSearchParams(); const nav = useNavigate();
  const id = params.get('id');
  const [dados, setDados] = useState(null);

  useEffect(() => {
    if (!id) return;
    api.get(`/nota/${id}`).then(r=>setDados(r.data)).catch(()=>nav(-1));
  }, [id]);

  if (!dados) return <div style={{padding:20,color:'#fff'}}>Carregando...</div>;
  const { venda, itens } = dados;

  return (
    <div style={{background:'var(--bg)',minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',padding:24}}>
      <div style={{display:'flex',gap:10,marginBottom:16,width:240}}>
        <button onClick={()=>nav(-1)} style={{flex:1,padding:'9px 0',background:'var(--s1)',border:'1px solid var(--bd)',borderRadius:'var(--r)',color:'var(--tx2)',cursor:'pointer',fontSize:13}}>← Voltar</button>
        <button onClick={()=>window.print()} style={{flex:1,padding:'9px 0',background:'var(--red)',border:'none',borderRadius:'var(--r)',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>🖨 Imprimir</button>
      </div>
      <div id="nota-print" style={{width:240,background:'#fff',color:'#111',padding:'12px 10px',fontFamily:'monospace',fontSize:12,lineHeight:1.5}}>
        <div style={{textAlign:'center',marginBottom:10}}>
          <div style={{fontWeight:700,fontSize:16}}>MotoNow</div>
          <div style={{fontSize:11}}>Comprovante de Venda</div>
          <div style={{borderTop:'1px dashed #999',margin:'8px 0'}} />
        </div>
        <div><b>Cliente:</b> {venda.cliente_nome}</div>
        <div><b>Tel:</b> {venda.cliente_telefone||'—'}</div>
        <div><b>Data:</b> {fmtDateTime(venda.created_at)}</div>
        <div><b>Pgto:</b> {venda.forma_pagamento}</div>
        <div><b>Filial:</b> {venda.cidade}</div>
        <div style={{borderTop:'1px dashed #999',margin:'8px 0'}} />
        {itens.map((it,i)=>(
          <div key={i} style={{marginBottom:6}}>
            <div style={{fontWeight:600}}>{it.nome_peca}</div>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span>{it.quantidade}× R$ {Number(it.preco_unitario).toFixed(2)}</span>
              <span>R$ {(it.quantidade*it.preco_unitario).toFixed(2)}</span>
            </div>
          </div>
        ))}
        <div style={{borderTop:'1px dashed #999',margin:'8px 0'}} />
        <div style={{display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:14}}>
          <span>TOTAL</span><span>R$ {Number(venda.total).toFixed(2)}</span>
        </div>
        {venda.observacao&&<><div style={{borderTop:'1px dashed #999',margin:'8px 0'}} /><div style={{fontSize:11}}>Obs: {venda.observacao}</div></>}
        <div style={{borderTop:'1px dashed #999',margin:'8px 0'}} />
        <div style={{textAlign:'center',fontSize:11}}>Obrigado pela preferência!</div>
      </div>
      <style>{'@media print{body{background:#fff}#nota-print{box-shadow:none}button{display:none}}'}</style>
    </div>
  );
}
