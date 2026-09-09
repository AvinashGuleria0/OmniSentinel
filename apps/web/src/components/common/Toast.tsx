'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: string; type: ToastType; title: string; message?: string }
interface ToastContextType { toast: (type: ToastType, title: string, message?: string) => void }

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

const ICON = {
  success: <CheckCircle2 size={14} />,
  error: <AlertCircle size={14} />,
  info: <Info size={14} />,
};
const COLORS: Record<ToastType, { bg: string; color: string; border: string }> = {
  success: { bg: 'var(--success-surface)', color: 'var(--success)', border: 'var(--success)' },
  error: { bg: 'var(--danger-surface)', color: 'var(--danger)', border: 'var(--danger)' },
  info: { bg: 'var(--accent-surface)', color: 'var(--accent)', border: 'var(--accent)' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => setToasts((p) => p.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (type: ToastType, title: string, message?: string) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((p) => [...p.slice(-3), { id, type, title, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 340 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className="fade-in"
            style={{
              background: 'var(--surface)',
              border: `1px solid var(--border)`,
              borderLeft: `3px solid ${COLORS[t.type].border}`,
              borderRadius: 'var(--radius)',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            }}
          >
            <span style={{ color: COLORS[t.type].color, flexShrink: 0, marginTop: 1 }}>{ICON[t.type]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{t.title}</div>
              {t.message && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t.message}</div>}
            </div>
            <button onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}>
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
