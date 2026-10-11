import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LandingPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-surface)', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation */}
      <header
        style={{
          height: '70px',
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--color-outline-variant)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="brand-icon">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>bolt</span>
          </div>
          <span style={{ fontFamily: 'var(--font-headline)', fontSize: '20px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
            TaskFlow
          </span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '28px', fontSize: '14px', fontWeight: 500, color: 'var(--color-on-surface-variant)' }}>
          <a href="#features" style={{ transition: 'color 150ms' }}>Features</a>
          <a href="#velocity" style={{ transition: 'color 150ms' }}>Velocity</a>
          <a href="#security" style={{ transition: 'color 150ms' }}>Security</a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isAuthenticated ? (
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Go to Workspace
            </button>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary">
                Log In
              </Link>
              <Link to="/register" className="btn btn-primary">
                Get Started Free
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', maxWidth: '780px', marginBottom: '40px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-primary-fixed)',
              color: 'var(--color-primary)',
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '20px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>speed</span>
            <span>TaskFlow 2.0 Engine Live</span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-headline)',
              fontSize: '48px',
              fontWeight: 700,
              lineHeight: 1.15,
              color: 'var(--color-on-surface)',
              letterSpacing: '-0.03em',
              marginBottom: '20px',
            }}
          >
            Plan clearly. Work together. <br />
            <span style={{ color: 'var(--color-primary-container)' }}>Deliver with kinetic velocity.</span>
          </h1>

          <p style={{ fontSize: '18px', color: 'var(--color-on-surface-variant)', lineHeight: 1.6, marginBottom: '32px' }}>
            Built for modern engineering, product, and design teams. Seamless Kanban lanes, instant subtask checklists, and zero-latency collaboration.
          </p>

          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/register')}>
              <span>Start Free with Workspace</span>
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => navigate('/login')}>
              <span>Sign In with Demo Account</span>
            </button>
          </div>
        </div>

        {/* Interactive Preview Mockup Box */}
        <div
          style={{
            width: '100%',
            backgroundColor: 'var(--color-surface-lowest)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-outline-variant)',
            boxShadow: 'var(--shadow-xl)',
            overflow: 'hidden',
            marginBottom: '80px',
          }}
        >
          {/* Mock Window Header */}
          <div
            style={{
              height: '42px',
              backgroundColor: 'var(--color-surface-low)',
              borderBottom: '1px solid var(--color-outline-variant)',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#eab308' }} />
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
            </div>
            <span style={{ fontSize: '12px', color: 'var(--color-outline)', fontFamily: 'var(--font-mono)' }}>
              app.taskflow.co/projects/MOB/board
            </span>
            <div style={{ width: '30px' }} />
          </div>

          {/* Mock Kanban Snippet */}
          <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', backgroundColor: 'var(--color-surface)' }}>
            {/* Column 1 */}
            <div style={{ backgroundColor: 'var(--color-surface-low)', borderRadius: 'var(--radius-base)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                <span>To Do (4)</span>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-outline)' }}>add</span>
              </div>
              <div className="task-card">
                <span style={{ fontSize: '11px', color: 'var(--color-outline)', fontFamily: 'var(--font-mono)' }}>MOB-101</span>
                <p style={{ fontWeight: 600, fontSize: '13px', margin: '4px 0 8px' }}>Audit biometric passkey fallback on Android 14</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge badge-urgent">Urgent</span>
                  <div className="avatar avatar-sm">LC</div>
                </div>
              </div>
            </div>

            {/* Column 2 */}
            <div style={{ backgroundColor: 'var(--color-surface-low)', borderRadius: 'var(--radius-base)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                <span>In Progress (2)</span>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-outline)' }}>add</span>
              </div>
              <div className="task-card">
                <span style={{ fontSize: '11px', color: 'var(--color-primary-container)', fontFamily: 'var(--font-mono)' }}>MOB-88</span>
                <p style={{ fontWeight: 600, fontSize: '13px', margin: '4px 0 8px' }}>Implement OAuth2 Social Logins (Google & Apple)</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge badge-in_progress">In Progress</span>
                  <div className="avatar avatar-sm">EV</div>
                </div>
              </div>
            </div>

            {/* Column 3 */}
            <div style={{ backgroundColor: 'var(--color-surface-low)', borderRadius: 'var(--radius-base)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                <span>Done (8)</span>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-outline)' }}>check</span>
              </div>
              <div className="task-card" style={{ opacity: 0.85 }}>
                <span style={{ fontSize: '11px', color: 'var(--color-outline)', fontFamily: 'var(--font-mono)', textDecoration: 'line-through' }}>MOB-74</span>
                <p style={{ fontWeight: 600, fontSize: '13px', margin: '4px 0 8px', textDecoration: 'line-through' }}>Migrate Gradle builds to Kotlin DSL script format</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge badge-done">Completed</span>
                  <div className="avatar avatar-sm">MB</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div id="features" style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '60px' }}>
          <div className="card">
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'var(--color-primary-fixed)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              <span className="material-symbols-outlined">view_kanban</span>
            </div>
            <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              Kinetic Kanban Boards
            </h3>
            <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', lineHeight: 1.6 }}>
              Organize sprints across columns, drag and drop with instant reordering, and inspect details without losing board context.
            </p>
          </div>

          <div className="card" id="security">
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'var(--color-secondary-container)', color: 'var(--color-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              <span className="material-symbols-outlined">shield</span>
            </div>
            <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              Multi-Tenant Security
            </h3>
            <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', lineHeight: 1.6 }}>
              Hardened workspace boundaries, role-based access control (Owner, Admin, Member, Viewer), and HTTP-only cookie sessions.
            </p>
          </div>

          <div className="card" id="velocity">
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'var(--color-tertiary-fixed)', color: 'var(--color-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              <span className="material-symbols-outlined">analytics</span>
            </div>
            <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              Real-Time Sprint Metrics
            </h3>
            <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', lineHeight: 1.6 }}>
              Live completion percentages, overdue task trackers, priority triage, and audit activity feeds calculated directly from database records.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--color-outline-variant)', padding: '24px', textAlign: 'center', color: 'var(--color-on-surface-variant)', fontSize: '13px', backgroundColor: 'var(--color-surface-lowest)' }}>
        TaskFlow MERN Project Management Suite • Powered by Stitch AI Design System
      </footer>
    </div>
  );
};
