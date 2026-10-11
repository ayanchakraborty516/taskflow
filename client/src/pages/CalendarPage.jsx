import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api/client';
import { useTaskDrawer } from '../context/TaskDrawerContext';
import { useToast } from '../context/ToastContext';

// Robust timezone-safe date key formatting (YYYY-MM-DD)
export const getLocalDateKey = (d) => {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
    return d.slice(0, 10);
  }
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const CalendarPage = () => {
  const { projects = [] } = useOutletContext() || {};
  const [tasks, setTasks] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const { openDrawer } = useTaskDrawer();
  const toast = useToast();

  const fetchCalendarTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/tasks');
      if (res.success) {
        setTasks(res.tasks || []);
      }
    } catch (error) {
      toast.error('Failed to load tasks for calendar.');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCalendarTasks();
  }, [fetchCalendarTasks]);

  // Calendar math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Calendar grid squares
  const calendarCells = [];

  // Trailing days from previous month
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    calendarCells.push({
      dayNum,
      isCurrentMonth: false,
      date: new Date(year, month - 1, dayNum),
    });
  }

  // Days in current month
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({
      dayNum: i,
      isCurrentMonth: true,
      date: new Date(year, month, i),
    });
  }

  // Next month days to fill remaining slots (up to 35 or 42)
  const remainingSlots = 42 - calendarCells.length;
  for (let i = 1; i <= remainingSlots; i++) {
    calendarCells.push({
      dayNum: i,
      isCurrentMonth: false,
      date: new Date(year, month + 1, i),
    });
  }

  const isToday = (date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Filter tasks by project and status
  const filteredTasks = tasks.filter((t) => {
    if (selectedProject !== 'all' && (t.project?._id || t.project) !== selectedProject) {
      return false;
    }
    if (selectedStatus !== 'all' && t.status !== selectedStatus) {
      return false;
    }
    return true;
  });

  const getTasksForDate = (date) => {
    const cellKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return filteredTasks.filter((t) => {
      if (!t.dueDate) return false;
      return getLocalDateKey(t.dueDate) === cellKey;
    });
  };

  const tasksWithDueDatesThisMonth = filteredTasks.filter((t) => {
    if (!t.dueDate) return false;
    const dateKey = getLocalDateKey(t.dueDate);
    const [y, m] = dateKey.split('-').map(Number);
    return y === year && m === month + 1;
  });

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header and Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '28px', fontWeight: 700 }}>
            Deliverables Calendar
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
            Schedule and milestones across workspace projects • {tasksWithDueDatesThisMonth.length} scheduled in {monthNames[month]}
          </p>
        </div>

        {/* Toolbar with Navigation and Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Project Filter */}
          <select
            className="form-select"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', backgroundColor: 'var(--color-surface-lowest)', border: '1px solid var(--color-outline-variant)' }}
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            className="form-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', backgroundColor: 'var(--color-surface-lowest)', border: '1px solid var(--color-outline-variant)' }}
          >
            <option value="all">All Statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="in_review">In Review</option>
            <option value="done">Done</option>
          </select>

          {(selectedProject !== 'all' || selectedStatus !== 'all') && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSelectedProject('all');
                setSelectedStatus('all');
              }}
              style={{ fontSize: '12px' }}
            >
              Clear Filters
            </button>
          )}

          {/* Month Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--color-surface-lowest)', padding: '4px 8px', borderRadius: 'var(--radius-base)', border: '1px solid var(--color-outline-variant)' }}>
            <button className="btn btn-ghost btn-sm" onClick={prevMonth} style={{ padding: '4px' }} title="Previous month">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
            </button>
            <span style={{ fontSize: '14px', fontWeight: 600, minWidth: '140px', textAlign: 'center' }}>
              {monthNames[month]} {year}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={nextMonth} style={{ padding: '4px' }} title="Next month">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
            </button>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={goToToday}>
            Today
          </button>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Days of week header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', backgroundColor: 'var(--color-surface-low)', borderBottom: '1px solid var(--color-outline-variant)', textAlign: 'center', padding: '10px 0', fontSize: '12px', fontWeight: 600, color: 'var(--color-outline)', textTransform: 'uppercase' }}>
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Calendar Cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(115px, 1fr)' }}>
          {calendarCells.map((cell, idx) => {
            const cellTasks = getTasksForDate(cell.date);
            const today = isToday(cell.date);

            return (
              <div
                key={idx}
                style={{
                  borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--color-surface-low)' : 'none',
                  borderBottom: idx < 35 ? '1px solid var(--color-surface-low)' : 'none',
                  padding: '8px',
                  backgroundColor: cell.isCurrentMonth ? 'var(--color-surface-lowest)' : 'var(--color-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  minHeight: '115px',
                  transition: 'background-color 150ms ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: today ? 700 : 500,
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: today ? 'var(--color-primary-container)' : 'transparent',
                      color: today ? 'white' : cell.isCurrentMonth ? 'var(--color-on-surface)' : 'var(--color-outline)',
                    }}
                  >
                    {cell.dayNum}
                  </span>
                  {cellTasks.length > 0 && (
                    <span style={{ fontSize: '10px', color: 'var(--color-outline)', fontWeight: 600 }}>
                      {cellTasks.length} {cellTasks.length === 1 ? 'task' : 'tasks'}
                    </span>
                  )}
                </div>

                {/* Tasks chips on this day */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', maxHeight: '85px' }}>
                  {cellTasks.map((t) => (
                    <div
                      key={t._id}
                      onClick={() => openDrawer(t._id, fetchCalendarTasks)}
                      style={{
                        padding: '4px 6px',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: '11px',
                        fontWeight: 500,
                        backgroundColor:
                          t.status === 'done' ? 'var(--color-success-bg)' :
                          t.priority === 'urgent' ? 'var(--color-danger-bg)' : 'var(--color-primary-fixed)',
                        color:
                          t.status === 'done' ? 'var(--color-success)' :
                          t.priority === 'urgent' ? 'var(--color-danger)' : 'var(--color-primary)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'transform 100ms ease',
                      }}
                      title={`${t.key}: ${t.title} (${t.status.replace('_', ' ')})`}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{t.key}:</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
