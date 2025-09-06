import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

// Компонент модального окна подтверждения - ИСПРАВЛЕНО: использование Portal
export const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  type = 'warning', // 'warning', 'danger'
  isLoading = false
}) => {
  // Блокируем прокрутку при открытом модальном окне
  useEffect(() => {
    if (isOpen) {
      // Сохраняем текущую позицию прокрутки
      const scrollY = window.scrollY;

      // Блокируем прокрутку
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
      document.body.style.width = '100%';

      return () => {
        // Восстанавливаем прокрутку при закрытии
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const bgColor = type === 'danger' ? 'bg-red-50' : 'bg-yellow-50';
  const borderColor = type === 'danger' ? 'border-red-200' : 'border-yellow-200';
  const iconColor = type === 'danger' ? 'text-red-500' : 'text-yellow-500';
  const textColor = type === 'danger' ? 'text-red-800' : 'text-yellow-800';
  const confirmButtonColor = type === 'danger'
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-yellow-600 hover:bg-yellow-700';

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        minHeight: '100vh',
        minWidth: '100vw'
      }}
      onClick={(e) => {
        // Закрываем модальное окно при клике на фон
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`relative max-w-md w-full ${bgColor} ${borderColor} border rounded-xl p-6 shadow-2xl transform transition-all duration-200 scale-100 mx-4`}
        onClick={(e) => e.stopPropagation()} // Предотвращаем закрытие при клике на само модальное окно
        style={{
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        {/* Заголовок с иконкой и кнопкой закрытия */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle size={24} className={iconColor} />
            <h2 className={`text-lg font-bold ${textColor}`}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Сообщение */}
        <p className={`${textColor} mb-6 leading-relaxed`}>
          {message}
        </p>

        {/* Кнопки действий */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 shadow-sm"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            disabled={isLoading}
            className={`flex-1 px-4 py-3 ${confirmButtonColor} text-white rounded-lg transition-colors font-medium disabled:opacity-50 shadow-sm`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  // Рендерим модальное окно через портал прямо в body
  return createPortal(modalContent, document.body);
};