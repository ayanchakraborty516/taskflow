import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

export const NotificationsPage = () => {
  const { refreshShellData } = useOutletContext() || {};
  const [notifications, setNotifications] = useState([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/notifications?unreadOnly=${unreadOnly}`);
      if (res.success) {
        setNotifications(res.notifications || []);
      }
    } catch (error) {
      toast.error('Failed to load notifications.');
    } finally {
      setIsLoading(false);
    }
  }, [unreadOnly, toast]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id, link, e) => {
    e.stopPropagation();
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      if (refreshShellData) refreshShellData();
      if (link) navigate(link);
    } catch (err) {
      // Ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await api.put('/notifications/read-all');
      if (res.success) {
        toast.success('All notifications marked as read.');
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        if (refreshShellData) refreshShellData();
      }
    } catch (error) {
      toast.error('Could not mark all as read.');
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      if (refreshShellData) refreshShellData();
    } catch (err) {
      toast.error('Could not delete notification.');
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-headline)', fontSize: '28px', fontWeight: 700 }}>
            Notifications
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
            Alerts, assignments, mentions, and updates across your team deliverables.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn ${!unreadOnly ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setUnreadOnly(false)}
          >
            All
          </button>
          <button
            className={`btn ${unreadOnly ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setUnreadOnly(true)}
          >
            Unread Only
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleMarkAllRead}>
            Mark All as Read
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '24px' }}>
            <div className="skeleton" style={{ height: '40px', marginBottom: '12px' }} />
            <div className="skeleton" style={{ height: '40px', marginBottom: '12px' }} />
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-outline)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-outline-variant)', marginBottom: '12px' }}>
              notifications_off
            </span>
            <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-on-surface)' }}>
              All caught up!
            </p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>
              No {unreadOnly ? 'unread' : ''} notifications in your inbox.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {notifications.map((n) => (
              <div
                key={n._id}
                onClick={(e) => handleMarkAsRead(n._id, n.link, e)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--color-surface-low)',
                  backgroundColor: n.read ? 'transparent' : 'var(--color-primary-fixed)',
                  opacity: n.read ? 0.75 : 1,
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: n.read ? 'var(--color-surface-container)' : 'var(--color-primary-container)',
                      color: n.read ? 'var(--color-on-surface-variant)' : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      {n.type === 'task_assigned' ? 'assignment_ind' :
                       n.type === 'comment_added' ? 'chat_bubble' :
                       n.type === 'task_status' ? 'sync' : 'notifications'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-on-surface)' }}>
                        {n.title}
                      </span>
                      {!n.read && (
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-danger)' }} />
                      )}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', lineHeight: 1.5 }}>
                      {n.message}
                    </p>
                    <span style={{ fontSize: '11px', color: 'var(--color-outline)', marginTop: '4px' }}>
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => handleDelete(n._id, e)}
                  style={{ padding: '4px', color: 'var(--color-outline)', cursor: 'pointer' }}
                  title="Remove alert"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
