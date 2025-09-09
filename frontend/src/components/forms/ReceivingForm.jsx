import React, { useState, useEffect, useCallback, useRef } from 'react';
import {Camera, MapPin, Send, RefreshCw, Home, Plus, Image, XCircle, Clock, User} from 'lucide-react';
import { MemoizedInput } from '../common/MemoizedInput';
import { ValidationAlert } from '../common/ValidationAlert';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useFormData } from '../../hooks/useFormData';
import { getTodayDate, getYesterdayDate, getCurrentMSKTime } from '../../utils/dateUtils';

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
  const [formData, setFormData] = useState({
    location: '',
    shift: '', // ДОБАВИТЬ
    cashierName: '', // ДОБАВИТЬ
    date: getCurrentMSKTime(), // ИЗМЕНЕНО: datetime вместо getCurrentDate()
    photos: [],
    kitchen: Array(15).fill({ name: '', quantity: '', unit: '' }), // ИСПРАВЛЕНО: 15 элементов
    bar: Array(4).fill({ name: '', quantity: '', unit: '' }),
    packaging: Array(5).fill({ name: '', quantity: '', unit: '' })
  });

  // НОВОЕ: состояние для дополнительных фото
  const [additionalPhotos, setAdditionalPhotos] = useState([]);

  const [showClearModal, setShowClearModal] = useState(false);
  const [showDeletePhotoModal, setShowDeletePhotoModal] = useState(false);
  const [showDeleteAdditionalPhotoModal, setShowDeleteAdditionalPhotoModal] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState(null);
  const [additionalPhotoToDelete, setAdditionalPhotoToDelete] = useState(null);
  const { handleNumberInput } = useFormData(validationErrors, setValidationErrors);
  const singlePhotoInputRef = useRef(null);
  const additionalPhotoInputRef = useRef(null); // НОВОЕ: ref для дополнительных фото

  // Загружаем черновик при инициализации
  useEffect(() => {
    if (currentDraftId) {
      const draftData = loadDraft(currentDraftId);
      if (draftData) {
        setFormData(draftData);
        // Восстанавливаем дополнительные фото из черновика
        if (draftData.additionalPhotos && Array.isArray(draftData.additionalPhotos)) {
          setAdditionalPhotos(draftData.additionalPhotos);
        } else {
          setAdditionalPhotos([]);
        }
      }
    }
  }, [currentDraftId, loadDraft]);

  // Функция для автосохранения
  const autoSaveFunction = useCallback(async (data) => {
    const hasKitchenItems = data.kitchen.some(item => item.name || item.quantity || item.unit);
    const hasBarItems = data.bar.some(item => item.name || item.quantity || item.unit);
    const hasPackagingItems = data.packaging.some(item => item.name || item.quantity || item.unit);

    if (data.location || data.photos.length > 0 || additionalPhotos.length > 0 ||
        hasKitchenItems || hasBarItems || hasPackagingItems) {
      // Добавляем additionalPhotos к данным для сохранения
      const dataWithAdditionalPhotos = { ...data, additionalPhotos };
      await saveDraft('receiving', dataWithAdditionalPhotos);
    }
  }, [saveDraft, additionalPhotos]);

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

  // ИСПРАВЛЕННАЯ функция addPhotos
  const addPhotos = useCallback((files) => {
    // Проверяем что files является массивом или FileList
    const fileArray = Array.isArray(files) ? files : Array.from(files || []);

    const validFiles = fileArray.filter(file => {
      // Расширенный список поддерживаемых форматов
      const validTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
        'image/bmp', 'image/webp', 'image/heic', 'image/heif'
      ];
      const maxSize = 50 * 1024 * 1024; // Увеличиваем до 50MB для HEIC

      // Дополнительная проверка по расширению файла
      const fileName = file.name.toLowerCase();
      const hasValidExtension = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic', '.heif']
        .some(ext => fileName.endsWith(ext));

      return (validTypes.includes(file.type) || hasValidExtension) && file.size <= maxSize;
    });

    if (validFiles.length !== fileArray.length) {
      alert('Некоторые файлы были пропущены. Разрешены только изображения до 50МБ.');
    }

    setFormData(prev => {
      const newPhotos = [...prev.photos, ...validFiles].slice(0, 10);
      return { ...prev, photos: newPhotos };
    });

    // Очищаем input после загрузки
    if (singlePhotoInputRef.current) {
      singlePhotoInputRef.current.value = '';
    }

    // Очищаем ошибку валидации при добавлении фото
    if (validationErrors.photos) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.photos;
        return newErrors;
      });
    }
  }, [validationErrors, setValidationErrors]);

  // НОВОЕ: функция для добавления дополнительных фото
  const addAdditionalPhotos = useCallback((files) => {
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

    setAdditionalPhotos(prev => {
      const newPhotos = [...prev, ...validFiles].slice(0, 10);
      return newPhotos;
    });

    // Очищаем input после загрузки
    if (additionalPhotoInputRef.current) {
      additionalPhotoInputRef.current.value = '';
    }
  }, []);

  const removePhoto = useCallback((index) => {
    setFormData(prev => {
      const newPhotos = prev.photos.filter((_, i) => i !== index);
      return { ...prev, photos: newPhotos };
    });
    setShowDeletePhotoModal(false);
    setPhotoToDelete(null);
  }, []);

  // НОВОЕ: функция для удаления дополнительных фото
  const removeAdditionalPhoto = useCallback((index) => {
    setAdditionalPhotos(prev => prev.filter((_, i) => i !== index));
    setShowDeleteAdditionalPhotoModal(false);
    setAdditionalPhotoToDelete(null);
  }, []);

  // Функция для показа модального окна удаления фото
  const handleDeletePhotoClick = useCallback((index) => {
    setPhotoToDelete(index);
    setShowDeletePhotoModal(true);
  }, []);

  // НОВОЕ: функция для показа модального окна удаления дополнительного фото
  const handleDeleteAdditionalPhotoClick = useCallback((index) => {
    setAdditionalPhotoToDelete(index);
    setShowDeleteAdditionalPhotoModal(true);
  }, []);

  // Функция подтверждения удаления фото
  const handleConfirmDeletePhoto = useCallback(() => {
    if (photoToDelete !== null) {
      removePhoto(photoToDelete);
    }
  }, [photoToDelete, removePhoto]);

  // НОВОЕ: функция подтверждения удаления дополнительного фото
  const handleConfirmDeleteAdditionalPhoto = useCallback(() => {
    if (additionalPhotoToDelete !== null) {
      removeAdditionalPhoto(additionalPhotoToDelete);
    }
  }, [additionalPhotoToDelete, removeAdditionalPhoto]);

  // Функция очистки формы
  const handleClearForm = useCallback(() => {
    if (currentDraftId) {
      clearCurrentDraft();
    }
    setValidationErrors({});
    setAdditionalPhotos([]); // НОВОЕ: очистка дополнительных фото
    // Очищаем input для фотографий
    if (singlePhotoInputRef.current) {
      singlePhotoInputRef.current.value = '';
    }
    if (additionalPhotoInputRef.current) {
      additionalPhotoInputRef.current.value = '';
    }
    window.location.reload();
  }, [currentDraftId, clearCurrentDraft, setValidationErrors]);

  // НОВОЕ: функция отправки дополнительных фото
  const sendAdditionalPhotos = useCallback(async () => {
    if (additionalPhotos.length === 0 || !formData.location) return;

    setIsLoading(true);
    try {
      await apiService.sendAdditionalPhotos(formData.location, additionalPhotos);
      showNotification('success', 'Дополнительные фото отправлены!', 'Дополнительные фотографии накладных успешно отправлены');
      setAdditionalPhotos([]); // Очищаем дополнительные фото после успешной отправки
      if (additionalPhotoInputRef.current) {
        additionalPhotoInputRef.current.value = '';
      }
    } catch (error) {
      console.error('❌ Ошибка отправки дополнительных фото:', error);
      showNotification('error', 'Ошибка сервера', `Не удалось отправить дополнительные фото: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [additionalPhotos, formData.location, apiService, showNotification, setIsLoading]);

  const handleSubmit = useCallback(async () => {
    // Валидация
    const errors = {};

    if (!formData.location) errors.location = 'Выберите локацию';
    if (!formData.shift) errors.shift = 'Выберите смену'; // ДОБАВИТЬ
    if (!formData.cashierName.trim()) errors.cashierName = 'Введите имя кассира'; // ДОБАВИТЬ
    if (!formData.date) errors.date = 'Выберите дату';

    // Проверяем, что есть хотя бы одна заполненная позиция
    const hasKitchenItems = formData.kitchen.some(item => item.name && item.quantity && item.unit);
    const hasBarItems = formData.bar.some(item => item.name && item.quantity && item.unit);
    const hasPackagingItems = formData.packaging.some(item => item.name && item.quantity && item.unit);

    if (!hasKitchenItems && !hasBarItems && !hasPackagingItems) {
      errors.items = 'Заполните хотя бы одну позицию товара (название + количество + единица измерения)';
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
      apiFormData.append('shift_type', formData.shift === 'Утро' ? 'morning' : 'night'); // ДОБАВИТЬ
      apiFormData.append('cashier_name', formData.cashierName); // ДОБАВИТЬ

      formData.photos.forEach((photo, index) => {
        apiFormData.append(`photos`, photo);
      });

      // Кухня - ИСПРАВЛЕНО: используем правильное поле API
      const kuxnyaItems = formData.kitchen
        .filter(item => item.name && item.quantity && item.unit)
        .map(item => ({
          name: item.name,
          unit: item.unit,  // отдельное поле,
          count: parseInt(item.quantity)
        }));

      if (kuxnyaItems.length > 0) {
        apiFormData.append('kuxnya_json', JSON.stringify(kuxnyaItems));
      }

      // Бар - ИСПРАВЛЕНО: используем правильное поле API
      const barItems = formData.bar
        .filter(item => item.name && item.quantity && item.unit)
        .map(item => ({
          name: item.name,
          unit: item.unit,  // отдельное поле,
          count: parseInt(item.quantity)
        }));

      if (barItems.length > 0) {
        apiFormData.append('bar_json', JSON.stringify(barItems));
      }

      // Упаковки - ИСПРАВЛЕНО: используем правильное поле API
      const upakovkiItems = formData.packaging
        .filter(item => item.name && item.quantity && item.unit)
        .map(item => ({
          name: item.name,
          unit: item.unit,  // отдельное поле,
          count: parseInt(item.quantity)
        }));

      if (upakovkiItems.length > 0) {
        apiFormData.append('upakovki_json', JSON.stringify(upakovkiItems));
      }

      const result = await apiService.createReceivingReport(apiFormData);

      // НОВОЕ: автоматически отправляем дополнительные фото если они есть
      if (additionalPhotos.length > 0) {
        try {
          await apiService.sendAdditionalPhotos(formData.location, additionalPhotos);
          showNotification('success', 'Отчет отправлен!', `Отчет приема товаров успешно отправлен вместе с ${additionalPhotos.length} дополнительными фотографи��ми`);
          setAdditionalPhotos([]); // Очищаем дополнительные фото после успешной отправки
          if (additionalPhotoInputRef.current) {
            additionalPhotoInputRef.current.value = '';
          }
        } catch (additionalPhotoError) {
          console.error('❌ Ошибка отправки дополнительных фото:', additionalPhotoError);
          showNotification('success', 'Отчет отправлен!', 'Отчет приема товаров успешно отправлен, но дополнительные фотографии не удалось отправить');
        }
      } else {
        showNotification('success', 'Отчет отправлен!', 'Отчет приема товаров успешно отправлен и сохранен в системе');
      }
      clearCurrentDraft(); // Удаляем черновик сразу после успешной отправки


    } catch (error) {
      console.error('❌ Ошибка отправки отчета:', error);
      showNotification('error', 'Ошибка сервера', `Не удалось отправить отчет: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [formData, additionalPhotos, apiService, showNotification, showValidationErrors, clearCurrentDraft, setIsLoading]);

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

          {/* Shift Selection - ДОБАВИТЬ ПОСЛЕ БЛОКА LOCATION */}
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

          {/* Cashier Name - ДОБАВИТЬ ПОСЛЕ БЛОКА SHIFT */}
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

          {/* Date & Time - КАК В КАССОВОМ ОТЧЕТЕ */}
          <div className="mb-4">
            <label className="text-sm font-medium block mb-2 text-gray-700">📅 Дата (автозаполнение по МСК)</label>
            <input
              type="text"
              value={formData.date}
              readOnly
              className="w-full p-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-700"
            />
          </div>

          {/* Photos Section - ИСПРАВЛЕНО: Улучшенная загрузка фотографий */}
          {/*<div className="mb-6">*/}
          {/*  <label className="flex items-center gap-2 text-sm font-medium mb-3 text-gray-700">*/}
          {/*    <Camera size={16} className="text-purple-500" />*/}
          {/*    Фотографии накладных **/}
          {/*  </label>*/}
          {/*  <p className="text-xs text-gray-600 mb-3">*/}
          {/*    Добавьте фотографии накладных на принятый товар (до 10 фотографий)*/}
          {/*  </p>*/}

          {/*  /!* Fallback input для одиночной загрузки - ЕДИНСТВЕННАЯ ФОРМА *!/*/}
          {/*  <input*/}
          {/*    ref={singlePhotoInputRef}*/}
          {/*    type="file"*/}
          {/*    accept="image/jpeg,image/jpg,image/png,image/webp"*/}
          {/*    onChange={(e) => {*/}
          {/*      if (e.target.files && e.target.files[0]) {*/}
          {/*        addPhotos([e.target.files[0]]);*/}
          {/*      }*/}
          {/*    }}*/}
          {/*    disabled={isLoading}*/}
          {/*    className="hidden"*/}
          {/*    name="single_photo"*/}
          {/*    id="single_photo"*/}
          {/*  />*/}

          {/*  /!* Единственная кнопка загрузки фотографий - увеличенная с дизайном основной кнопки *!/*/}
          {/*  <button*/}
          {/*    type="button"*/}
          {/*    onClick={() => singlePhotoInputRef.current?.click()}*/}
          {/*    disabled={isLoading || formData.photos.length >= 10}*/}
          {/*    className={`w-full photo-upload-button ${*/}
          {/*      validationErrors.photos */}
          {/*        ? 'border-red-400 bg-red-50 hover:bg-red-100' */}
          {/*        : formData.photos.length >= 10*/}
          {/*          ? 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-60'*/}
          {/*          : 'border-purple-300 bg-purple-50 hover:bg-purple-100 hover:border-purple-400'*/}
          {/*    }`}*/}
          {/*  >*/}
          {/*    <div className="flex items-center justify-center gap-3">*/}
          {/*      <Camera size={24} className="text-purple-600" />*/}
          {/*      <div className="text-center">*/}
          {/*        <div className="font-semibold text-purple-700 text-lg">*/}
          {/*          {formData.photos.length >= 10*/}
          {/*            ? 'Достигнут максимум (10 фото)'*/}
          {/*            : 'Добавить по одной фотографии'*/}
          {/*          }*/}
          {/*        </div>*/}
          {/*        <div className="text-sm text-purple-600">*/}
          {/*          {formData.photos.length > 0*/}
          {/*            ? `Загружено: ${formData.photos.length} из 10`*/}
          {/*            : 'Нажмите для выбора фотографии'*/}
          {/*          }*/}
          {/*        </div>*/}
          {/*      </div>*/}
          {/*    </div>*/}
          {/*  </button>*/}

          {/*  /!* Показываем загруженные фотографии *!/*/}
          {/*  {formData.photos.length > 0 && (*/}
          {/*    <div className="mt-4 space-y-2">*/}
          {/*      <h4 className="text-sm font-medium text-green-700 mb-2">*/}
          {/*        ✅ Загруженные ����отографии ({formData.photos.length}):*/}
          {/*      </h4>*/}
          {/*      <div className="space-y-2">*/}
          {/*        {formData.photos.map((photo, index) => (*/}
          {/*          <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">*/}
          {/*            <div className="flex items-start gap-3">*/}
          {/*              <Image size={20} className="text-green-500 mt-0.5 flex-shrink-0" />*/}
          {/*              <div className="flex-1 min-w-0">*/}
          {/*                <p className="text-sm font-medium text-green-700 truncate mb-1">*/}
          {/*                  📄 {photo.name}*/}
          {/*                </p>*/}
          {/*                <div className="flex items-center gap-4 text-xs text-green-600">*/}
          {/*                  <span>📏 {(photo.size / 1024 / 1024).toFixed(2)} МБ</span>*/}
          {/*                  <span>🖼️ {photo.type}</span>*/}
          {/*                </div>*/}
          {/*              </div>*/}
          {/*              <button*/}
          {/*                type="button"*/}
          {/*                onClick={() => handleDeletePhotoClick(index)}*/}
          {/*                className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"*/}
          {/*                disabled={isLoading}*/}
          {/*              >*/}
          {/*                <XCircle size={16} />*/}
          {/*              </button>*/}
          {/*            </div>*/}
          {/*          </div>*/}
          {/*        ))}*/}
          {/*      </div>*/}
          {/*    </div>*/}
          {/*  )}*/}

          {/*  /!* Сообщение об ошибке или подсказка - УЛУЧШЕНО *!/*/}
          {/*  {formData.photos.length === 0 && (*/}
          {/*    <div className={`text-center p-4 rounded-lg border-2 border-dashed transition-colors mt-4 ${*/}
          {/*      validationErrors.photos */}
          {/*        ? 'border-red-300 bg-red-50 text-red-600' */}
          {/*        : 'border-gray-300 bg-gray-50 text-gray-500'*/}
          {/*    }`}>*/}
          {/*      <Camera size={32} className="mx-auto mb-3 opacity-50" />*/}
          {/*      <p className="text-sm font-medium mb-1">*/}
          {/*        {validationErrors.photos*/}
          {/*          ? '❌ Необходимо добавить фотографии накладных'*/}
          {/*          : '📸 Нажмите кнопку выше для добавления фотографий'*/}
          {/*        }*/}
          {/*      </p>*/}
          {/*      <p className="text-xs text-gray-400 mb-2">*/}
          {/*        Рекомендуется 5-10 четких фотографий накладных*/}
          {/*      </p>*/}
          {/*      <p className="text-xs text-amber-600">*/}
          {/*        💡 Добавляйте фотографии по одной для стабильной работы*/}
          {/*      </p>*/}
          {/*    </div>*/}
          {/*  )}*/}
          {/*</div>*/}

          {/* НОВОЕ: Секция дополнительных фото - показывается когда основных фото 10 */}
          {formData.photos.length === 10 && (
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-medium mb-3 text-gray-700">
                <Camera size={16} className="text-orange-500" />
                📸 Дополнительные фотографии
              </label>
              <p className="text-xs text-orange-600 mb-3">
                Если нужно еще больше фото - добавьте их сюда. Они отправятся автоматически вместе с основным отчетом.
              </p>

              {/* Input для дополнительных фото */}
              <input
                ref={additionalPhotoInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    addAdditionalPhotos([e.target.files[0]]);
                  }
                }}
                disabled={isLoading}
                className="hidden"
                name="additional_photo"
                id="additional_photo"
              />

              {/* Кнопка для добавления дополнительных фото */}
              <button
                type="button"
                onClick={() => additionalPhotoInputRef.current?.click()}
                disabled={isLoading || additionalPhotos.length >= 10}
                className={`w-full photo-upload-button ${
                  additionalPhotos.length >= 10
                    ? 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-60'
                    : 'border-orange-300 bg-orange-50 hover:bg-orange-100 hover:border-orange-400'
                }`}
              >
                <div className="flex items-center justify-center gap-3">
                  <Camera size={24} className="text-orange-600" />
                  <div className="text-center">
                    <div className="font-semibold text-orange-700 text-lg">
                      {additionalPhotos.length >= 10
                        ? 'Достигнут максимум (10 фото)'
                        : 'Добавить дополнительные фото'
                      }
                    </div>
                    <div className="text-sm text-orange-600">
                      {additionalPhotos.length > 0
                        ? `Загружено: ${additionalPhotos.length} из 10`
                        : 'Эти фото отправятся вместе с основным отчетом'
                      }
                    </div>
                  </div>
                </div>
              </button>

              {/* Показываем дополнительные фотографии */}
              {additionalPhotos.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium text-orange-700 mb-2">
                    📸 Дополнительные фотографии ({additionalPhotos.length}):
                  </h4>
                  <p className="text-xs text-orange-600 mb-2">
                    ✅ Эти фото будут отправлены автоматически вместе с основным отчетом
                  </p>
                  <div className="space-y-2">
                    {additionalPhotos.map((photo, index) => (
                      <div key={index} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <div className="flex items-start gap-3">
                          <Image size={20} className="text-orange-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-orange-700 truncate mb-1">
                              📄 {photo.name}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-orange-600">
                              <span>📏 {(photo.size / 1024 / 1024).toFixed(2)} МБ</span>
                              <span>🖼️ {photo.type}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteAdditionalPhotoClick(index)}
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
          )}

          {/* Kitchen Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-orange-600 mb-3">Поставщики</h3>
            <p className="text-sm text-gray-600 mb-3">Наименования — количество — единица (кг/шт)</p>
            {formData.kitchen.map((item, index) => (
              <div key={index} className="grid grid-cols-3 gap-2 mb-2">
                <MemoizedInput
                  type="text"
                  placeholder="Наименование"
                  value={item.name}
                  onChange={(e) => handleArrayChange('kitchen', index, 'name', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`kitchen-name-${index}`}
                  id={`kitchen-name-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Количество"
                  value={item.quantity}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleArrayChange('kitchen', index, 'quantity', value)
                  )}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`kitchen-quantity-${index}`}
                  id={`kitchen-quantity-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="кг/шт"
                  value={item.unit}
                  onChange={(e) => handleArrayChange('kitchen', index, 'unit', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`kitchen-unit-${index}`}
                  id={`kitchen-unit-${index}`}
                />
              </div>
            ))}
            <button
              onClick={() => addArrayItem('kitchen')}
              disabled={isLoading}
              className="w-full p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <Plus size={16} />
             добавить еще
            </button>
          </div>

          {/* Bar Section */}
          <div className="mb-6">
            {/* Предупреждающий блок для перемещений */}
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <div className="text-amber-600 text-lg">⚠️</div>
                <div>
                  <p className="text-sm font-medium text-amber-800 mb-1">
                    Внимание!
                  </p>
                  <p className="text-sm text-amber-700">
                    Указывать информацию только если вы получили товар с другой точки!
                  </p>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-blue-600 mb-3">Перемещение с другой точки к вам</h3>
            <p className="text-sm text-gray-600 mb-3">Наименования — количество — единица (кг/шт)</p>
            {formData.bar.map((item, index) => (
              <div key={index} className="grid grid-cols-3 gap-2 mb-2">
                <MemoizedInput
                  type="text"
                  placeholder="Наименование"
                  value={item.name}
                  onChange={(e) => handleArrayChange('bar', index, 'name', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`bar-name-${index}`}
                  id={`bar-name-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Количество"
                  value={item.quantity}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleArrayChange('bar', index, 'quantity', value)
                  )}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`bar-quantity-${index}`}
                  id={`bar-quantity-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="кг/шт"
                  value={item.unit}
                  onChange={(e) => handleArrayChange('bar', index, 'unit', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`bar-unit-${index}`}
                  id={`bar-unit-${index}`}
                />
              </div>
            ))}
            <button
              onClick={() => addArrayItem('bar')}
              disabled={isLoading}
              className="w-full p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <Plus size={16} />
              добавить еще
            </button>
          </div>

          {/* Packaging Section */}
          <div className="mb-6">
            {/* Предупреждающий блок для покупок */}
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <div className="text-blue-600 text-lg">⚠️</div>
                <div>
                  <p className="text-sm font-medium text-blue-800 mb-2">
                    Внимание! Указывать полную информацию.
                  </p>
                  <p className="text-sm text-blue-700 mb-2">Пример:</p>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Огурцы 3 кг</li>
                    <li>• Майонез 10 пачек по 750 гр</li>
                  </ul>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-green-600 mb-3">Покупки с магазина</h3>
            <p className="text-sm text-gray-600 mb-3">Наименования — количество — единица (пачки/шт)</p>
            {formData.packaging.map((item, index) => (
              <div key={index} className="grid grid-cols-3 gap-2 mb-2">
                <MemoizedInput
                  type="text"
                  placeholder="Наименование"
                  value={item.name}
                  onChange={(e) => handleArrayChange('packaging', index, 'name', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-green-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`packaging-name-${index}`}
                  id={`packaging-name-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Количество"
                  value={item.quantity}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleArrayChange('packaging', index, 'quantity', value)
                  )}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-green-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`packaging-quantity-${index}`}
                  id={`packaging-quantity-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="пачки/шт"
                  value={item.unit}
                  onChange={(e) => handleArrayChange('packaging', index, 'unit', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-green-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`packaging-unit-${index}`}
                  id={`packaging-unit-${index}`}
                />
              </div>
            ))}
            <button
              onClick={() => addArrayItem('packaging')}
              disabled={isLoading}
              className="w-full p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
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
        message={`Вы уверены, что хотите удалить фотографию "${photoToDelete !== null ? formData.photos[photoToDelete]?.name : ''}"? Это действие нельзя отменить.`}
        confirmText="Удалить"
        cancelText="Отмена"
        type="danger"
      />

      {/* НОВОЕ: Модальное окно подтверждения удаления дополнительного фото */}
      <ConfirmationModal
        isOpen={showDeleteAdditionalPhotoModal}
        onClose={() => {
          setShowDeleteAdditionalPhotoModal(false);
          setAdditionalPhotoToDelete(null);
        }}
        onConfirm={handleConfirmDeleteAdditionalPhoto}
        title="Удалить дополнительную фотографию"
        message={`Вы уверены, что хотите удалить дополнительную фотографию "${additionalPhotoToDelete !== null ? additionalPhotos[additionalPhotoToDelete]?.name : ''}"? Это действие нельзя отменить.`}
        confirmText="Удалить"
        cancelText="Отмена"
        type="danger"
      />
    </>
  );
};

