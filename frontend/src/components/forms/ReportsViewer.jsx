import React, { useState, useEffect, useCallback, useMemo } from 'react';

const REPORT_CATEGORIES = [
	{
		id: 'shift-reports',
		name: 'Кассовые отчёты',
		api: 'shift-reports',
		icon: '💰',
		color: 'bg-green-50 border-green-200',
		headerColor: 'bg-green-500',
	},
	{
		id: 'receiving-reports',
		name: 'Отчёт приема товара',
		api: 'report-on-goods',
		icon: '📦',
		color: 'bg-blue-50 border-blue-200',
		headerColor: 'bg-blue-500',
	},
	{
		id: 'writeoff-reports',
		name: 'Списания',
		api: 'writeoff-transfer',
		type: 'writeoff',
		icon: '❌',
		color: 'bg-red-50 border-red-200',
		headerColor: 'bg-red-500',
	},
	{
		id: 'writeoff-period-reports',
		name: 'Списания за период',
		api: 'writeoff-transfer',
		endpoint: 'period',
		useDateTime: true,
		icon: '🗓️',
		color: 'bg-orange-50 border-orange-200',
		headerColor: 'bg-orange-500',
	},
	{
		id: 'transfer-reports',
		name: 'Перемещения',
		api: 'writeoff-transfer',
		type: 'transfer',
		icon: '🔄',
		color: 'bg-purple-50 border-purple-200',
		headerColor: 'bg-purple-500',
	},
];

const LOCATIONS = [
	{ id: 'all', name: 'Все локации', value: 'all' },
	{ id: 'gagarina', name: 'Гагарина 48/1', value: 'Гагарина 48/1' },
	{
		id: 'abdulhakima',
		name: 'Абдулхакима Исмаилова 51',
		value: 'Абдулхакима Исмаилова 51',
	},
	{ id: 'gaydara', name: 'Гайдара Гаджиева 7Б', value: 'Гайдара Гаджиева 7Б' },
];

// Функция для получения правильного названия локации в зависимости от типа отчета
const getLocationDisplayName = (locationValue, categoryId) => {
	if (locationValue === 'all') return 'Все локации';

	switch (categoryId) {
		case 'shift-reports':
			return `Касса - ${locationValue}`;
		case 'receiving-reports':
		case 'writeoff-reports':
		case 'writeoff-period-reports':
			return `Отчет - ${locationValue}`;
		case 'transfer-reports':
			return locationValue;
		default:
			return locationValue;
	}
};

// Функция для получения опций локаций в зависимости от выбранной категории
const getLocationOptions = (categoryId) => {
	const baseLocations = LOCATIONS.slice(1); // Убираем "Все локации" для модификации

	const modifiedLocations = baseLocations.map((location) => ({
		...location,
		displayName: getLocationDisplayName(location.value, categoryId),
	}));

	return [
		{ id: 'all', name: 'Все локации', value: 'all', displayName: 'Все локации' },
		...modifiedLocations,
	];
};

