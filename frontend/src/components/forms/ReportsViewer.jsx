import React, { useState, useEffect, useCallback } from 'react';

const REPORT_CATEGORIES = [
  {
    id: 'shift-reports',
    name: 'Кассовые отчёты',
    api: 'shift-reports',
    icon: '💰',
    color: 'bg-green-50 border-green-200',
    headerColor: 'bg-green-500'
  },
  {
    id: 'receiving-reports',
    name: 'Отчёт приема товара',
    api: 'report-on-goods',
    icon: '📦',
    color: 'bg-blue-50 border-blue-200',
    headerColor: 'bg-blue-500'
  },
  {
    id: 'writeoff-reports',
    name: 'Списания',
    api: 'writeoff-transfer',
    type: 'writeoff',
    icon: '❌',
    color: 'bg-red-50 border-red-200',
    headerColor: 'bg-red-500'
  },
  {
    id: 'transfer-reports',
    name: 'Перемещения',
    api: 'writeoff-transfer',
    type: 'transfer',
    icon: '🔄',
    color: 'bg-purple-50 border-purple-200',
    headerColor: 'bg-purple-500'
  }
];

const LOCATIONS = [
  { id: 'all', name: 'Все локации', value: 'all' },
  { id: 'gagarina', name: 'Гагарина 48/1', value: 'Гагарина 48/1' },
  { id: 'abdulhakima', name: 'Абдулхакима Исмаилова 51', value: 'Абдулхакима Исмаилова 51' },
  { id: 'gaydara', name: 'Гайдара Гаджиева 7Б', value: 'Гайдара Гаджиева 7Б' }
];

