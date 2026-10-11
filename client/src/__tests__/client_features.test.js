import { describe, it, expect, beforeEach } from 'vitest';
import { getLocalDateKey } from '../pages/CalendarPage';
import { api } from '../api/client';

const mockStorage = {};
if (typeof window === 'undefined') {
  globalThis.window = {
    localStorage: {
      getItem: (k) => mockStorage[k] || null,
      setItem: (k, v) => { mockStorage[k] = String(v); },
      removeItem: (k) => { delete mockStorage[k]; },
      clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
    },
  };
  globalThis.localStorage = globalThis.window.localStorage;
}

describe('Frontend Client & Date Utilities', () => {
  beforeEach(() => {
    window.localStorage.clear();
    api.setWorkspaceId(null);
    api.setToken(null);
  });

  describe('getLocalDateKey', () => {
    it('should format ISO string date to YYYY-MM-DD directly without timezone shift', () => {
      const dateKey = getLocalDateKey('2026-10-15T00:00:00.000Z');
      expect(dateKey).toBe('2026-10-15');
    });

    it('should format plain date string correctly', () => {
      const dateKey = getLocalDateKey('2026-12-31');
      expect(dateKey).toBe('2026-12-31');
    });

    it('should format Javascript Date object correctly', () => {
      const d = new Date(2026, 9, 20); // October 20, 2026
      const dateKey = getLocalDateKey(d);
      expect(dateKey).toBe('2026-10-20');
    });

    it('should return empty string for null or invalid dates', () => {
      expect(getLocalDateKey(null)).toBe('');
      expect(getLocalDateKey(undefined)).toBe('');
      expect(getLocalDateKey('invalid-date')).toBe('');
    });
  });

  describe('ApiClient Authentication & Headers', () => {
    it('should store and persist workspace ID in localStorage', () => {
      api.setWorkspaceId('ws_12345');
      expect(api.workspaceId).toBe('ws_12345');
      expect(localStorage.getItem('taskflow_workspace_id')).toBe('ws_12345');

      api.setWorkspaceId(null);
      expect(api.workspaceId).toBeNull();
      expect(localStorage.getItem('taskflow_workspace_id')).toBeNull();
    });

    it('should store and persist auth token in localStorage', () => {
      api.setToken('jwt_sample_token_67890');
      expect(api.token).toBe('jwt_sample_token_67890');
      expect(localStorage.getItem('taskflow_token')).toBe('jwt_sample_token_67890');

      api.setToken(null);
      expect(api.token).toBeNull();
      expect(localStorage.getItem('taskflow_token')).toBeNull();
    });
  });
});
