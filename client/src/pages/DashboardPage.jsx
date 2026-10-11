import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTaskDrawer } from '../context/TaskDrawerContext';
import { useToast } from '../context/ToastContext';

export const DashboardPage = () => {
  const { user, currentWorkspace } = useAuth();
  const { openDrawer } = useTaskDrawer();
  const { projects = [] } = useOutletContext() || {};
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('all');
  const toast = useToast();
  const navigate = useNavigate();

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/dashboard');
      if (res.success) {
        setData(res);
      }
    } catch (error) {
      toast.error('Failed to load dashboard metrics.');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, currentWorkspace]);

  const handleToggleTaskStatus = async (taskId, currentStatus, e) => {
    e.stopPropagation();
    try {
      const newStatus = currentStatus === 'done' ? 'todo' : 'done';
      await api.put(`/tasks/${taskId}`, { status: newStatus });
      toast.success(newStatus === 'done' ? 'Task marked as done!' : 'Task reopened.');
      fetchDashboardData();
    } catch (err) {
      toast.error('Could not update task status.');
    }
  };

  const summary = data?.summary || {
    activeProjectsCount: 0,
    myTasksCount: 0,
    myTasksDueToday: 0,
    myTasksInProgress: 0,
    completedTasksCount: 0,
    completedThisWeek: 0,
    overdueCount: 0,
    velocityRate: 0,
    totalTasksCount: 0,
    statusCounts: { todo: 0, in_progress: 0, in_review: 0, done: 0 },
  };

  const priorityTasks = (data?.priorityTasks || []).filter((task) => {
    if (selectedProjectFilter === 'all') return true;
    return task.project?._id === selectedProjectFilter;
  });

  const upcomingDeadlines = data?.upcomingDeadlines || [];
  const completionChart = data?.completionChart || [];
  const recentActivity = data?.recentActivity || [];
  const activeProjects = data?.activeProjects || [];

  const maxCompleted = Math.max(1, ...completionChart.map((c) => c.completed || 0));

  const formatRelativeDue = (dueDate) => {
    if (!dueDate) return { label: 'No date', isUrgent: false };
    const due = new Date(dueDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const diffDays = Math.round((dueDay - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { label: 'Due today', isUrgent: true };
    if (diffDays === 1) return { label: 'Due tomorrow', isUrgent: false };
    if (diffDays > 1 && diffDays <= 7) return { label: `In ${diffDays} days`, isUrgent: false };
    return {
      label: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isUrgent: false,
    };
  };

  const isFirstUse = summary.activeProjectsCount === 0 && (summary.totalTasksCount || 0) === 0;

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Greeting & Context Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            <span>{currentWorkspace?.name || 'Workspace'}</span>
            <span>/</span>
            <span style={{ color: 'var(--color-primary-container)' }}>Sprint Overview</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '28px', fontWeight: 700, color: 'var(--color-on-surface)', marginTop: '4px' }}>
            Good day, {user?.name?.split(' ')[0] || 'Team'} 👋
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
            Live performance, team assignments, and upcoming milestones for {currentWorkspace?.name || 'your workspace'}.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-base)',
              backgroundColor: 'var(--color-surface-low)',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-primary-container)' }}>
              calendar_today
            </span>
            <span>Today, {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>

          <select
            className="form-select"
            value={selectedProjectFilter}
            onChange={(e) => setSelectedProjectFilter(e.target.value)}
            style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', backgroundColor: 'var(--color-surface-lowest)', border: '1px solid var(--color-outline-variant)' }}
          >
            <option value="all">Filter: All Projects</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>

          <button className="btn btn-primary btn-sm" onClick={() => navigate('/projects')}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>bolt</span>
            <span>Sprint Projects</span>
          </button>
        </div>
      </div>

      {/* First-Use Onboarding Hero Banner */}
      {isFirstUse && !isLoading && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, var(--color-surface-lowest) 0%, var(--color-primary-fixed) 100%)',
            border: '1.5px dashed var(--color-primary)',
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--color-primary-container)' }}>
              rocket_launch
            </span>
            <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '20px', fontWeight: 700 }}>
              Welcome to your new TaskFlow workspace!
            </h2>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', maxWidth: '720px', lineHeight: 1.5 }}>
            You haven't added any projects or tasks yet. TaskFlow gives your team Kanban boards, calendar milestones, threaded discussion comments, and real-time delivery notifications.
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/projects')}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
              <span>Create Your First Project</span>
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/calendar')}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>calendar_month</span>
              <span>View Calendar</span>
            </button>
          </div>
        </div>
      )}

      {/* 4-Column Metric Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {/* Card 1: Active Projects */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '140px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-on-surface-variant)' }}>
              Active Projects
            </span>
            <div style={{ padding: '6px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-surface-low)', color: 'var(--color-primary-container)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>folder_open</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-headline)', fontSize: '32px', fontWeight: 700 }} className="tabular">
                {summary.activeProjectsCount}
              </span>
              <span className="badge" style={{ backgroundColor: 'var(--color-secondary-container)', color: 'var(--color-secondary)', marginLeft: '8px' }}>
                {summary.activeProjectsCount > 0 ? 'Active' : 'Get Started'}
              </span>
            </div>
            <svg width="60" height="26" viewBox="0 0 64 28" fill="none" style={{ color: 'var(--color-secondary)' }}>
              <path d="M2 24L14 18L26 21L38 12L50 15L62 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Card 2: Assigned Tasks */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '140px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-on-surface-variant)' }}>
              Assigned to Me
            </span>
            <div style={{ padding: '6px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-surface-low)', color: 'var(--color-primary-container)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>assignment_turned_in</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-headline)', fontSize: '32px', fontWeight: 700 }} className="tabular">
                {summary.myTasksCount}
              </span>
              <span className="badge" style={{ backgroundColor: 'var(--color-primary-fixed)', color: 'var(--color-primary)', marginLeft: '8px' }}>
                {summary.myTasksDueToday} due today
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
              {summary.myTasksInProgress} in progress
            </span>
          </div>
        </div>

        {/* Card 3: Completed Tasks */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '140px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-on-surface-variant)' }}>
              Completed Tasks
            </span>
            <div style={{ padding: '6px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-secondary-container)', color: 'var(--color-secondary)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-headline)', fontSize: '32px', fontWeight: 700 }} className="tabular">
                {summary.completedTasksCount || summary.completedThisWeek}
              </span>
              <span className="badge" style={{ backgroundColor: 'var(--color-secondary-container)', color: 'var(--color-secondary)', marginLeft: '8px' }}>
                {summary.velocityRate}% velocity
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--color-secondary)', fontWeight: 600 }}>
              {summary.completedThisWeek} this week
            </span>
          </div>
        </div>

        {/* Card 4: Overdue Tasks */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '140px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-on-surface-variant)' }}>
              Overdue Tasks
            </span>
            <div style={{ padding: '6px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>warning</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-headline)', fontSize: '32px', fontWeight: 700 }} className="tabular">
                {summary.overdueCount}
              </span>
              <span className="badge badge-urgent" style={{ marginLeft: '8px' }}>
                {summary.overdueCount > 0 ? 'Needs attention' : 'None overdue'}
              </span>
            </div>
            <span style={{ fontSize: '12px', color: summary.overdueCount > 0 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 500 }}>
              {summary.overdueCount > 0 ? 'Escalate' : 'All clear'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Workspace Split: 8 Cols vs 4 Cols */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px', alignItems: 'flex-start' }}>
        {/* Left Section (8 cols) */}
        <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Priority Tasks Table Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-primary-container)' }}>
                  task_alt
                </span>
                <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '18px', fontWeight: 600 }}>
                  Priority Tasks
                </h2>
                <span className="badge" style={{ backgroundColor: 'var(--color-surface-container)' }}>
                  {priorityTasks.length} active
                </span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/my-tasks')}>
                View All My Tasks
              </button>
            </div>

            {priorityTasks.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--color-outline)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--color-outline-variant)', marginBottom: '8px' }}>
                  task
                </span>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-on-surface)' }}>No active priority tasks found</p>
                <p style={{ fontSize: '12px', marginTop: '2px' }}>All tasks are either completed or no tasks match the selected project filter.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {priorityTasks.map((t) => (
                  <div
                    key={t._id}
                    onClick={() => openDrawer(t._id, fetchDashboardData)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-base)',
                      backgroundColor: 'var(--color-surface-low)',
                      cursor: 'pointer',
                      transition: 'background-color 150ms ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-container)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-low)')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <button
                        onClick={(e) => handleToggleTaskStatus(t._id, t.status, e)}
                        style={{
                          width: '20px',
                          height: '20px',
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
                          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'white' }}>
                            check
                          </span>
                        )}
                      </button>

                      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-on-surface)', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>
                          {t.title}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '12px', color: 'var(--color-outline)' }}>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{t.key}</span>
                          <span>•</span>
                          <span>{t.project?.name}</span>
                          {t.labels?.[0] && (
                            <>
                              <span>•</span>
                              <span className="badge" style={{ fontSize: '10px', padding: '1px 5px' }}>#{t.labels[0]}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className={`badge badge-${t.priority}`}>
                        {t.priority}
                      </span>
                      {t.assignee?.avatar ? (
                        <img src={t.assignee.avatar} alt={t.assignee.name} className="avatar avatar-sm" />
                      ) : (
                        <div className="avatar avatar-sm">{t.assignee?.name?.[0] || 'U'}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Meaningful Completion Chart (7-day velocity) */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '16px', fontWeight: 600 }}>
                  Completion Velocity (Last 7 Days)
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--color-outline)', marginTop: '2px' }}>
                  Daily task completion volume based on actual workspace records
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge" style={{ backgroundColor: 'var(--color-secondary-container)', color: 'var(--color-secondary)' }}>
                  {summary.completedThisWeek} completed
                </span>
                <span className="badge" style={{ backgroundColor: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                  {summary.velocityRate}% velocity
                </span>
              </div>
            </div>

            {/* Visual Bar Chart */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px', alignItems: 'flex-end', height: '140px', padding: '10px 0 0' }}>
              {completionChart.map((item, idx) => {
                const heightPercent = maxCompleted > 0 ? Math.max(12, Math.round((item.completed / maxCompleted) * 100)) : 12;
                const isToday = idx === completionChart.length - 1;

                return (
                  <div
                    key={item.date || idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: '100%',
                      justifyContent: 'flex-end',
                      gap: '8px',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 600, color: item.completed > 0 ? 'var(--color-on-surface)' : 'var(--color-outline)' }}>
                      {item.completed}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '44px',
                        height: `${heightPercent}%`,
                        borderRadius: 'var(--radius-sm)',
                        background: item.completed > 0
                          ? (isToday ? 'var(--color-primary)' : 'var(--color-secondary)')
                          : 'var(--color-surface-high)',
                        transition: 'height 300ms ease, background-color 200ms ease',
                      }}
                      title={`${item.day} (${item.date}): ${item.completed} task${item.completed === 1 ? '' : 's'} completed`}
                    />
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}>
                        {item.day}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status Breakdown Distribution */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
              Workspace Status Distribution
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', textAlign: 'center' }}>
              <div style={{ padding: '14px', borderRadius: 'var(--radius-base)', backgroundColor: 'var(--color-surface-low)' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>To Do</span>
                <p style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)', marginTop: '4px' }}>
                  {summary.statusCounts.todo}
                </p>
              </div>
              <div style={{ padding: '14px', borderRadius: 'var(--radius-base)', backgroundColor: 'var(--color-primary-fixed)' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-primary)' }}>In Progress</span>
                <p style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-headline)', color: 'var(--color-primary)', marginTop: '4px' }}>
                  {summary.statusCounts.in_progress}
                </p>
              </div>
              <div style={{ padding: '14px', borderRadius: 'var(--radius-base)', backgroundColor: 'var(--color-warning-bg)' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-warning)' }}>In Review</span>
                <p style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-headline)', color: 'var(--color-warning)', marginTop: '4px' }}>
                  {summary.statusCounts.in_review}
                </p>
              </div>
              <div style={{ padding: '14px', borderRadius: 'var(--radius-base)', backgroundColor: 'var(--color-success-bg)' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-success)' }}>Done</span>
                <p style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-headline)', color: 'var(--color-success)', marginTop: '4px' }}>
                  {summary.statusCounts.done}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section (4 cols) */}
        <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Upcoming Deadlines Widget */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-primary-container)' }}>
                  event_upcoming
                </span>
                <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '16px', fontWeight: 600 }}>Upcoming Deadlines</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/calendar')}>Calendar</button>
            </div>

            {upcomingDeadlines.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-outline)', fontSize: '13px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--color-outline-variant)', marginBottom: '6px' }}>
                  alarm_on
                </span>
                <p style={{ fontWeight: 500, color: 'var(--color-on-surface)' }}>No upcoming deadlines</p>
                <p style={{ fontSize: '11px', marginTop: '2px' }}>All scheduled deliverables are completed or on track.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {upcomingDeadlines.map((t) => {
                  const relDue = formatRelativeDue(t.dueDate);
                  return (
                    <div
                      key={t._id}
                      onClick={() => openDrawer(t._id, fetchDashboardData)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-base)',
                        backgroundColor: 'var(--color-surface-low)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        transition: 'background-color 150ms ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-container)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-low)')}
                    >
                      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.title}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-outline)' }}>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{t.key}</span>
                          <span>•</span>
                          <span>{t.project?.name}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                        <span
                          className="badge"
                          style={{
                            fontSize: '11px',
                            backgroundColor: relDue.isUrgent ? 'var(--color-danger-bg)' : 'var(--color-primary-fixed)',
                            color: relDue.isUrgent ? 'var(--color-danger)' : 'var(--color-primary)',
                          }}
                        >
                          {relDue.label}
                        </span>
                        <span className={`badge badge-${t.priority}`} style={{ fontSize: '10px', padding: '1px 5px' }}>
                          {t.priority}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Projects Widget */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '16px', fontWeight: 600 }}>Active Projects</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}>View All</button>
            </div>

            {activeProjects.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-outline)', fontSize: '13px' }}>
                No active projects found.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeProjects.map((p) => (
                  <div
                    key={p._id}
                    onClick={() => navigate(`/projects/${p._id}`)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-base)',
                      backgroundColor: 'var(--color-surface-low)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{p.name}</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-primary-container)' }}>
                        {p.progress}%
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--color-surface-high)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${p.progress}%`, height: '100%', backgroundColor: p.color || 'var(--color-primary-container)' }} />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
                      {p.taskCount} tasks • {p.category}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity Feed */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '16px', fontWeight: 600, marginBottom: '14px' }}>
              Recent Activity
            </h3>

            {recentActivity.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-outline)', fontSize: '13px' }}>
                No recent activity recorded yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {recentActivity.map((a) => (
                  <div key={a._id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    {a.user?.avatar ? (
                      <img src={a.user.avatar} alt={a.user.name} className="avatar avatar-sm" style={{ marginTop: '2px' }} />
                    ) : (
                      <div className="avatar avatar-sm" style={{ marginTop: '2px' }}>{a.user?.name?.[0] || 'U'}</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', color: 'var(--color-on-surface)', lineHeight: 1.4 }}>
                        {a.details}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--color-outline)', marginTop: '2px' }}>
                        {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(a.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
