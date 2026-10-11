import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useTaskDrawer } from '../context/TaskDrawerContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export const TaskDrawer = ({ members = [] }) => {
  const { user, currentWorkspace } = useAuth();
  const { activeTaskId, closeDrawer, triggerUpdate } = useTaskDrawer();
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [newLabelInput, setNewLabelInput] = useState('');
  const [showAddLabel, setShowAddLabel] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const toast = useToast();

  const fetchTaskDetails = useCallback(async (id) => {
    try {
      setIsLoading(true);
      const [taskRes, commentsRes] = await Promise.all([
        api.get(`/tasks/${id}`),
        api.get(`/comments/task/${id}`),
      ]);

      if (taskRes.success) {
        setTask(taskRes.task);
        setTitleDraft(taskRes.task.title);
        setDescDraft(taskRes.task.description || '');
      }

      if (commentsRes.success) {
        setComments(commentsRes.comments || []);
      }
    } catch (error) {
      toast.error('Failed to load task details.');
      closeDrawer();
    } finally {
      setIsLoading(false);
    }
  }, [closeDrawer, toast]);

  useEffect(() => {
    if (activeTaskId) {
      fetchTaskDetails(activeTaskId);
    } else {
      setTask(null);
      setComments([]);
      setIsEditingDesc(false);
      setIsEditingTitle(false);
    }
  }, [activeTaskId, fetchTaskDetails]);

  if (!activeTaskId) return null;

  const handleUpdate = async (updates) => {
    if (!task) return;
    try {
      const res = await api.put(`/tasks/${task._id}`, updates);
      if (res.success) {
        setTask(res.task);
        triggerUpdate();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to update task.');
    }
  };

  const handleSaveTitle = async () => {
    if (!titleDraft.trim()) return;
    await handleUpdate({ title: titleDraft.trim() });
    setIsEditingTitle(false);
  };

  const handleSaveDescription = async () => {
    await handleUpdate({ description: descDraft });
    setIsEditingDesc(false);
  };

  const handleToggleSubtask = async (subtaskId) => {
    try {
      const res = await api.put(`/tasks/${task._id}/subtasks/${subtaskId}`);
      if (res.success) {
        setTask((prev) => ({ ...prev, subtasks: res.subtasks }));
        triggerUpdate();
      }
    } catch (error) {
      toast.error('Could not update checklist.');
    }
  };

  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    const currentSubtasks = task.subtasks || [];
    const updated = [...currentSubtasks, { title: newSubtaskTitle.trim(), completed: false }];
    await handleUpdate({ subtasks: updated });
    setNewSubtaskTitle('');
  };

  const handleAddLabel = async () => {
    if (!newLabelInput.trim()) return;
    const label = newLabelInput.trim().replace(/^#/, '');
    const currentLabels = task.labels || [];
    if (!currentLabels.includes(label)) {
      await handleUpdate({ labels: [...currentLabels, label] });
    }
    setNewLabelInput('');
    setShowAddLabel(false);
  };

  const handleRemoveLabel = async (labelToRemove) => {
    const updated = (task.labels || []).filter((l) => l !== labelToRemove);
    await handleUpdate({ labels: updated });
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      setIsSubmittingComment(true);
      const res = await api.post('/comments', {
        task: task._id,
        content: newComment.trim(),
      });
      if (res.success) {
        setComments((prev) => [...prev, res.comment]);
        setNewComment('');
      }
    } catch (error) {
      toast.error('Failed to post comment.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const res = await api.delete(`/comments/${commentId}`);
      if (res.success) {
        setComments((prev) => prev.filter((c) => c._id !== commentId));
        toast.info('Comment removed.');
      }
    } catch (error) {
      toast.error('Could not delete comment.');
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      const res = await api.delete(`/tasks/${task._id}`);
      if (res.success) {
        toast.success('Task deleted successfully.');
        closeDrawer();
        triggerUpdate();
      }
    } catch (error) {
      toast.error('Failed to delete task.');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Task link copied to clipboard!');
  };

  // Subtask progress
  const completedSubtasks = task?.subtasks?.filter((s) => s.completed).length || 0;
  const totalSubtasks = task?.subtasks?.length || 0;
  const checklistPercent = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

  return (
    <div className="drawer-backdrop" onClick={closeDrawer}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        {isLoading || !task ? (
          <div style={{ padding: '30px' }}>
            <div className="skeleton" style={{ height: '32px', width: '60%', marginBottom: '20px' }} />
            <div className="skeleton" style={{ height: '120px', width: '100%', marginBottom: '20px' }} />
            <div className="skeleton" style={{ height: '200px', width: '100%' }} />
          </div>
        ) : (
          <>
            {/* Top Bar */}
            <div
              style={{
                height: '56px',
                padding: '0 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--color-outline-variant)',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Status Dropdown */}
                <select
                  value={task.status}
                  onChange={(e) => handleUpdate({ status: e.target.value })}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    fontSize: '12px',
                    backgroundColor:
                      task.status === 'done' ? 'var(--color-success-bg)' :
                      task.status === 'in_review' ? 'var(--color-warning-bg)' :
                      task.status === 'in_progress' ? 'var(--color-primary-fixed)' : 'var(--color-surface-low)',
                    color:
                      task.status === 'done' ? 'var(--color-success)' :
                      task.status === 'in_review' ? 'var(--color-warning)' :
                      task.status === 'in_progress' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                    border: '1px solid var(--color-outline-variant)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="done">Done</option>
                </select>

                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-outline)' }}>
                  {task.key || 'TSK-100'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button className="btn btn-ghost" onClick={handleCopyLink} title="Copy Link" style={{ padding: '6px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>link</span>
                </button>
                <button className="btn btn-ghost" onClick={handleDeleteTask} title="Delete Task" style={{ padding: '6px', color: 'var(--color-danger)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                </button>
                <button className="btn btn-ghost" onClick={closeDrawer} title="Close drawer" style={{ padding: '6px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* Title Header */}
              <div>
                {isEditingTitle ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      autoFocus
                      style={{ fontSize: '18px', fontWeight: 600 }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={handleSaveTitle}>Save</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setIsEditingTitle(false)}>Cancel</button>
                  </div>
                ) : (
                  <h2
                    onClick={() => setIsEditingTitle(true)}
                    style={{
                      fontFamily: 'var(--font-headline)',
                      fontSize: '22px',
                      fontWeight: 600,
                      color: 'var(--color-on-surface)',
                      cursor: 'pointer',
                      lineHeight: 1.3,
                    }}
                    title="Click to edit title"
                  >
                    {task.title}
                  </h2>
                )}
              </div>

              {/* Properties Grid */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface-low)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '14px',
                }}
              >
                {/* Assignee */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-outline)', fontWeight: 500 }}>Assignee</span>
                  <select
                    className="form-select"
                    value={task.assignee?._id || ''}
                    onChange={(e) => handleUpdate({ assignee: e.target.value || null })}
                    style={{ backgroundColor: 'var(--color-surface-lowest)', padding: '6px 10px', fontSize: '13px' }}
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.user?._id || m.user} value={m.user?._id || m.user}>
                        {m.user?.name || 'Member'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-outline)', fontWeight: 500 }}>Priority</span>
                  <select
                    className="form-select"
                    value={task.priority}
                    onChange={(e) => handleUpdate({ priority: e.target.value })}
                    style={{ backgroundColor: 'var(--color-surface-lowest)', padding: '6px 10px', fontSize: '13px' }}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                {/* Due Date */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-outline)', fontWeight: 500 }}>Due Date</span>
                  <input
                    type="date"
                    className="form-input"
                    value={task.dueDate ? (typeof task.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(task.dueDate) ? task.dueDate.slice(0, 10) : new Date(task.dueDate).toISOString().slice(0, 10)) : ''}
                    onChange={(e) => handleUpdate({ dueDate: e.target.value || null })}
                    style={{ backgroundColor: 'var(--color-surface-lowest)', padding: '6px 10px', fontSize: '13px' }}
                  />
                </div>

                {/* Project */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-outline)', fontWeight: 500 }}>Project</span>
                  <div
                    style={{
                      padding: '6px 10px',
                      backgroundColor: 'var(--color-surface-lowest)',
                      borderRadius: 'var(--radius-base)',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--color-on-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: task.project?.color || 'var(--color-primary-container)',
                      }}
                    />
                    <span>{task.project?.name || 'Project'}</span>
                  </div>
                </div>

                {/* Labels */}
                <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-outline)', fontWeight: 500 }}>Labels</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                    {task.labels?.map((label) => (
                      <span
                        key={label}
                        className="badge"
                        style={{
                          backgroundColor: 'var(--color-surface-container)',
                          color: 'var(--color-on-surface)',
                          padding: '3px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        #{label}
                        <span
                          onClick={() => handleRemoveLabel(label)}
                          className="material-symbols-outlined"
                          style={{ fontSize: '14px', cursor: 'pointer', color: 'var(--color-outline)' }}
                        >
                          close
                        </span>
                      </span>
                    ))}

                    {showAddLabel ? (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Tag..."
                          value={newLabelInput}
                          onChange={(e) => setNewLabelInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddLabel()}
                          style={{
                            height: '24px',
                            width: '80px',
                            padding: '2px 6px',
                            fontSize: '12px',
                            borderRadius: '4px',
                            border: '1px solid var(--color-primary-container)',
                            backgroundColor: 'var(--color-surface-lowest)',
                          }}
                          autoFocus
                        />
                        <button className="btn btn-primary btn-sm" onClick={handleAddLabel} style={{ height: '24px', padding: '0 6px', fontSize: '11px' }}>
                          Add
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowAddLabel(false)} style={{ height: '24px', padding: '0 4px' }}>
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddLabel(true)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-xs)',
                          border: '1px dashed var(--color-outline)',
                          fontSize: '11px',
                          color: 'var(--color-outline)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
                        <span>Add Tag</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Description Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-headline)', fontSize: '14px', fontWeight: 600 }}>Description</span>
                  {!isEditingDesc && (
                    <button
                      onClick={() => setIsEditingDesc(true)}
                      style={{ fontSize: '12px', color: 'var(--color-outline)', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span> Edit
                    </button>
                  )}
                </div>

                {isEditingDesc ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea
                      rows={5}
                      className="form-textarea"
                      value={descDraft}
                      onChange={(e) => setDescDraft(e.target.value)}
                      placeholder="Add detailed task instructions, specs, or context..."
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setIsEditingDesc(false)}>Cancel</button>
                      <button className="btn btn-primary btn-sm" onClick={handleSaveDescription}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsEditingDesc(true)}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-base)',
                      backgroundColor: 'var(--color-surface-lowest)',
                      border: '1px solid var(--color-outline-variant)',
                      fontSize: '14px',
                      color: task.description ? 'var(--color-on-surface)' : 'var(--color-outline)',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      cursor: 'pointer',
                      minHeight: '60px',
                    }}
                  >
                    {task.description || 'No description provided. Click to add details...'}
                  </div>
                )}
              </div>

              {/* Acceptance Criteria / Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-headline)', fontSize: '14px', fontWeight: 600 }}>
                      Acceptance Criteria
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>
                      ({completedSubtasks}/{totalSubtasks})
                    </span>
                  </div>
                  {totalSubtasks > 0 && (
                    <div style={{ width: '80px', height: '6px', backgroundColor: 'var(--color-surface-high)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${checklistPercent}%`, height: '100%', backgroundColor: 'var(--color-success)', transition: 'width 200ms ease' }} />
                    </div>
                  )}
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--color-surface-low)',
                    padding: '12px',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {task.subtasks?.map((subtask) => (
                    <label
                      key={subtask._id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={subtask.completed}
                        onChange={() => handleToggleSubtask(subtask._id)}
                        style={{ marginTop: '3px', accentColor: 'var(--color-primary-container)', cursor: 'pointer' }}
                      />
                      <span
                        style={{
                          color: subtask.completed ? 'var(--color-outline)' : 'var(--color-on-surface)',
                          textDecoration: subtask.completed ? 'line-through' : 'none',
                          lineHeight: 1.4,
                        }}
                      >
                        {subtask.title}
                      </span>
                    </label>
                  ))}

                  <form onSubmit={handleAddSubtask} style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Add subtask or criterion..."
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      style={{ height: '32px', fontSize: '13px' }}
                    />
                    <button type="submit" className="btn btn-secondary btn-sm" disabled={!newSubtaskTitle.trim()}>
                      Add
                    </button>
                  </form>
                </div>
              </div>

              {/* Discussion & Comments */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontFamily: 'var(--font-headline)', fontSize: '14px', fontWeight: 600 }}>
                  Activity & Discussion ({comments.length})
                </span>

                {/* Comment box */}
                <form onSubmit={handleAddComment} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <textarea
                    rows={3}
                    className="form-textarea"
                    placeholder="Write a comment or update team members..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={isSubmittingComment || !newComment.trim()}
                    >
                      {isSubmittingComment ? 'Posting...' : 'Post Comment'}
                    </button>
                  </div>
                </form>

                {/* Comments List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                  {comments.map((c) => (
                    <div
                      key={c._id}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-base)',
                        backgroundColor: 'var(--color-surface-lowest)',
                        border: '1px solid var(--color-outline-variant)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {c.author?.avatar ? (
                            <img src={c.author.avatar} alt={c.author.name} className="avatar avatar-sm" />
                          ) : (
                            <div className="avatar avatar-sm">{c.author?.name?.[0] || 'U'}</div>
                          )}
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{c.author?.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
                            {new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {(() => {
                          const isAuthor = (c.author?._id || c.author) === user?._id;
                          const currentMember = currentWorkspace?.members?.find(
                            (m) => (m.user?._id || m.user) === user?._id
                          );
                          const isOwnerOrAdmin = ['Owner', 'Admin'].includes(currentMember?.role);
                          if (isAuthor || isOwnerOrAdmin) {
                            return (
                              <button
                                onClick={() => handleDeleteComment(c._id)}
                                style={{ padding: '2px', color: 'var(--color-outline)', cursor: 'pointer' }}
                                title="Delete comment"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                              </button>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--color-on-surface)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {c.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
};