const ReportsViewer = ({ goToMenu, apiService }) => {
	const [selectedCategory, setSelectedCategory] = useState('');
	const [selectedLocation, setSelectedLocation] = useState('all');
	const [startDate, setStartDate] = useState('');
	const [endDate, setEndDate] = useState('');
	const [startTime, setStartTime] = useState('00:00');
	const [endTime, setEndTime] = useState('23:59');
	const [reports, setReports] = useState([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState('');
	const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [totalCount, setTotalCount] = useState(0);
	const [hasSearched, setHasSearched] = useState(false);

	// Состояние для модального окна удаления
	const [deleteModal, setDeleteModal] = useState({
		isOpen: false,
		reportId: null,
		reportType: null,
		isDeleting: false,
	});

	const ITEMS_PER_PAGE = 10;

	// Мемоизируем текущую категорию для предотвращения лишних вычислений
	const currentCategory = useMemo(() => {
		return REPORT_CATEGORIES.find(cat => cat.id === selectedCategory);
	}, [selectedCategory]);

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
			if (!currentCategory) throw new Error('Неизвестная категория отчета');

			const params = {
				page: currentPage,
				per_page: ITEMS_PER_PAGE,
			};

			// Если категория использует datetime, отправляем datetime параметры
			if (currentCategory.useDateTime) {
				params.start_datetime = `${startDate}T${startTime}`;
				params.end_datetime = `${endDate}T${endTime}`;
			} else {
				// Иначе используем обычные даты
				params.start_date = startDate;
				params.end_date = endDate;
			}

			if (selectedLocation !== 'all') {
				params.location = getLocationDisplayName(selectedLocation, selectedCategory);
			}

			if (currentCategory.type) {
				params.type = currentCategory.type;
			}

			// Используем кастомный endpoint если указан
			let apiPath = currentCategory.api;
			if (currentCategory.endpoint) {
				apiPath = `${currentCategory.api}/${currentCategory.endpoint}`;
			}

			const response = await apiService.getReports(apiPath, params);

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
	}, [selectedCategory, selectedLocation, startDate, endDate, startTime, endTime, currentPage, apiService, currentCategory]);

	const handleShowReports = () => {
		setCurrentPage(1);
		setHasSearched(true); // Помечаем что был выполнен поиск
		fetchReports();
	};

	const handlePageChange = (newPage) => {
		if (newPage >= 1 && newPage <= totalPages) {
			setCurrentPage(newPage);
		}
	};

	// Убираем автоматическую загрузку при изменении фильтров
	useEffect(() => {
		// Загружаем отчеты только при изменении страницы И если уже был выполнен поиск
		if (hasSearched && currentPage > 1) {
			fetchReports();
		}
	}, [currentPage, fetchReports, hasSearched]);

	const formatDate = (dateString) => {
		return new Date(dateString).toLocaleString('ru-RU', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const formatAmount = (amount) => {
		return new Intl.NumberFormat('ru-RU', {
			style: 'currency',
			currency: 'RUB',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	};

	// Функция для формирования правильного URL изображения
	const getImageUrl = (photoUrl) => {
		if (!photoUrl) return null;

		// Если URL уже полный (http/https) — возвращаем как есть
		if (/^https?:\/\//i.test(photoUrl)) return photoUrl;

		// Нормализуем baseUrl
		let baseUrl = import.meta.env.VITE_API_BASE_URL || '';
		if (baseUrl === '/api') baseUrl = '';
		// Убираем хвосты /api и /uploads и конечный слэш
		baseUrl = baseUrl.replace(/\/api$/, '').replace(/\/uploads$/, '');
		if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

		// Нормализуем путь к файлу
		let path = photoUrl || '';
		if (!path.startsWith('/')) {
			if (path.startsWith('uploads/')) {
				path = `/${path}`; // -> /uploads/...
			} else {
				path = `/uploads/${path.replace(/^\/+/, '')}`; // -> /uploads/<name>
			}
		}

		// Устраняем возможное дублирование /uploads/uploads/
		path = path.replace(/\/uploads\/uploads\//g, '/uploads/');

		return `${baseUrl}${path}`;
	};

	// Компонент для отображения кассовых отчетов
	const ShiftReportCard = ({ report }) => {
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
					<div className="flex items-center space-x-2">
						<div className="text-sm font-semibold text-gray-700 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
							{formatDate(report.date || report.created_at)}
						</div>
						<button
							onClick={() => openDeleteModal(report.id, selectedCategory)}
							className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
							title="Удалить отчет"
						>
							✕
						</button>
					</div>
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
				<div className="grid grid-cols-3 gap-2 mb-3">
					<div className="bg-blue-50 p-2 rounded">
						<p className="text-xs text-blue-700">Выручка</p>
						<p className="font-semibold text-sm text-blue-800">
							{formatAmount(report.total_revenue || 0)}
						</p>
					</div>
					<div className="bg-orange-50 p-2 rounded">
						<p className="text-xs text-orange-700">Возвраты</p>
						<p className="font-semibold text-sm text-orange-800">
							{formatAmount(report.returns || 0)}
						</p>
					</div>
					<div className="bg-purple-50 p-2 rounded">
						<p className="text-xs text-purple-700">Эквайринг</p>
						<p className="font-semibold text-sm text-purple-800">
							{formatAmount(report.total_acquiring || 0)}
						</p>
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
							<p className="text-gray-600">Я.Пэй QR</p>
							<p className="font-medium">{formatAmount(report.yandex_pay_qr || 0)}</p>
						</div>
						<div className="bg-gray-50 p-1.5 rounded text-center">
							<p className="text-gray-600">QR (тг)</p>
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
					</div>
				</div>

				{/* Внесения с возможностью рас��рытия */}
				{report.income_entries && report.income_entries.length > 0 && (
					<div className="mb-3">
						<p className="text-xs font-medium text-gray-700 mb-1">
							📈 Внесения ({formatAmount(report.total_income || 0)}):
						</p>
						<div className="space-y-1">
							{report.income_entries.map((entry, index) => (
								<div
									key={index}
									className="bg-green-50 p-1.5 rounded flex justify-between text-xs"
								>
									<span className="text-gray-700 truncate">
										{entry.comment || 'Без комментария'}
									</span>
									<span className="font-medium text-green-700 ml-2">
										{formatAmount(entry.amount || 0)}
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Расходы с возможностью раскрытия */}
				{report.expense_entries && report.expense_entries.length > 0 && (
					<div className="mb-3">
						<p className="text-xs font-medium text-gray-700 mb-1">
							📉 Расходы ({formatAmount(report.total_expenses || 0)}):
						</p>
						<div className="space-y-1">
							{report.expense_entries.map((entry, index) => (
								<div
									key={index}
									className="bg-red-50 p-1.5 rounded flex justify-between text-xs"
								>
									<span className="text-gray-700 truncate">
										{entry.description || 'Без описания'}
									</span>
									<span className="font-medium text-red-700 ml-2">
										{formatAmount(entry.amount || 0)}
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Итоги компактно */}
				<div className="grid grid-cols-3 gap-2 mb-3">
					<div className="bg-yellow-50 p-2 rounded text-center">
						<p className="text-xs text-yellow-700">Факт</p>
						<p className="font-semibold text-sm text-yellow-800">
							{formatAmount(report.fact_cash || 0)}
						</p>
					</div>
					<div className="bg-blue-50 p-2 rounded text-center">
						<p className="text-xs text-blue-700">Расчет</p>
						<p className="font-semibold text-sm text-blue-800">
							{formatAmount(report.calculated_amount || 0)}
						</p>
					</div>
					<div
						className={`p-2 rounded text-center ${
							report.difference > 0
								? 'bg-green-50'
								: report.difference < 0
								? 'bg-red-50'
								: 'bg-green-50'
						}`}
					>
						<p
							className={`text-xs ${
								report.difference > 0
									? 'text-green-700'
									: report.difference < 0
									? 'text-red-700'
									: 'text-green-700'
							}`}
						>
							{report.difference > 0
								? 'Излишек'
								: report.difference < 0
								? 'Недостача'
								: 'Сходится'}
						</p>
						<p
							className={`font-semibold text-sm ${
								report.difference > 0
									? 'text-green-800'
									: report.difference < 0
									? 'text-red-800'
									: 'text-green-800'
							}`}
						>
							{report.difference > 0 ? '+' : ''}
							{formatAmount(report.difference || 0)}
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
			{(report.photo_url || report.receipt_photo_url) && (
				<div className="bg-gray-50 p-2 rounded">
					<p className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
						📸 Фото:
					</p>

					{/* Сетка для фото */}
					<div className={`grid gap-2 ${report.photo_url && report.receipt_photo_url ? 'grid-cols-2' : 'grid-cols-1'}`}>
						{/* Основное фото отчета */}
						{report.photo_url && (
							<div>
								<p className="text-xs text-gray-600 mb-1 text-center">Фото отчёта</p>
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
							</div>
						)}

						{/* НОВОЕ: Фото чека с магазина */}
						{report.receipt_photo_url && (
							<div>
								<p className="text-xs text-gray-600 mb-1 text-center">Чек с магазина</p>
								<div className="flex justify-center">
									<img
										src={getImageUrl(report.receipt_photo_url)}
										alt="Фото чека"
										className="max-w-full max-h-32 rounded cursor-pointer hover:opacity-80 transition-opacity border border-gray-200"
										onClick={() => {
											const imageUrl = getImageUrl(report.receipt_photo_url);
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
										<div className="text-gray-400 text-2xl mb-2">🧾</div>
										<p className="text-xs text-gray-500">Чек недоступен</p>
									</div>
								</div>
							</div>
						)}
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
				<div className="flex items-center space-x-2">
					<div className="text-sm font-semibold text-gray-700 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
						{formatDate(report.date || report.created_at)}
					</div>
					<button
						onClick={() => openDeleteModal(report.id, selectedCategory)}
						className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
						title="Удалить отчет"
					>
						✕
					</button>
				</div>
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
						<h4 className="font-semibold text-green-800 mb-1 flex items-center">
							<span className="mr-2">🍳</span>
							Основное и Напитки ({report.kuxnya.length} поз.)
						</h4>
						<p className="text-xs font-semibold text-green-700 mb-2">Основное:</p>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
							{report.kuxnya.map((item, index) => (
								<div key={index} className="bg-white p-2 rounded border border-green-200">
									<div className="flex justify-between items-center">
										<div className="flex-1">
											<p className="font-medium text-sm text-gray-900">{item.name}</p>
										</div>
										<div className="text-right">
											<p className="font-semibold text-green-700 text-sm">{item.count} {item.unit}</p>
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
						<h4 className="font-semibold text-purple-800 mb-1 flex items-center">
							<span className="mr-2">🍹</span>
							Перемещение с другой точки к вам ({report.bar.length} поз.)
						</h4>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
							{report.bar.map((item, index) => (
								<div key={index} className="bg-white p-2 rounded border border-purple-200">
									<div className="flex justify-between items-center">
										<div className="flex-1">
											<p className="font-medium text-sm text-gray-900">{item.name}</p>
										</div>
										<div className="text-right">
											<p className="font-semibold text-purple-700 text-sm">{item.count} {item.unit}</p>
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
							Покупки с магазина ({report.upakovki.length} поз.)
						</h4>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
							{report.upakovki.map((item, index) => (
								<div
									key={index}
									className="bg-white p-2 rounded border border-orange-200"
								>
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

				{/* Фотографии накладных (если есть) */}
				{report.photos_urls && report.photos_urls.length > 0 && (
					<div className="mt-4 bg-gray-50 p-3 rounded-lg">
						<p className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">📸 Фотографии накладных ({report.photos_urls.length})</p>
						<div className={`grid gap-2 ${report.photos_urls.length > 1 ? 'grid-cols-3 md:grid-cols-4' : 'grid-cols-1'}`}>
							{report.photos_urls.map((photo, idx) => {
								const imageUrl = getImageUrl(photo);
								return (
									<div key={idx} className="flex justify-center">
										{imageUrl ? (
											<img
												src={imageUrl}
												alt={`Фото ${idx + 1}`}
												className="max-w-full max-h-32 rounded cursor-pointer hover:opacity-80 transition-opacity border border-gray-200"
												onClick={() => window.open(imageUrl, '_blank')}
												onError={(e) => { e.target.style.display = 'none'; if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'block'; }}
												onLoad={(e) => { e.target.style.display = 'block'; if (e.target.nextElementSibling) { e.target.nextElementSibling.style.display = 'none'; } }}
											/>
										) : null}
										<div style={{ display: 'none' }} className="text-center p-4 bg-gray-100 rounded border border-gray-300">
											<div className="text-gray-400 text-2xl mb-2">🖼️</div>
											<p className="text-xs text-gray-500">Фото недоступно</p>
										</div>
									</div>
								);
							})}
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
	// Компонент для отображения списаний
	const WriteoffReportCard = ({ report }) => {
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
					<div className="flex items-center space-x-2">
						<div className="text-sm font-semibold text-gray-700 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
							{formatDate(report.date || report.created_at)}
						</div>
						<button
							onClick={() => openDeleteModal(report.id, selectedCategory)}
							className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
							title="Удалить отчет"
						>
							✕
						</button>
					</div>
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
							{report.writeoffs.map((item, index) => (
								<div key={index} className="bg-red-50 p-1.5 rounded">
									<div className="flex justify-between items-center text-xs">
										<div>
											<p className="font-medium text-gray-900 truncate">{item.name}</p>
											<p className="text-gray-600">
												{item.weight} {item.unit}
											</p>
										</div>
										<p className="text-red-600 bg-red-100 px-1.5 py-0.5 rounded text-xs">
											{item.reason}
										</p>
									</div>
								</div>
							))}
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

	// НОВЫЙ: Компонент для отображения объединённых списаний за период
	const WriteoffPeriodCard = ({ reports }) => {
		if (!reports || reports.length === 0) return null;

		const totalItems = reports.reduce((sum, report) => sum + (report.writeoffs?.length || 0), 0);
		const totalReports = reports.length;

		return (
			<div className="bg-white border-2 border-orange-300 rounded-lg p-4 shadow-md mb-4">
				{/* Заголовок */}
				<div className="mb-4 pb-3 border-b-2 border-orange-200">
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-3">
							<div className="bg-orange-500 text-white p-2 rounded-lg text-lg">🗓️</div>
							<div>
								<h3 className="text-lg font-bold text-gray-900">Списания за период</h3>
								<p className="text-sm text-orange-600">
									Отчётов: {totalReports} | Позиций: {totalItems}
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Список списаний, сгруппированных по отчётам */}
				<div className="space-y-4">
					{reports.map((report) => (
						<div key={report.id} className="bg-orange-50 rounded-lg p-4 border border-orange-200">
							{/* Шапка отчёта */}
							<div className="mb-3 pb-2 border-b border-orange-300">
								<p className="text-gray-700 font-medium">
									📅 {formatDate(report.date || report.created_at)}
								</p>
								<p className="text-gray-700 mt-1">
									👤 {report.cashier_name} | 📍 {report.location}
								</p>
							</div>

							{/* Список товаров из этого отчёта */}
							{report.writeoffs && report.writeoffs.length > 0 && (
								<div className="space-y-2">
									{report.writeoffs.map((item, idx) => (
										<div key={idx} className="flex items-center gap-2 text-base">
											<span className="font-bold text-gray-900">{item.name}</span>
											<span className="text-gray-500">—</span>
											<span className="font-bold text-gray-900">{item.weight} {item.unit}</span>
											<span className="text-gray-500">—</span>
											<span className="bg-red-100 text-red-700 px-3 py-1 rounded font-medium">
												{item.reason}
											</span>
										</div>
									))}
								</div>
							)}
						</div>
					))}
				</div>

				{/* Итоговая статистика */}
				<div className="mt-4 pt-3 border-t-2 border-orange-200">
					<div className="grid grid-cols-2 gap-3">
						<div className="bg-orange-50 p-3 rounded-lg text-center">
							<p className="text-xs text-orange-700">Всего отчётов</p>
							<p className="text-xl font-bold text-orange-800">{totalReports}</p>
						</div>
						<div className="bg-orange-50 p-3 rounded-lg text-center">
							<p className="text-xs text-orange-700">Всего позиций</p>
							<p className="text-xl font-bold text-orange-800">{totalItems}</p>
						</div>
					</div>
				</div>
			</div>
		);
	};

	// Компонент для отображения перемещений
	const TransferReportCard = ({ report }) => {
		return (
			<div className="bg-white border border-purple-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200 mb-3">
				<div className="flex justify-between items-start mb-2">
					<div className="flex items-center space-x-2">
						<div className="bg-purple-500 text-white p-1.5 rounded text-sm">🔄</div>
						<div>
							<h3 className="font-semibold text-sm text-gray-900">Перемещение #{report.id}</h3>
							<div className="text-xs text-purple-600">
								<p>📍 Откуда: {report.location}</p>
								{report.location_to && <p>📍 Куда: {report.location_to}</p>}
							</div>
						</div>
					</div>
					<div className="flex items-center space-x-2">
						<div className="text-sm font-semibold text-gray-700 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
							{formatDate(report.date || report.created_at)}
						</div>
						<button
							onClick={() => openDeleteModal(report.id, selectedCategory)}
							className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
							title="Удалить отчет"
						>
							✕
						</button>
					</div>
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

				{/* Отображение перемещений с возможностью раскрытия */}
				{report.transfers && report.transfers.length > 0 && (
					<div className="mb-2">
						<p className="text-xs font-medium text-gray-700 mb-1">📋 Перемещенные товары:</p>
						<div className="space-y-1">
							{report.transfers.map((item, index) => (
								<div key={index} className="bg-purple-50 p-1.5 rounded">
									<div className="flex justify-between items-center text-xs">
										<div>
											<p className="font-medium text-gray-900 truncate">{item.name}</p>
											<p className="text-gray-600">
												{item.weight} {item.unit}
											</p>
										</div>
										<p className="text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded text-xs">
											{item.reason}
										</p>
									</div>
								</div>
							))}
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
			case 'writeoff-period-reports':
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

				{getPageNumbers().map((page) => (
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

	// Компонент фильтров (будет всегда видимым)
	const FiltersPanel = () => (
		<div className="lg:w-80 lg:flex-shrink-0">
			{/* Мобильная версия - компактная */}
			<div className="lg:hidden bg-white rounded-lg shadow-md p-4 mb-4">
				<h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
					<span className="mr-2">🔍</span>
					Фильтры
				</h2>

				{/* Выбор категории - компактно */}
				<div className="mb-3">
					<label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
					<select
						value={selectedCategory}
						onChange={(e) => setSelectedCategory(e.target.value)}
						className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
					>
						<option value="">Выберите категорию</option>
						{REPORT_CATEGORIES.map((category) => (
							<option key={category.id} value={category.id}>
								{category.icon} {category.name}
							</option>
						))}
					</select>
				</div>

				<div className="grid grid-cols-2 gap-2 mb-3">
					<div>
						<label className="block text-xs font-medium text-gray-700 mb-1">Локация</label>
						<select
							value={selectedLocation}
							onChange={(e) => setSelectedLocation(e.target.value)}
							className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
						>
							{getLocationOptions(selectedCategory).map((location) => (
								<option key={location.id} value={location.value}>
									{location.displayName && location.displayName.length > 15
										? location.displayName.substring(0, 15) + '...'
										: location.displayName || location.name}
								</option>
							))}
						</select>
					</div>

					<div>
						<label className="block text-xs font-medium text-gray-700 mb-1">Период</label>
						<div className="flex gap-1">
							<input
								type="date"
								value={startDate}
								onChange={(e) => setStartDate(e.target.value)}
								className="flex-1 p-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-xs"
							/>
							<input
								type="date"
								value={endDate}
								onChange={(e) => setEndDate(e.target.value)}
								className="flex-1 p-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-xs"
							/>
						</div>
					</div>
				</div>

				<button
					onClick={handleShowReports}
					disabled={!selectedCategory || !startDate || !endDate}
					className="w-full bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
				>
					Показать отчеты
				</button>
			</div>

			{/* Десктопная версия - полная */}
			<div className="hidden lg:block bg-white rounded-lg shadow-md p-6">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-xl font-semibold text-gray-900 flex items-center">
						<span className="mr-2">📊</span>
						Просмотр отчетов
					</h2>
					<button
						onClick={goToMenu}
						className="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 transition-colors text-sm"
					>
						🏠 Меню
					</button>
				</div>

				{/* Выбор категории отчета */}
				<div className="mb-6">
					<h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
						<span className="mr-2">📋</span>
						Категория отчета
					</h3>
					<div className="space-y-3">
						{REPORT_CATEGORIES.map((category) => (
							<button
								key={category.id}
								onClick={() => {
									setSelectedCategory(category.id);
									setHasSearched(false); // Сбрасываем флаг поиска
									setReports([]); // Очищаем отчёты
									setCurrentPage(1); // Сбрасываем на первую страницу
								}}
								className={`w-full p-3 rounded-lg border-2 transition-all duration-300 text-left ${
									selectedCategory === category.id
										? `${category.color} border-current shadow-md`
										: 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm'
								}`}
							>
								<div className="flex items-center space-x-3">
									<span className="text-xl">{category.icon}</span>
									<div>
										<h4 className="font-medium text-gray-900">{category.name}</h4>
										<p className="text-xs text-gray-600 mt-1">
											{category.id === 'shift-reports' && 'Кассовые смены'}
											{category.id === 'receiving-reports' && 'Поступления товара'}
											{category.id === 'writeoff-reports' && 'Списания товара'}
											{category.id === 'writeoff-period-reports' && 'Списания за выбранный период времени'}
											{category.id === 'transfer-reports' && 'Перемещения товара'}
										</p>
									</div>
								</div>
							</button>
						))}
					</div>
				</div>

				{/* Фильтры */}
				{selectedCategory && (
					<div className="mb-6">
						<h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
							<span className="mr-2">🔍</span>
							Фильтры
						</h3>
						<div className="space-y-4">
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
									{getLocationOptions(selectedCategory).map((location) => (
										<option key={location.id} value={location.value}>
											{location.displayName || location.name}
										</option>
									))}
								</select>
							</div>

							{/* Период */}
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									📅 Период
								</label>
								<div className="space-y-2">
									<div>
										<label className="block text-xs text-gray-600 mb-1">
											Дата начала
										</label>
										<input
											type="date"
											value={startDate}
											onChange={(e) => setStartDate(e.target.value)}
											className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										/>
									</div>

									{/* Время начала - показываем только для категорий с useDateTime */}
									{currentCategory?.useDateTime && (
										<div>
											<label className="block text-xs text-gray-600 mb-1">
												⏰ Время начала
											</label>
											<input
												type="time"
												value={startTime}
												onChange={(e) => setStartTime(e.target.value)}
												className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
											/>
										</div>
									)}

									<div>
										<label className="block text-xs text-gray-600 mb-1">
											Дата окончания
										</label>
										<input
											type="date"
											value={endDate}
											onChange={(e) => setEndDate(e.target.value)}
											className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										/>
									</div>

									{/* Время окончания - показываем только для категорий с useDateTime */}
									{currentCategory?.useDateTime && (
										<div>
											<label className="block text-xs text-gray-600 mb-1">
												⏰ Время окончания
											</label>
											<input
												type="time"
												value={endTime}
												onChange={(e) => setEndTime(e.target.value)}
												className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
											/>
										</div>
									)}
								</div>
							</div>

							<button
								onClick={handleShowReports}
								disabled={!selectedCategory || !startDate || !endDate}
								className="w-full bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
							>
								Показать отчеты
							</button>
						</div>
					</div>
				)}

				{/* Статистика */}
				{selectedCategory && totalCount > 0 && (
					<div className="bg-gray-50 p-4 rounded-lg">
						<h4 className="font-medium text-gray-900 mb-2">Статистика</h4>
						<div className="text-sm text-gray-600 space-y-1">
							<p>
								Найдено:{' '}
								<span className="font-semibold text-gray-900">{totalCount}</span> отчетов
							</p>
							{totalPages > 1 && (
								<p>
									Страница:{' '}
									<span className="font-semibold text-gray-900">{currentPage}</span> из{' '}
									<span className="font-semibold text-gray-900">{totalPages}</span>
								</p>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);

	// Компонент области отчетов
	const ReportsArea = () => {
		const selectedCategoryData = REPORT_CATEGORIES.find((cat) => cat.id === selectedCategory);

		if (!selectedCategory) {
			return (
				<div className="flex-1 bg-white rounded-lg shadow-md p-8 text-center">
					<div className="text-gray-400 text-6xl mb-4">📊</div>
					<h3 className="text-xl font-semibold text-gray-900 mb-2">
						Выберите категорию отчета
					</h3>
					<p className="text-gray-600">
						Выберите категорию отчета в панели фильтров, чтобы начать просмотр
					</p>
				</div>
			);
		}

		// Если категория выбрана, но поиск еще не выполнялся
		if (!hasSearched) {
			return (
				<div className="flex-1 bg-white rounded-lg shadow-md p-8 text-center">
					<div className="text-blue-400 text-6xl mb-4">🔍</div>
					<h3 className="text-xl font-semibold text-gray-900 mb-2">Готов к поиску</h3>
					<p className="text-gray-600 mb-4">
						Настройте фильтры и нажмите кнопку «Показать отчеты» для загрузки данных
					</p>
					<div className="text-sm text-gray-500">
						Выбрана категория:{' '}
						<span className="font-medium text-gray-700">
							{selectedCategoryData?.name}
						</span>
					</div>
				</div>
			);
		}

		if (isLoading) {
			return (
				<div className="flex-1 bg-white rounded-lg shadow-md p-8">
					<div className="flex justify-center items-center py-20">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
						<p className="ml-4 text-gray-600">Загрузка отчетов...</p>
					</div>
				</div>
			);
		}

		if (error) {
			return (
				<div className="flex-1 bg-white rounded-lg shadow-md p-8">
					<div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
						<div className="text-red-500 text-4xl mb-4">⚠️</div>
						<h3 className="text-lg font-semibold text-red-800 mb-2">Ошибка загрузки</h3>
						<p className="text-red-600 mb-4">{error}</p>
						<button
							onClick={fetchReports}
							className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
						>
							Попробовать снова
						</button>
					</div>
				</div>
			);
		}

		if (reports.length === 0) {
			return (
				<div className="flex-1 bg-white rounded-lg shadow-md p-8">
					<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
						<div className="text-yellow-500 text-6xl mb-4">📭</div>
						<h3 className="text-xl font-semibold text-gray-900 mb-2">Отчеты не найдены</h3>
						<p className="text-gray-600">
							За указанный период не найдено отчётов в категории «{selectedCategoryData?.name}»
						</p>
					</div>
				</div>
			);
		}

		return (
			<div className="flex-1">
				{/* Заголовок области отчетов */}
				<div className="bg-white rounded-lg shadow-md p-4 mb-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-3">
							<div
								className={`${selectedCategoryData?.headerColor} text-white p-2 rounded-lg`}
							>
								<span className="text-lg">{selectedCategoryData?.icon}</span>
							</div>
							<div>
								<h2 className="text-lg font-bold text-gray-900">
									{selectedCategoryData?.name}
								</h2>
								<p className="text-sm text-gray-600">
									{startDate} - {endDate} •{' '}
									{selectedLocation === 'all'
										? 'Все локации'
										: selectedLocation}
								</p>
							</div>
						</div>
						<div className="lg:hidden">
							<button
								onClick={goToMenu}
								className="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 transition-colors text-sm"
							>
								🏠
							</button>
						</div>
					</div>
				</div>

				{/* Список отчетов */}
				{selectedCategory === 'writeoff-period-reports' ? (
					// Для списаний за период показываем объединённую карточку
					<WriteoffPeriodCard reports={reports} />
				) : (
					// Для остальных категорий показываем отдельные карточки
					<div className="space-y-3">{reports.map(renderReportCard)}</div>
				)}

				{/* Пагинация */}
				{totalPages > 1 && (
					<div className="bg-white rounded-lg shadow-md p-4 mt-4">
						<div className="flex justify-center items-center space-x-2">
							<button
								onClick={() => handlePageChange(currentPage - 1)}
								disabled={currentPage === 1}
								className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								←
							</button>

							<div className="flex space-x-1">
								{Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
									let pageNum;
									if (totalPages <= 5) {
										pageNum = i + 1;
									} else if (currentPage <= 3) {
										pageNum = i + 1;
									} else if (currentPage >= totalPages - 2) {
										pageNum = totalPages - 4 + i;
									} else {
										pageNum = currentPage - 2 + i;
									}

									return (
										<button
											key={pageNum}
											onClick={() => handlePageChange(pageNum)}
											className={`px-3 py-2 rounded ${
												currentPage === pageNum
													? 'bg-blue-500 text-white'
													: 'bg-gray-200 text-gray-700 hover:bg-gray-300'
											}`}
										>
											{pageNum}
										</button>
									);
								})}
							</div>

							<button
								onClick={() => handlePageChange(currentPage + 1)}
								disabled={currentPage === totalPages}
								className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								→
							</button>
						</div>
					</div>
				)}
			</div>
		);
	};

	// Функции для работы с удалением отчетов
	const openDeleteModal = (reportId, reportType) => {
		setDeleteModal({
			isOpen: true,
			reportId,
			reportType,
			isDeleting: false,
		});
	};

	const closeDeleteModal = () => {
		setDeleteModal({
			isOpen: false,
			reportId: null,
			reportType: null,
			isDeleting: false,
		});
	};

	const handleDeleteReport = async () => {
		if (!deleteModal.reportId || !deleteModal.reportType) return;

		setDeleteModal((prev) => ({ ...prev, isDeleting: true }));

		try {
			let deleteMethod;

			// Выбираем правильный метод удаления в зависимости от типа отчета
			switch (deleteModal.reportType) {
				case 'shift-reports':
					deleteMethod = apiService.deleteShiftReport;
					break;
				case 'receiving-reports':
					deleteMethod = apiService.deleteReceivingReport;
					break;
				case 'writeoff-reports':
				case 'writeoff-period-reports':
				case 'transfer-reports':
					deleteMethod = apiService.deleteWriteoffTransferReport;
					break;
				default:
					throw new Error('Неизвестный тип отчета');
			}

			await deleteMethod(deleteModal.reportId);

			// Удаляем отчет из локального состояния
			setReports((prevReports) =>
				prevReports.filter((report) => report.id !== deleteModal.reportId)
			);

			// Обновляем общее количество
			setTotalCount((prev) => prev - 1);

			// Закрываем модальное окно
			closeDeleteModal();

			// Если на текущей странице больше нет отчетов, переходим на предыдущую
			if (reports.length === 1 && currentPage > 1) {
				setCurrentPage((prev) => prev - 1);
			}
		} catch (error) {
			console.error('Ошибка удаления отчета:', error);
			setError(`Ошибка удаления отчета: ${error.message}`);
			setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
			<div className="max-w-6xl mx-auto">
				<div className="flex flex-col lg:flex-row lg:space-x-4">
					{/* Панель фильтров */}
					<FiltersPanel />

					{/* Область отчетов */}
					<ReportsArea />
				</div>
			</div>

			{/* Модальное окно подтвержения удаления */}
			{deleteModal.isOpen && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
						<div className="flex items-center mb-4">
							<div className="bg-red-100 p-2 rounded-full mr-3">
								<svg
									className="w-6 h-6 text-red-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="2"
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z"
									/>
								</svg>
							</div>
							<h3 className="text-lg font-semibold text-gray-900">
								Подтверждение удаления
							</h3>
						</div>

						<p className="text-gray-600 mb-6">
							Вы точно хотите удалить отчет #{deleteModal.reportId}? <br />
							<span className="text-red-600 font-medium">
								Это действие нельзя отменить.
							</span>
						</p>

						<div className="flex space-x-3">
							<button
								onClick={closeDeleteModal}
								disabled={deleteModal.isDeleting}
								className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
							>
								Отмена
							</button>
							<button
								onClick={handleDeleteReport}
								disabled={deleteModal.isDeleting}
								className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
							>
								{deleteModal.isDeleting ? (
									<>
										<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
										Удаление...
									</>
								) : (
									'Удалить'
								)}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default ReportsViewer;
