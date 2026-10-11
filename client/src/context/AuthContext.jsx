import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  const fetchCurrentUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/auth/me');
      if (res.success && res.user) {
        setUser(res.user);
        setWorkspaces(res.workspaces || []);

        // Pick workspace: stored in api, or user.currentWorkspace, or first in list
        const activeWsId = api.workspaceId || res.user.currentWorkspace;
        const matched = res.workspaces?.find((w) => w._id === activeWsId) || res.workspaces?.[0];

        if (matched) {
          setCurrentWorkspace(matched);
          api.setWorkspaceId(matched._id);
        }
      } else {
        setUser(null);
        setWorkspaces([]);
        setCurrentWorkspace(null);
        api.setWorkspaceId(null);
      }
    } catch (err) {
      setUser(null);
      setWorkspaces([]);
      setCurrentWorkspace(null);
      api.setWorkspaceId(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();

    const handleUnauthorized = () => {
      setUser(null);
      setWorkspaces([]);
      setCurrentWorkspace(null);
      api.setWorkspaceId(null);
      api.setToken(null);
    };

    window.addEventListener('taskflow_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('taskflow_unauthorized', handleUnauthorized);
  }, [fetchCurrentUser]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.success) {
      if (res.token) api.setToken(res.token);
      toast.success('Welcome back to TaskFlow!');
      await fetchCurrentUser();
      return res;
    }
    throw new Error(res.message || 'Login failed');
  };

  const register = async (name, email, password, workspaceName) => {
    const res = await api.post('/auth/register', { name, email, password, workspaceName });
    if (res.success) {
      if (res.token) api.setToken(res.token);
      toast.success('Account created! Welcome aboard.');
      await fetchCurrentUser();
      return res;
    }
    throw new Error(res.message || 'Registration failed');
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Continue cleanup on client
    }
    setUser(null);
    setWorkspaces([]);
    setCurrentWorkspace(null);
    api.setWorkspaceId(null);
    api.setToken(null);
    toast.info('You have logged out.');
  };

  const switchWorkspace = (workspaceId) => {
    const target = workspaces.find((w) => w._id === workspaceId);
    if (target) {
      setCurrentWorkspace(target);
      api.setWorkspaceId(target._id);
      // Persist to user record in background
      api.put('/auth/profile', { currentWorkspace: target._id }).catch(() => {});
      toast.info(`Switched to workspace: ${target.name}`);
    }
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspaces,
        currentWorkspace,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        switchWorkspace,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
