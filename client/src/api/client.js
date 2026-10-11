const API_BASE = import.meta.env.VITE_API_URL || '/api';

const getStorage = (key) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  return null;
};

const setStorage = (key, val) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      if (val) {
        window.localStorage.setItem(key, val);
      } else {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      // Ignore storage errors
    }
  }
};

class ApiClient {
  constructor() {
    this.workspaceId = getStorage('taskflow_workspace_id');
    this.token = getStorage('taskflow_token');
  }

  setToken(token) {
    this.token = token;
    setStorage('taskflow_token', token);
  }

  setWorkspaceId(id) {
    this.workspaceId = id;
    setStorage('taskflow_workspace_id', id);
  }

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (this.workspaceId) {
      headers['x-workspace-id'] = this.workspaceId;
    }

    const config = {
      ...options,
      headers,
      credentials: 'include', // essential for HTTP-only cookies
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(data.message || `Request failed with status ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (error) {
      if (error.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
        // Broadcast unauthorized event for AuthContext
        window.dispatchEvent(new CustomEvent('taskflow_unauthorized'));
      }
      throw error;
    }
  }

  get(endpoint, headers = {}) {
    return this.request(endpoint, { method: 'GET', headers });
  }

  post(endpoint, body, headers = {}) {
    return this.request(endpoint, { method: 'POST', body, headers });
  }

  put(endpoint, body, headers = {}) {
    return this.request(endpoint, { method: 'PUT', body, headers });
  }

  delete(endpoint, headers = {}) {
    return this.request(endpoint, { method: 'DELETE', headers });
  }
}

export const api = new ApiClient();
