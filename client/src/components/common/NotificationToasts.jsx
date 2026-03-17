import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';

const getTarget = (toast) => {
  if (toast?.type === 'volunteer-request') return '/admin?tab=approval-workflow';
  if (toast?.type === 'chat') {
    const chatUserId = toast?.data?.chatWithUserId;
    if (chatUserId) return `/chat/${chatUserId}`;
    return '/chat';
  }
  const requestId = toast?.data?.requestId || toast?.linkedId || toast?.data?._id;
  if (requestId) return `/track/${requestId}`;
  if (toast?.type === 'sos') return '/volunteer';
  if (toast?.type === 'sos-status') return '/dashboard';
  return '/dashboard';
};

const getBorderClass = (type) => {
  if (type === 'sos') return 'border-red-300';
  if (type === 'sos-status') return 'border-blue-300';
  if (type === 'chat') return 'border-green-300';
  if (type === 'volunteer-request') return 'border-amber-300';
  return 'border-gray-300';
};

export default function NotificationToasts() {
  const { toasts, dismissToast } = useSocket();

  useEffect(() => {
    const timers = toasts.map((toast) =>
      setTimeout(() => {
        dismissToast(toast.id);
      }, 5000)
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts, dismissToast]);

  if (!toasts.length) return null;

  return (
    <div className="fixed top-20 right-4 z-[70] space-y-3 w-[320px]">
      {toasts.slice(0, 3).map((toast) => (
        <div
          key={toast.id}
          className={`bg-white border-l-4 ${getBorderClass(toast.type)} shadow-lg rounded-xl p-3`}
        >
          <div className="text-sm font-semibold text-gray-900">{toast.message}</div>
          <div className="mt-2 flex items-center justify-between">
            <Link to={getTarget(toast)} className="text-xs text-primary font-semibold hover:underline">
              View
            </Link>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
