import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../api/client';
import { ProjectModal } from '../components/ProjectModal';
import { useTaskDrawer } from '../context/TaskDrawerContext';
import { useToast } from '../context/ToastContext';

export const ProjectDetailPage = () => {
  const { id } = useParams();
  const { members = [], refreshShellData } = useOutletContext() || {};
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { openDrawer } = useTaskDrawer();
  const toast = useToast();
  const navigate = useNavigate();

  const fetchProjectData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [pRes, tRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/tasks?project=${id}`),
      ]);

      if (pRes.success) setProject(pRes.project);
      if (tRes.success) setTasks(tRes.tasks || []);
    } catch (error) {
      toast.error('Could not load project.');
      navigate('/projects');
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  const handleDeleteProject = async () => {
    if (!window.confirm(`Are you sure you want to delete "${project.name}" and all its tasks?`)) return;
    try {
      const res = await api.delete(`/projects/${project._id}`);
      if (res.success) {
        toast.success('Project deleted.');
        if (refreshShellData) refreshShellData();
        navigate('/projects');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to delete project.');
    }
  };

  if (isLoading || !project) {
    return (
      <div style={{ padding: '40px' }}>
        <div className="skeleton" style={{ height: '48px', width: '40%', marginBottom: '20px' }} />
        <div className="skeleton" style={{ height: '140px', width: '100%', marginBottom: '20px' }} />
      </div>
    );
  }

  const stats = project.stats || { total: 0, done: 0, inProgress: 0, inReview: 0, todo: 0, completionRate: 0 };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Project Banner */}
      <div className="card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-primary-fixed)',
                color: 'var(--color-primary-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>
                {project.icon || 'folder'}
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-outline)', fontWeight: 600 }}>
                  {project.key}
                </span>
                <span className="badge" style={{ backgroundColor: 'var(--color-surface-low)' }}>
                  {project.category}
                </span>
                <span className={`badge badge-${project.status}`}>
                  {project.status.replace('_', ' ')}
                </span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '26px', fontWeight: 700, marginTop: '4px' }}>
                {project.name}
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/projects/${project._id}/board`)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>view_kanban</span>
              <span>Open Kanban Board</span>
            </button>
            <button className="btn btn-secondary" onClick={() => setIsEditModalOpen(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
              <span>Edit</span>
            </button>
            <button className="btn btn-danger" onClick={handleDeleteProject} title="Delete Project">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
            </button>
          </div>
        </div>

        {project.description && (
          <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', lineHeight: 1.6, marginTop: '16px', maxWidth: '800px' }}>
            {project.description}
          </p>
        )}

        {/* Progress & Milestone Overview */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--color-outline-variant)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
            <span>Milestone Sprint Velocity</span>
            <span style={{ color: 'var(--color-primary-container)' }}>{stats.completionRate}% Done ({stats.done}/{stats.total} tasks)</span>
          </div>
          <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-surface-high)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${stats.completionRate}%`, height: '100%', backgroundColor: project.color || 'var(--color-primary-container)', transition: 'width 200ms ease' }} />
          </div>
        </div>
      </div>

      {/* Task Summary Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>To Do</span>
          <p style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-headline)', marginTop: '4px' }}>{stats.todo}</p>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center', backgroundColor: 'var(--color-primary-fixed)' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-primary)' }}>In Progress</span>
          <p style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-headline)', color: 'var(--color-primary)', marginTop: '4px' }}>{stats.inProgress}</p>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center', backgroundColor: 'var(--color-warning-bg)' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-warning)' }}>In Review</span>
          <p style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-headline)', color: 'var(--color-warning)', marginTop: '4px' }}>{stats.inReview}</p>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center', backgroundColor: 'var(--color-success-bg)' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-success)' }}>Completed</span>
          <p style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-headline)', color: 'var(--color-success)', marginTop: '4px' }}>{stats.done}</p>
        </div>
      </div>

      {/* Project Tasks Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '16px', fontWeight: 600 }}>Project Tasks ({tasks.length})</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/projects/${project._id}/board`)}>
            Switch to Kanban Board
          </button>
        </div>

        {tasks.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-outline)' }}>
            No tasks created in this project yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tasks.map((task) => (
              <div
                key={task._id}
                onClick={() => openDrawer(task._id, fetchProjectData)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--color-surface-low)',
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-low)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary-container)' }}>
                    {task.key}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-on-surface)' }}>
                    {task.title}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                  <span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span>
                  {task.assignee?.avatar ? (
                    <img src={task.assignee.avatar} alt={task.assignee.name} className="avatar avatar-sm" />
                  ) : (
                    <div className="avatar avatar-sm">{task.assignee?.name?.[0] || 'U'}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <ProjectModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        projectToEdit={project}
        members={members}
        onSuccess={() => {
          fetchProjectData();
          if (refreshShellData) refreshShellData();
        }}
      />
    </div>
  );
};
