import React, { useEffect } from 'react';

export function Notification({ message, type = 'info', onClose, duration = 4000 }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const colors = {
    success: { bg: '#10b981', border: '#059669', icon: '✅' },
    error: { bg: '#ef4444', border: '#dc2626', icon: '❌' },
    warning: { bg: '#f59e0b', border: '#d97706', icon: '⚠️' },
    info: { bg: '#3b82f6', border: '#2563eb', icon: 'ℹ️' }
  };

  const color = colors[type] || colors.info;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: color.bg,
      color: 'white',
      padding: '16px 20px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      zIndex: 9999,
      minWidth: '300px',
      maxWidth: '500px',
      animation: 'slideInRight 0.3s ease-out',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      border: `2px solid ${color.border}`
    }}>
      <style>
        {`
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          @keyframes slideOutRight {
            from {
              transform: translateX(0);
              opacity: 1;
            }
            to {
              transform: translateX(100%);
              opacity: 0;
            }
          }
        `}
      </style>
      <div style={{ fontSize: '20px', flexShrink: 0 }}>
        {color.icon}
      </div>
      <div style={{ flex: 1, fontSize: '14px', lineHeight: '1.4' }}>
        {message}
      </div>
      <button
        onClick={onClose}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          color: 'white',
          fontSize: '18px',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: '4px',
          lineHeight: '1',
          transition: 'background 0.2s'
        }}
        onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.3)'}
        onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
      >
        ✕
      </button>
    </div>
  );
}

export function ConfirmDialog({ message, onConfirm, onCancel, title = '¿Estás seguro?' }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes scaleIn {
            from {
              transform: scale(0.9);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }
        `}
      </style>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        animation: 'scaleIn 0.2s ease-out'
      }}>
        <h2 style={{
          margin: '0 0 16px 0',
          fontSize: '20px',
          color: '#1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '24px' }}>⚠️</span>
          {title}
        </h2>
        <p style={{
          margin: '0 0 24px 0',
          fontSize: '14px',
          color: '#475569',
          lineHeight: '1.6',
          whiteSpace: 'pre-line'
        }}>
          {message}
        </p>
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onCancel}
            style={{
              backgroundColor: '#e2e8f0',
              color: '#475569',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#cbd5e1'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#e2e8f0'}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#bb2d3b'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#dc3545'}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
