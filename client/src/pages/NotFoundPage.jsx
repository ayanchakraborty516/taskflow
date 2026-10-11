import React from 'react';
import { useNavigate } from 'react-router-dom';

export const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '40px 20px',
      }}
    >
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-primary-fixed)',
          color: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '36px' }}>search_off</span>
      </div>

      <h1
        style={{
          fontFamily: 'var(--font-headline)',
          fontSize: '32px',
          fontWeight: 700,
          color: 'var(--color-on-surface)',
          marginBottom: '8px',
        }}
      >
        Page Not Found
      </h1>

      <p
        style={{
          fontSize: '15px',
          color: 'var(--color-on-surface-variant)',
          maxWidth: '440px',
          lineHeight: 1.6,
          marginBottom: '28px',
        }}
      >
        The page, project, or task you are trying to view might have been moved, archived, or you may not have permission to view it.
      </p>

      <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>home</span>
        <span>Return to Dashboard</span>
      </button>
    </div>
  );
};
