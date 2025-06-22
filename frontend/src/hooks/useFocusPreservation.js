import { useRef, useCallback } from 'react';

// Хук для сохранения и восстановления фокуса
export const useFocusPreservation = () => {
  const focusInfoRef = useRef(null);

  const saveFocus = useCallback(() => {
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      focusInfoRef.current = {
        element: activeElement,
        selectionStart: activeElement.selectionStart,
        selectionEnd: activeElement.selectionEnd,
        name: activeElement.name,
        id: activeElement.id,
        className: activeElement.className
      };
    }
  }, []);

  const restoreFocus = useCallback(() => {
    if (focusInfoRef.current) {
      const { element, selectionStart, selectionEnd, name, id, className } = focusInfoRef.current;

      let targetElement = element;
      if (!document.contains(element)) {
        if (id) targetElement = document.getElementById(id);
        else if (name) targetElement = document.querySelector(`[name="${name}"]`);
        else if (className) targetElement = document.querySelector(`.${className.split(' ')[0]}`);
      }

      if (targetElement && document.contains(targetElement)) {
        setTimeout(() => {
          targetElement.focus();
          if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
            targetElement.setSelectionRange(selectionStart, selectionEnd);
          }
        }, 0);
      }
    }
  }, []);

  return { saveFocus, restoreFocus };
};