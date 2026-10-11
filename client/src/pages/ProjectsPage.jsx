import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../api/client';
import { ProjectModal } from '../components/ProjectModal';
import { useToast } from '../context/ToastContext';

export const ProjectsPage = () => {
  const { members = [], refreshShellData } = useOutletContext() || {};
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState(null);
  const toast = useToast();
  const navigate = useNavigate();

  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (statusFilter !== 'all') queryParams.append('status', statusFilter);
      if (categoryFilter !== 'all') queryParams.append('category', categoryFilter);

      const res = await api.get(`/projects?${queryParams.toString()}`);
      if (res.success) {
        setProjects(res.projects || []);
      }
    } catch (error) {
      toast.error('Failed to load projects.');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, categoryFilter, toast]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateSuccess = () => {
    fetchProjects();
    if (refreshShellData) refreshShellData();
  };

  // Metrics calculation
  const totalProjects = projects.length;
  const inProgressProjects = projects.filter((p) => p.status === 'in_progress').length;
  const completedProjects = projects.filter((p) => p.status === 'completed').length;
  const avgCompletion =
    totalProjects > 0
      ? Math.round(
          projects.reduce((acc, p) => acc + (p.stats?.completionRate || 0), 0) / totalProjects
        )
      : 0;

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '28px', fontWeight: 700 }}>Projects</h1>
            <span className="badge" style={{ backgroundColor: 'var(--color-secondary-container)', color: 'var(--color-secondary)', fontSize: '12px' }}>
              {inProgressProjects} active
            </span>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
            Manage, track milestones, and view velocity across all team initiatives.
          </p>
        </div>

        {/* View Toggle & New Project Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--color-surface-high)', padding: '2px', borderRadius: 'var(--radius-base)' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: '6px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: viewMode === 'grid' ? 'var(--color-surface-lowest)' : 'transparent',
                color: viewMode === 'grid' ? 'var(--color-primary-container)' : 'var(--color-outline)',
                boxShadow: viewMode === 'grid' ? 'var(--shadow-sm)' : 'none',
              }}
              title="Grid View"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>grid_view</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '6px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: viewMode === 'list' ? 'var(--color-surface-lowest)' : 'transparent',
                color: viewMode === 'list' ? 'var(--color-primary-container)' : 'var(--color-outline)',
                boxShadow: viewMode === 'list' ? 'var(--shadow-sm)' : 'none',
              }}
              title="List View"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>view_list</span>
            </button>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => {
              setProjectToEdit(null);
              setIsModalOpen(true);
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--color-outline)', textTransform: 'uppercase', fontWeight: 600 }}>Active Sprints</span>
            <p style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-headline)', marginTop: '2px' }}>{inProgressProjects}</p>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: 'var(--color-surface-low)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary-container)' }}>
            <span className="material-symbols-outlined">rocket_launch</span>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--color-outline)', textTransform: 'uppercase', fontWeight: 600 }}>Avg Completion</span>
            <p style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-headline)', marginTop: '2px' }}>{avgCompletion}%</p>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: 'var(--color-secondary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-secondary)' }}>
            <span className="material-symbols-outlined">donut_large</span>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--color-outline)', textTransform: 'uppercase', fontWeight: 600 }}>Delivered</span>
            <p style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-headline)', marginTop: '2px' }}>{completedProjects}</p>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: 'var(--color-secondary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-secondary)' }}>
            <span className="material-symbols-outlined">task_alt</span>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--color-outline)', textTransform: 'uppercase', fontWeight: 600 }}>Total Projects</span>
            <p style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-headline)', marginTop: '2px' }}>{totalProjects}</p>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: 'var(--color-tertiary-fixed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-tertiary)' }}>
            <span className="material-symbols-outlined">flag</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '8px', fontSize: '18px', color: 'var(--color-outline)' }}>
            search
          </span>
          <input
            type="text"
            className="form-input"
            placeholder="Search projects by name, key, or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '34px', height: '34px', fontSize: '13px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 'auto', padding: '6px 10px', fontSize: '13px', backgroundColor: 'var(--color-surface-low)' }}
          >
            <option value="all">Status: All</option>
            <option value="in_progress">In Progress</option>
            <option value="planning">Planning</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>

          <select
            className="form-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: 'auto', padding: '6px 10px', fontSize: '13px', backgroundColor: 'var(--color-surface-low)' }}
          >
            <option value="all">Category: All</option>
            <option value="Design & Eng">Design & Eng</option>
            <option value="Product">Product</option>
            <option value="Engineering">Engineering</option>
            <option value="Marketing">Marketing</option>
          </select>

          {(search || statusFilter !== 'all' || categoryFilter !== 'all') && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setCategoryFilter('all');
              }}
              title="Reset filters"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>restart_alt</span>
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Projects Display: Grid or List */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          <div className="card skeleton" style={{ height: '220px' }} />
          <div className="card skeleton" style={{ height: '220px' }} />
          <div className="card skeleton" style={{ height: '220px' }} />
        </div>
      ) : projects.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--color-outline)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-outline-variant)', marginBottom: '12px' }}>
            folder_off
          </span>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-on-surface)' }}>No projects found</h3>
          <p style={{ fontSize: '14px', marginTop: '4px' }}>
            {search || statusFilter !== 'all' ? 'Try adjusting your search criteria.' : 'Create your first project to begin organizing sprints!'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {projects.map((project) => (
            <div
              key={project._id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                gap: '16px',
              }}
              onClick={() => navigate(`/projects/${project._id}`)}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span className="badge" style={{ backgroundColor: 'var(--color-surface-low)', color: 'var(--color-on-surface-variant)' }}>
                    {project.category}
                  </span>
                  <span
                    className="badge"
                    style={{
                      backgroundColor:
                        project.status === 'completed' ? 'var(--color-secondary-container)' :
                        project.status === 'in_progress' ? 'var(--color-primary-fixed)' : 'var(--color-surface-low)',
                      color:
                        project.status === 'completed' ? 'var(--color-secondary)' :
                        project.status === 'in_progress' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                    }}
                  >
                    {project.status.replace('_', ' ')}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--color-primary-fixed)',
                      color: 'var(--color-primary-container)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                      {project.icon || 'folder'}
                    </span>
                  </div>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '16px', fontWeight: 600, color: 'var(--color-on-surface)' }}>
                      {project.name}
                    </h3>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-outline)', fontWeight: 600 }}>
                      {project.key}
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', lineHeight: 1.5, marginTop: '10px', height: '40px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {project.description || 'No project description provided.'}
                </p>
              </div>

              {/* Progress Bar & Footer */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  <span style={{ color: 'var(--color-outline)' }}>Completion</span>
                  <span style={{ color: 'var(--color-primary-container)' }}>{project.stats?.completionRate || 0}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--color-surface-high)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${project.stats?.completionRate || 0}%`,
                      height: '100%',
                      backgroundColor: project.color || 'var(--color-primary-container)',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--color-surface-low)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {project.lead?.avatar ? (
                      <img src={project.lead.avatar} alt={project.lead.name} className="avatar avatar-sm" />
                    ) : (
                      <div className="avatar avatar-sm">{project.lead?.name?.[0] || 'L'}</div>
                    )}
                    <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>
                      {project.stats?.total || 0} tasks
                    </span>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/projects/${project._id}/board`);
                    }}
                  >
                    <span>Board</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List Mode */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 2fr 140px 140px 140px 120px',
              padding: '12px 18px',
              borderBottom: '1px solid var(--color-outline-variant)',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-outline)',
              textTransform: 'uppercase',
              backgroundColor: 'var(--color-surface-low)',
            }}
          >
            <span>Key</span>
            <span>Project Name</span>
            <span>Category</span>
            <span>Status</span>
            <span>Progress</span>
            <span>Actions</span>
          </div>

          {projects.map((p) => (
            <div
              key={p._id}
              onClick={() => navigate(`/projects/${p._id}`)}
              style={{
                display: 'grid',
                gridTemplateColumns: '80px 2fr 140px 140px 140px 120px',
                alignItems: 'center',
                padding: '12px 18px',
                borderBottom: '1px solid var(--color-surface-low)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-low)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary-container)' }}>
                {p.key}
              </span>
              <div>
                <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-on-surface)' }}>{p.name}</p>
                <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>{p.stats?.total || 0} tasks</span>
              </div>
              <span style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>{p.category}</span>
              <div>
                <span className={`badge badge-${p.status}`}>{p.status.replace('_', ' ')}</span>
              </div>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{p.stats?.completionRate || 0}%</span>
                <div style={{ width: '80px', height: '4px', backgroundColor: 'var(--color-surface-high)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                  <div style={{ width: `${p.stats?.completionRate || 0}%`, height: '100%', backgroundColor: p.color || 'var(--color-primary-container)' }} />
                </div>
              </div>
              <div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/projects/${p._id}/board`);
                  }}
                >
                  Board
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Project Modal */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projectToEdit={projectToEdit}
        members={members}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
};
