import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useTaskDrawer } from '../context/TaskDrawerContext';
import { useToast } from '../context/ToastContext';

export const MyTasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { openDrawer } = useTaskDrawer();
  const toast = useToast();

  const fetchMyTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/tasks?myTasks=true');
      if (res.success) {
        setTasks(res.tasks || []);
      }
    } catch (error) {
      toast.error('Failed to load your assigned tasks.');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMyTasks();
  }, [fetchMyTasks]);

  const handleToggleTask = async (taskId, currentStatus, e) => {
    e.stopPropagation();
    try {
      const newStatus = currentStatus === 'done' ? 'todo' : 'done';
      await api.put(`/tasks/${taskId}`, { status: newStatus });
      toast.success(newStatus === 'done' ? 'Task marked as done!' : 'Task reopened.');
      fetchMyTasks();
    } catch (err) {
      toast.error('Could not update status.');
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase()) && !t.key?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '28px', fontWeight: 700 }}>My Tasks</h1>
            <span className="badge" style={{ backgroundColor: 'var(--color-primary-fixed)', color: 'var(--color-primary)', fontSize: '13px', padding: '2px 8px' }}>
              {tasks.length} assigned
            </span>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
            All deliverables and milestones assigned to you across projects.
          </p>
        </div>

        {/* Search & Status Filters */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '8px', fontSize: '18px', color: 'var(--color-outline)' }}>
              search
            </span>
            <input
              type="text"
              placeholder="Search my tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '34px', width: '220px', height: '34px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', backgroundColor: 'var(--color-surface-low)', padding: '2px', borderRadius: 'var(--radius-base)' }}>
            {['all', 'todo', 'in_progress', 'in_review', 'done'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: statusFilter === st ? 'var(--color-surface-lowest)' : 'transparent',
                  color: statusFilter === st ? 'var(--color-on-surface)' : 'var(--color-outline)',
                  boxShadow: statusFilter === st ? 'var(--shadow-sm)' : 'none',
                  textTransform: 'capitalize',
                  transition: 'all 150ms ease',
                }}
              >
                {st === 'in_progress' ? 'In Progress' : st === 'in_review' ? 'In Review' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '30px' }}>
            <div className="skeleton" style={{ height: '40px', marginBottom: '12px' }} />
            <div className="skeleton" style={{ height: '40px', marginBottom: '12px' }} />
            <div className="skeleton" style={{ height: '40px' }} />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-outline)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-outline-variant)', marginBottom: '12px' }}>
              assignment_turned_in
            </span>
            <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-on-surface)' }}>No tasks found</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>
              {searchQuery || statusFilter !== 'all' ? 'Try adjusting your search or filters.' : 'You have no assigned tasks right now!'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Table Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 100px 1fr 140px 120px 120px',
                padding: '12px 18px',
                borderBottom: '1px solid var(--color-outline-variant)',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--color-outline)',
                textTransform: 'uppercase',
                backgroundColor: 'var(--color-surface-low)',
              }}
            >
              <span></span>
              <span>Key</span>
              <span>Title & Project</span>
              <span>Due Date</span>
              <span>Priority</span>
              <span>Status</span>
            </div>

            {/* Rows */}
            {filteredTasks.map((t) => (
              <div
                key={t._id}
                onClick={() => openDrawer(t._id, fetchMyTasks)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 100px 1fr 140px 120px 120px',
                  alignItems: 'center',
                  padding: '12px 18px',
                  borderBottom: '1px solid var(--color-surface-low)',
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-low)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div>
                  <button
                    onClick={(e) => handleToggleTask(t._id, t.status, e)}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      border: '1.5px solid var(--color-outline)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: t.status === 'done' ? 'var(--color-success)' : 'transparent',
                      borderColor: t.status === 'done' ? 'var(--color-success)' : 'var(--color-outline)',
                    }}
                  >
                    {t.status === 'done' && (
                      <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'white' }}>
                        check
                      </span>
                    )}
                  </button>
                </div>

                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary-container)' }}>
                  {t.key}
                </span>

                <div style={{ minWidth: 0, paddingRight: '16px' }}>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--color-on-surface)',
                      textDecoration: t.status === 'done' ? 'line-through' : 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.title}
                  </p>
                  <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
                    {t.project?.name}
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: t.status === 'done' ? 'var(--color-outline)' : 'var(--color-on-surface)' }}>
                  {t.dueDate ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-outline)' }}>calendar_today</span>
                      {new Date(t.dueDate).toLocaleDateString()}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--color-outline)' }}>—</span>
                  )}
                </div>

                <div>
                  <span className={`badge badge-${t.priority}`}>{t.priority}</span>
                </div>

                <div>
                  <span className={`badge badge-${t.status}`}>{t.status.replace('_', ' ')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
