import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { TaskDrawer } from './TaskDrawer';
import { TaskModal } from './TaskModal';
import { CommandPalette } from './CommandPalette';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export const AppShell = () => {
  const { isAuthenticated, isLoading, currentWorkspace } = useAuth();
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const fetchShellData = useCallback(async () => {
    if (!currentWorkspace) return;
    try {
      const [projRes, wsRes, notifRes] = await Promise.all([
        api.get('/projects'),
        api.get(`/workspaces/${currentWorkspace._id}`),
        api.get('/notifications?unreadOnly=true'),
      ]);

      if (projRes.success) setProjects(projRes.projects || []);
      if (wsRes.success) setMembers(wsRes.workspace.members || []);
      if (notifRes.success) setUnreadCount(notifRes.unreadCount || 0);
    } catch (err) {
      // Handled silently
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (currentWorkspace) {
      fetchShellData();
    }
  }, [currentWorkspace, fetchShellData]);

  // Global keydown listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-surface)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="brand-icon" style={{ width: '48px', height: '48px', fontSize: '24px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>bolt</span>
          </div>
          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-on-surface-variant)' }}>
            Loading workspace environment...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-container">
      {/* Mobile backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <Sidebar
        unreadNotificationsCount={unreadCount}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      <Header
        onOpenNewTask={() => setIsTaskModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        unreadCount={unreadCount}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      <main className="main-content">
        <Outlet context={{ projects, members, refreshShellData: fetchShellData }} />
      </main>

      {/* Global Slide-out Task Detail Drawer */}
      <TaskDrawer members={members} />

      {/* Global Quick Task Creation Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        projects={projects}
        members={members}
        onSuccess={() => fetchShellData()}
      />

      {/* Cmd+K Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
};
