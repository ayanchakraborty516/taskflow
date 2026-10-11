import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

export const ProjectModal = ({ isOpen, onClose, projectToEdit, members = [], onSuccess }) => {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Design & Eng');
  const [lead, setLead] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [color, setColor] = useState('#5757d9');
  const [icon, setIcon] = useState('folder');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (projectToEdit) {
      setName(projectToEdit.name || '');
      setKey(projectToEdit.key || '');
      setDescription(projectToEdit.description || '');
      setCategory(projectToEdit.category || 'Design & Eng');
      setLead(projectToEdit.lead?._id || projectToEdit.lead || '');
      setTargetDate(projectToEdit.targetDate ? new Date(projectToEdit.targetDate).toISOString().split('T')[0] : '');
      setColor(projectToEdit.color || '#5757d9');
      setIcon(projectToEdit.icon || 'folder');
    } else {
      setName('');
      setKey('');
      setDescription('');
      setCategory('Design & Eng');
      setLead(members[0]?.user?._id || '');
      setTargetDate('');
      setColor('#5757d9');
      setIcon('folder');
    }
  }, [projectToEdit, members, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Project name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        name: name.trim(),
        key: key.trim().toUpperCase(),
        description: description.trim(),
        category,
        lead: lead || null,
        targetDate: targetDate || null,
        color,
        icon,
      };

      let res;
      if (projectToEdit) {
        res = await api.put(`/projects/${projectToEdit._id}`, payload);
      } else {
        res = await api.post('/projects', payload);
      }

      if (res.success) {
        toast.success(projectToEdit ? 'Project updated!' : `Project "${res.project.name}" created!`);
        onClose();
        if (onSuccess) onSuccess(res.project);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to save project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const colorOptions = ['#5757d9', '#006b56', '#7c4100', '#ba1a1a', '#2563eb', '#7c3aed', '#db2777'];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-outline-variant)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '18px', fontWeight: 600 }}>
            {projectToEdit ? 'Edit Project' : 'Create New Project'}
          </h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: '4px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Project Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Mobile App Redesign v2"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!projectToEdit && !key) {
                    const words = e.target.value.split(/\s+/).filter(Boolean);
                    if (words.length > 0) {
                      setKey(words.map((w) => w[0]).join('').toUpperCase().slice(0, 4));
                    }
                  }
                }}
                required
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Key Prefix</label>
              <input
                type="text"
                className="form-input"
                placeholder="MOB"
                maxLength={8}
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                disabled={!!projectToEdit}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Category</label>
              <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="Design & Eng">Design & Eng</option>
                <option value="Product">Product</option>
                <option value="Engineering">Engineering</option>
                <option value="Marketing">Marketing</option>
                <option value="Operations">Operations</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Project Lead</label>
              <select className="form-select" value={lead} onChange={(e) => setLead(e.target.value)}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user?._id || m.user} value={m.user?._id || m.user}>
                    {m.user?.name || 'Member'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Target Completion Date</label>
            <input
              type="date"
              className="form-input"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Theme Color</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {colorOptions.map((c) => (
                <div
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: c,
                    cursor: 'pointer',
                    boxShadow: color === c ? '0 0 0 3px var(--color-surface), 0 0 0 5px ' + c : 'none',
                    transition: 'box-shadow 150ms ease',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Description</label>
            <textarea
              rows={3}
              className="form-textarea"
              placeholder="Outline project mission, key outcomes, or milestones..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : projectToEdit ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
