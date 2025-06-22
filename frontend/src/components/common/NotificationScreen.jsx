import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

// Компонент уведомления (только для успешных операций)
export const NotificationScreen = ({ notification, clearNotification }) => {
  if (!notification) return null;

  const bgColor = notification.type === 'success' ? 'bg-green-50' : 'bg-red-50';
  const borderColor = notification.type === 'success' ? 'border-green-200' : 'border-red-200';
  const textColor = notification.type === 'success' ? 'text-green-800' : 'text-red-800';
  const iconColor = notification.type === 'success' ? 'text-green-500' : 'text-red-500';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className={`max-w-md w-full ${bgColor} ${borderColor} border rounded-xl p-6 text-center`}>
        <div className={`mx-auto w-16 h-16 ${iconColor} mb-4 flex items-center justify-center`}>
          {notification.type === 'success' ? (
            <CheckCircle size={64} />
          ) : (
            <XCircle size={64} />
          )}
        </div>

        <h2 className={`text-xl font-bold ${textColor} mb-2`}>
          {notification.title}
        </h2>

        <p className={`${textColor} mb-6`}>
          {notification.message}
        </p>

        <button
          onClick={clearNotification}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
        >
          Вернуться в меню
        </button>
      </div>
    </div>
  );
};