import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Send, RefreshCw, Home, Plus, Clock, User } from 'lucide-react';
import { MemoizedInput } from '../common/MemoizedInput';
import { ValidationAlert } from '../common/ValidationAlert';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useFormData } from '../../hooks/useFormData';
import { getCurrentMSKTime } from '../../utils/dateUtils';

export const TransferForm = ({
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
    locationFrom: '',
    locationTo: '',
    shift: '',
    cashierName: '',
    writeoff_or_transfer: 'Перемещения',
    reportDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD формат
    reportTime: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), // HH:MM формат
    transfers: ['', '', '', ''] // Явно инициализируем как массив строк
  });

  const [showClearModal, setShowClearModal] = useState(false);
  const { handleNumberInput } = useFormData(validationErrors, setValidationErrors);

  // Загружаем черновик при инициализации
  useEffect(() => {
    if (currentDraftId) {
      const draftData = loadDraft(currentDraftId);
      if (draftData) {
        // Проверяем и исправляем структуру transfers, если она неправильная
        if (draftData.transfers && Array.isArray(draftData.transfers)) {
          draftData.transfers = draftData.transfers.map(item => {
            // Если элемент - объект, преобразуем в строку
            if (typeof item === 'object' && item !== null) {
              return ''; // Очищаем неправильные данные
            }
            // Если элемент уже строка, оставляем как есть
            return typeof item === 'string' ? item : '';
          });
        } else {
          // Если transfers не массив, создаем новый пустой массив
          draftData.transfers = ['', '', '', ''];
        }
        setFormData(draftData);
      }
    }
  }, [currentDraftId, loadDraft]);

  // Функция для автосохранения
  const autoSaveFunction = useCallback(async (data) => {
    const hasTransfers = data.transfers.some(item => item.trim() !== '');

    if (data.locationFrom || data.locationTo || hasTransfers) {
      await saveDraft('transfer', data);
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

  const handleTransferChange = useCallback((index, value) => {
    setFormData(prev => {
      const newTransfers = [...prev.transfers];
      newTransfers[index] = value;
      return { ...prev, transfers: newTransfers };
    });
  }, []);

  const addArrayItem = useCallback((arrayName) => {
    setFormData(prev => ({
      ...prev,
      [arrayName]: [...prev[arrayName], { name: '', weight: '', unit: '', reason: '' }]
    }));
  }, []);

  const addTransferItem = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      transfers: [...prev.transfers, '']
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

  // Функция для валидации даты
  const validateDate = useCallback((dateString) => {
    if (!dateString) return false;

    const date = new Date(dateString);
    const today = new Date();
    const minDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const maxDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());

    return date >= minDate && date <= maxDate;
  }, []);

  // Функция для валидации времени
  const validateTime = useCallback((timeString) => {
    if (!timeString) return false;

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeString);
  }, []);

  const handleSubmit = useCallback(async () => {
    // Валидация
    const errors = {};

    if (!formData.locationFrom) errors.locationFrom = 'Выберите локацию "Откуда"';
    if (!formData.locationTo) errors.locationTo = 'Выберите локацию "Куда"';
    if (formData.locationFrom === formData.locationTo) errors.locationTo = 'Локации отправления и назначения не могут быть одинаковыми';
    if (!formData.shift) errors.shift = 'Выберите смену';
    if (!formData.cashierName.trim()) errors.cashierName = 'Введите имя кассира';

    // Валидация даты
    if (!formData.reportDate) {
      errors.reportDate = 'Выберите дату';
    } else if (!validateDate(formData.reportDate)) {
      errors.reportDate = 'Выберите корректную дату (в пределах года от текущей даты)';
    }

    // Валидация времени
    if (!formData.reportTime) {
      errors.reportTime = 'Выберите время';
    } else if (!validateTime(formData.reportTime)) {
      errors.reportTime = 'Введите корректное время в формате ЧЧ:ММ';
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
      apiFormData.append('location_from', formData.locationFrom);
      apiFormData.append('location_to', formData.locationTo);
      apiFormData.append('shift_type', formData.shift === 'Утро' ? 'morning' : 'night');
      apiFormData.append('cashier_name', formData.cashierName);
      apiFormData.append('writeoff_or_transfer', formData.writeoff_or_transfer);
      apiFormData.append('report_date', formData.reportDate);
      apiFormData.append('report_time', formData.reportTime);

      // Парсим строки перемещений в нужный формат для API
      const writeoffs = [];
      const transfers = formData.transfers
        .filter(item => item.trim() !== '')
        .map((item, index) => ({
          name: item,
          unit: 'шт',
          weight: 1,
          reason: `Позиция ${index + 1}`
        }));

      // Отправляем пустые списания для совместимости с API
      apiFormData.append('writeoffs_json', JSON.stringify(writeoffs));

      if (transfers.length > 0) {
        apiFormData.append('transfers_json', JSON.stringify(transfers));
      }

      const result = await apiService.createWriteOffReport(apiFormData);
      clearCurrentDraft();
      showNotification('success', 'Акт перемещения отправлен!', 'Акт перемещения успешно отправлен и сохранен в системе');

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
              <h1 className="text-2xl font-bold text-blue-600">↔️ Акты перемещения</h1>
              {currentDraftId && (
                <p className="text-sm text-blue-600">✓ Автосохранение включено</p>
              )}
            </div>
          </div>

          {/* Ошибки валидации */}
          <ValidationAlert errors={validationErrors} />

          {/* Location From */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
              <MapPin size={16} className="text-red-500" />
              📍 Откуда?
            </label>
            <div className="space-y-2">
              {locations.map(loc => (
                <button
                  key={loc}
                  onClick={() => handleInputChange('locationFrom', loc)}
                  disabled={isLoading}
                  className={`w-full p-3 text-left rounded-lg border transition-colors disabled:opacity-50 ${
                    formData.locationFrom === loc 
                      ? 'bg-blue-500 border-blue-500 text-white shadow-md' 
                      : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700 shadow-sm hover:shadow-md'
                  } ${validationErrors.locationFrom ? 'border-red-400 bg-red-50' : ''}`}
                >
                  Отправляю с {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Location To */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
              <MapPin size={16} className="text-red-500" />
              📍 Куда?
            </label>
            <div className="space-y-2">
              {locations.map(loc => (
                <button
                  key={loc}
                  onClick={() => handleInputChange('locationTo', loc)}
                  disabled={isLoading}
                  className={`w-full p-3 text-left rounded-lg border transition-colors disabled:opacity-50 ${
                    formData.locationTo === loc 
                      ? 'bg-blue-500 border-blue-500 text-white shadow-md' 
                      : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700 shadow-sm hover:shadow-md'
                  } ${validationErrors.locationTo ? 'border-red-400 bg-red-50' : ''}`}
                >
                  На точку {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Shift Selection */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
              <Clock size={16} className="text-blue-500" />
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
                      ? 'bg-blue-500 border-blue-500 text-white shadow-md' 
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
              <User size={16} className="text-blue-500" />
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
                  : 'bg-white border-gray-300 focus:border-blue-500 focus:outline-none text-gray-700'
              }`}
              name="cashier-name"
              id="cashier-name"
            />
            {validationErrors.cashierName && (
              <p className="text-xs text-red-600 mt-1">⚠️ {validationErrors.cashierName}</p>
            )}
          </div>

          {/* Date & Time */}
          <div className="mb-4">
            <label className="text-sm font-medium block mb-2 text-gray-700">📅 Дата отчета</label>
            <input
              type="date"
              value={formData.reportDate}
              onChange={(e) => handleInputChange('reportDate', e.target.value)}
              disabled={isLoading}
              min={new Date(new Date().getFullYear() - 1, new Date().getMonth(), new Date().getDate()).toISOString().split('T')[0]}
              max={new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate()).toISOString().split('T')[0]}
              className={`w-full p-3 border rounded-lg transition-colors disabled:opacity-50 ${
                validationErrors.reportDate 
                  ? 'border-red-400 bg-red-50 text-red-700' 
                  : 'bg-white border-gray-300 focus:border-blue-500 focus:outline-none text-gray-700'
              }`}
              name="report-date"
              id="report-date"
            />
            {validationErrors.reportDate && (
              <p className="text-xs text-red-600 mt-1">⚠️ {validationErrors.reportDate}</p>
            )}
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium block mb-2 text-gray-700">⏰ Время отчета</label>
            <input
              type="time"
              value={formData.reportTime}
              onChange={(e) => handleInputChange('reportTime', e.target.value)}
              disabled={isLoading}
              step="60"
              className={`w-full p-3 border rounded-lg transition-colors disabled:opacity-50 ${
                validationErrors.reportTime 
                  ? 'border-red-400 bg-red-50 text-red-700' 
                  : 'bg-white border-gray-300 focus:border-blue-500 focus:outline-none text-gray-700'
              }`}
              name="report-time"
              id="report-time"
            />
            {validationErrors.reportTime && (
              <p className="text-xs text-red-600 mt-1">⚠️ {validationErrors.reportTime}</p>
            )}
          </div>

          {/* Информационный блок с правилами */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">!</span>
              </div>
              <h3 className="text-lg font-bold text-blue-700">Правило по перемещениям товара</h3>
            </div>

            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <span className="font-semibold text-green-700">Если твоя точка отправляет товар</span> в другую точку —
                  <span className="font-semibold"> заполняешь перемещение в этой форме</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <span className="font-semibold text-orange-700">Если твоя точка принимает товар</span> —
                  <span className="font-semibold"> в перемещении ничего не пишешь</span>.
                  Отмечаешь это только в своём отчёте о приёма товара, в блоке «Перемещение с другой точки к вам»
                </div>
              </div>
            </div>

            <div className="mt-3 p-2 bg-blue-100 rounded border-l-4 border-blue-400">
              <p className="text-xs text-blue-800 font-medium">
                💡 Помни: каждое перемещение фиксируется только один раз — отправителем!
              </p>
            </div>
          </div>

          {/* Информационный блок с инструкциями по заполнению */}
          <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">⚠</span>
              </div>
              <h3 className="text-lg font-bold text-orange-700">Внимание!</h3>
            </div>

            <div className="space-y-3 text-sm text-gray-700">
              <p className="font-semibold text-orange-800">
                Указывайте полную информацию перемещения товара.
              </p>
              <p>
                <span className="font-medium">Название - вес/количество.</span>
              </p>

              <div className="bg-orange-100 p-3 rounded-lg border-l-4 border-orange-400">
                <p className="text-xs font-medium text-orange-800 mb-2">Примеры правильного заполнения:</p>
                <div className="space-y-1 text-xs text-orange-700">
                  <p>• Майонез - 10 пачек</p>
                  <p>• Лепешки 200 штук</p>
                  <p>• Сырный соус 2 кг</p>
                  <p>• Стрипсы 1 пачку</p>
                  <p>• Специи 2 кг и тд.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Transfers Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-blue-600 mb-3">↔️ Перемещения</h3>
            <p className="text-sm text-gray-600 mb-3">Укажите полную информацию о товаре в каждом поле</p>
            {formData.transfers.map((item, index) => (
              <div key={index} className="mb-3">
                <textarea
                  placeholder="Какой товар, сколько кг\шт или пачек"
                  value={item}
                  onChange={(e) => handleTransferChange(index, e.target.value)}
                  disabled={isLoading}
                  rows={3}
                  className={`w-full p-3 border rounded-lg transition-colors disabled:opacity-50 resize-none ${
                    'bg-white border-gray-300 focus:border-blue-500 focus:outline-none text-gray-700'
                  }`}
                  name={`transfer-${index}`}
                  id={`transfer-${index}`}
                />
              </div>
            ))}
            <button
              onClick={addTransferItem}
              disabled={isLoading}
              className="w-full p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <Plus size={16} />
              добавить еще поле
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
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 shadow-md hover:shadow-lg"
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
