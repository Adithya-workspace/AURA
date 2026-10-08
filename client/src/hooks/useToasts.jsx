import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, tone = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3200);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast pointer-events-auto rounded-md border bg-surface px-3 py-2 text-sm shadow-card ${toast.tone === 'error' ? 'border-critical text-critical' : 'border-border text-text'}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToasts() {
  return useContext(ToastContext);
}
