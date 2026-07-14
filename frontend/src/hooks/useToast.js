import { useState, useCallback } from 'react';

export default function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg, tipo = 'ok') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 2800);
  }, []);
  const Toast = toast ? <div className={`toast ${toast.tipo}`}>{toast.msg}</div> : null;
  return { show, Toast };
}
