import { useCallback } from 'react';

// Хук для общих функций работы с формами
export const useFormData = (validationErrors, setValidationErrors) => {
  // Функция для обработки числового ввода
  const handleNumberInput = useCallback((e, callback) => {
    const value = e.target.value;

    // Дополнительная проверка на случай загрузки из localStorage
    if (value === '' || value === null || value === undefined) {
      callback('');
      return;
    }

    // Преобразуем в строку если это не строка
    const stringValue = String(value);

    // Проверяем корректность числового значения
    if (/^\d*\.?\d*$/.test(stringValue)) {
      callback(stringValue);
    }
  }, []);

  // Функция для очистки ошибки валидации при изменении поля
  const clearValidationError = useCallback((field) => {
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [validationErrors, setValidationErrors]);

  return {
    handleNumberInput,
    clearValidationError
  };
};