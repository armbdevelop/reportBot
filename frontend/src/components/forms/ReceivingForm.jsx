import React, { useState, useEffect, useCallback, useRef } from 'react';
import {Camera, MapPin, Send, RefreshCw, Home, Plus, Image, XCircle, Clock, User} from 'lucide-react';
import { MemoizedInput } from '../common/MemoizedInput';
import { ValidationAlert } from '../common/ValidationAlert';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useFormData } from '../../hooks/useFormData';
import { getCurrentMSKTime } from '../../utils/dateUtils';

export const ReceivingForm = ({
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
  // Предзаполненные товары для Пункта 1 (Основное)
  const PUNKT1_ITEMS = [
    { name: 'Лепешки', unit: 'кол-во' },
    { name: 'Курица', unit: 'кол-во' },
    { name: 'Компоты', unit: 'кол-во' },
    { name: 'Лаваши', unit: 'кол-во' },
    { name: 'Булки', unit: 'кол-во' }
  ];

  // Предзаполненные товары для Пункта 2 (Напитки)
  const PUNKT2_ITEMS = [
    { name: 'ЖБ напитки', unit: 'кол-во' },
    { name: 'Кинза напитки', unit: 'кол-во' },
    { name: 'Энергетики', unit: 'кол-во' },
    { name: 'Кураговый компот', unit: 'кол-во' },
    { name: 'IL Primo', unit: 'кол-во' },
    { name: 'Добрый ПЭТ', unit: 'кол-во' },
    { name: 'Колд Брю', unit: 'кол-во' },
    { name: 'Айран', unit: 'кол-во' },
    { name: 'Вода', unit: 'кол-во' }
  ];

  const [formData, setFormData] = useState({
    location: '',
    shift: '',
    cashierName: '',
    date: getCurrentMSKTime(),
    // Пункт 1 - Основное (предзаполненное)
    punkt1: PUNKT1_ITEMS.map(item => ({ ...item, quantity: '' })),
    // Пункт 2 - Напитки (предзаполненное)
    punkt2: PUNKT2_ITEMS.map(item => ({ ...item, quantity: '' })),
    // Пункт 3 - Перемещение с других точек (2 блока + кнопка добавить)
    peremesheniye: Array(2).fill(null).map(() => ({ name: '', quantity: '', unit: '' })),
    // Пункт 4 - Покупки с магазина (2 блока + кнопка добавить)
    pokupki: Array(2).fill(null).map(() => ({ name: '', quantity: '', unit: '' })),
    // Пункт 5 - Фотографии накладных
    nakladniyePhotos: []
  });

  const [showClearModal, setShowClearModal] = useState(false);
  const [showDeletePhotoModal, setShowDeletePhotoModal] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState(null);
  const [useCustomDateTime, setUseCustomDateTime] = useState(false);
  const { handleNumberInput } = useFormData(validationErrors, setValidationErrors);
  const nakladniyePhotoInputRef = useRef(null);

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
    const hasPunkt1Items = data.punkt1?.some(item => item.quantity);
    const hasPunkt2Items = data.punkt2?.some(item => item.quantity);
    const hasPeremeshenieyeItems = data.peremesheniye?.some(item => item.name || item.quantity || item.unit);
    const hasPokupkiItems = data.pokupki?.some(item => item.name || item.quantity || item.unit);

    if (data.location || data.nakladniyePhotos?.length > 0 ||
        hasPunkt1Items || hasPunkt2Items || hasPeremeshenieyeItems || hasPokupkiItems) {
      await saveDraft('receiving', data);
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
      [arrayName]: [...prev[arrayName], { name: '', quantity: '', unit: '' }]
    }));
  }, []);

  // Функция для добавления фотографий накладных
  const addNakladniyePhotos = useCallback((files) => {
    const fileArray = Array.isArray(files) ? files : Array.from(files || []);

    const validFiles = fileArray.filter(file => {
      const validTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
        'image/bmp', 'image/webp', 'image/heic', 'image/heif'
      ];
      const maxSize = 50 * 1024 * 1024;

      const fileName = file.name.toLowerCase();
      const hasValidExtension = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic', '.heif']
        .some(ext => fileName.endsWith(ext));

      return (validTypes.includes(file.type) || hasValidExtension) && file.size <= maxSize;
    });

    if (validFiles.length !== fileArray.length) {
      alert('Некоторые файлы были пропущены. Разрешены только изображения до 50МБ.');
    }

    setFormData(prev => {
      const newPhotos = [...prev.nakladniyePhotos, ...validFiles];
      return { ...prev, nakladniyePhotos: newPhotos };
    });

    // Очищаем input после загрузки
    if (nakladniyePhotoInputRef.current) {
      nakladniyePhotoInputRef.current.value = '';
    }

    // Очищаем ошибку валидации при добавлении фото
    if (validationErrors.nakladniyePhotos) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.nakladniyePhotos;
        return newErrors;
      });
    }
  }, [validationErrors, setValidationErrors]);

  const removeNakladniyePhoto = useCallback((index) => {
    setFormData(prev => {
      const newPhotos = prev.nakladniyePhotos.filter((_, i) => i !== index);
      return { ...prev, nakladniyePhotos: newPhotos };
    });
    setShowDeletePhotoModal(false);
    setPhotoToDelete(null);
  }, []);

  // Функция для показа модального окна удаления фото накладных
  const handleDeletePhotoClick = useCallback((index) => {
    setPhotoToDelete(index);
    setShowDeletePhotoModal(true);
  }, []);

  // Функция подтверждения удаления фото накладных
  const handleConfirmDeletePhoto = useCallback(() => {
    if (photoToDelete !== null) {
      removeNakladniyePhoto(photoToDelete);
    }
  }, [photoToDelete, removeNakladniyePhoto]);

  // Функция очистки формы
  const handleClearForm = useCallback(() => {
    if (currentDraftId) {
      clearCurrentDraft();
    }
    setValidationErrors({});
    // Очищаем input для фотографий
    if (nakladniyePhotoInputRef.current) {
      nakladniyePhotoInputRef.current.value = '';
    }
    window.location.reload();
  }, [currentDraftId, clearCurrentDraft, setValidationErrors]);

  const handleSubmit = useCallback(async () => {
    // Валидация
    const errors = {};

    if (!formData.location) errors.location = 'Выберите локацию';
    if (!formData.shift) errors.shift = 'Выберите смену';
    if (!formData.cashierName.trim()) errors.cashierName = 'Введите имя кассира';
    if (!formData.date) errors.date = 'Выберите дату';

    // Проверяем, что есть хотя бы одна заполненная позиция
    const hasPunkt1Items = formData.punkt1.some(item => item.quantity);
    const hasPunkt2Items = formData.punkt2.some(item => item.quantity);
    const hasPeremeshenieyeItems = formData.peremesheniye.some(item => item.name && item.quantity && item.unit);
    const hasPokupkiItems = formData.pokupki.some(item => item.name && item.quantity && item.unit);

    if (!hasPunkt1Items && !hasPunkt2Items && !hasPeremeshenieyeItems && !hasPokupkiItems) {
      errors.items = 'Заполните хотя бы одну позицию товара';
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
      apiFormData.append('location', formData.location);
      apiFormData.append('shift_type', formData.shift === 'Утро' ? 'morning' : 'night');
      apiFormData.append('cashier_name', formData.cashierName);

      // Отправляем custom_date только если пользователь выбрал ручной ввод
      if (useCustomDateTime && formData.date) {
        apiFormData.append('custom_date', formData.date);
      }

      // Фотографии накладных
      formData.nakladniyePhotos.forEach((photo) => {
        apiFormData.append('photos', photo);
      });

      // Пункт 1 - Основное (кухня)
      const punkt1Items = formData.punkt1
        .filter(item => item.quantity)
        .map(item => ({
          name: item.name,
          unit: item.unit,
          count: parseInt(item.quantity)
        }));

      // Пункт 2 - Напитки (бар)
      const punkt2Items = formData.punkt2
        .filter(item => item.quantity)
        .map(item => ({
          name: item.name,
          unit: item.unit,
          count: parseInt(item.quantity)
        }));

      // Объединяем пункты 1 и 2 для отправки в kuxnya_json
      const allKuxnyaItems = [...punkt1Items, ...punkt2Items];
      if (allKuxnyaItems.length > 0) {
        apiFormData.append('kuxnya_json', JSON.stringify(allKuxnyaItems));
      }

      // Пункт 3 - Перемещение с других точек (отправляем в bar_json)
      const peremeshenieyeItems = formData.peremesheniye
        .filter(item => item.name && item.quantity && item.unit)
        .map(item => ({
          name: item.name,
          unit: item.unit,
          count: parseInt(item.quantity)
        }));

      if (peremeshenieyeItems.length > 0) {
        apiFormData.append('bar_json', JSON.stringify(peremeshenieyeItems));
      }

      // Пункт 4 - Покупки с магазина (отправляем в upakovki_json)
      const pokupkiItems = formData.pokupki
        .filter(item => item.name && item.quantity && item.unit)
        .map(item => ({
          name: item.name,
          unit: item.unit,
          count: parseInt(item.quantity)
        }));

      if (pokupkiItems.length > 0) {
        apiFormData.append('upakovki_json', JSON.stringify(pokupkiItems));
      }

      await apiService.createReceivingReport(apiFormData);

      showNotification('success', 'Отчет отправлен!', 'Отчет приема товаров успешно отправлен и сохранен в системе');
      clearCurrentDraft();

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
              <h1 className="text-2xl font-bold text-purple-600">📥 Отчёт прием товара</h1>
              {currentDraftId && (
                <p className="text-sm text-purple-600">✓ Автосохранение включено</p>
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
                  • {loc}
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
          </div>

          {/* Date & Time */}
          <div className="mb-4">
            <label className="text-sm font-medium block mb-2 text-gray-700">📅 Дата и время</label>

            {/* Переключатель: автозаполнение / ручной ввод */}
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  setUseCustomDateTime(false);
                  handleInputChange('date', getCurrentMSKTime());
                }}
                className={`flex-1 p-2 rounded-lg border transition-colors text-sm ${
                  !useCustomDateTime
                    ? 'bg-blue-500 border-blue-500 text-white shadow-md'
                    : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700'
                }`}
                disabled={isLoading}
              >
                🕐 Текущее время (МСК)
              </button>
              <button
                type="button"
                onClick={() => setUseCustomDateTime(true)}
                className={`flex-1 p-2 rounded-lg border transition-colors text-sm ${
                  useCustomDateTime
                    ? 'bg-blue-500 border-blue-500 text-white shadow-md'
                    : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700'
                }`}
                disabled={isLoading}
              >
                📝 Указать вручную
              </button>
            </div>

            {/* Поле ввода даты и времени */}
            {useCustomDateTime ? (
              <input
                type="datetime-local"
                value={formData.date.slice(0, 16)} // Преобразуем формат для datetime-local
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-gray-700 focus:border-blue-500 focus:outline-none"
                disabled={isLoading}
              />
            ) : (
              <input
                type="text"
                value={formData.date}
                readOnly
                className="w-full p-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-700"
              />
            )}
          </div>

          {/* Пункт 1 - Основное */}
          <div className="mb-6 bg-white p-4 rounded-lg shadow-md border-2 border-orange-200">
            <h3 className="text-lg font-semibold text-orange-600 mb-3">📦 Пункт 1. Основное</h3>
            <p className="text-sm text-gray-600 mb-3">Заполните только количество (названия предзаполнены)</p>
            <div className="space-y-2">
              {formData.punkt1.map((item, index) => (
                <div key={index} className="grid grid-cols-[2fr_1fr] gap-2">
                  <div className="p-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700 flex items-center">
                    {item.name}
                  </div>
                  <MemoizedInput
                    type="text"
                    placeholder="Кол-во"
                    value={item.quantity}
                    onChange={(e) => handleNumberInput(e, (value) =>
                      handleArrayChange('punkt1', index, 'quantity', value)
                    )}
                    disabled={isLoading}
                    className="p-2 bg-white border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                    name={`punkt1-quantity-${index}`}
                    id={`punkt1-quantity-${index}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Пункт 2 - Напитки */}
          <div className="mb-6 bg-white p-4 rounded-lg shadow-md border-2 border-blue-200">
            <h3 className="text-lg font-semibold text-blue-600 mb-3">🥤 Пункт 2. Напитки</h3>
            <p className="text-sm text-gray-600 mb-3">Заполните только количество (названия предзаполнены)</p>
            <div className="space-y-2">
              {formData.punkt2.map((item, index) => (
                <div key={index} className="grid grid-cols-[2fr_1fr] gap-2">
                  <div className="p-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700 flex items-center">
                    {item.name}
                  </div>
                  <MemoizedInput
                    type="text"
                    placeholder="Кол-во"
                    value={item.quantity}
                    onChange={(e) => handleNumberInput(e, (value) =>
                      handleArrayChange('punkt2', index, 'quantity', value)
                    )}
                    disabled={isLoading}
                    className="p-2 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                    name={`punkt2-quantity-${index}`}
                    id={`punkt2-quantity-${index}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Пункт 3 - Перемещение с других точек */}
          <div className="mb-6">
            <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-lg mb-3">
              <div className="flex items-start gap-2">
                <div className="text-amber-600 text-base">⚠️</div>
                <div>
                  <p className="text-xs font-medium text-amber-800">
                    Перемещение с других точек
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              {formData.peremesheniye.map((item, index) => (
                <div key={index} className="grid grid-cols-3 gap-1.5">
                  <MemoizedInput
                    type="text"
                    placeholder="Название"
                    value={item.name}
                    onChange={(e) => handleArrayChange('peremesheniye', index, 'name', e.target.value)}
                    disabled={isLoading}
                    className="p-1 bg-white border border-gray-300 rounded-lg focus:border-amber-500 focus:outline-none disabled:opacity-50 transition-colors text-xs w-full"
                    name={`peremesheniye-name-${index}`}
                    id={`peremesheniye-name-${index}`}
                  />
                  <MemoizedInput
                    type="text"
                    placeholder="Кол-во"
                    value={item.quantity}
                    onChange={(e) => handleNumberInput(e, (value) =>
                      handleArrayChange('peremesheniye', index, 'quantity', value)
                    )}
                    disabled={isLoading}
                    className="p-1 bg-white border border-gray-300 rounded-lg focus:border-amber-500 focus:outline-none disabled:opacity-50 transition-colors text-xs w-full text-center"
                    name={`peremesheniye-quantity-${index}`}
                    id={`peremesheniye-quantity-${index}`}
                  />
                  <MemoizedInput
                    type="text"
                    placeholder="ед."
                    value={item.unit}
                    onChange={(e) => handleArrayChange('peremesheniye', index, 'unit', e.target.value)}
                    disabled={isLoading}
                    className="p-1 bg-white border border-gray-300 rounded-lg focus:border-amber-500 focus:outline-none disabled:opacity-50 transition-colors text-xs w-full text-center"
                    name={`peremesheniye-unit-${index}`}
                    id={`peremesheniye-unit-${index}`}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() => addArrayItem('peremesheniye')}
              disabled={isLoading}
              className="w-full p-1.5 mt-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-md hover:shadow-lg text-sm"
            >
              <Plus size={14} />
              Добавить еще
            </button>
          </div>

          {/* Пункт 4 - Покупки с магазина */}
          <div className="mb-6">
            <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded-lg mb-3">
              <div className="flex items-start gap-2">
                <div className="text-green-600 text-base">🛒</div>
                <div>
                  <p className="text-xs font-medium text-green-800">
                    Покупки с магазина
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              {formData.pokupki.map((item, index) => (
                <div key={index} className="grid grid-cols-3 gap-1.5">
                  <MemoizedInput
                    type="text"
                    placeholder="Название"
                    value={item.name}
                    onChange={(e) => handleArrayChange('pokupki', index, 'name', e.target.value)}
                    disabled={isLoading}
                    className="p-1 bg-white border border-gray-300 rounded-lg focus:border-green-500 focus:outline-none disabled:opacity-50 transition-colors text-xs w-full"
                    name={`pokupki-name-${index}`}
                    id={`pokupki-name-${index}`}
                  />
                  <MemoizedInput
                    type="text"
                    placeholder="Кол-во"
                    value={item.quantity}
                    onChange={(e) => handleNumberInput(e, (value) =>
                      handleArrayChange('pokupki', index, 'quantity', value)
                    )}
                    disabled={isLoading}
                    className="p-1 bg-white border border-gray-300 rounded-lg focus:border-green-500 focus:outline-none disabled:opacity-50 transition-colors text-xs w-full text-center"
                    name={`pokupki-quantity-${index}`}
                    id={`pokupki-quantity-${index}`}
                  />
                  <MemoizedInput
                    type="text"
                    placeholder="ед."
                    value={item.unit}
                    onChange={(e) => handleArrayChange('pokupki', index, 'unit', e.target.value)}
                    disabled={isLoading}
                    className="p-1 bg-white border border-gray-300 rounded-lg focus:border-green-500 focus:outline-none disabled:opacity-50 transition-colors text-xs w-full text-center"
                    name={`pokupki-unit-${index}`}
                    id={`pokupki-unit-${index}`}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() => addArrayItem('pokupki')}
              disabled={isLoading}
              className="w-full p-1.5 mt-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-md hover:shadow-lg text-sm"
            >
              <Plus size={14} />
              Добавить еще
            </button>
          </div>

          {/* Пункт 5 - Фотографии накладных */}
          <div className="mb-6">
            <div className="bg-purple-50 border-l-4 border-purple-400 p-4 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <div className="text-purple-600 text-lg">📸</div>
                <div>
                  <p className="text-sm font-medium text-purple-800 mb-1">
                    Фотографии всех накладных (обязательный)
                  </p>
                  <p className="text-sm text-purple-700">
                    Добавьте все фото накладных которые поступили, без письменного формата.
                  </p>
                </div>
              </div>
            </div>

            {/* Input для фотографий */}
            <input
              ref={nakladniyePhotoInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  addNakladniyePhotos([e.target.files[0]]);
                }
              }}
              disabled={isLoading}
              className="hidden"
              name="nakladniye_photo"
              id="nakladniye_photo"
            />

            {/* Кнопка добавления фото */}
            <button
              type="button"
              onClick={() => nakladniyePhotoInputRef.current?.click()}
              disabled={isLoading}
              className="w-full p-4 border-2 border-dashed border-purple-300 bg-purple-50 hover:bg-purple-100 hover:border-purple-400 rounded-lg transition-colors disabled:opacity-50"
            >
              <div className="flex items-center justify-center gap-3">
                <Camera size={24} className="text-purple-600" />
                <div className="text-center">
                  <div className="font-semibold text-purple-700 text-lg">
                    Добавить фотографии накладных
                  </div>
                  <div className="text-sm text-purple-600">
                    {formData.nakladniyePhotos.length > 0
                      ? `Загружено: ${formData.nakladniyePhotos.length} фото`
                      : 'Нажмите для выбора фотографий'
                    }
                  </div>
                </div>
              </div>
            </button>

            {/* Показываем загруженные фотографии */}
            {formData.nakladniyePhotos.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium text-purple-700 mb-2">
                  ✅ Загруженные фотографии ({formData.nakladniyePhotos.length}):
                </h4>
                <div className="space-y-2">
                  {formData.nakladniyePhotos.map((photo, index) => (
                    <div key={index} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="flex items-start gap-3">
                        <Image size={20} className="text-purple-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-purple-700 truncate mb-1">
                            📄 {photo.name}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-purple-600">
                            <span>📏 {(photo.size / 1024 / 1024).toFixed(2)} МБ</span>
                            <span>🖼️ {photo.type}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeletePhotoClick(index)}
                          className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
                          disabled={isLoading}
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 shadow-md hover:shadow-lg"
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

      {/* Модальное окно подтверждения удаления фото */}
      <ConfirmationModal
        isOpen={showDeletePhotoModal}
        onClose={() => {
          setShowDeletePhotoModal(false);
          setPhotoToDelete(null);
        }}
        onConfirm={handleConfirmDeletePhoto}
        title="Удалить фотографию"
        message={`Вы уверены, что хотите удалить фотографию "${photoToDelete !== null ? formData.nakladniyePhotos[photoToDelete]?.name : ''}"? Это действие нельзя отменить.`}
        confirmText="Удалить"
        cancelText="Отмена"
        type="danger"
      />
    </>
  );
};
