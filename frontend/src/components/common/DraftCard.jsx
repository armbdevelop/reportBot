import React, { useCallback, useState } from 'react';
import { MapPin, Clock, Edit3, Trash2 } from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';

// Компонент карточки черновика - ОБНОВЛЕН с модальным окном подтверждения
export const DraftCard = React.memo(({ draft, loadDraft, deleteDraft }) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const formatDate = useCallback((dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const getLocationFromDraft = useCallback(() => {
    return draft.data?.location || 'Локация не выбрана';
  }, [draft.data?.location]);

  const getReportTypeName = useCallback((type) => {
    const types = {
      'cashier': 'Завершение смены',
      'inventory': 'Инвентаризация',
      'receiving': 'Прием товаров',
      'writeoff': 'Списание/перемещение'
    };
    return types[type] || type;
  }, []);

  const getReportTypeIcon = useCallback((type) => {
    const icons = {
      'cashier': '💰',
      'inventory': '📦',
      'receiving': '📥',
      'writeoff': '📋'
    };
    return icons[type] || '📄';
  }, []);

  const handleContinue = useCallback(() => {
    loadDraft(draft.id);
  }, [draft.id, loadDraft]);

  const handleDelete = useCallback(() => {
    deleteDraft(draft.id);
    setShowDeleteModal(false);
  }, [draft.id, deleteDraft]);

  const handleDeleteClick = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{getReportTypeIcon(draft.type)}</div>
            <div>
              <h3 className="font-semibold text-gray-900">{getReportTypeName(draft.type)}</h3>
              <p className="text-sm text-gray-600">Черновик</p>
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin size={14} />
            <span>{getLocationFromDraft()}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock size={14} />
            <span>Изменен: {formatDate(draft.updatedAt)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleContinue}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Edit3 size={16} />
            Продолжить
          </button>
          <button
            onClick={handleDeleteClick}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Модальное окно подтверждения удаления */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Удалить черновик"
        message={`Вы уверены, что хотите удалить черновик "${getReportTypeName(draft.type)}"? Это действие нельзя отменить.`}
        confirmText="Удалить"
        cancelText="Отмена"
        type="danger"
      />
    </>
  );
});