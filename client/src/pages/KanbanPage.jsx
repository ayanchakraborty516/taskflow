import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../api/client';
import { TaskModal } from '../components/TaskModal';
import { useTaskDrawer } from '../context/TaskDrawerContext';
import { useToast } from '../context/ToastContext';

const COLUMNS = [
  { id: 'todo', title: 'To Do', color: 'var(--color-outline)' },
  { id: 'in_progress', title: 'In Progress', color: 'var(--color-primary-container)' },
  { id: 'in_review', title: 'In Review', color: 'var(--color-warning)' },
  { id: 'done', title: 'Done', color: 'var(--color-success)' },
];

// Sortable Task Card
const SortableTaskCard = ({ task, columnId, onOpenDrawer, onQuickShift }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id,
    data: { task, columnId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    cursor: 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="task-card"
      onClick={() => onOpenDrawer(task._id)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-outline)', fontWeight: 600 }}>
          {task.key}
        </span>
        <span className={`badge badge-${task.priority}`} style={{ fontSize: '10px' }}>
          {task.priority}
        </span>
      </div>

      <p
        style={{
          fontFamily: 'var(--font-headline)',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--color-on-surface)',
          lineHeight: 1.4,
          marginBottom: '8px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {task.title}
      </p>

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {task.labels.slice(0, 3).map((lbl) => (
            <span
              key={lbl}
              className="badge"
              style={{ backgroundColor: 'var(--color-surface-container)', fontSize: '10px', padding: '1px 5px' }}
            >
              #{lbl}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--color-surface-low)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--color-outline)' }}>
          {task.dueDate && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>calendar_today</span>
              {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.subtasks?.length > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>checklist</span>
              {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Quick shift column dropdown */}
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ position: 'relative', display: 'inline-block' }}
          >
            <select
              value={task.status}
              onChange={(e) => onQuickShift(task._id, e.target.value, e)}
              style={{
                fontSize: '10px',
                backgroundColor: 'var(--color-surface-low)',
                borderRadius: '4px',
                padding: '2px 4px',
                border: 'none',
                color: 'var(--color-outline)',
                cursor: 'pointer',
              }}
              title="Quick change status"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Prog</option>
              <option value="in_review">Review</option>
              <option value="done">Done</option>
            </select>
          </div>

          {task.assignee?.avatar ? (
            <img src={task.assignee.avatar} alt={task.assignee.name} className="avatar avatar-sm" style={{ width: '22px', height: '22px' }} />
          ) : (
            <div className="avatar avatar-sm" style={{ width: '22px', height: '22px', fontSize: '9px' }}>
              {task.assignee?.name?.[0] || 'U'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Pure card for DragOverlay
const DragOverlayCard = ({ task }) => {
  if (!task) return null;
  return (
    <div
      className="task-card"
      style={{
        boxShadow: 'var(--shadow-xl)',
        cursor: 'grabbing',
        transform: 'rotate(2deg)',
        backgroundColor: 'var(--color-surface-lowest)',
        border: '1px solid var(--color-primary-container)',
        width: '280px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-outline)', fontWeight: 600 }}>
          {task.key}
        </span>
        <span className={`badge badge-${task.priority}`} style={{ fontSize: '10px' }}>
          {task.priority}
        </span>
      </div>
      <p style={{ fontFamily: 'var(--font-headline)', fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface)' }}>
        {task.title}
      </p>
    </div>
  );
};

// Droppable Column Component
const KanbanColumn = ({ column, tasks, onAddTask, onOpenDrawer, onQuickShift }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { columnId: column.id },
  });

  const taskIds = useMemo(() => tasks.map((t) => t._id), [tasks]);

  return (
    <div
      ref={setNodeRef}
      className="kanban-column"
      style={{
        backgroundColor: isOver ? 'var(--color-surface-container)' : undefined,
        transition: 'background-color 150ms ease',
      }}
    >
      {/* Column Header */}
      <div className="kanban-column-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: column.color }} />
          <span style={{ fontFamily: 'var(--font-headline)', fontSize: '14px', fontWeight: 600 }}>
            {column.title}
          </span>
          <span className="badge" style={{ backgroundColor: 'var(--color-surface-high)', fontSize: '11px' }}>
            {tasks.length}
          </span>
        </div>

        <button
          onClick={() => onAddTask(column.id)}
          style={{ color: 'var(--color-outline)', padding: '2px' }}
          title={`Add task to ${column.title}`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
        </button>
      </div>

      {/* Task Cards List with SortableContext */}
      <div className="kanban-tasks-list">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard
              key={task._id}
              task={task}
              columnId={column.id}
              onOpenDrawer={onOpenDrawer}
              onQuickShift={onQuickShift}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div
            style={{
              padding: '24px 12px',
              textAlign: 'center',
              color: 'var(--color-outline)',
              fontSize: '12px',
              border: '1px dashed var(--color-outline-variant)',
              borderRadius: 'var(--radius-base)',
              margin: '4px 0',
            }}
          >
            No issues in {column.title}
          </div>
        )}

        {/* Add task button */}
        <button
          onClick={() => onAddTask(column.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            width: '100%',
            padding: '8px',
            borderRadius: 'var(--radius-base)',
            color: 'var(--color-outline)',
            fontSize: '13px',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-surface-container)';
            e.currentTarget.style.color = 'var(--color-on-surface)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--color-outline)';
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
          <span>Add task</span>
        </button>
      </div>
    </div>
  );
};

// Alternative List View
const KanbanListView = ({ tasks, onOpenDrawer, onQuickShift, onAddTask }) => {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '80px 2fr 130px 110px 120px 140px',
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
        <span>Title</span>
        <span>Status</span>
        <span>Priority</span>
        <span>Due Date</span>
        <span>Assignee</span>
      </div>

      {tasks.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-outline)' }}>
          No tasks found matching your filter criteria.
        </div>
      ) : (
        tasks.map((task) => (
          <div
            key={task._id}
            onClick={() => onOpenDrawer(task._id)}
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 2fr 130px 110px 120px 140px',
              alignItems: 'center',
              padding: '12px 18px',
              borderBottom: '1px solid var(--color-surface-low)',
              cursor: 'pointer',
              transition: 'background-color 150ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-low)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary-container)' }}>
              {task.key}
            </span>

            <div>
              <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-on-surface)' }}>
                {task.title}
              </p>
              {task.labels && task.labels.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                  {task.labels.map((l) => (
                    <span key={l} style={{ fontSize: '10px', color: 'var(--color-outline)' }}>#{l}</span>
                  ))}
                </div>
              )}
            </div>

            <div onClick={(e) => e.stopPropagation()}>
              <select
                value={task.status}
                onChange={(e) => onQuickShift(task._id, e.target.value, e)}
                className="form-select"
                style={{ height: '28px', padding: '2px 8px', fontSize: '12px', width: 'auto' }}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <span className={`badge badge-${task.priority}`} style={{ fontSize: '11px' }}>
                {task.priority}
              </span>
            </div>

            <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>
              {task.dueDate ? new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—'}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {task.assignee?.avatar ? (
                <img src={task.assignee.avatar} alt={task.assignee.name} className="avatar avatar-sm" style={{ width: '24px', height: '24px' }} />
              ) : (
                <div className="avatar avatar-sm" style={{ width: '24px', height: '24px', fontSize: '10px' }}>
                  {task.assignee?.name?.[0] || 'U'}
                </div>
              )}
              <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                {task.assignee?.name || 'Unassigned'}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export const KanbanPage = () => {
  const { id } = useParams();
  const { projects = [], members = [] } = useOutletContext() || {};
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('board'); // 'board' | 'list'
  const [filterQuery, setFilterQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [modalDefaultStatus, setModalDefaultStatus] = useState('todo');
  const [activeTask, setActiveTask] = useState(null);

  const { openDrawer } = useTaskDrawer();
  const toast = useToast();
  const navigate = useNavigate();

  // Pointer sensor with activation constraint to distinguish click from drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const fetchBoardData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [pRes, tRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/tasks?project=${id}`),
      ]);

      if (pRes.success) setProject(pRes.project);
      if (tRes.success) setTasks(tRes.tasks || []);
    } catch (error) {
      toast.error('Could not load board.');
    } finally {
      setIsLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchBoardData();
  }, [fetchBoardData]);

  // Quick shift column handler
  const handleQuickShift = async (taskId, targetStatus, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const previousTasks = [...tasks];

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: targetStatus } : t))
    );

    try {
      await api.post(`/tasks/${taskId}/move`, { status: targetStatus });
      toast.success(`Moved to ${targetStatus.replace('_', ' ')}`);
      fetchBoardData();
    } catch (err) {
      toast.error('Failed to move task. Reverting state.');
      setTasks(previousTasks);
    }
  };

  // DND Handlers
  const handleDragStart = (event) => {
    const { active } = event;
    const task = tasks.find((t) => t._id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Find active task
    const activeTaskItem = tasks.find((t) => t._id === activeId);
    if (!activeTaskItem) return;

    // Determine target column and new order
    let targetStatus = null;
    let targetOrder = 0;

    // Check if dropped directly onto a column container
    const isColumn = COLUMNS.some((col) => col.id === overId);
    if (isColumn) {
      targetStatus = overId;
      const tasksInColumn = tasks.filter((t) => t.status === targetStatus && t._id !== activeId);
      targetOrder = tasksInColumn.length;
    } else {
      // Dropped onto another task card
      const overTaskItem = tasks.find((t) => t._id === overId);
      if (overTaskItem) {
        targetStatus = overTaskItem.status;
        targetOrder = overTaskItem.order !== undefined ? overTaskItem.order : 0;
      }
    }

    if (!targetStatus) return;

    // If neither status nor position changed, exit early
    if (activeTaskItem.status === targetStatus && activeId === overId) {
      return;
    }

    // Save snapshot for rollback on failure
    const previousTasks = [...tasks];

    // Optimistically update local state
    setTasks((prev) => {
      return prev.map((t) => {
        if (t._id === activeId) {
          return { ...t, status: targetStatus, order: targetOrder };
        }
        return t;
      });
    });

    try {
      await api.post(`/tasks/${activeId}/move`, {
        status: targetStatus,
        newOrder: targetOrder,
      });
      toast.success(`Moved to ${targetStatus.replace('_', ' ')}`);
      fetchBoardData();
    } catch (error) {
      toast.error('Failed to persist task movement. Reverting...');
      setTasks(previousTasks);
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterQuery) {
        const q = filterQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchKey = t.key?.toLowerCase().includes(q);
        const matchLabel = t.labels?.some((l) => l.toLowerCase().includes(q));
        if (!matchTitle && !matchKey && !matchLabel) return false;
      }
      if (assigneeFilter !== 'all' && (t.assignee?._id || t.assignee) !== assigneeFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [tasks, filterQuery, assigneeFilter, priorityFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* View Header & Navigation */}
      <div
        style={{
          backgroundColor: 'var(--color-surface-lowest)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--color-outline-variant)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-base)',
                backgroundColor: 'var(--color-primary-container)',
                color: 'var(--color-on-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                {project?.icon || 'view_kanban'}
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-outline)', textTransform: 'uppercase', fontWeight: 600 }}>
                <span onClick={() => navigate('/projects')} style={{ cursor: 'pointer' }}>Projects</span>
                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>chevron_right</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{project?.key}</span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '22px', fontWeight: 700, marginTop: '2px' }}>
                {project?.name || 'Project Board'}
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Member Avatars */}
            <div className="avatar-stack">
              {project?.members?.slice(0, 4).map((m) =>
                m.avatar ? (
                  <img key={m._id} src={m.avatar} alt={m.name} className="avatar avatar-sm" />
                ) : (
                  <div key={m._id} className="avatar avatar-sm">{m.name?.[0] || 'M'}</div>
                )
              )}
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/team')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person_add</span>
              <span>Invite</span>
            </button>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setModalDefaultStatus('todo');
                setIsTaskModalOpen(true);
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
              <span>New Issue</span>
            </button>
          </div>
        </div>

        {/* Secondary Navigation & Controls Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--color-surface-low)' }}>
          {/* Tabs: Board View vs List View */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setViewMode('board')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-base)',
                backgroundColor: viewMode === 'board' ? 'var(--color-primary-fixed)' : 'transparent',
                color: viewMode === 'board' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                fontWeight: viewMode === 'board' ? 600 : 500,
                fontSize: '13px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>view_kanban</span>
              <span>Kanban Board</span>
              <span className="badge" style={{ backgroundColor: viewMode === 'board' ? 'var(--color-primary-container)' : 'var(--color-surface-high)', color: viewMode === 'board' ? 'white' : 'inherit', padding: '1px 6px' }}>
                {tasks.length}
              </span>
            </button>

            <button
              onClick={() => setViewMode('list')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-base)',
                backgroundColor: viewMode === 'list' ? 'var(--color-primary-fixed)' : 'transparent',
                color: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                fontWeight: viewMode === 'list' ? 600 : 500,
                fontSize: '13px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>format_list_bulleted</span>
              <span>List View</span>
            </button>

            <button
              onClick={() => navigate(`/projects/${id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-base)',
                color: 'var(--color-on-surface-variant)',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>info</span>
              <span>Project Details</span>
            </button>
          </div>

          {/* Filtering controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: '8px', top: '7px', fontSize: '16px', color: 'var(--color-outline)' }}>
                filter_list
              </span>
              <input
                type="text"
                placeholder="Filter issues..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                style={{
                  height: '32px',
                  paddingLeft: '28px',
                  paddingRight: '12px',
                  borderRadius: 'var(--radius-base)',
                  backgroundColor: 'var(--color-surface-low)',
                  fontSize: '12px',
                  width: '160px',
                }}
              />
            </div>

            <select
              className="form-select"
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              style={{ height: '32px', padding: '4px 8px', fontSize: '12px', width: 'auto', backgroundColor: 'var(--color-surface-low)' }}
            >
              <option value="all">Assignee: All</option>
              {members.map((m) => (
                <option key={m.user?._id || m.user} value={m.user?._id || m.user}>
                  {m.user?.name || 'Member'}
                </option>
              ))}
            </select>

            <select
              className="form-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{ height: '32px', padding: '4px 8px', fontSize: '12px', width: 'auto', backgroundColor: 'var(--color-surface-low)' }}
            >
              <option value="all">Priority: All</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main View Area: Board (dnd-kit) or List */}
      {isLoading ? (
        <div style={{ display: 'flex', gap: '16px', overflowX: 'auto' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="kanban-column skeleton" style={{ height: '400px' }} />
          ))}
        </div>
      ) : viewMode === 'board' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="kanban-board">
            {COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id);
              return (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  tasks={colTasks}
                  onAddTask={(status) => {
                    setModalDefaultStatus(status);
                    setIsTaskModalOpen(true);
                  }}
                  onOpenDrawer={(taskId) => openDrawer(taskId, fetchBoardData)}
                  onQuickShift={handleQuickShift}
                />
              );
            })}
          </div>

          <DragOverlay>
            {activeTask ? <DragOverlayCard task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <KanbanListView
          tasks={filteredTasks}
          onOpenDrawer={(taskId) => openDrawer(taskId, fetchBoardData)}
          onQuickShift={handleQuickShift}
          onAddTask={(status) => {
            setModalDefaultStatus(status);
            setIsTaskModalOpen(true);
          }}
        />
      )}

      {/* Task Creation Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        projects={projects}
        members={members}
        defaultProjectId={id}
        defaultStatus={modalDefaultStatus}
        onSuccess={fetchBoardData}
      />
    </div>
  );
};

export default KanbanPage;
