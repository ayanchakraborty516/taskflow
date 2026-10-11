import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useTaskDrawer } from '../context/TaskDrawerContext';

export const CommandPalette = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { openDrawer } = useTaskDrawer();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const searchTimer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const [tasksRes, projectsRes] = await Promise.all([
          api.get(`/tasks?search=${encodeURIComponent(query)}`),
          api.get(`/projects?search=${encodeURIComponent(query)}`),
        ]);

        const taskItems = (tasksRes.tasks || []).slice(0, 5).map((t) => ({
          type: 'task',
          id: t._id,
          title: t.title,
          subtitle: `${t.key} • ${t.project?.name || 'Project'} • ${t.status.replace('_', ' ')}`,
          icon: 'task_alt',
          action: () => {
            onClose();
            openDrawer(t._id);
          },
        }));

        const projectItems = (projectsRes.projects || []).slice(0, 4).map((p) => ({
          type: 'project',
          id: p._id,
          title: p.name,
          subtitle: `${p.key} • ${p.category} • ${p.stats?.total || 0} tasks`,
          icon: 'folder',
          action: () => {
            onClose();
            navigate(`/projects/${p._id}`);
          },
        }));

        const staticPages = [
          { title: 'Dashboard', subtitle: 'View team velocity & metrics', icon: 'home', to: '/dashboard' },
          { title: 'My Tasks', subtitle: 'Tasks assigned to you', icon: 'check_circle', to: '/my-tasks' },
          { title: 'Projects', subtitle: 'All active team initiatives', icon: 'folder', to: '/projects' },
          { title: 'Calendar', subtitle: 'Upcoming milestone deadlines', icon: 'calendar_today', to: '/calendar' },
          { title: 'Team', subtitle: 'Workspace members & roles', icon: 'group', to: '/team' },
          { title: 'Settings', subtitle: 'Workspace & account preferences', icon: 'settings', to: '/settings' },
        ]
          .filter((page) => page.title.toLowerCase().includes(query.toLowerCase()))
          .map((page) => ({
            type: 'page',
            id: page.to,
            title: page.title,
            subtitle: page.subtitle,
            icon: page.icon,
            action: () => {
              onClose();
              navigate(page.to);
            },
          }));

        setResults([...taskItems, ...projectItems, ...staticPages]);
        setSelectedIndex(0);
      } catch (err) {
        // Fallback
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => clearTimeout(searchTimer);
  }, [query, isOpen, navigate, onClose, openDrawer]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (results.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % (results.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        results[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '600px', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--color-outline-variant)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-outline)', marginRight: '10px' }}>
            search
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a task, project, or command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ width: '100%', fontSize: '15px', color: 'var(--color-on-surface)', outline: 'none' }}
          />
          <span className="search-shortcut">ESC</span>
        </div>

        <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px' }}>
          {results.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-outline)', fontSize: '13px' }}>
              {isSearching ? 'Searching across workspace...' : 'No results found matching your query.'}
            </div>
          ) : (
            results.map((item, idx) => (
              <div
                key={`${item.type}-${item.id}`}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-base)',
                  backgroundColor: idx === selectedIndex ? 'var(--color-surface-low)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background-color 100ms ease',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: 'var(--color-surface-container)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: item.type === 'task' ? 'var(--color-primary-container)' : 'var(--color-on-surface-variant)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{item.icon}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-on-surface)' }}>{item.title}</span>
                  <span style={{ fontSize: '12px', color: 'var(--color-outline)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.subtitle}
                  </span>
                </div>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-outline)' }}>
                  subdirectory_arrow_left
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
