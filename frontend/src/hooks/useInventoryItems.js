import { useState, useEffect, useCallback } from 'react';

const useInventoryItems = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

  // Получить список товаров
  const fetchItems = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, value);
        }
      });

      const response = await fetch(`${API_BASE_URL}/inventory-management/items?${params}`);

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }

      const data = await response.json();
      setItems(data.items || []);
      return data;
    } catch (error) {
      setError(error.message);
      console.error('Ошибка получения товаров:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL]);

  // Создать товар
  const createItem = useCallback(async (itemData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory-management/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(itemData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка создания товара');
      }

      const newItem = await response.json();
      setItems(prev => [...prev, newItem]);
      return newItem;
    } catch (error) {
      console.error('Ошибка создания товара:', error);
      throw error;
    }
  }, [API_BASE_URL]);

  // Обновить товар
  const updateItem = useCallback(async (itemId, updateData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory-management/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка обновления товара');
      }

      const updatedItem = await response.json();
      setItems(prev => prev.map(item =>
        item.id === itemId ? updatedItem : item
      ));
      return updatedItem;
    } catch (error) {
      console.error('Ошибка обновления товара:', error);
      throw error;
    }
  }, [API_BASE_URL]);

  // Удалить товар
  const deleteItem = useCallback(async (itemId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory-management/items/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка удаления товара');
      }

      setItems(prev => prev.filter(item => item.id !== itemId));
      return true;
    } catch (error) {
      console.error('Ошибка удаления товара:', error);
      throw error;
    }
  }, [API_BASE_URL]);

  // Получить товар по ID
  const getItem = useCallback(async (itemId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory-management/items/${itemId}`);

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Ошибка получения товара:', error);
      throw error;
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return {
    items,
    loading,
    error,
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
    getItem,
  };
};

export default useInventoryItems;