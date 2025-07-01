import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Clock, Send, RefreshCw, Home, Package, Search } from 'lucide-react';
import { MemoizedInput } from '../common/MemoizedInput';
import { ValidationAlert } from '../common/ValidationAlert';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useFormData } from '../../hooks/useFormData';
import { getCurrentMSKTime } from '../../utils/dateUtils';

export const InventoryForm = ({
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
    conductor: '',
    report_date: new Date().toISOString().split('T')[0], // Текущая дата в формате YYYY-MM-DD
    report_time: new Date().toTimeString().slice(0,5),
    inventory_data: []
  });

  const [showClearModal, setShowClearModal] = useState(false);
  const [availableItems, setAvailableItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { handleNumberInput } = useFormData(validationErrors, setValidationErrors);

  // Загрузка товаров из API
  useEffect(() => {
    const loadItems = async () => {
      setItemsLoading(true);
      try {
        const response = await apiService.getInventoryItems({
          is_active: true,
          limit: 1000
        });

        const items = response.items || [];
        setAvailableItems(items);

        // Инициализируем inventory_data с нулевыми значениями для всех товаров
        setFormData(prev => ({
          ...prev,
          inventory_data: items.map(item => ({
            item_id: item.id,
            quantity: 0
          }))
        }));
      } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
        showNotification('error', 'Ошибка загрузки', 'Не удалось загрузить список товаров из базы данных');
      } finally {
        setItemsLoading(false);
      }
    };

    loadItems();
  }, [apiService, showNotification]);

  // Загружаем черновик при инициализации
  useEffect(() => {
    if (currentDraftId && availableItems.length > 0) {
      const draftData = loadDraft(currentDraftId);
      if (draftData) {
        setFormData(draftData);
      }
    }
  }, [currentDraftId, loadDraft, availableItems]);

  // Функция для автосохранения
  const autoSaveFunction = useCallback(async (data) => {
    if (data.location || data.shift || data.conductor || data.report_date || data.report_time ||
        (data.inventory_data && data.inventory_data.some(item => item.quantity > 0))) {
      await saveDraft('inventory', data);
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

  // Обработка изменения количества товара
  const handleQuantityChange = useCallback((itemId, value) => {
    // Разрешаем пустую строку как промежуточное значение
    if (value === '') {
      setFormData(prev => ({
        ...prev,
        inventory_data: prev.inventory_data.map(entry =>
          entry.item_id === itemId ? { ...entry, quantity: 0 } : entry
        )
      }));
      return;
    }

    // Пропускаем нечисловые значения
    if (!/^\d+$/.test(value)) return;

    // Преобразуем в число (убираем ведущие нули)
    const numValue = parseInt(value, 10);

    // Устанавливаем значение (не менее 0)
    setFormData(prev => ({
      ...prev,
      inventory_data: prev.inventory_data.map(entry =>
        entry.item_id === itemId ? { ...entry, quantity: numValue } : entry
      )
    }));
  }, []);

  // Функция очистки формы
  const handleClearForm = useCallback(() => {
    if (currentDraftId) {
      clearCurrentDraft();
    }
    setValidationErrors({});
    // Сбрасываем количества товаров на 0
    setFormData(prev => ({
      ...prev,
      location: '',
      shift: '',
      conductor: '',
      // ДОБАВИТЬ СБРОС ДАТЫ И ВРЕМЕНИ:
      report_date: new Date().toISOString().split('T')[0],
      report_time: new Date().toTimeString().slice(0,5),
      inventory_data: prev.inventory_data.map(entry => ({
        ...entry,
        quantity: 0
      }))
    }));
  }, [currentDraftId, clearCurrentDraft, setValidationErrors]);

  // Фильтрация товаров
  const filteredItems = availableItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Получение количества для товара
  const getQuantityForItem = useCallback((itemId) => {
    const entry = formData.inventory_data.find(item => item.item_id === itemId);
    return entry ? (entry.quantity === 0 ? '' : entry.quantity.toString()) : '';
  }, [formData.inventory_data]);

  const handleSubmit = useCallback(async () => {
    // Валидация
    const errors = {};

    if (!formData.location) errors.location = 'Выберите локацию';
    if (!formData.shift) errors.shift = 'Выберите смену';
    if (!formData.conductor.trim()) errors.conductor = 'Введите имя сотрудника';

    // ДОБАВИТЬ ВАЛИДАЦИЮ ДАТЫ И ВРЕМЕНИ:
    if (!formData.report_date) errors.report_date = 'Выберите дату отчета';
    if (!formData.report_time) errors.report_time = 'Выберите время отчета';

    // Проверяем что есть хотя бы один товар с количеством > 0
    const hasItems = formData.inventory_data.some(item => item.quantity > 0);
    if (!hasItems) {
      errors.items = 'Укажите количество хотя бы для одного товара';
    }

    if (Object.keys(errors).length > 0) {
      showValidationErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      // Используем новый API v2
      const submitData = {
        location: formData.location,
        shift_type: formData.shift === 'Утро' ? 'morning' : 'night',
        cashier_name: formData.conductor,
        // ДОБАВИТЬ ДАТУ И ВРЕМЯ:
        report_date: formData.report_date,
        report_time: formData.report_time,
        inventory_data: formData.inventory_data.filter(item => item.quantity > 0)
      };

      const result = await apiService.createInventoryReportV2(submitData);
      clearCurrentDraft();
      showNotification('success', 'Инвентаризация отправлена!', 'Отчет ежедневной инвентаризации успешно отправлен и сохранен в базе данных');

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
              <h1 className="text-2xl font-bold text-blue-600">📦 Ежедневная инвентаризация</h1>
              {currentDraftId && (
                <p className="text-sm text-blue-600">✓ Автосохранение включено</p>
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

          {/* Shift */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
              <Clock size={16} className="text-yellow-500" />
              🌙 Смена:
            </label>
            <div className="flex gap-2">
              {['Утро', 'Ночь'].map(shift => (
                <button
                  key={shift}
                  onClick={() => handleInputChange('shift', shift)}
                  disabled={isLoading}
                  className={`flex-1 p-3 rounded-lg border transition-colors disabled:opacity-50 ${
                    formData.shift === shift 
                      ? 'bg-yellow-500 border-yellow-500 text-white shadow-md' 
                      : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700 shadow-sm hover:shadow-md'
                  } ${validationErrors.shift ? 'border-red-400 bg-red-50' : ''}`}
                >
                  {shift} / {shift === 'Утро' ? 'День' : 'Ночь'}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="mb-4">
            <label className="text-sm font-medium block mb-2 text-gray-700">📅 Дата отчета:*</label>
            <input
              type="date"
              value={formData.report_date}
              onChange={(e) => handleInputChange('report_date', e.target.value)}
              disabled={isLoading}
              className={`w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors ${
                validationErrors.report_date ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
              required
            />
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium block mb-2 text-gray-700">⏰ Время отчета:*</label>
            <input
              type="time"
              value={formData.report_time}
              onChange={(e) => handleInputChange('report_time', e.target.value)}
              disabled={isLoading}
              className={`w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors ${
                validationErrors.report_time ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
              required
            />
          </div>

          {/* ДОБАВИТЬ ЭТОТ БЛОК ПРЕДУПРЕЖДЕНИЯ */}
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
            <p className="text-red-700 font-bold text-center">
              Внимание !!!<br />
              Обязательно указывайте, во сколько фактически началась инвентаризация. Если вы начали в 10:00 а закончили в 10:30, указывайте 10:00
            </p>
          </div>


          {/* Conductor */}
          <div className="mb-6">
            <label className="text-sm font-medium block mb-2 text-gray-700">📊 Кто провел:*</label>
            <MemoizedInput
              type="text"
              value={formData.conductor}
              onChange={(e) => handleInputChange('conductor', e.target.value)}
              disabled={isLoading}
              className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
              placeholder="Введите имя сотрудника"
              name="conductor"
              id="conductor"
              hasError={!!validationErrors.conductor}
            />
          </div>

          {/* Загрузка товаров */}
          {itemsLoading ? (
            <div className="mb-6 p-8 text-center bg-white border border-gray-200 rounded-lg">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Загрузка товаров из базы данных...</p>
            </div>
          ) : availableItems.length === 0 ? (
            <div className="mb-6 p-8 text-center bg-white border border-gray-200 rounded-lg">
              <Package size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-2">Нет доступных товаров</p>
              <p className="text-sm text-gray-500">Обратитесь к администратору для добавления товаров</p>
            </div>
          ) : (
            <>
              {/* Поиск */}
              <div className="mb-4 bg-white border border-gray-200 rounded-lg p-4">
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Поиск товаров..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  Показано товаров: {filteredItems.length} из {availableItems.length}
                </div>
              </div>

              {/* Товары единым списком */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-blue-600 mb-3">📋 Товары:</h3>
                {validationErrors.items && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700 text-sm">⚠️ {validationErrors.items}</p>
                  </div>
                )}

                {filteredItems.length === 0 ? (
                  <div className="p-6 text-center bg-white border border-gray-200 rounded-lg">
                    <p className="text-gray-600">Товары не найдены по заданному поиску</p>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="space-y-3">
                      {filteredItems.map(item => {
                        const quantity = getQuantityForItem(item.id);

                        return (
                          <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                            quantity > 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                          }`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {item.name}
                                {quantity > 0 && <span className="ml-2 text-green-600">✓</span>}
                              </p>
                              <p className="text-xs text-gray-600">
                                ID: {item.id} • {item.unit}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              <input
                                type="number"
                                min="0"
                                value={getQuantityForItem(item.id)}
                                onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                disabled={isLoading}
                                className={`w-20 p-2 border rounded-lg focus:outline-none text-center disabled:opacity-50 transition-all ${
                                  quantity > 0 
                                    ? 'bg-green-50 border-green-300 focus:border-green-500 text-green-700' 
                                    : 'bg-white border-gray-300 focus:border-blue-500'
                                }`}
                                placeholder="0"
                                name={`item-${item.id}`}
                                id={`item-${item.id}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setShowClearModal(true)}
              disabled={isLoading || itemsLoading}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 text-gray-700 shadow-sm hover:shadow-md"
            >
              <RefreshCw size={18} />
              Очистить
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading || itemsLoading}
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

          {/* Информация о системе */}
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              ✨ <strong>Упрощенная система:</strong> Товары отображаются единым списком без категорий.
              Список товаров можно настроить через "Управление товарами" в главном меню.
            </p>
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