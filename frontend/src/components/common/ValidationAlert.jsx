import React from 'react';
import { AlertCircle } from 'lucide-react';

// Компонент для показа ошибок валидации на форме
export const ValidationAlert = React.memo(({ errors }) => {
  if (!errors || Object.keys(errors).length === 0) return null;

  return (
    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle size={16} className="text-red-500" />
        <h4 className="text-red-800 font-semibold">Ошибка валидации</h4>
      </div>
      <ul className="text-red-700 text-sm space-y-1">
        {Object.values(errors).map((error, index) => (
          <li key={index}>• {error}</li>
        ))}
      </ul>
    </div>
  );
});