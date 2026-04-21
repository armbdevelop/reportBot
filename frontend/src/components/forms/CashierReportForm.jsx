import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Camera, MapPin, Clock, Calculator, Send, RefreshCw, Home, Plus, CheckCircle, XCircle } from 'lucide-react';
import { MemoizedInput } from '../common/MemoizedInput';
import { ValidationAlert } from '../common/ValidationAlert';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useFormData } from '../../hooks/useFormData';
import { getCurrentMSKTime } from '../../utils/dateUtils';

export const CashierReportForm = ({
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
    date: getCurrentMSKTime(), // Формат для отображения (старое поле, оставляем для совместимости)
    reportDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD формат
    reportTime: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), // HH:MM формат
    cashierName: '',
    incomes: Array(2).fill({ amount: '', comment: '' }),
    expenses: Array(5).fill({ name: '', amount: '' }),
    iikoData: {
      totalRevenue: '',
      returns: '',
      acquiring: '',
      yandexPayQr: '',
      qrCode: '',
      onlineApp: '',
      yandexEda: '',
      yandexEdaNoSystem: ''
    },
    factCash: '',
    photo: null,
    receiptPhoto: null, // НОВОЕ: фото чека с магазина
    comments: '' // НОВОЕ: поле для комментариев
  });

  const [showClearModal, setShowClearModal] = useState(false);
  const [showDeletePhotoModal, setShowDeletePhotoModal] = useState(false);
  const [showDeleteReceiptPhotoModal, setShowDeleteReceiptPhotoModal] = useState(false); // НОВОЕ: модальное окно для удаления фото чека
  const { handleNumberInput } = useFormData(validationErrors, setValidationErrors);
  const photoInputRef = useRef(null);
  const receiptPhotoInputRef = useRef(null); // НОВОЕ: ref для поля загрузки фото чека


  // Загружаем черновик при инициализации
  useEffect(() => {
    if (currentDraftId) {
      const draftData = loadDraft(currentDraftId);
      if (draftData) {
        setFormData(draftData);
      }
    }
  }, [currentDraftId, loadDraft]);

  // Функция для автосохранения (теперь включаем фото)
  const autoSaveFunction = useCallback(async (data) => {
    if (data.location || data.shift || data.cashierName ||
        data.incomes.some(i => i.amount || i.comment) ||
        data.expenses.some(e => e.name || e.amount) ||
        Object.values(data.iikoData).some(v => v) ||
        data.factCash || data.photo || data.receiptPhoto || data.comments) {
      await saveDraft('cashier', data);
    }
  }, [saveDraft]);

  // Автосохранение каждые 300мс с сохранением фокуса
  useAutoSave(formData, autoSaveFunction, 300);

  const handleInputChange = useCallback((field, value, index = null, subfield = null) => {
    setFormData(prev => {
      if (index !== null && subfield) {
        const newArray = [...prev[field]];
        newArray[index] = { ...newArray[index], [subfield]: value };
        return { ...prev, [field]: newArray };
      } else if (index !== null) {
        const newArray = [...prev[field]];
        newArray[index] = value;
        return { ...prev, [field]: newArray };
      } else if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return {
          ...prev,
          [parent]: { ...prev[parent], [child]: value }
        };
      } else {
        return { ...prev, [field]: value };
      }
    });

    // Очищаем ошибки валидации при изменении поля
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Очищаем ошибки для полей приходов и расходов
    if (index !== null && subfield) {
      const errorKey = field === 'incomes'
        ? `income-${subfield}-${index}`
        : field === 'expenses'
          ? `expense-${subfield === 'name' ? 'name' : 'amount'}-${index}`
          : null;

      if (errorKey && validationErrors[errorKey]) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[errorKey];
          return newErrors;
        });
      }
    }
  }, [validationErrors, setValidationErrors]);

  const addIncomeEntry = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      incomes: [...prev.incomes, { amount: '', comment: '' }]
    }));
  }, []);

  const addExpenseEntry = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      expenses: [...prev.expenses, { name: '', amount: '' }]
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

  // Функция удаления фото с подтверждением
  const handleDeletePhoto = useCallback(() => {
    setFormData(prev => ({ ...prev, photo: null }));
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
    setShowDeletePhotoModal(false);
  }, []);

  // НОВОЕ: Функция удаления фото чека с подтверждением
  const handleDeleteReceiptPhoto = useCallback(() => {
    setFormData(prev => ({ ...prev, receiptPhoto: null }));
    if (receiptPhotoInputRef.current) {
      receiptPhotoInputRef.current.value = '';
    }
    setShowDeleteReceiptPhotoModal(false);
  }, []);

  // ИСПРАВЛЕНА ФОРМУЛА СОГЛАСНО ТЗ (ДОБАВЛЕНЫ НОВЫЕ ПОЛЯ)
  const calculateTotals = useMemo(() => {
    const totalIncome = formData.incomes.reduce((sum, item) =>
      sum + (parseFloat(item.amount) || 0), 0
    );
    const totalExpenses = formData.expenses.reduce((sum, item) =>
      sum + (parseFloat(item.amount) || 0), 0
    );

    // ИСПРАВЛЕНО: Итого эквайринг = все поля кроме общей выручки и возвратов (включая новые поля)
    const totalAcquiring = (parseFloat(formData.iikoData.acquiring) || 0) +
                          (parseFloat(formData.iikoData.yandexPayQr) || 0) +
                          (parseFloat(formData.iikoData.qrCode) || 0) +
                          (parseFloat(formData.iikoData.onlineApp) || 0) +
                          (parseFloat(formData.iikoData.yandexEda) || 0) +
                          (parseFloat(formData.iikoData.yandexEdaNoSystem) || 0);

    // ИСПРАВЛЕНО: ФОРМУЛА ПО ТЗ: (общая выручка) - (возвраты) + (внесения) - (итоговый расход) - (итого эквайринг)
    const totalRevenue = parseFloat(formData.iikoData.totalRevenue) || 0;
    const returns = parseFloat(formData.iikoData.returns) || 0;
    const calculatedAmount = totalRevenue - returns + totalIncome - totalExpenses - totalAcquiring;

    // ИСПРАВЛЕНО: Излишек/недостача = Факт наличные - Расчетная сумма
    const factCash = parseFloat(formData.factCash) || 0;
    const difference = factCash - calculatedAmount;

    return { totalIncome, totalExpenses, totalAcquiring, calculatedAmount, difference, factCash };
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    // Валидация
    const errors = {};

    if (!formData.location) errors.location = 'Выберите локацию';
    if (!formData.shift) errors.shift = 'Выберите смену';
    if (!formData.reportDate) errors.reportDate = 'Выберите дату отчета';
    if (!formData.reportTime) errors.reportTime = 'Выберите время отчета';
    if (!formData.cashierName.trim()) errors.cashierName = 'Введите имя кассира';
    if (!formData.photo) errors.photo = 'Добавьте фотографию кассового отчёта';
    if (!formData.iikoData.totalRevenue || parseFloat(formData.iikoData.totalRevenue) <= 0) {
      errors.totalRevenue = 'Введите общую выручку больше 0';
    }
    if (!formData.factCash || parseFloat(formData.factCash) < 0) {
      errors.factCash = 'Введите фактическую сумму наличных';
    }

    // Проверка приходов: если указана сумма, комментарий обязателен
    formData.incomes.forEach((income, index) => {
      if (income.amount && income.amount.trim() && (!income.comment || !income.comment.trim())) {
        errors[`income-comment-${index}`] = 'Комментарий обязателен при указании суммы';
      }
      if (income.comment && income.comment.trim() && (!income.amount || !income.amount.trim())) {
        errors[`income-amount-${index}`] = 'Сумма обязательна при указании комментария';
      }
    });

    // Проверка расходов: если указана сумма, комментарий обязателен
    formData.expenses.forEach((expense, index) => {
      if (expense.amount && expense.amount.trim() && (!expense.name || !expense.name.trim())) {
        errors[`expense-name-${index}`] = 'Комментарий обязателен при указании суммы';
      }
      if (expense.name && expense.name.trim() && (!expense.amount || !expense.amount.trim())) {
        errors[`expense-amount-${index}`] = 'Сумма обязательна при указании комментария';
      }
    });

    if (Object.keys(errors).length > 0) {
      showValidationErrors(errors);
      // Прокручиваем к верху страницы при появлении ошибок
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsLoading(true);

    try {
      // Подготовка FormData для API
      const apiFormData = new FormData();

      // Основные поля
      apiFormData.append('location', formData.location);
      apiFormData.append('shift_type', formData.shift === 'Утро' ? 'morning' : 'night');

      // Объединяем дату и время и отправляем как shift_date
      if (formData.reportDate && formData.reportTime) {
        const shiftDateTime = `${formData.reportDate}T${formData.reportTime}`;
        apiFormData.append('shift_date', shiftDateTime);
      }

      apiFormData.append('cashier_name', formData.cashierName);

      // Финансовые данные (ОБНОВЛЕНО: добавлены новые поля)
      apiFormData.append('total_revenue', parseFloat(formData.iikoData.totalRevenue) || 0);
      apiFormData.append('returns', parseFloat(formData.iikoData.returns) || 0);
      apiFormData.append('acquiring', parseFloat(formData.iikoData.acquiring) || 0);
      apiFormData.append('yandex_pay_qr', parseFloat(formData.iikoData.yandexPayQr) || 0);
      apiFormData.append('qr_code', parseFloat(formData.iikoData.qrCode) || 0);
      apiFormData.append('online_app', parseFloat(formData.iikoData.onlineApp) || 0);
      apiFormData.append('yandex_food', parseFloat(formData.iikoData.yandexEda) || 0);
      apiFormData.append('yandex_food_no_system', parseFloat(formData.iikoData.yandexEdaNoSystem) || 0);

      // ИСПРАВЛЕНО: Отправляем фактическую сумму наличных
      apiFormData.append('fact_cash', parseFloat(formData.factCash) || 0);

      // Приходы (JSON)
      const incomeEntries = formData.incomes
        .filter(item => item.amount && item.comment)
        .map(item => ({ amount: parseFloat(item.amount), comment: item.comment }));

      if (incomeEntries.length > 0) {
        apiFormData.append('income_entries_json', JSON.stringify(incomeEntries));
      }

      // Расходы (JSON)
      const expenseEntries = formData.expenses
        .filter(item => item.name && item.amount)
        .map(item => ({ description: item.name, amount: parseFloat(item.amount) }));

      if (expenseEntries.length > 0) {
        apiFormData.append('expense_entries_json', JSON.stringify(expenseEntries));
      }

      // Фото
      apiFormData.append('photo', formData.photo);

      // НОВОЕ: Фото чека с магазина (необязательное)
      if (formData.receiptPhoto) {
        apiFormData.append('receipt_photo', formData.receiptPhoto);
      }

      // Комментарии
      if (formData.comments && formData.comments.trim()) {
        apiFormData.append('comments', formData.comments.trim());
      }

      await apiService.createShiftReport(apiFormData);
      clearCurrentDraft(); // Удаляем черновик сразу после успешной отправки
      showNotification('success', 'Отчет отправлен!', 'Отчет смены успешно отправлен и сохранен в системе');

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
              <h1 className="text-2xl font-bold text-green-600">💰 Кассовый отчет</h1>
              {currentDraftId && (
                <p className="text-sm text-green-600">✓ Автосохранение включено</p>
              )}
            </div>
          </div>

          {/* Ошибки валидации */}
          <ValidationAlert errors={validationErrors} />

          {/* Location Selection */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
              <MapPin size={16} className="text-red-500" />
              Адрес локации *
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
              <Clock size={16} className="text-yellow-500" />
              Выбор смены *
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

          {/* Date & Time - два отдельных поля */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Дата */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Дата отчета *
              </label>
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
                    : 'bg-white border-gray-300 focus:border-green-500 focus:outline-none text-gray-700'
                }`}
                name="report-date"
                id="report-date"
              />
              {validationErrors.reportDate && (
                <p className="text-xs text-red-600 mt-1">⚠️ {validationErrors.reportDate}</p>
              )}
            </div>

            {/* Время */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ⏰ Время отчета *
              </label>
              <input
                type="time"
                value={formData.reportTime}
                onChange={(e) => handleInputChange('reportTime', e.target.value)}
                disabled={isLoading}
                step="60"
                className={`w-full p-3 border rounded-lg transition-colors disabled:opacity-50 ${
                  validationErrors.reportTime 
                    ? 'border-red-400 bg-red-50 text-red-700' 
                    : 'bg-white border-gray-300 focus:border-green-500 focus:outline-none text-gray-700'
                }`}
                name="report-time"
                id="report-time"
              />
              {validationErrors.reportTime && (
                <p className="text-xs text-red-600 mt-1">⚠️ {validationErrors.reportTime}</p>
              )}
            </div>
          </div>

          <div className="mb-6">
            <label className="text-sm font-medium block mb-2 text-gray-700">👤 Имя кассира *</label>
            <MemoizedInput
              type="text"
              value={formData.cashierName}
              onChange={(e) => handleInputChange('cashierName', e.target.value)}
              disabled={isLoading}
              className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
              placeholder="Введите имя кассира"
              name="cashierName"
              id="cashierName"
              hasError={!!validationErrors.cashierName}
            />
          </div>

          {/* Income Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-green-600 mb-3">💰 Приход денег/внесения</h3>
            <p className="text-sm text-gray-600 mb-3">сумма — подробный комментарий</p>
            {formData.incomes.map((income, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 mb-2">
                <MemoizedInput
                  type="text"
                  placeholder="Сумма"
                  value={income.amount}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange('incomes', value, index, 'amount')
                  )}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-green-500 focus:outline-none disabled:opacity-50 transition-colors"
                  name={`income-amount-${index}`}
                  id={`income-amount-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Комментарий"
                  value={income.comment}
                  onChange={(e) => handleInputChange('incomes', e.target.value, index, 'comment')}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-green-500 focus:outline-none disabled:opacity-50 transition-colors"
                  name={`income-comment-${index}`}
                  id={`income-comment-${index}`}
                />
              </div>
            ))}
            <button
              onClick={addIncomeEntry}
              disabled={isLoading}
              className="w-full p-2 mb-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <Plus size={16} />
              добавить еще
            </button>
            <div className="text-right text-green-600 font-semibold bg-green-50 p-2 rounded-lg">
              Итого приход: {calculateTotals.totalIncome.toLocaleString()} ₽
            </div>
          </div>

          {/* Expenses Section */}
          <div className="mb-6">
            {/* Информационный блок о правилах расходов - РАЗДЕЛЕН НА ДВА БЛОКА */}
            
            {/* Первый блок - Правила (красный цвет) */}
            <div className="mb-3 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
              <h4 className="text-base font-bold text-red-800 mb-3">🚨 ВНИМАНИЕ! При внесении расходов:</h4>
              <ul className="text-sm text-red-700 space-y-2 font-semibold">
                <li>• Указывать максимально подробную информацию (назначение, сотрудник, детали).</li>
                <li>• Заранее информировать управляющего или менеджера смены о каждом расходе.</li>
              </ul>
            </div>

            {/* Второй блок - Примеры (желтый цвет) */}
            <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg">
              <h4 className="text-base font-bold text-yellow-800 mb-3">💡 Примеры корректного описания:</h4>
              <ul className="text-sm text-yellow-700 space-y-1 pl-2 font-medium">
                <li>• Зарплата Камиль (повар)</li>
                <li>• Такси — / оплата передачи с другой точки / оплата за ложный вызов / оплата за не забранный заказ</li>
                <li>• Оплата накладной от GFC (с указанием наименований товаров)</li>
              </ul>
            </div>

            {/* Третий блок - Информация о чеках (голубой цвет) */}
            <div className="mb-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
              <h4 className="text-base font-bold text-blue-800 mb-2 flex items-center gap-2">
                <span className="text-lg">ℹ️</span> Инфо
              </h4>
              <p className="text-sm text-blue-700 leading-relaxed">
                Старайтесь покупать в магазинах где дают чек, нам важна такая информация как <strong>наименование</strong>, <strong>количество/вес</strong> и <strong>цена</strong>.
              </p>
              <p className="text-sm text-blue-700 leading-relaxed mt-2">
                Если чек все же не выдали, напишите от руки: наименование — количество/вес и цену и сделайте фотографию такого &quot;чека&quot; который оплатили.
              </p>
            </div>

            <h3 className="text-lg font-semibold text-red-600 mb-3">💸 Расходы</h3>
            <p className="text-sm text-gray-600 mb-3">сумма — подробный комментарий</p>
            {formData.expenses.map((expense, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 mb-2">
                <MemoizedInput
                  type="text"
                  placeholder="Сумма"
                  value={expense.amount}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange('expenses', value, index, 'amount')
                  )}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none disabled:opacity-50 transition-colors"
                  name={`expense-amount-${index}`}
                  id={`expense-amount-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Комментарий"
                  value={expense.name}
                  onChange={(e) => handleInputChange('expenses', e.target.value, index, 'name')}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none disabled:opacity-50 transition-colors"
                  name={`expense-name-${index}`}
                  id={`expense-name-${index}`}
                />
              </div>
            ))}
            <button
              onClick={addExpenseEntry}
              disabled={isLoading}
              className="w-full p-2 mb-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <Plus size={16} />
              добавить еще
            </button>
            <div className="text-right text-red-600 font-semibold bg-red-50 p-2 rounded-lg">
              Итого расходы: {calculateTotals.totalExpenses.toLocaleString()} ₽
            </div>

            {/* НОВОЕ: Фото чека с магазина */}
            <div className="mt-4">
              <label className="flex items-center gap-2 text-sm font-medium mb-3 text-gray-700">
                <Camera size={16} className="text-blue-500" />
                Фото чека с магазина (необязательно)
              </label>

              {/* Скрытый input для фото чека */}
              <input
                ref={receiptPhotoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  // Сохраняем текущую позицию скролла перед обновлением состояния
                  const scrollPosition = window.scrollY;
                  setFormData(prev => ({ ...prev, receiptPhoto: e.target.files[0] }));
                  // Восстанавливаем позицию скролла после рендера
                  requestAnimationFrame(() => {
                    window.scrollTo(0, scrollPosition);
                  });
                }}
                disabled={isLoading}
                className="hidden"
                name="receiptPhoto"
                id="receiptPhoto"
              />

              {/* Кнопка загрузки фото чека */}
              <button
                type="button"
                onClick={() => receiptPhotoInputRef.current?.click()}
                disabled={isLoading}
                className="w-full photo-upload-button border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-400"
              >
                <div className="flex items-center justify-center gap-3">
                  <Camera size={24} className="text-blue-600" />
                  <div className="text-center">
                    <div className="font-semibold text-blue-700 text-lg">+ Добавить фото чека с магазина</div>
                    <div className="text-xs text-blue-600 mt-1">Необязательное поле</div>
                  </div>
                </div>
              </button>

              {/* Показываем выбранный файл чека */}
              {formData.receiptPhoto && (
                <div className="photo-selected bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle size={20} className="text-green-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-700 mb-1">
                        ✅ Фото чека успешно выбрано
                      </p>
                      <p className="text-sm text-green-600 truncate mb-2">
                        📄 {formData.receiptPhoto.name}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-green-600">
                        <span>📏 {(formData.receiptPhoto.size / 1024 / 1024).toFixed(2)} МБ</span>
                        <span>🖼️ {formData.receiptPhoto.type}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDeleteReceiptPhotoModal(true)}
                      className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
                      disabled={isLoading}
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* iiko Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-blue-600 mb-3">📱 iiko информация</h3>
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium block mb-1 text-gray-700">Общая выручка: *</label>
                <MemoizedInput
                  type="text"
                  placeholder="Общая выручка"
                  value={formData.iikoData.totalRevenue}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange(`iikoData.totalRevenue`, value)
                  )}
                  disabled={isLoading}
                  className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
                  name="iiko-totalRevenue"
                  id="iiko-totalRevenue"
                  hasError={validationErrors.totalRevenue}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1 text-gray-700">Возвраты:</label>
                <MemoizedInput
                  type="text"
                  placeholder="Возвраты"
                  value={formData.iikoData.returns}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange(`iikoData.returns`, value)
                  )}
                  disabled={isLoading}
                  className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
                  name="iiko-returns"
                  id="iiko-returns"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1 text-gray-700">*СберБанк терминал:</label>
                <MemoizedInput
                  type="text"
                  placeholder="СберБанк терминал"
                  value={formData.iikoData.acquiring}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange(`iikoData.acquiring`, value)
                  )}
                  disabled={isLoading}
                  className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
                  name="iiko-acquiring"
                  id="iiko-acquiring"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1 text-gray-700">*QR код от Яндекс.Пэй:</label>
                <MemoizedInput
                  type="text"
                  placeholder="QR код от Яндекс.Пэй"
                  value={formData.iikoData.yandexPayQr}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange(`iikoData.yandexPayQr`, value)
                  )}
                  disabled={isLoading}
                  className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
                  name="iiko-yandexPayQr"
                  id="iiko-yandexPayQr"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1 text-gray-700">*Не работает терминал (QR с телеграмм):</label>
                <MemoizedInput
                  type="text"
                  placeholder="Не работает терминал (QR с телеграмм)"
                  value={formData.iikoData.qrCode}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange(`iikoData.qrCode`, value)
                  )}
                  disabled={isLoading}
                  className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
                  name="iiko-qrCode"
                  id="iiko-qrCode"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1 text-gray-700">*Онлайн приложение:</label>
                <MemoizedInput
                  type="text"
                  placeholder="Онлайн приложение"
                  value={formData.iikoData.onlineApp}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange(`iikoData.onlineApp`, value)
                  )}
                  disabled={isLoading}
                  className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
                  name="iiko-onlineApp"
                  id="iiko-onlineApp"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1 text-gray-700">*Яндекс.Еда:</label>
                <MemoizedInput
                  type="text"
                  placeholder="Яндекс.Еда"
                  value={formData.iikoData.yandexEda}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange(`iikoData.yandexEda`, value)
                  )}
                  disabled={isLoading}
                  className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
                  name="iiko-yandexEda"
                  id="iiko-yandexEda"
                />
              </div>
              {/* НОВЫЕ ПОЛЯ */}
              <div>
                <label className="text-sm font-medium block mb-1 text-gray-700">*Я.Еда — оплачен (не пришел заказ в iiko):</label>
                <MemoizedInput
                  type="text"
                  placeholder="Я.Еда — оплачен (не пришел заказ в iiko)"
                  value={formData.iikoData.yandexEdaNoSystem}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange(`iikoData.yandexEdaNoSystem`, value)
                  )}
                  disabled={isLoading}
                  className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
                  name="iiko-yandexEdaNoSystem"
                  id="iiko-yandexEdaNoSystem"
                />
              </div>
            </div>
          </div>

          {/* ИТОГОВЫЙ ОТЧЁТ */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-purple-600 mb-3">📊 ИТОГОВЫЙ ОТЧЁТ</h3>
            <div className="space-y-3">
              {/* Факт наличные - ДОБАВЛЕНО ПОЛЕ ДЛЯ ВВОДА */}
              <div>
                <label className="text-sm font-medium block mb-2 text-gray-700">
                  Факт наличные: (указать фактическую сумму наличных) *
                </label>
                <MemoizedInput
                  type="text"
                  placeholder="Введите фактическую сумму наличных"
                  value={formData.factCash}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange('factCash', value)
                  )}
                  disabled={isLoading}
                  className="w-full p-3 bg-white border rounded-lg focus:border-purple-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
                  name="factCash"
                  id="factCash"
                  hasError={!!validationErrors.factCash}
                />
              </div>

              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="text-sm text-purple-700 space-y-1">
                  <div className="flex justify-between">
                    <span>Итого эквайринг:</span>
                    <span className="font-semibold">{calculateTotals.totalAcquiring.toLocaleString()} ₽</span>
                  </div>
                  <div className="text-xs text-purple-600">
                    (авто подсчёт всех пунктов которые отмечены &quot;*&quot;)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Photo Upload */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium mb-3 text-gray-700">
              <Camera size={16} className="text-purple-500" />
              Фотография кассового отчёта с iiko*
            </label>

            {/* Скрытый input для фото */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                // Сохраняем текущую позицию скролла перед обновлением состояния
                const scrollPosition = window.scrollY;
                setFormData(prev => ({ ...prev, photo: e.target.files[0] }));
                if (validationErrors.photo) {
                  setValidationErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.photo;
                    return newErrors;
                  });
                }
                // Восстанавливаем позицию скролла после рендера
                requestAnimationFrame(() => {
                  window.scrollTo(0, scrollPosition);
                });
              }}
              disabled={isLoading}
              className="hidden"
              name="photo"
              id="photo"
            />

            {/* Универсальная кнопка загрузки фото */}
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={isLoading}
              className={`w-full photo-upload-button ${
                validationErrors.photo 
                  ? 'border-red-400 bg-red-50 hover:bg-red-100' 
                  : 'border-purple-300 bg-purple-50 hover:bg-purple-100 hover:border-purple-400'
              }`}
            >
              <div className="flex items-center justify-center gap-3">
                <Camera size={24} className="text-purple-600" />
                <div className="text-center">
                  <div className="font-semibold text-purple-700 text-lg">Добавить фото отчёта</div>
                </div>
              </div>
            </button>

            {/* Показываем выбранный файл */}
            {formData.photo && (
              <div className="photo-selected bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                <div className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-green-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-700 mb-1">
                      ✅ Фото успешно выбрано
                    </p>
                    <p className="text-sm text-green-600 truncate mb-2">
                      📄 {formData.photo.name}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-green-600">
                      <span>📏 {(formData.photo.size / 1024 / 1024).toFixed(2)} МБ</span>
                      <span>🖼️ {formData.photo.type}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeletePhotoModal(true)}
                    className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
                    disabled={isLoading}
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Подсказка если фото не выбрано */}
            {!formData.photo && (
              <div className={`text-center p-4 rounded-lg border-2 border-dashed transition-colors mt-4 ${
                validationErrors.photo 
                  ? 'border-red-300 bg-red-50 text-red-600' 
                  : 'border-gray-300 bg-gray-50 text-gray-500'
              }`}>
                <Camera size={32} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium mb-1">
                  {validationErrors.photo
                    ? '❌ Необходимо добавить фотографию отчёта'
                    : '📸 Нажмите кнопку выше'}
                </p>
                <p className="text-xs text-gray-400">
                  *возможно добавить только фотографию с галереи
                </p>
              </div>
            )}
          </div>

          {/* Calculation Results - ИСПРАВЛЕННАЯ ФОРМУЛА */}
          <div className="mb-6 p-4 bg-white border border-gray-300 rounded-lg shadow-sm">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-yellow-600 mb-3">
              <Calculator size={20} />
              Подсчет излишки/недостачи
            </h3>
            <div className="space-y-2 text-sm">
              <div className="text-xs text-gray-600 mb-2">
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Расчетная сумма:</span>
                <span className="font-semibold">{calculateTotals.calculatedAmount.toLocaleString()} ₽</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Факт наличные:</span>
                <span className="font-semibold">{calculateTotals.factCash.toLocaleString()} ₽</span>
              </div>
              <hr className="border-gray-300" />
              <div className={`flex justify-between font-bold ${calculateTotals.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <span>{calculateTotals.difference >= 0 ? '✅ Излишек:' : '❌ Недостача:'}</span>
                <span>{Math.abs(calculateTotals.difference).toLocaleString()} ₽</span>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="mb-6">
            <label className="text-sm font-medium block mb-2 text-gray-700">💬 Комментарии</label>
            <p className="text-xs text-gray-600 mb-3">Дополнительные комментарии к отчету (необязательно)</p>
            <textarea
              value={formData.comments}
              onChange={(e) => handleInputChange('comments', e.target.value)}
              disabled={isLoading}
              className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:border-gray-500 focus:outline-none disabled:opacity-50 transition-colors resize-none"
              placeholder="Введите дополнительные комментарии к отчету..."
              rows={4}
              name="comments"
              id="comments"
            />
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
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 shadow-md hover:shadow-lg"
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
        onClose={() => setShowDeletePhotoModal(false)}
        onConfirm={handleDeletePhoto}
        title="Удалить фотографию"
        message="Вы уверены, что хотите удалить выбранную фотографию? Это действие нельзя отменить."
        confirmText="Удалить"
        cancelText="Отмена"
        type="danger"
      />

      {/* НОВОЕ: Модальное окно подтверждения удаления фото чека */}
      <ConfirmationModal
        isOpen={showDeleteReceiptPhotoModal}
        onClose={() => setShowDeleteReceiptPhotoModal(false)}
        onConfirm={handleDeleteReceiptPhoto}
        title="Удалить фото чека"
        message="Вы уверены, что хотите удалить фото чека с магазина? Это действие нельзя отменить."
        confirmText="Удалить"
        cancelText="Отмена"
        type="danger"
      />
    </>
  );
};
