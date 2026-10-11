import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Sidebar = ({ unreadNotificationsCount = 0, isOpen = false, onClose }) => {
  const { user, workspaces, currentWorkspace, switchWorkspace, logout } = useAuth();
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: 'home' },
    { to: '/my-tasks', label: 'My Tasks', icon: 'check_circle' },
    { to: '/projects', label: 'Projects', icon: 'folder' },
    { to: '/calendar', label: 'Calendar', icon: 'calendar_today' },
    { to: '/team', label: 'Team', icon: 'group' },
    { to: '/notifications', label: 'Notifications', icon: 'notifications', badge: unreadNotificationsCount },
  ];

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div>
        {/* Brand Header */}
        <div className="sidebar-header">
          <div className="brand-logo" onClick={() => { navigate('/dashboard'); handleNavClick(); }} style={{ cursor: 'pointer' }}>
            <div className="brand-icon">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>bolt</span>
            </div>
            <span style={{ fontSize: '18px', fontWeight: 600 }}>TaskFlow</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              style={{ padding: '4px', borderRadius: '4px', color: 'var(--color-outline)' }}
              title="Switch Workspace"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>unfold_more</span>
            </button>
            <button
              className="mobile-close-btn"
              onClick={onClose}
              style={{ padding: '4px', borderRadius: '4px', color: 'var(--color-outline)' }}
              title="Close sidebar"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
            </button>
          </div>
        </div>

        {/* Workspace Selector Bar */}
        <div style={{ position: 'relative' }}>
          <div
            className="workspace-switcher"
            onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <div className="workspace-badge">
                {(currentWorkspace?.name || 'A')[0].toUpperCase()}
              </div>
              <span style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentWorkspace?.name || 'My Workspace'}
              </span>
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-outline)' }}>
              expand_more
            </span>
          </div>

          {showWorkspaceMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: '14px',
                right: '14px',
                backgroundColor: 'var(--color-surface-lowest)',
                borderRadius: 'var(--radius-base)',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--color-outline-variant)',
                zIndex: 60,
                padding: '6px',
              }}
            >
              <div style={{ padding: '6px 8px', fontSize: '11px', color: 'var(--color-outline)', textTransform: 'uppercase', fontWeight: 600 }}>
                Workspaces ({workspaces.length})
              </div>
              {workspaces.map((ws) => (
                <div
                  key={ws._id}
                  onClick={() => {
                    switchWorkspace(ws._id);
                    setShowWorkspaceMenu(false);
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-xs)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    backgroundColor: ws._id === currentWorkspace?._id ? 'var(--color-surface-low)' : 'transparent',
                    fontWeight: ws._id === currentWorkspace?._id ? 600 : 400,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="workspace-badge" style={{ width: '18px', height: '18px', fontSize: '10px' }}>
                      {ws.name[0]}
                    </div>
                    <span>{ws.name}</span>
                  </div>
                  {ws._id === currentWorkspace?._id && (
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-primary-container)' }}>
                      check
                    </span>
                  )}
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--color-surface-low)', marginTop: '4px', paddingTop: '4px' }}>
                <div
                  onClick={() => {
                    setShowWorkspaceMenu(false);
                    navigate('/settings');
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-xs)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: 'var(--color-primary-container)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                  <span>Create or Join Workspace</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Primary Navigation */}
        <nav className="nav-links">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <div className="nav-item-left">
                <span className="material-symbols-outlined">{item.icon}</span>
                <span>{item.label}</span>
              </div>
              {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer Navigation & Profile Bar */}
      <div className="sidebar-footer">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '10px' }}>
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            style={{ padding: '6px 12px' }}
          >
            <div className="nav-item-left">
              <span className="material-symbols-outlined">settings</span>
              <span>Settings</span>
            </div>
          </NavLink>
        </div>

        {/* User Card Bar */}
        <div style={{ position: 'relative' }}>
          <div className="user-profile-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="avatar avatar-sm"
                  style={{ width: '30px', height: '30px' }}
                />
              ) : (
                <div className="avatar avatar-sm" style={{ width: '30px', height: '30px' }}>
                  {user?.name?.[0] || 'U'}
                </div>
              )}
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name || 'User'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.jobTitle || 'Team Member'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{ color: 'var(--color-outline)', padding: '2px' }}
              title="User menu"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>more_vert</span>
            </button>
          </div>

          {showUserMenu && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
                marginBottom: '8px',
                backgroundColor: 'var(--color-surface-lowest)',
                borderRadius: 'var(--radius-base)',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--color-outline-variant)',
                padding: '6px',
                zIndex: 60,
              }}
            >
              <div
                onClick={() => {
                  setShowUserMenu(false);
                  navigate('/settings');
                }}
                style={{
                  padding: '8px 10px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-xs)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person</span>
                <span>Account Settings</span>
              </div>
              <div
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                }}
                style={{
                  padding: '8px 10px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-xs)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--color-danger)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>logout</span>
                <span>Sign Out</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
