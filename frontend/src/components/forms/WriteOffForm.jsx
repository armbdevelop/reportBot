import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Send, RefreshCw, Home, Plus, Clock, User } from 'lucide-react';
import { MemoizedInput } from '../common/MemoizedInput';
import { ValidationAlert } from '../common/ValidationAlert';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useFormData } from '../../hooks/useFormData';
import { getCurrentMSKTime } from '../../utils/dateUtils';

export const WriteOffForm = ({
  isLoading,
  setIsLoading,
  validationErrors,
  setValidationErrors,
  showValidationErrors,
  showNotification,
  clearCurrentDraft,
  currentDraftId,
  loadDraft,
  saveDraft,
  goToMenu,
  locations,
  apiService
}) => {
  const [formData, setFormData] = useState({
    location: '',
    shift: '',
    cashierName: '',
    writeoff_or_transfer: 'Списания',
    report_date: new Date().toISOString().split('T')[0], // Текущая дата в формате YYYY-MM-DD
    report_time: new Date().toTimeString().slice(0,5),
    writeOffs: Array(4).fill({ name: '', weight: '', unit: '', reason: '' })
  });

  const [showClearModal, setShowClearModal] = useState(false);
  const { handleNumberInput } = useFormData(validationErrors, setValidationErrors);

  // Загружаем черновик при инициализации
  useEffect(() => {
    if (currentDraftId) {
      const draftData = loadDraft(currentDraftId);
      if (draftData) {
        setFormData(draftData);
      }
    }
  }, [currentDraftId, loadDraft]);

  // Функция для автосохранения
  const autoSaveFunction = useCallback(async (data) => {
    const hasWriteOffs = data.writeOffs.some(item => item.name || item.weight || item.unit || item.reason);

    if (data.location || hasWriteOffs || data.report_date || data.report_time) {
      await saveDraft('writeoff', data);
    }
  }, [saveDraft]);

  // Автосохранение каждые 300мс с сохранением фокуса
  useAutoSave(formData, autoSaveFunction, 300);

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Очищаем ошибку валидации при изменении поля
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [validationErrors, setValidationErrors]);

  const handleArrayChange = useCallback((arrayName, index, field, value) => {
    setFormData(prev => {
      const newArray = [...prev[arrayName]];
      newArray[index] = { ...newArray[index], [field]: value };
      return { ...prev, [arrayName]: newArray };
    });
  }, []);

  const addArrayItem = useCallback((arrayName) => {
  setFormData(prev => ({
    ...prev,
    [arrayName]: [...prev[arrayName], { name: '', weight: '', unit: '', reason: '' }]
  }));
  }, []);

  // Функция очистки формы
  const handleClearForm = useCallback(() => {
    if (currentDraftId) {
      clearCurrentDraft();
    }
    setValidationErrors({});
    window.location.reload();
  }, [currentDraftId, clearCurrentDraft, setValidationErrors]);

  const handleSubmit = useCallback(async () => {
    // Валидация
    const errors = {};

    if (!formData.location) errors.location = 'Выберите локацию';
    if (!formData.shift) errors.shift = 'Выберите смену';
    if (!formData.cashierName.trim()) errors.cashierName = 'Введите имя кассира';
    if (!formData.report_date) errors.report_date = 'Выберите дату отчета';
    if (!formData.report_time) errors.report_time = 'Выберите время отчета';

    // Проверяем, что есть хотя бы одна заполненная позиция
    const hasWriteOffs = formData.writeOffs.some(item => item.name && item.weight && item.unit && item.reason);

    if (!hasWriteOffs) {
      errors.items = 'Заполните хотя бы одну позицию списания (название + вес + единица + причина)';
    }

    if (Object.keys(errors).length > 0) {
      showValidationErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      // Подготовка FormData для API
      const apiFormData = new FormData();

      // Основные поля
      apiFormData.append('location_from', formData.location);
      apiFormData.append('shift_type', formData.shift === 'Утро' ? 'morning' : 'night');
      apiFormData.append('cashier_name', formData.cashierName);
      apiFormData.append('writeoff_or_transfer', formData.writeoff_or_transfer);
      apiFormData.append('report_date', formData.report_date);
      apiFormData.append('report_time', formData.report_time);

      // Списания
      const writeoffs = formData.writeOffs
        .filter(item => item.name && item.weight && item.unit && item.reason)
        .map(item => ({
          name: item.name,
          unit: item.unit,
          weight: parseFloat(item.weight),
          reason: item.reason
        }));

      if (writeoffs.length > 0) {
        apiFormData.append('writeoffs_json', JSON.stringify(writeoffs));
      }

      // Отправляем пустые перемещения для совместимости с API
      const transfers = [];
      apiFormData.append('transfers_json', JSON.stringify(transfers));

      const result = await apiService.createWriteOffReport(apiFormData);
      clearCurrentDraft();
      showNotification('success', 'Акт списания отправлен!', 'Акт списания успешно отправлен и сохранен в системе');

    } catch (error) {
      console.error('❌ Ошибка отправки отчета:', error);
      showNotification('error', 'Ошибка сервера', `Не удалось отправить отчет: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [formData, apiService, showNotification, showValidationErrors, clearCurrentDraft, setIsLoading]);

  return (
    <>
      <div className="min-h-screen bg-gray-50 text-gray-900 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={goToMenu}
              className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              disabled={isLoading}
            >
              <Home size={20} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-red-600">🗑️ Акты списания</h1>
              {currentDraftId && (
                <p className="text-sm text-red-600">✓ Автосохранение включено</p>
              )}
            </div>
          </div>

          {/* Ошибки валидации */}
          <ValidationAlert errors={validationErrors} />

          {/* Location */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
              <MapPin size={16} className="text-red-500" />
              📍 Локация:
            </label>
            <div className="space-y-2">
              {locations.map(loc => (
                <button
                  key={loc}
                  onClick={() => handleInputChange('location', loc)}
                  disabled={isLoading}
                  className={`w-full p-3 text-left rounded-lg border transition-colors disabled:opacity-50 ${
                    formData.location === loc 
                      ? 'bg-red-500 border-red-500 text-white shadow-md' 
                      : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700 shadow-sm hover:shadow-md'
                  } ${validationErrors.location ? 'border-red-400 bg-red-50' : ''}`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Shift Selection */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
              <Clock size={16} className="text-red-500" />
              🕐 Смена:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['Утро', 'Ночь'].map(shift => (
                <button
                  key={shift}
                  onClick={() => handleInputChange('shift', shift)}
                  disabled={isLoading}
                  className={`p-3 text-center rounded-lg border transition-colors disabled:opacity-50 ${
                    formData.shift === shift 
                      ? 'bg-red-500 border-red-500 text-white shadow-md' 
                      : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700 shadow-sm hover:shadow-md'
                  } ${validationErrors.shift ? 'border-red-400 bg-red-50' : ''}`}
                >
                  {shift}
                </button>
              ))}
            </div>
            {validationErrors.shift && (
              <p className="text-xs text-red-600 mt-1">⚠️ {validationErrors.shift}</p>
            )}
          </div>

          {/* Cashier Name */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
              <User size={16} className="text-red-500" />
              👤 Имя кассира:
            </label>
            <MemoizedInput
              type="text"
              placeholder="Введите ФИО кассира"
              value={formData.cashierName}
              onChange={(e) => handleInputChange('cashierName', e.target.value)}
              disabled={isLoading}
              className={`w-full p-3 border rounded-lg transition-colors disabled:opacity-50 ${
                validationErrors.cashierName 
                  ? 'border-red-400 bg-red-50 text-red-700' 
                  : 'bg-white border-gray-300 focus:border-red-500 focus:outline-none text-gray-700'
              }`}
              name="cashier-name"
              id="cashier-name"
            />
            {validationErrors.cashierName && (
              <p className="text-xs text-red-600 mt-1">⚠️ {validationErrors.cashierName}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Дата */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Дата отчета
              </label>
              <input
                type="date"
                value={formData.report_date}
                onChange={(e) => setFormData(prev => ({...prev, report_date: e.target.value}))}
                disabled={isLoading}
                className="w-full p-3 border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none disabled:opacity-50"
                placeholder="Оставьте пустым для автоматической даты"
              />
              <p className="text-xs text-gray-500 mt-1">Опционально - если не указано, будет текущая дата</p>
            </div>

            {/* Время */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🕒 Время отчета
              </label>
              <input
                type="time"
                value={formData.report_time}
                onChange={(e) => setFormData(prev => ({...prev, report_time: e.target.value}))}
                disabled={isLoading}
                className="w-full p-3 border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none disabled:opacity-50"
                placeholder="Оставьте пустым для автоматического времени"
              />
              <p className="text-xs text-gray-500 mt-1">Опционально - если не указано, будет текущее время</p>
            </div>
          </div>

          {/* Write-offs Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-red-600 mb-3">🗑️ Списания</h3>
            <p className="text-sm text-gray-600 mb-3">Наименование - количество - кг/шт - причина</p>
            {formData.writeOffs.map((item, index) => (
              <div key={index} className="grid grid-cols-4 gap-1 mb-2">
                <MemoizedInput
                  type="text"
                  placeholder="Наименование"
                  value={item.name}
                  onChange={(e) => handleArrayChange('writeOffs', index, 'name', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-xs disabled:opacity-50 transition-colors"
                  name={`writeoff-name-${index}`}
                  id={`writeoff-name-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Количество"
                  value={item.weight}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleArrayChange('writeOffs', index, 'weight', value)
                  )}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-xs disabled:opacity-50 transition-colors"
                  name={`writeoff-weight-${index}`}
                  id={`writeoff-weight-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="кг/шт"
                  value={item.unit}
                  onChange={(e) => handleArrayChange('writeOffs', index, 'unit', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-xs disabled:opacity-50 transition-colors"
                  name={`writeoff-unit-${index}`}
                  id={`writeoff-unit-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Причина"
                  value={item.reason}
                  onChange={(e) => handleArrayChange('writeOffs', index, 'reason', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-xs disabled:opacity-50 transition-colors"
                  name={`writeoff-reason-${index}`}
                  id={`writeoff-reason-${index}`}
                />
              </div>
            ))}
            <button
              onClick={() => addArrayItem('writeOffs')}
              disabled={isLoading}
              className="w-full p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <Plus size={16} />
              добавить еще
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setShowClearModal(true)}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 text-gray-700 shadow-sm hover:shadow-md"
            >
              <RefreshCw size={18} />
              Очистить
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              {isLoading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Отправка...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Отправить отчёт
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Модальное окно подтверждения очистки */}
      <ConfirmationModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearForm}
        title="Очистить форму"
        message="Вы уверены, что хотите очистить форму? Все несохраненные данные будут потеряны."
        confirmText="Очистить"
        cancelText="Отмена"
        type="warning"
      />
    </>
  );
};