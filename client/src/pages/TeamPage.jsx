import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const TeamPage = () => {
  const { user, currentWorkspace } = useAuth();
  const { refreshShellData } = useOutletContext() || {};
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Member');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const toast = useToast();

  const fetchWorkspaceMembers = useCallback(async () => {
    if (!currentWorkspace) return;
    try {
      setIsLoading(true);
      const res = await api.get(`/workspaces/${currentWorkspace._id}`);
      if (res.success) {
        setMembers(res.workspace.members || []);
        setInviteCode(res.workspace.inviteCode || '');
      }
    } catch (error) {
      toast.error('Failed to load team members.');
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, toast]);

  useEffect(() => {
    fetchWorkspaceMembers();
  }, [fetchWorkspaceMembers]);

  const handleInviteMember = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address.');
      return;
    }

    try {
      setIsInviting(true);
      const res = await api.post(`/workspaces/${currentWorkspace._id}/members`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      if (res.success) {
        toast.success(res.message);
        setInviteEmail('');
        fetchWorkspaceMembers();
        if (refreshShellData) refreshShellData();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to add member.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (memberUserId, newRole) => {
    try {
      const res = await api.put(`/workspaces/${currentWorkspace._id}/members/${memberUserId}`, {
        role: newRole,
      });

      if (res.success) {
        toast.success('Member role updated.');
        fetchWorkspaceMembers();
      }
    } catch (error) {
      toast.error(error.message || 'Could not update role.');
    }
  };

  const handleRemoveMember = async (memberUserId, memberName) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName} from this workspace?`)) return;
    try {
      const res = await api.delete(`/workspaces/${currentWorkspace._id}/members/${memberUserId}`);
      if (res.success) {
        toast.success(res.message);
        fetchWorkspaceMembers();
        if (refreshShellData) refreshShellData();
      }
    } catch (error) {
      toast.error(error.message || 'Could not remove member.');
    }
  };

  const handleCopyInviteCode = () => {
    navigator.clipboard.writeText(inviteCode);
    toast.success('Invite code copied to clipboard!');
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '28px', fontWeight: 700 }}>Team Management</h1>
            <span className="badge" style={{ backgroundColor: 'var(--color-primary-fixed)', color: 'var(--color-primary)', fontSize: '13px' }}>
              {members.length} members
            </span>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
            Manage workspace roles (Owner, Admin, Member, Viewer) and onboarding invitations for {currentWorkspace?.name}.
          </p>
        </div>

        {/* Invite Code Quick Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-surface-lowest)', padding: '6px 14px', borderRadius: 'var(--radius-base)', border: '1px solid var(--color-outline-variant)' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>Workspace Invite Code:</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px', color: 'var(--color-primary-container)' }}>
            {inviteCode}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={handleCopyInviteCode} style={{ padding: '2px 6px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
          </button>
        </div>
      </div>

      {/* Invite Member Box */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          Add or Invite a Teammate
        </h2>
        <form onSubmit={handleInviteMember} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="email"
            className="form-input"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            style={{ flex: 1, minWidth: '220px', height: '38px' }}
            required
          />
          <select
            className="form-select"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            style={{ width: '130px', height: '38px', backgroundColor: 'var(--color-surface-low)' }}
          >
            <option value="Member">Member</option>
            <option value="Admin">Admin</option>
            <option value="Viewer">Viewer</option>
          </select>
          <button type="submit" className="btn btn-primary" style={{ height: '38px' }} disabled={isInviting}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
            <span>{isInviting ? 'Inviting...' : 'Add Member'}</span>
          </button>
        </form>
      </div>

      {/* Team Roster Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 2fr 160px 140px 100px',
            padding: '12px 20px',
            borderBottom: '1px solid var(--color-outline-variant)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--color-outline)',
            textTransform: 'uppercase',
            backgroundColor: 'var(--color-surface-low)',
          }}
        >
          <span>Member Name</span>
          <span>Email Address</span>
          <span>Job Title</span>
          <span>Role</span>
          <span>Actions</span>
        </div>

        {isLoading ? (
          <div style={{ padding: '30px' }}>
            <div className="skeleton" style={{ height: '40px', marginBottom: '12px' }} />
            <div className="skeleton" style={{ height: '40px', marginBottom: '12px' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {members.map((m) => {
              const u = m.user || {};
              const isCurrentUser = u._id === user?._id;

              return (
                <div
                  key={u._id || Math.random()}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 2fr 160px 140px 100px',
                    alignItems: 'center',
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--color-surface-low)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} className="avatar avatar-md" />
                    ) : (
                      <div className="avatar avatar-md">{u.name?.[0] || 'U'}</div>
                    )}
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-on-surface)' }}>
                        {u.name || 'Invited User'} {isCurrentUser && <span style={{ color: 'var(--color-primary-container)', fontSize: '11px' }}>(You)</span>}
                      </p>
                      <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
                        Joined {new Date(m.joinedAt || Date.now()).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <span style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                    {u.email}
                  </span>

                  <span style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                    {u.jobTitle || 'Contributor'}
                  </span>

                  <div>
                    {m.role === 'Owner' ? (
                      <span className="badge" style={{ backgroundColor: 'var(--color-primary-fixed)', color: 'var(--color-primary)' }}>
                        Owner
                      </span>
                    ) : (
                      <select
                        className="form-select"
                        value={m.role}
                        onChange={(e) => handleRoleChange(u._id, e.target.value)}
                        style={{ height: '28px', padding: '2px 8px', fontSize: '12px', width: '100px', backgroundColor: 'var(--color-surface-low)' }}
                      >
                        <option value="Admin">Admin</option>
                        <option value="Member">Member</option>
                        <option value="Viewer">Viewer</option>
                      </select>
                    )}
                  </div>

                  <div>
                    {m.role !== 'Owner' && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleRemoveMember(u._id, u.name)}
                        style={{ color: 'var(--color-danger)', padding: '4px' }}
                        title="Remove member"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_remove</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
