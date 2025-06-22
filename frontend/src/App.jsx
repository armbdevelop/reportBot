import React, { useState, useCallback, useEffect } from 'react';
import {
  MainMenu,
  CashierReportForm,
  InventoryForm,
  ReceivingForm,
  WriteOffForm,
  TransferForm,
  InventoryManagement
} from './components/forms';
import { NotificationScreen } from './components/common';
import { apiService } from './services/apiService';
import {LOCATIONS, CASHIER_LOCATIONS, REPORT_LOCATIONS, PEREMESHENIYA} from './constants';
import './App.css';

// Функция для конвертации File в base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

// Функция для конвертации base64 обратно в File
const base64ToFile = (base64, filename) => {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

// Draft storage functions
const getDrafts = () => {
  try {
    const drafts = localStorage.getItem('reportDrafts');
    return drafts ? JSON.parse(drafts) : [];
  } catch (error) {
    console.error('Error loading drafts:', error);
    return [];
  }
};

const saveDrafts = (drafts) => {
  try {
    localStorage.setItem('reportDrafts', JSON.stringify(drafts));
  } catch (error) {
    console.error('Error saving drafts:', error);
  }
};

function App() {
  const [currentForm, setCurrentForm] = useState('menu');
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [notification, setNotification] = useState(null);
  const [drafts, setDrafts] = useState([]);

  // Load drafts on app start
  useEffect(() => {
    setDrafts(getDrafts());
  }, []);

  // Draft management functions с логикой base64 как в монолитной версии
  const saveDraft = useCallback(async (type, data) => {
    if (!data || typeof data !== 'object') return;

    const draftId = currentDraftId || Date.now().toString();

    try {
      // Конвертируем фото в base64 если есть
      const dataToSave = { ...data };

      // Обрабатываем одиночное фото (для отчета смены)
      if (dataToSave.photo && dataToSave.photo instanceof File) {
        try {
          dataToSave.photoBase64 = await fileToBase64(dataToSave.photo);
          dataToSave.photoName = dataToSave.photo.name;
          delete dataToSave.photo;
        } catch (error) {
          console.warn('Не удалось сохранить фото в черновик:', error);
          delete dataToSave.photo;
        }
      }

      // Обрабатываем массив фотографий (для отчета приема товаров)
      if (dataToSave.photos && Array.isArray(dataToSave.photos) && dataToSave.photos.length > 0) {
        try {
          dataToSave.photosBase64 = [];
          for (const photo of dataToSave.photos) {
            if (photo instanceof File) {
              const base64 = await fileToBase64(photo);
              dataToSave.photosBase64.push({
                base64: base64,
                name: photo.name,
                type: photo.type,
                size: photo.size
              });
            }
          }
          delete dataToSave.photos;
        } catch (error) {
          console.warn('Не удалось сохранить фотографии в черновик:', error);
          delete dataToSave.photos;
        }
      }

      // Обрабатываем дополнительные фотографии (для отчета приема товаров)
      if (dataToSave.additionalPhotos && Array.isArray(dataToSave.additionalPhotos) && dataToSave.additionalPhotos.length > 0) {
        try {
          dataToSave.additionalPhotosBase64 = [];
          for (const photo of dataToSave.additionalPhotos) {
            if (photo instanceof File) {
              const base64 = await fileToBase64(photo);
              dataToSave.additionalPhotosBase64.push({
                base64: base64,
                name: photo.name,
                type: photo.type,
              });
            }
          }
          delete dataToSave.additionalPhotos;
        } catch (error) {
          console.warn('Не удалось сохранить дополнительные фотографии в черновик:', error);
          delete dataToSave.additionalPhotos;
        }
      }

      const draft = {
        id: draftId,
        type: type,
        data: dataToSave,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const existingDrafts = getDrafts();
      const draftIndex = existingDrafts.findIndex(d => d.id === draftId);

      if (draftIndex !== -1) {
        existingDrafts[draftIndex] = { ...existingDrafts[draftIndex], ...draft, updatedAt: new Date().toISOString() };
      } else {
        existingDrafts.push(draft);
      }

      saveDrafts(existingDrafts);
      setDrafts(existingDrafts);

      if (!currentDraftId) {
        setCurrentDraftId(draftId);
      }
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  }, [currentDraftId]);

  // Отдельная функция для загрузки черновика из MainMenu
  const loadDraftFromMenu = useCallback((draftId) => {
    const drafts = getDrafts();
    const draft = drafts.find(d => d.id === draftId);
    if (draft) {
      setCurrentDraftId(draftId);
      setCurrentForm(draft.type);
    }
  }, []);

  const loadDraft = useCallback((draftId) => {
    try {
      const drafts = getDrafts();
      const draft = drafts.find(d => d.id === draftId);
      if (draft) {
        // Восстанавливаем данные
        const draftData = { ...draft.data };

        // Восстанавливаем одиночное фото из base64 (для отчета смены)
        if (draftData.photoBase64 && draftData.photoName) {
          try {
            draftData.photo = base64ToFile(draftData.photoBase64, draftData.photoName);
            delete draftData.photoBase64;
            delete draftData.photoName;
          } catch (error) {
            console.warn('Не удалось восстановить фото из черновика:', error);
          }
        }

        // Восстанавливаем массив фотографий из base64 (для отчета приема товаров)
        if (draftData.photosBase64 && Array.isArray(draftData.photosBase64)) {
          try {
            draftData.photos = [];
            for (const photoData of draftData.photosBase64) {
              const file = base64ToFile(photoData.base64, photoData.name);
              draftData.photos.push(file);
            }
            delete draftData.photosBase64;
          } catch (error) {
            console.warn('Не удалось восстановить фотографии из черновика:', error);
            draftData.photos = [];
          }
        }
        // Восстанавливаем дополнительные фотографии из base64 (для отчета приема товаров)
        if (draftData.additionalPhotosBase64 && Array.isArray(draftData.additionalPhotosBase64)) {
          try {
            draftData.additionalPhotos = [];
            for (const photoData of draftData.additionalPhotosBase64) {
              const file = base64ToFile(photoData.base64, photoData.name);
              draftData.additionalPhotos.push(file);
            }
            delete draftData.additionalPhotosBase64;
          } catch (error) {
            console.warn('Не удалось восстановить дополнительные фотографии из черновика:', error);
            draftData.additionalPhotos = [];
          }
        }

        return draftData;
      }
      return null;
    } catch (error) {
      console.error('Error loading draft:', error);
      return null;
    }
  }, []);

  const deleteDraft = useCallback((draftId) => {
    try {
      const drafts = getDrafts();
      const updatedDrafts = drafts.filter(d => d.id !== draftId);
      saveDrafts(updatedDrafts);
      setDrafts(updatedDrafts);

      if (currentDraftId === draftId) {
        setCurrentDraftId(null);
      }
    } catch (error) {
      console.error('Error deleting draft:', error);
    }
  }, [currentDraftId]);

  const clearCurrentDraft = useCallback(() => {
    if (currentDraftId) {
      deleteDraft(currentDraftId);
    }
  }, [currentDraftId, deleteDraft]);

  // Navigation functions
  const goToMenu = useCallback(() => {
    setCurrentForm('menu');
    setCurrentDraftId(null);
    setValidationErrors({});
    setDrafts(getDrafts()); // Обновляем список черновиков
  }, []);

  // Notification functions - показываем только для успеха или критических ошибок
  const showNotification = useCallback((type, title, message) => {
    // Показываем NotificationScreen только для успеха или критических ошибок сервера
    if (type === 'success' || message.includes('сервер') || message.includes('Сеть')) {
      setNotification({ type, title, message });
    }
  }, []);

  const clearNotification = useCallback(() => {
    setNotification(null);
    goToMenu();
  }, [goToMenu]);

  const showValidationErrors = useCallback((errors) => {
    setValidationErrors(errors);
    // Прокручиваем к первой ошибке
    setTimeout(() => {
      const firstErrorField = document.querySelector('.border-red-400');
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }, []);

  // Form props object
  const formProps = {
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
    locations: LOCATIONS,
    cashierLocations: CASHIER_LOCATIONS,
    reportLocations: REPORT_LOCATIONS,
    peremesheniya: PEREMESHENIYA,
    apiService
  };

  // Show notification screen if notification exists
  if (notification) {
    return (
      <NotificationScreen
        notification={notification}
        clearNotification={clearNotification}
      />
    );
  }

  // Render appropriate form
  switch (currentForm) {
    case 'cashier':
      return <CashierReportForm {...formProps} locations={formProps.cashierLocations}/>;
    case 'inventory':
      return <InventoryForm {...formProps} locations={formProps.reportLocations}/>;
    case 'receiving':
      return <ReceivingForm {...formProps} locations={formProps.reportLocations}/>;
    case 'writeoff':
      return <WriteOffForm {...formProps} locations={formProps.reportLocations}/>;
    case 'transfer':
      return <TransferForm {...formProps} locations={formProps.peremesheniya}/>;
    case 'inventory-management':
      return <InventoryManagement goToMenu={goToMenu}/>;
    default:
      return (
        <MainMenu
          drafts={drafts}
          setCurrentForm={setCurrentForm}
          setCurrentDraftId={setCurrentDraftId}
          setValidationErrors={setValidationErrors}
          deleteDraft={deleteDraft}
          loadDraft={loadDraftFromMenu}
        />
      );
  }
}

export default App;