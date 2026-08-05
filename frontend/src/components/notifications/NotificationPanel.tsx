import React, { useEffect, useState } from 'react';
import { Bell, Check, Trash2, CheckCheck, X } from 'lucide-react';
import { Notification } from '../../types';
import { notificationsAPI } from '../../api/services';
import { formatDateTime } from '../../utils/helpers';
import toast from 'react-hot-toast';

const typeColors: Record<string, string> = {
  SUCCESS: 'bg-green-500', ERROR: 'bg-red-500', INFO: 'bg-blue-500', WARNING: 'bg-yellow-500',
};

const NotificationPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async () => {
    try {
      const res = await notificationsAPI.getAll({ limit: 20 });
      setNotifs(res.data.data);
      setUnread(res.data.unreadCount);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNotifs(); }, []);

  const markRead = async (id: string) => {
    await notificationsAPI.markRead(id);
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setUnread((u) => Math.max(0, u - 1));
  };

  const markAll = async () => {
    await notificationsAPI.markAllRead();
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    toast.success('All marked as read');
  };

  const deleteNotif = async (id: string) => {
    await notificationsAPI.delete(id);
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="absolute right-0 top-12 w-96 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4" />
          <span className="font-semibold text-sm">Notifications</span>
          {unread > 0 && (
            <span className="bg-primary-600 text-white text-xs rounded-full px-1.5 py-0.5">{unread}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {unread > 0 && (
            <button onClick={markAll} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              <CheckCheck className="w-3 h-3" /> Mark all read
            </button>
          )}
          <button onClick={onClose} aria-label="Close notifications" className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto divide-y">
        {loading ? (
          <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
        ) : notifs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No notifications</div>
        ) : (
          notifs.map((n) => (
            <div key={n.id} className={`flex gap-3 p-3 hover:bg-gray-50 ${!n.isRead ? 'bg-blue-50/40' : ''}`}>
              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${typeColors[n.type]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDateTime(n.createdAt)}</p>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                {!n.isRead && (
                  <button onClick={() => markRead(n.id)} className="text-primary-600 hover:text-primary-700">
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => deleteNotif(n.id)} className="text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
