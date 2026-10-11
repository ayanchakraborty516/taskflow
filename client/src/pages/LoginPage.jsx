import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const LoginPage = () => {
  const [email, setEmail] = useState('elena.vance@acmestudio.io');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login(email, password);
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message || 'Login failed. Please check credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    try {
      setIsSubmitting(true);
      await login(demoEmail, 'Password123!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message || 'Demo login failed.');
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

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 10 }}>
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
            Plan clearly. Work together. Deliver better.
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
              Welcome back
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
              Enter your credentials to access your workspace.
            </p>
          </div>

          {/* Quick 1-Click Demo Accounts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleQuickDemoLogin('elena.vance@acmestudio.io')}
              style={{ justifyContent: 'flex-start', padding: '10px 14px', height: 'auto' }}
            >
              <div className="avatar avatar-sm" style={{ marginRight: '6px' }}>EV</div>
              <div style={{ textAlign: 'left', minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>Demo: Elena Vance (Lead / Owner)</div>
                <div style={{ fontSize: '11px', color: 'var(--color-outline)' }}>elena.vance@acmestudio.io</div>
              </div>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleQuickDemoLogin('liam.chen@acmestudio.io')}
              style={{ justifyContent: 'flex-start', padding: '10px 14px', height: 'auto' }}
            >
              <div className="avatar avatar-sm" style={{ marginRight: '6px' }}>LC</div>
              <div style={{ textAlign: 'left', minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>Demo: Liam Chen (Engineer)</div>
                <div style={{ fontSize: '11px', color: 'var(--color-outline)' }}>liam.chen@acmestudio.io</div>
              </div>
            </button>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: '10px' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-outline-variant)' }} />
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-outline)', fontWeight: 600 }}>
              or email login
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-outline-variant)' }} />
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Work Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <span style={{ fontSize: '11px', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>
                Workspace verified: Acme Studio
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Password</label>
                <span style={{ fontSize: '12px', color: 'var(--color-primary-container)', cursor: 'pointer' }}>
                  Forgot password?
                </span>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Enter your password"
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

              {/* Password strength indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                <div style={{ flex: 1, height: '4px', borderRadius: '2px', backgroundColor: 'var(--color-success)' }} />
                <div style={{ flex: 1, height: '4px', borderRadius: '2px', backgroundColor: 'var(--color-success)' }} />
                <div style={{ flex: 1, height: '4px', borderRadius: '2px', backgroundColor: 'var(--color-success)' }} />
                <span style={{ fontSize: '11px', color: 'var(--color-outline)', marginLeft: '4px' }}>Strong</span>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', height: '40px', marginTop: '8px', fontSize: '14px', fontWeight: 600 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing In...' : 'Sign In to Workspace'}
            </button>
          </form>

          {/* Switch to Register */}
          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
            Don't have an account yet?{' '}
            <Link to="/register" style={{ color: 'var(--color-primary-container)', fontWeight: 600 }}>
              Create a workspace
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