const ReportsViewer = ({ goToMenu, apiService }) => {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(true);

  // Новое состояние для отслеживания развернутых секций
  const [expandedSections, setExpandedSections] = useState({});

  const ITEMS_PER_PAGE = 10;

  // Установка даты по умолчанию (последние 30 дней)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  const fetchReports = useCallback(async () => {
    if (!selectedCategory || !startDate || !endDate) return;

    setIsLoading(true);
    setError('');

    try {
      const category = REPORT_CATEGORIES.find(cat => cat.id === selectedCategory);
      if (!category) throw new Error('Неизвестная категория отчета');

      const params = {
        start_date: startDate,
        end_date: endDate,
        page: currentPage,
        per_page: ITEMS_PER_PAGE
      };

      if (selectedLocation !== 'all') {
        params.location = selectedLocation;
      }

      if (category.type) {
        params.type = category.type;
      }

      const response = await apiService.getReports(category.api, params);

      setReports(response.reports || []);
      setTotalCount(response.total || 0);
      setTotalPages(Math.ceil((response.total || 0) / ITEMS_PER_PAGE));

    } catch (err) {
      console.error('Ошибка загрузки отчетов:', err);
      setError(err.message || 'Ошибка загрузки отчетов');
      setReports([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, selectedLocation, startDate, endDate, currentPage, apiService]);

  const handleShowReports = () => {
    setCurrentPage(1);
    setShowFilters(false);
    fetchReports();
  };

  const handleBackToFilters = () => {
    setShowFilters(true);
    setReports([]);
    setError('');
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  useEffect(() => {
    if (!showFilters && selectedCategory && startDate && endDate) {
      fetchReports();
    }
  }, [currentPage, fetchReports, showFilters, selectedCategory, startDate, endDate]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(amount);
  };

  // Функция для переключения развернутого состояния секции
  const toggleExpandedSection = (reportId, sectionType) => {
    const key = `${reportId}_${sectionType}`;
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Функция для формирования правильного URL изображения
  const getImageUrl = (photoUrl) => {
    if (!photoUrl) return null;

    // Если URL уже полный (начинается с http), используем как есть
    if (photoUrl.startsWith('http')) {
      return photoUrl;
    }

    // Получаем базовый URL без /api
    let baseUrl = '';
    if (import.meta.env.VITE_API_BASE_URL) {
      if (import.meta.env.VITE_API_BASE_URL === '/api') {
        // Режим разработки - используем текущий хост
        baseUrl = '';
      } else {
        // Продакшн - используем полный URL без /api
        baseUrl = import.meta.env.VITE_API_BASE_URL.replace('/api', '');
      }
    }

    // Если URL уже начинается с /, это готовый путь
    if (photoUrl.startsWith('/')) {
      return `${baseUrl}${photoUrl}`;
    }

    // Иначе это относительный путь, добавляем /uploads/
    return `${baseUrl}/uploads/${photoUrl}`;
  };

  // Компонент для отображения кассовых отчетов
  const ShiftReportCard = ({ report }) => {
    const incomeExpanded = expandedSections[`${report.id}_income`];
    const expenseExpanded = expandedSections[`${report.id}_expense`];

    return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200 mb-3">
      {/* Компактный заголовок */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center space-x-2">
          <div className="bg-green-500 text-white p-1.5 rounded text-sm">💰</div>
          <div>
            <h3 className="font-semibold text-sm text-gray-900">Отчёт #{report.id}</h3>
            <p className="text-xs text-green-600">📍 {report.location}</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
          {formatDate(report.created_at)}
        </p>
      </div>

      {/* Основная информация в одной строке */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gray-50 p-2 rounded text-center">
          <p className="text-xs text-gray-600">Кассир</p>
          <p className="font-medium text-sm">{report.cashier_name}</p>
        </div>
        <div className="bg-gray-50 p-2 rounded text-center">
          <p className="text-xs text-gray-600">Смена</p>
          <p className="font-medium text-sm">
            {report.shift_type === 'morning' ? 'Утро' : 'Ночь'}
          </p>
        </div>
      </div>

      {/* Ключевые суммы в компактной сетке */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-blue-50 p-2 rounded">
          <p className="text-xs text-blue-700">Выручка</p>
          <p className="font-semibold text-sm text-blue-800">{formatAmount(report.total_revenue || 0)}</p>
        </div>
        <div className="bg-purple-50 p-2 rounded">
          <p className="text-xs text-purple-700">Эквайринг</p>
          <p className="font-semibold text-sm text-purple-800">{formatAmount(report.total_acquiring || 0)}</p>
        </div>
      </div>

      {/* Безналичные пл��тежи в компактной сетке */}
      <div className="mb-3">
        <p className="text-xs font-medium text-gray-700 mb-2">💳 Безналичные:</p>
        <div className="grid grid-cols-3 gap-1 text-xs">
          <div className="bg-gray-50 p-1.5 rounded text-center">
            <p className="text-gray-600">Терминал</p>
            <p className="font-medium">{formatAmount(report.acquiring || 0)}</p>
          </div>
          <div className="bg-gray-50 p-1.5 rounded text-center">
            <p className="text-gray-600">QR</p>
            <p className="font-medium">{formatAmount(report.qr_code || 0)}</p>
          </div>
          <div className="bg-gray-50 p-1.5 rounded text-center">
            <p className="text-gray-600">Приложение</p>
            <p className="font-medium">{formatAmount(report.online_app || 0)}</p>
          </div>
          <div className="bg-gray-50 p-1.5 rounded text-center">
            <p className="text-gray-600">Я.Еда</p>
            <p className="font-medium">{formatAmount(report.yandex_food || 0)}</p>
          </div>
          <div className="bg-gray-50 p-1.5 rounded text-center">
            <p className="text-gray-600">Я.Еда ручн.</p>
            <p className="font-medium">{formatAmount(report.yandex_food_no_system || 0)}</p>
          </div>
          <div className="bg-gray-50 p-1.5 rounded text-center">
            <p className="text-gray-600">Primehill</p>
            <p className="font-medium">{formatAmount(report.primehill || 0)}</p>
          </div>
        </div>
      </div>

      {/* Внесения с возможностью рас��рытия */}
      {report.income_entries && report.income_entries.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-700 mb-1">📈 Внесения ({formatAmount(report.total_income || 0)}):</p>
          <div className="space-y-1">
            {(incomeExpanded ? report.income_entries : report.income_entries.slice(0, 2)).map((entry, index) => (
              <div key={index} className="bg-green-50 p-1.5 rounded flex justify-between text-xs">
                <span className="text-gray-700 truncate">{entry.comment || 'Без комментария'}</span>
                <span className="font-medium text-green-700 ml-2">{formatAmount(entry.amount || 0)}</span>
              </div>
            ))}
            {report.income_entries.length > 2 && (
              <button
                onClick={() => toggleExpandedSection(report.id, 'income')}
                className="text-xs text-blue-600 hover:text-blue-800 underline cursor-pointer"
              >
                {incomeExpanded
                  ? 'Скрыть'
                  : `...показать еще ${report.income_entries.length - 2}`
                }
              </button>
            )}
          </div>
        </div>
      )}

      {/* Расходы с возможностью раскрытия */}
      {report.expense_entries && report.expense_entries.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-700 mb-1">📉 Расходы ({formatAmount(report.total_expenses || 0)}):</p>
          <div className="space-y-1">
            {(expenseExpanded ? report.expense_entries : report.expense_entries.slice(0, 2)).map((entry, index) => (
              <div key={index} className="bg-red-50 p-1.5 rounded flex justify-between text-xs">
                <span className="text-gray-700 truncate">{entry.description || 'Без описания'}</span>
                <span className="font-medium text-red-700 ml-2">{formatAmount(entry.amount || 0)}</span>
              </div>
            ))}
            {report.expense_entries.length > 2 && (
              <button
                onClick={() => toggleExpandedSection(report.id, 'expense')}
                className="text-xs text-blue-600 hover:text-blue-800 underline cursor-pointer"
              >
                {expenseExpanded
                  ? 'Скрыть'
                  : `...показать еще ${report.expense_entries.length - 2}`
                }
              </button>
            )}
          </div>
        </div>
      )}

      {/* Итоги компактно */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-yellow-50 p-2 rounded text-center">
          <p className="text-xs text-yellow-700">Факт</p>
          <p className="font-semibold text-sm text-yellow-800">{formatAmount(report.fact_cash || 0)}</p>
        </div>
        <div className="bg-blue-50 p-2 rounded text-center">
          <p className="text-xs text-blue-700">Расчет</p>
          <p className="font-semibold text-sm text-blue-800">{formatAmount(report.calculated_amount || 0)}</p>
        </div>
        <div className={`p-2 rounded text-center ${
          report.difference > 0 ? 'bg-green-50' : 
          report.difference < 0 ? 'bg-red-50' : 'bg-green-50'
        }`}>
          <p className={`text-xs ${
            report.difference > 0 ? 'text-green-700' : 
            report.difference < 0 ? 'text-red-700' : 'text-green-700'
          }`}>
            {report.difference > 0 ? 'Излишек' :
             report.difference < 0 ? 'Недостача' : 'Сходится'}
          </p>
          <p className={`font-semibold text-sm ${
            report.difference > 0 ? 'text-green-800' : 
            report.difference < 0 ? 'text-red-800' : 'text-green-800'
          }`}>
            {report.difference > 0 ? '+' : ''}{formatAmount(report.difference || 0)}
          </p>
        </div>
      </div>

      {/* Комментарии компактно */}
      {report.comments && (
        <div className="bg-gray-50 p-2 rounded mb-3">
          <p className="text-xs font-medium text-gray-700 mb-1">💬 Комментарии:</p>
          <p className="text-xs text-gray-800">{report.comments}</p>
        </div>
      )}

      {/* Фото компактно - ИСПРАВЛЕНО: используем правильный URL из apiService */}
      {report.photo_url && (
        <div className="bg-gray-50 p-2 rounded">
          <p className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
            📸 Фото:
          </p>
          <div className="flex justify-center">
            <img
              src={getImageUrl(report.photo_url)}
              alt="Фото отчета"
              className="max-w-full max-h-32 rounded cursor-pointer hover:opacity-80 transition-opacity border border-gray-200"
              onClick={() => {
                const imageUrl = getImageUrl(report.photo_url);
                if (imageUrl) window.open(imageUrl, '_blank');
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'block';
              }}
              onLoad={(e) => {
                e.target.style.display = 'block';
                if (e.target.nextElementSibling) {
                  e.target.nextElementSibling.style.display = 'none';
                }
              }}
            />
            <div
              style={{ display: 'none' }}
              className="text-center p-4 bg-gray-100 rounded border border-gray-300"
            >
              <div className="text-gray-400 text-2xl mb-2">🖼️</div>
              <p className="text-xs text-gray-500">Фото недоступно</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 text-center mt-1">Нажмите для увеличения</p>
        </div>
      )}
    </div>
    );
  };

  // Компонент для отображения отчетов приема товара
  const ReceivingReportCard = ({ report }) => (
    <div className="bg-white border border-blue-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 mb-4">
      {/* Заголовок отчета */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-500 text-white p-2 rounded-lg text-lg">📦</div>
          <div>
            <h3 className="font-semibold text-lg text-gray-900">Прием товара #{report.id}</h3>
            <p className="text-sm text-blue-600">📍 {report.location}</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded-lg">
          {formatDate(report.created_at)}
        </p>
      </div>

      {/* Основная информация */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-50 p-3 rounded-lg text-center">
          <p className="text-sm text-gray-600">Кассир</p>
          <p className="font-medium text-base">{report.cashier_name}</p>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg text-center">
          <p className="text-sm text-gray-600">Смена</p>
          <p className="font-medium text-base">
            {report.shift_type === 'morning' ? 'Утренняя' : 'Ночная'}
          </p>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg text-center">
          <p className="text-sm text-blue-700">Всего позиций</p>
          <p className="font-semibold text-lg text-blue-800">{report.goods_count || 0}</p>
        </div>
      </div>

      {/* Товары по категориям */}
      <div className="space-y-4">
        {/* Кухня */}
        {report.kuxnya && report.kuxnya.length > 0 && (
          <div className="border border-green-200 rounded-lg p-3 bg-green-50">
            <h4 className="font-semibold text-green-800 mb-3 flex items-center">
              <span className="mr-2">🍳</span>
              Кухня ({report.kuxnya.length} поз.)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {report.kuxnya.map((item, index) => (
                <div key={index} className="bg-white p-2 rounded border border-green-200">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">{item.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-700 text-sm">
                        {item.count} {item.unit}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Бар */}
        {report.bar && report.bar.length > 0 && (
          <div className="border border-purple-200 rounded-lg p-3 bg-purple-50">
            <h4 className="font-semibold text-purple-800 mb-3 flex items-center">
              <span className="mr-2">🍹</span>
              Бар ({report.bar.length} поз.)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {report.bar.map((item, index) => (
                <div key={index} className="bg-white p-2 rounded border border-purple-200">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">{item.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-purple-700 text-sm">
                        {item.count} {item.unit}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Упаковки/Хозтовары */}
        {report.upakovki && report.upakovki.length > 0 && (
          <div className="border border-orange-200 rounded-lg p-3 bg-orange-50">
            <h4 className="font-semibold text-orange-800 mb-3 flex items-center">
              <span className="mr-2">📦</span>
              Упаковки/Хозтовары ({report.upakovki.length} поз.)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {report.upakovki.map((item, index) => (
                <div key={index} className="bg-white p-2 rounded border border-orange-200">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">{item.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-orange-700 text-sm">
                        {item.count} {item.unit}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Если нет товаров */}
        {(!report.kuxnya || report.kuxnya.length === 0) &&
         (!report.bar || report.bar.length === 0) &&
         (!report.upakovki || report.upakovki.length === 0) && (
          <div className="bg-gray-50 p-4 rounded-lg text-center">
            <p className="text-gray-500">Товары не указаны</p>
          </div>
        )}
      </div>

      {/* Дополнительная информация */}
      {report.supplier && (
        <div className="mt-4 bg-blue-50 p-3 rounded-lg">
          <p className="text-sm font-medium text-blue-700 mb-1">Поставщик:</p>
          <p className="text-sm text-blue-800">{report.supplier}</p>
        </div>
      )}
    </div>
  );

  // Компонент для отображения списаний
  const WriteoffReportCard = ({ report }) => {
    const writeoffExpanded = expandedSections[`${report.id}_writeoff`];

    return (
    <div className="bg-white border border-red-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200 mb-3">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-2">
          <div className="bg-red-500 text-white p-1.5 rounded text-sm">❌</div>
          <div>
            <h3 className="font-semibold text-sm text-gray-900">Списание #{report.id}</h3>
            <p className="text-xs text-red-600">📍 {report.location}</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
          {formatDate(report.created_at)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-gray-50 p-2 rounded text-center">
          <p className="text-xs text-gray-600">Кассир</p>
          <p className="font-medium text-sm">{report.cashier_name}</p>
        </div>
        <div className="bg-gray-50 p-2 rounded text-center">
          <p className="text-xs text-gray-600">Смена</p>
          <p className="font-medium text-sm">
            {report.shift_type === 'morning' ? 'Утро' : 'Вечер'}
          </p>
        </div>
      </div>

      {/* Отображение списаний с возможностью раскрытия */}
      {report.writeoffs && report.writeoffs.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-gray-700 mb-1">📋 Списанные товары:</p>
          <div className="space-y-1">
            {(writeoffExpanded ? report.writeoffs : report.writeoffs.slice(0, 2)).map((item, index) => (
              <div key={index} className="bg-red-50 p-1.5 rounded">
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <p className="font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-gray-600">{item.weight} {item.unit}</p>
                  </div>
                  <p className="text-red-600 bg-red-100 px-1.5 py-0.5 rounded text-xs">
                    {item.reason}
                  </p>
                </div>
              </div>
            ))}
            {report.writeoffs.length > 2 && (
              <button
                onClick={() => toggleExpandedSection(report.id, 'writeoff')}
                className="text-xs text-blue-600 hover:text-blue-800 underline cursor-pointer"
              >
                {writeoffExpanded
                  ? 'Скрыть'
                  : `...показать еще ${report.writeoffs.length - 2}`
                }
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-red-50 p-2 rounded text-center">
        <p className="text-xs text-red-700">Всего позиций списано</p>
        <p className="font-semibold text-sm text-red-800">{report.items_count}</p>
      </div>
    </div>
    );
  };

  // Компонент для отображения перемещений
  const TransferReportCard = ({ report }) => {
    const transferExpanded = expandedSections[`${report.id}_transfer`];

    return (
    <div className="bg-white border border-purple-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200 mb-3">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-2">
          <div className="bg-purple-500 text-white p-1.5 rounded text-sm">🔄</div>
          <div>
            <h3 className="font-semibold text-sm text-gray-900">Перемещение #{report.id}</h3>
            <div className="text-xs text-purple-600">
              <p>📍 Откуда: {report.location}</p>
              {report.location_to && (
                <p>📍 Куда: {report.location_to}</p>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
          {formatDate(report.created_at)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-gray-50 p-2 rounded text-center">
          <p className="text-xs text-gray-600">Кассир</p>
          <p className="font-medium text-sm">{report.cashier_name}</p>
        </div>
        <div className="bg-gray-50 p-2 rounded text-center">
          <p className="text-xs text-gray-600">Смена</p>
          <p className="font-medium text-sm">
            {report.shift_type === 'morning' ? 'Утро' : 'Вечер'}
          </p>
        </div>
      </div>

      {/* Отобра��ение перемещений с возможностью раскрытия */}
      {report.transfers && report.transfers.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-gray-700 mb-1">📋 Перемещенные товары:</p>
          <div className="space-y-1">
            {(transferExpanded ? report.transfers : report.transfers.slice(0, 2)).map((item, index) => (
              <div key={index} className="bg-purple-50 p-1.5 rounded">
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <p className="font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-gray-600">{item.weight} {item.unit}</p>
                  </div>
                  <p className="text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded text-xs">
                    {item.reason}
                  </p>
                </div>
              </div>
            ))}
            {report.transfers.length > 2 && (
              <button
                onClick={() => toggleExpandedSection(report.id, 'transfer')}
                className="text-xs text-blue-600 hover:text-blue-800 underline cursor-pointer"
              >
                {transferExpanded
                  ? 'Скрыть'
                  : `...показать еще ${report.transfers.length - 2}`
                }
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-purple-50 p-2 rounded text-center">
        <p className="text-xs text-purple-700">Всего позиций перемещено</p>
        <p className="font-semibold text-sm text-purple-800">{report.items_count}</p>
      </div>
    </div>
    );
  };

  const renderReportCard = (report) => {
    switch (selectedCategory) {
      case 'shift-reports':
        return <ShiftReportCard key={report.id} report={report} />;
      case 'receiving-reports':
        return <ReceivingReportCard key={report.id} report={report} />;
      case 'writeoff-reports':
        return <WriteoffReportCard key={report.id} report={report} />;
      case 'transfer-reports':
        return <TransferReportCard key={report.id} report={report} />;
      default:
        return null;
    }
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
      const pages = [];
      const maxVisible = 5;

      if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        const start = Math.max(1, currentPage - 2);
        const end = Math.min(totalPages, start + maxVisible - 1);

        for (let i = start; i <= end; i++) {
          pages.push(i);
        }
      }

      return pages;
    };

    return (
      <div className="flex justify-center items-center space-x-2 mt-8">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ← Назад
        </button>

        {getPageNumbers().map(page => (
          <button
            key={page}
            onClick={() => handlePageChange(page)}
            className={`px-3 py-2 rounded-lg border transition-colors ${
              currentPage === page
                ? 'bg-blue-500 text-white border-blue-500'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Вперед →
        </button>
      </div>
    );
  };

  if (showFilters) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Заголовок */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              📊 Просмотр отчетов
            </h1>
            <p className="text-gray-600">
              Выберите категорию отчета и период для просмотра
            </p>
          </div>

          {/* Выбор категории отчета */}
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">📋</span>
              Категория отчета
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {REPORT_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`p-4 rounded-xl border-2 transition-all duration-300 text-left ${
                    selectedCategory === category.id
                      ? `${category.color} border-current shadow-lg transform scale-105`
                      : 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{category.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{category.name}</h3>
                      <p className="text-sm text-gray-600">
                        {category.id === 'shift-reports' && 'Отчеты по кассовым сменам'}
                        {category.id === 'receiving-reports' && 'Документы поступления товара'}
                        {category.id === 'writeoff-reports' && 'Документы списания товара'}
                        {category.id === 'transfer-reports' && 'Документы перемещения товара'}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Фильтры */}
          {selectedCategory && (
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="mr-2">🔍</span>
                Фильтры
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Локация */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📍 Локация
                  </label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {LOCATIONS.map((location) => (
                      <option key={location.id} value={location.value}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Дата начала */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📅 Дата начала
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Дата окончания */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📅 Дата окончания
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Кнопка поиска */}
                <div className="flex items-end">
                  <button
                    onClick={handleShowReports}
                    disabled={!selectedCategory || !startDate || !endDate}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
                  >
                    🔍 Показать отчеты
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Кнопка возврата */}
          <div className="text-center">
            <button
              onClick={goToMenu}
              className="bg-gray-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
            >
              ← Вернуться в меню
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Отображение отчетов
  const selectedCategoryData = REPORT_CATEGORIES.find(cat => cat.id === selectedCategory);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Заголовок с информацией */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className={`${selectedCategoryData?.headerColor} text-white p-3 rounded-xl`}>
                <span className="text-xl">{selectedCategoryData?.icon}</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {selectedCategoryData?.name}
                </h1>
                <p className="text-gray-600">
                  {startDate} - {endDate} | {selectedLocation === 'all' ? 'Все локации' : selectedLocation}
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleBackToFilters}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                ← Изменить фильтры
              </button>
              <button
                onClick={goToMenu}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
              >
                🏠 В меню
              </button>
            </div>
          </div>

          {/* Статистика */}
          {totalCount > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Найдено отчетов: <span className="font-semibold text-gray-900">{totalCount}</span>
                {totalPages > 1 && (
                  <span className="ml-4">
                    Страница <span className="font-semibold">{currentPage}</span> из <span className="font-semibold">{totalPages}</span>
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Содержимое */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="ml-4 text-gray-600">Загрузка отчетов...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">Ошибка загрузки</h3>
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchReports}
              className="mt-4 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
            <div className="text-yellow-500 text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Отчеты не найдены</h3>
            <p className="text-gray-600">
              За указанный период не найдены отчетов в категории &quot;{selectedCategoryData?.name}&quot;
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {reports.map(renderReportCard)}
            {renderPagination()}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsViewer;
