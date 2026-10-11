import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const RegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, isAuthenticated } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      await register(name, email, password, workspaceName || `${name.split(' ')[0]}'s Workspace`);
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient background glow */}
      <div
        style={{
          position: 'absolute',
          top: '-80px',
          width: '320px',
          height: '320px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-primary-fixed)',
          filter: 'blur(80px)',
          opacity: 0.45,
          pointerEvents: 'none',
        }}
      />

      <div style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 10 }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div className="brand-icon" style={{ width: '38px', height: '38px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>bolt</span>
            </div>
            <span style={{ fontFamily: 'var(--font-headline)', fontSize: '24px', fontWeight: 700 }}>
              TaskFlow
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
            Start your high-velocity team workspace
          </p>
        </div>

        {/* Main Auth Card Container */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-lowest)',
            borderRadius: 'var(--radius-xl)',
            padding: '36px 32px',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--color-outline-variant)',
          }}
        >
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '24px', fontWeight: 600, color: 'var(--color-on-surface)' }}>
              Create an account
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
              Setup your profile and team workspace in under 30 seconds.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Alex Morgan"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!workspaceName && e.target.value) {
                    setWorkspaceName(`${e.target.value.split(' ')[0]}'s Workspace`);
                  }
                }}
                required
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Work Email *</label>
              <input
                type="email"
                className="form-input"
                placeholder="alex@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Initial Workspace Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Acme Studio"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Password *</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: '40px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '10px', color: 'var(--color-outline)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              {password.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                  <div
                    style={{
                      flex: 1,
                      height: '4px',
                      borderRadius: '2px',
                      backgroundColor: password.length >= 6 ? 'var(--color-success)' : 'var(--color-danger)',
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      height: '4px',
                      borderRadius: '2px',
                      backgroundColor: password.length >= 8 ? 'var(--color-success)' : 'var(--color-surface-high)',
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      height: '4px',
                      borderRadius: '2px',
                      backgroundColor: password.length >= 10 ? 'var(--color-success)' : 'var(--color-surface-high)',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-outline)', marginLeft: '4px' }}>
                    {password.length < 6 ? 'Too short' : password.length < 8 ? 'Fair' : 'Strong'}
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', height: '40px', marginTop: '8px', fontSize: '14px', fontWeight: 600 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating Workspace...' : 'Create Account & Workspace'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--color-primary-container)', fontWeight: 600 }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
