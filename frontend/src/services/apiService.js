const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Функция для обработки ответов API
const handleResponse = async (response, operation = 'операция') => {
  console.log(`📡 API Response [${operation}]:`, {
    status: response.status,
    statusText: response.statusText,
    url: response.url,
    headers: Object.fromEntries(response.headers.entries())
  });

  if (!response.ok) {
    let errorMessage = `Ошибка сервера ${response.status}`;

    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } else {
        const textData = await response.text();
        console.error(`❌ Non-JSON response [${operation}]:`, textData);
        errorMessage = `Сервер вернул не JSON ответ: ${response.status} ${response.statusText}`;
      }
    } catch (parseError) {
      console.error(`❌ Error parsing response [${operation}]:`, parseError);
      errorMessage = `Ошибка парсинга ответа: ${response.status} ${response.statusText}`;
    }

    throw new Error(errorMessage);
  }

  try {
    const data = await response.json();
    console.log(`✅ API Success [${operation}]:`, data);
    return data;
  } catch (parseError) {
    console.error(`❌ JSON Parse Error [${operation}]:`, parseError);
    throw new Error('Сервер вернул некорректный JSON ответ');
  }
};

export const apiService = {
  async createShiftReport(formData) {
    console.log('🚀 Отправляем отчет смены...');
    try {
      const response = await fetch(`${API_BASE_URL}/shift-reports/create`, {
        method: 'POST',
        body: formData
      });
      return await handleResponse(response, 'createShiftReport');
    } catch (error) {
      console.error('❌ createShiftReport error:', error);
      throw error;
    }
  },

  async createInventoryReport(formData) {
    console.log('🚀 Отправляем отчет инвентаризации...');
    try {
      const response = await fetch(`${API_BASE_URL}/daily_inventory/create`, {
        method: 'POST',
        body: formData
      });
      return await handleResponse(response, 'createInventoryReport');
    } catch (error) {
      console.error('❌ createInventoryReport error:', error);
      throw error;
    }
  },

  // НОВОЕ: создание инвентаризации v2
  async createInventoryReportV2(data) {
    console.log('🚀 Отправляем отчет инвентаризации v2...', data);
    try {
      const response = await fetch(`${API_BASE_URL}/daily-inventory-v2/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      return await handleResponse(response, 'createInventoryReportV2');
    } catch (error) {
      console.error('❌ createInventoryReportV2 error:', error);
      throw error;
    }
  },

  async createReceivingReport(formData) {
    console.log('🚀 Отправляем отчет приема товаров...');
    try {
      const response = await fetch(`${API_BASE_URL}/report-on-goods/create`, {
        method: 'POST',
        body: formData
      });
      return await handleResponse(response, 'createReceivingReport');
    } catch (error) {
      console.error('❌ createReceivingReport error:', error);
      throw error;
    }
  },

  async createWriteOffReport(formData) {
    console.log('🚀 Отправляем акт списания/перемещения...');
    try {
      const response = await fetch(`${API_BASE_URL}/writeoff-transfer/create`, {
        method: 'POST',
        body: formData
      });
      return await handleResponse(response, 'createWriteOffReport');
    } catch (error) {
      console.error('❌ createWriteOffReport error:', error);
      throw error;
    }
  },

  // Отправка дополнительных фотографий
  async sendAdditionalPhotos(location, photos) {
    console.log('🚀 Отправляем дополнительные фотографии...');

    if (!photos || photos.length === 0) {
      throw new Error('Нет фотографий для отправки');
    }

    try {
      const formData = new FormData();
      formData.append('location', location);

      photos.forEach((photo, index) => {
        formData.append('photos', photo);
      });

      const response = await fetch(`${API_BASE_URL}/report-on-goods/send-photo`, {
        method: 'POST',
        body: formData
      });
      return await handleResponse(response, 'sendAdditionalPhotos');
    } catch (error) {
      console.error('❌ sendAdditionalPhotos error:', error);
      throw error;
    }
  },

  // ===== МЕТОДЫ ДЛЯ ПРОСМОТРА ОТЧЕТОВ =====

  // Получение отчетов с пагинацией и фильтрацией
  async getReports(reportType, params = {}) {
    console.log(`🚀 Получаем отчеты типа ${reportType}...`, params);
    try {
      const queryParams = new URLSearchParams();

      // Добавляем параметры фильтрации
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value);
        }
      });

      const url = `${API_BASE_URL}/${reportType}/list?${queryParams}`;
      console.log('📡 Request URL:', url);

      const response = await fetch(url);
      return await handleResponse(response, 'getReports');
    } catch (error) {
      console.error('❌ getReports error:', error);
      throw error;
    }
  },

  // Получение конкретного отчета по ID
  async getReport(reportType, reportId) {
    console.log(`🚀 Получаем отчет ${reportType}/${reportId}...`);
    try {
      const response = await fetch(`${API_BASE_URL}/${reportType}/${reportId}`);
      return await handleResponse(response, 'getReport');
    } catch (error) {
      console.error('❌ getReport error:', error);
      throw error;
    }
  },

  // ===== СУЩЕСТВУЮЩИЕ МЕТОДЫ =====

  // ===== МЕТОДЫ ДЛЯ УПРАВЛЕНИЯ ТОВАРАМИ =====

  // Получение списка товаров
  async getInventoryItems(filters = {}) {
    console.log('🚀 Получаем список товаров...', filters);
    try {
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, value);
        }
      });

      const url = `${API_BASE_URL}/inventory-management/items?${params}`;
      console.log('📡 Request URL:', url);

      const response = await fetch(url);
      return await handleResponse(response, 'getInventoryItems');
    } catch (error) {
      console.error('❌ getInventoryItems error:', error);
      throw error;
    }
  },

  // Получение товара по ID
  async getInventoryItem(itemId) {
    console.log(`🚀 Получаем товар ${itemId}...`);
    try {
      const response = await fetch(`${API_BASE_URL}/inventory-management/items/${itemId}`);
      return await handleResponse(response, 'getInventoryItem');
    } catch (error) {
      console.error('❌ getInventoryItem error:', error);
      throw error;
    }
  },

  // Создание товара
  async createInventoryItem(itemData) {
    console.log('🚀 Создаем товар...', itemData);
    try {
      const response = await fetch(`${API_BASE_URL}/inventory-management/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(itemData)
      });
      return await handleResponse(response, 'createInventoryItem');
    } catch (error) {
      console.error('❌ createInventoryItem error:', error);
      throw error;
    }
  },

  // Обновление товара
  async updateInventoryItem(itemId, updateData) {
    console.log(`🚀 Обновляем товар ${itemId}...`, updateData);
    try {
      const response = await fetch(`${API_BASE_URL}/inventory-management/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });
      return await handleResponse(response, 'updateInventoryItem');
    } catch (error) {
      console.error('❌ updateInventoryItem error:', error);
      throw error;
    }
  },

  // Удаление товара
  async deleteInventoryItem(itemId) {
    console.log(`🚀 Удаляем товар ${itemId}...`);
    try {
      const response = await fetch(`${API_BASE_URL}/inventory-management/items/${itemId}`, {
        method: 'DELETE'
      });
      return await handleResponse(response, 'deleteInventoryItem');
    } catch (error) {
      console.error('❌ deleteInventoryItem error:', error);
      throw error;
    }
  },

  // Получение категорий
  async getInventoryCategories() {
    console.log('🚀 Получаем категории товаров...');
    try {
      const response = await fetch(`${API_BASE_URL}/inventory-management/categories`);
      return await handleResponse(response, 'getInventoryCategories');
    } catch (error) {
      console.error('❌ getInventoryCategories error:', error);
      throw error;
    }
  },

  // Получение детальной инвентаризации v2
  async getDetailedInventoryV2(inventoryId) {
    console.log(`🚀 Получаем детальную инвентаризацию ${inventoryId}...`);
    try {
      const response = await fetch(`${API_BASE_URL}/daily-inventory-v2/${inventoryId}/detailed`);
      return await handleResponse(response, 'getDetailedInventoryV2');
    } catch (error) {
      console.error('❌ getDetailedInventoryV2 error:', error);
      throw error;
    }
  }
};