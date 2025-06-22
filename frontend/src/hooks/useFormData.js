import { useCallback } from 'react';

// Хук для общих функций работы с формами
export const useFormData = (validationErrors, setValidationErrors) => {
  // Функция для обработки числового ввода
  const handleNumberInput = useCallback((e, callback) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      callback(value);
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