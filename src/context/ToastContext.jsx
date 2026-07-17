import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ message: '', show: false });
  const timerRef = useRef(null);

  const showToast = useCallback((message, duration = 2400) => {
    clearTimeout(timerRef.current);
    setToast({ message, show: true });
    timerRef.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={`toast${toast.show ? ' show' : ''}`}>{toast.message}</div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
