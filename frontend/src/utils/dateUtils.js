// Функция для получения текущей даты в формате YYYY-MM-DD по МСК
export const getTodayDate = () => {
  const now = new Date();
  // Создаем дату в московском времени
  const mskTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Moscow"}));
  return mskTime.toISOString().split('T')[0]; // YYYY-MM-DD
};

// Функция для получения вчерашней даты в формате YYYY-MM-DD
export const getYesterdayDate = () => {
  const now = new Date();
  const mskTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Moscow"}));
  mskTime.setDate(mskTime.getDate() - 1); // Вычитаем один день
  return mskTime.toISOString().split('T')[0]; // YYYY-MM-DD
};

// Автозаполнение даты по МСК
export const getCurrentMSKTime = () => {
  const now = new Date();
  // Создаем дату в московском времени
  const mskTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Moscow"}));
  return mskTime.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Получение даты в формате YYYY-MM-DD по МСК (дубликат getTodayDate для совместимости)
export const getCurrentDate = () => {
  return getTodayDate();
};