import React, { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const SettingsPage = () => {
  const { user, currentWorkspace, workspaces, refreshUser, switchWorkspace } = useAuth();
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'workspace' | 'workspaces'
  const toast = useToast();

  // Profile Form state
  const [name, setName] = useState(user?.name || '');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Workspace Settings state
  const [wsName, setWsName] = useState(currentWorkspace?.name || '');
  const [wsDesc, setWsDesc] = useState(currentWorkspace?.description || '');
  const [wsColor, setWsColor] = useState(currentWorkspace?.color || '#5757d9');
  const [isUpdatingWs, setIsUpdatingWs] = useState(false);

  // Join workspace state
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Create workspace state
  const [newWsName, setNewWsName] = useState('');
  const [isCreatingWs, setIsCreatingWs] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setIsUpdatingProfile(true);
      const res = await api.put('/auth/profile', {
        name: name.trim(),
        jobTitle: jobTitle.trim(),
        avatar: avatar.trim(),
      });
      if (res.success) {
        toast.success('Profile updated successfully!');
        refreshUser();
      }
    } catch (error) {
      toast.error(error.message || 'Could not update profile.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error('Both password fields are required.');
      return;
    }
    try {
      setIsUpdatingPassword(true);
      const res = await api.put('/auth/password', { currentPassword, newPassword });
      if (res.success) {
        toast.success('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
      }
    } catch (error) {
      toast.error(error.message || 'Could not update password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleUpdateWorkspace = async (e) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    try {
      setIsUpdatingWs(true);
      const res = await api.put(`/workspaces/${currentWorkspace._id}`, {
        name: wsName.trim(),
        description: wsDesc.trim(),
        color: wsColor,
      });
      if (res.success) {
        toast.success('Workspace updated!');
        refreshUser();
      }
    } catch (error) {
      toast.error(error.message || 'Could not update workspace.');
    } finally {
      setIsUpdatingWs(false);
    }
  };

  const handleJoinWorkspace = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    try {
      setIsJoining(true);
      const res = await api.post('/workspaces/join', { inviteCode: joinCode.trim() });
      if (res.success) {
        toast.success(res.message);
        setJoinCode('');
        await refreshUser();
        switchWorkspace(res.workspace._id);
      }
    } catch (error) {
      toast.error(error.message || 'Invalid invite code.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    try {
      setIsCreatingWs(true);
      const res = await api.post('/workspaces', { name: newWsName.trim() });
      if (res.success) {
        toast.success('New workspace created!');
        setNewWsName('');
        await refreshUser();
        switchWorkspace(res.workspace._id);
      }
    } catch (error) {
      toast.error(error.message || 'Could not create workspace.');
    } finally {
      setIsCreatingWs(false);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '28px', fontWeight: 700 }}>Settings</h1>
        <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
          Manage your personal account profile, security credentials, and workspace preferences.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '2px' }}>
        <button
          className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile & Security
        </button>
        <button
          className={`btn ${activeTab === 'workspace' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('workspace')}
        >
          Workspace Preferences
        </button>
        <button
          className={`btn ${activeTab === 'workspaces' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('workspaces')}
        >
          Switch / Join Workspaces ({workspaces.length})
        </button>
      </div>

      {activeTab === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Profile Card */}
          <div className="card">
            <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
              Personal Information
            </h2>
            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Job Title / Specialty</label>
                  <input
                    type="text"
                    className="form-input"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email Address (Read-only)</label>
                <input
                  type="email"
                  className="form-input"
                  value={user?.email || ''}
                  disabled
                  style={{ opacity: 0.7 }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Avatar Image URL</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
                <button type="submit" className="btn btn-primary" disabled={isUpdatingProfile}>
                  {isUpdatingProfile ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Password Card */}
          <div className="card">
            <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
              Security & Password
            </h2>
            <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Current Password</label>
                  <input
                    type="password"
                    className="form-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    className="form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
                <button type="submit" className="btn btn-secondary" disabled={isUpdatingPassword}>
                  {isUpdatingPassword ? 'Updating...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'workspace' && (
        <div className="card">
          <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            Current Workspace: {currentWorkspace?.name}
          </h2>

          <form onSubmit={handleUpdateWorkspace} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Workspace Name</label>
              <input
                type="text"
                className="form-input"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Workspace Description</label>
              <textarea
                rows={3}
                className="form-textarea"
                value={wsDesc}
                onChange={(e) => setWsDesc(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
              <button type="submit" className="btn btn-primary" disabled={isUpdatingWs}>
                {isUpdatingWs ? 'Saving...' : 'Save Workspace'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'workspaces' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Join with Invite Code */}
          <div className="card">
            <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              Join Another Workspace with Code
            </h2>
            <form onSubmit={handleJoinWorkspace} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Enter workspace invite code (e.g. acme2026)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-secondary" disabled={isJoining}>
                {isJoining ? 'Joining...' : 'Join Workspace'}
              </button>
            </form>
          </div>

          {/* Create New Workspace */}
          <div className="card">
            <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              Create a Brand New Workspace
            </h2>
            <form onSubmit={handleCreateWorkspace} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="New workspace title (e.g. Acme Labs)"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={isCreatingWs}>
                {isCreatingWs ? 'Creating...' : 'Create Workspace'}
              </button>
            </form>
          </div>

          {/* List of My Workspaces */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '16px', fontWeight: 600, marginBottom: '14px' }}>
              Your Workspaces ({workspaces.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {workspaces.map((ws) => (
                <div
                  key={ws._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-base)',
                    backgroundColor: ws._id === currentWorkspace?._id ? 'var(--color-primary-fixed)' : 'var(--color-surface-low)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="workspace-badge" style={{ width: '28px', height: '28px', fontSize: '12px' }}>
                      {ws.name[0]}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{ws.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--color-outline)', marginLeft: '8px' }}>
                        Role: {ws.role}
                      </span>
                    </div>
                  </div>

                  {ws._id === currentWorkspace?._id ? (
                    <span className="badge" style={{ backgroundColor: 'var(--color-primary-container)', color: 'white' }}>
                      Active
                    </span>
                  ) : (
                    <button className="btn btn-secondary btn-sm" onClick={() => switchWorkspace(ws._id)}>
                      Switch to this
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
