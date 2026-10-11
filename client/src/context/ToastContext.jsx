import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="material-symbols-outlined" style={{
              fontSize: '18px',
              color: t.type === 'success' ? 'var(--color-success)' :
                     t.type === 'error' ? 'var(--color-danger)' :
                     t.type === 'warning' ? 'var(--color-warning)' : 'var(--color-primary-container)'
            }}>
              {t.type === 'success' ? 'check_circle' :
               t.type === 'error' ? 'error' :
               t.type === 'warning' ? 'warning' : 'info'}
            </span>
            <span>{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              style={{ marginLeft: 'auto', padding: '2px', color: 'var(--color-outline)' }}
              aria-label="Close notification"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
