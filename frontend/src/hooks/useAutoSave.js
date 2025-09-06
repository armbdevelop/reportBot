import { useEffect, useRef } from 'react';
import { useFocusPreservation } from './useFocusPreservation';

// Хук для автосохранения с сохранением фокуса
export const useAutoSave = (data, saveFunction, delay = 300) => {
  const timeoutRef = useRef(null);
  const { saveFocus, restoreFocus } = useFocusPreservation();

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      saveFocus();
      await saveFunction(data);
      restoreFocus();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, saveFunction, delay, saveFocus, restoreFocus]);
};