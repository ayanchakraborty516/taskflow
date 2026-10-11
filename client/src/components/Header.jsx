import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Header = ({ onOpenNewTask, onOpenCommandPalette, unreadCount = 0, onToggleMobileSidebar }) => {
  const { user, currentWorkspace } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Compute breadcrumb path
  const getBreadcrumbTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/dashboard')) return 'Dashboard';
    if (path.startsWith('/my-tasks')) return 'My Tasks';
    if (path.startsWith('/projects/')) return 'Project Details';
    if (path.startsWith('/projects')) return 'Projects';
    if (path.startsWith('/calendar')) return 'Calendar';
    if (path.startsWith('/team')) return 'Team Management';
    if (path.startsWith('/notifications')) return 'Notifications';
    if (path.startsWith('/settings')) return 'Settings';
    return 'Overview';
  };

  return (
    <header className="main-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          className="btn btn-ghost mobile-menu-btn"
          onClick={onToggleMobileSidebar}
          style={{ padding: '6px', color: 'var(--color-on-surface)' }}
          aria-label="Toggle navigation menu"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>menu</span>
        </button>

        <div className="breadcrumbs">
          <span
            onClick={() => navigate('/dashboard')}
            style={{ cursor: 'pointer', color: 'var(--color-on-surface-variant)' }}
          >
            {currentWorkspace?.name || 'Workspace'}
          </span>
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
          <span className="current">{getBreadcrumbTitle()}</span>
        </div>

        <div className="global-search" onClick={onOpenCommandPalette} style={{ cursor: 'pointer' }}>
          <span
            className="material-symbols-outlined"
            style={{ position: 'absolute', left: '10px', fontSize: '18px', color: 'var(--color-outline)' }}
          >
            search
          </span>
          <input
            type="text"
            placeholder="Search tasks, projects..."
            readOnly
            style={{ cursor: 'pointer' }}
          />
          <span className="search-shortcut">⌘K</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button className="btn btn-primary" onClick={onOpenNewTask}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
          <span>New Task</span>
        </button>

        <button
          className="btn btn-ghost"
          style={{ position: 'relative', width: '36px', height: '36px', padding: 0 }}
          onClick={() => navigate('/notifications')}
          title="Notifications"
          aria-label="View notifications"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>notifications</span>
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-danger)',
              }}
            />
          )}
        </button>

        <div
          onClick={() => navigate('/settings')}
          style={{ cursor: 'pointer' }}
          title="Account settings"
        >
          {user?.avatar ? (
            <img src={user.avatar} alt={user.name} className="avatar avatar-md" />
          ) : (
            <div className="avatar avatar-md">{user?.name?.[0] || 'U'}</div>
          )}
        </div>
      </div>
    </header>
  );
};
