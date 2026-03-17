import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

const getTarget = (notification) => {
  if (notification?.type === 'volunteer-request') return '/admin?tab=approval-workflow';
  if (notification?.type === 'chat') {
    const chatUserId = notification?.data?.chatWithUserId;
    if (chatUserId) return `/chat/${chatUserId}`;
    return '/chat';
  }

  const requestId = notification?.data?.requestId || notification?.linkedId;
  if (requestId) return `/track/${requestId}`;
  if (notification?.type === 'sos') return '/volunteer';
  if (notification?.type === 'sos-status') return '/dashboard';
  return '/dashboard';
};

const getTypeBadge = (type) => {
  if (type === 'sos') return 'bg-red-100 text-red-700';
  if (type === 'sos-status') return 'bg-blue-100 text-blue-700';
  if (type === 'chat') return 'bg-green-100 text-green-700';
  if (type === 'volunteer-request') return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-700';
};

const getNotificationMeta = (notification) => {
  if (notification?.type === 'sos') {
    const citizenName = notification?.data?.citizenName || 'Citizen';
    const locationText = notification?.data?.location?.address
      || (Array.isArray(notification?.data?.location?.coordinates)
        ? `${notification.data.location.coordinates[1]}, ${notification.data.location.coordinates[0]}`
        : 'Location shared');
    return `${citizenName} | ${locationText}`;
  }

  if (notification?.type === 'chat') {
    return notification?.data?.chatWithName || 'Chat update';
  }

  return '';
};

export default function NotificationBell() {
  const { user } = useAuth();
  const { unreadCount, notifications, markRead, markAllRead } = useSocket();
  const [open, setOpen] = useState(false);

  const recent = useMemo(() => notifications.slice(0, 12), [notifications]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-lg hover:bg-gray-100"
        aria-label="Open notifications"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-96 bg-white shadow-xl rounded-2xl border border-gray-100 z-50 overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="font-semibold text-gray-900">Notifications</div>
            {unreadCount > 0 && (
              <button
                className="text-xs font-semibold text-primary hover:underline"
                onClick={markAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {recent.length === 0 ? (
              <div className="p-6 text-center text-gray-400">No notifications yet</div>
            ) : (
              recent.map((item) => (
                <div
                  key={item.id}
                  className={`block p-4 border-b last:border-b-0 ${item.read || item.isRead ? 'text-gray-500' : 'bg-red-50/50'}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="font-medium text-sm text-gray-900">{item.message}</div>
                    <span className={`text-[10px] px-2 py-1 rounded-full uppercase font-bold ${getTypeBadge(item.type)}`}>
                      {item.type}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(item.createdAt).toLocaleString()}
                  </div>
                  {getNotificationMeta(item) && (
                    <div className="text-xs text-gray-500 mt-1">
                      {getNotificationMeta(item)}
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Link
                      to={getTarget(item)}
                      onClick={() => {
                        markRead(item._id || item.id);
                        setOpen(false);
                      }}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Open
                    </Link>
                    {user?.role === 'admin' && item.type === 'volunteer-request' && (
                      <span className="text-[11px] px-2 py-1 rounded bg-amber-100 text-amber-700 font-semibold">
                        Review in Approval Workflow
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
