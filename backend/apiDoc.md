# API Документация ReportBot

## Общая информация

**Базовый URL:** `http://your-domain:8000`

**Тип контента:** `multipart/form-data` для всех эндпоинтов

**Система отчетности для кафе** с четырьмя основными типами отчетов:
- Отчеты завершения смены
- Ежедневная инвентаризация 
- Отчеты приема товаров
- Акты списания/перемещения

---

## 1. Отчеты завершения смены

### POST `/shift-reports/create`

Создает отчет завершения смены с автоматическими расчетами сверки кассы.

#### Параметры запроса (multipart/form-data)

**Основные поля:**
- `location` (string, обязательно) - Название локации
- `shift_type` (string, обязательно) - Тип смены: `"morning"` или `"night"`
- `cashier_name` (string, обязательно) - ФИО кассира

**Финансовые данные:**
- `total_revenue` (decimal, обязательно) - Общая выручка (≥ 0)
- `returns` (decimal, по умолчанию 0) - Возвраты (≥ 0)
- `acquiring` (decimal, по умолчанию 0) - Эквайринг (≥ 0)
- `qr_code` (decimal, по умолчанию 0) - QR код (≥ 0)
- `online_app` (decimal, по умолчанию 0) - Онлайн приложение (≥ 0)
- `yandex_food` (decimal, по умолчанию 0) - Яндекс Еда (≥ 0)
- `fact_cash` (decimal, обязательно) - Фактическая наличность (≥ 0)

**JSON поля:**
- `income_entries_json` (string, необязательно) - JSON массив приходов
- `expense_entries_json` (string, необязательно) - JSON массив расходов

**Файлы:**
- `photo` (file, обязательно) - Фото кассового отчета

#### Формат JSON полей

**income_entries_json:**
```json
[
  {
    "amount": 500.50,
    "comment": "Внесение от администратора"
  },
  {
    "amount": 200.00,
    "comment": "Сдача с предыдущей смены"
  }
]
```

**expense_entries_json:**
```json
[
  {
    "description": "Покупка канцтоваров",
    "amount": 125.75
  },
  {
    "description": "Такси для курьера", 
    "amount": 300.00
  }
]
```

#### Пример запроса (JavaScript)

```javascript
const formData = new FormData();
formData.append('location', 'Кафе Центральный');
formData.append('shift_type', 'morning');
formData.append('cashier_name', 'Иванов Иван Иванович');
formData.append('total_revenue', '15000.50');
formData.append('returns', '200.00');
formData.append('acquiring', '5000.00');
formData.append('fact_cash', '5100.50');

// JSON поля
const incomeEntries = [
  { amount: 500.50, comment: "Внесение от администратора" }
];
formData.append('income_entries_json', JSON.stringify(incomeEntries));

const expenseEntries = [
  { description: "Покупка канцтоваров", amount: 125.75 }
];
formData.append('expense_entries_json', JSON.stringify(expenseEntries));

// Фото
formData.append('photo', photoFile);

const response = await fetch('/shift-reports/create', {
  method: 'POST',
  body: formData
});
```

#### Ответ (201 Created)

```json
{
  "id": 1,
  "location": "Кафе Центральный",
  "shift_type": "morning",
  "date": "2025-05-28T10:30:00Z",
  "cashier_name": "Иванов Иван Иванович",
  "total_income": 700.50,
  "total_expenses": 425.75,
  "total_acquiring": 9700.00,
  "calculated_amount": 5574.75,
  "surplus_shortage": -474.25,
  "fact_cash": 5100.50,
  "total_revenue": 15000,
  "returns": 200,
  "acquiring": 5000,
  "qr_code": 1500,
  "online_app": 2000,
  "yandex_food": 1200,
  "income_entries": [
    {"amount": 500.5, "comment": "Внесение от администратора"}
  ],
  "expense_entries": [
    {"description": "Покупка канцтоваров", "amount": 125.75}
  ],
  "photo_path": "./uploads/shift_reports/uuid-filename.jpg",
  "status": "draft",
  "created_at": "2025-05-28T10:30:00Z"
}
```

#### Ограничения
- Максимум 5 записей приходов
- Максимум 10 записей расходов
- Фото обязательно (JPG, JPEG, PNG, GIF, BMP)

---

## 2. Ежедневная инвентаризация

### POST `/daily_inventory/create`

Создает отчет ежедневной инвентаризации товаров.

#### Параметры запроса (multipart/form-data)

**Основные поля:**
- `location` (string, обязательно) - Название локации
- `shift_type` (string, обязательно) - `"morning"` или `"night"`
- `cashier_name` (string, обязательно) - ФИО кассира

**Напитки (все поля integer ≥ 0):**
- `il_primo_steklo` - Количество Il Primo (стекло)
- `voda_gornaya` - Количество горной воды
- `dobri_sok_pet` - Количество сока Добрый (ПЭТ)
- `kuragovi_kompot` - Количество кураговый компот
- `napitki_jb` - Количество напитков JB
- `energetiky` - Количество энергетиков
- `kold_bru` - Количество колд брю
- `kinza_napitky` - Количество напитков Кинза

**Еда и ингредиенты (все поля integer ≥ 0):**
- `palli` - Количество палли (лепешки)
- `barbeku_dip` - Количество барбекю дипа
- `bulka_na_shaurmu` - Количество булок для шаурмы
- `lavash` - Количество лаваша
- `ketchup_dip` - Количество кетчуп дипа
- `sirny_sous_dip` - Количество сырного соуса дип
- `kuriza_jareny` - Количество жареной курицы
- `kuriza_siraya` - Количество сырой курицы

#### Пример запроса (JavaScript)

```javascript
const formData = new FormData();
formData.append('location', 'Кафе Центральный');
formData.append('shift_type', 'morning');
formData.append('cashier_name', 'Иванов Иван Иванович');

// Напитки
formData.append('il_primo_steklo', '10');
formData.append('voda_gornaya', '15');
formData.append('dobri_sok_pet', '8');
formData.append('kuragovi_kompot', '5');
formData.append('napitki_jb', '12');
formData.append('energetiky', '6');
formData.append('kold_bru', '4');
formData.append('kinza_napitky', '7');

// Еда и ингредиенты
formData.append('palli', '25');
formData.append('barbeku_dip', '3');
formData.append('bulka_na_shaurmu', '20');
formData.append('lavash', '15');
formData.append('ketchup_dip', '5');
formData.append('sirny_sous_dip', '4');
formData.append('kuriza_jareny', '10');
formData.append('kuriza_siraya', '8');

const response = await fetch('/daily_inventory/create', {
  method: 'POST',
  body: formData
});
```

#### Ответ (201 Created)

```json
{
  "id": 1,
  "location": "Кафе Центральный",
  "shift_type": "morning",
  "date": "2025-05-28T10:30:00Z",
  "cashier_name": "Иванов Иван Иванович",
  "il_primo_steklo": 10,
  "voda_gornaya": 15,
  "dobri_sok_pet": 8,
  "kuragovi_kompot": 5,
  "napitki_jb": 12,
  "energetiky": 6,
  "kold_bru": 4,
  "kinza_napitky": 7,
  "palli": 25,
  "barbeku_dip": 3,
  "bulka_na_shaurmu": 20,
  "lavash": 15,
  "ketchup_dip": 5,
  "sirny_sous_dip": 4,
  "kuriza_jareny": 10,
  "kuriza_siraya": 8
}
```

---

## 3. Отчеты приема товаров

### POST `/report-on-goods/create`

Создает отчет о приеме товаров по категориям.

#### Параметры запроса (multipart/form-data)

- `location` (string, обязательно) - Название локации
- `kuxnya_json` (string, необязательно) - JSON массив товаров для кухни
- `bar_json` (string, необязательно) - JSON массив товаров для бара  
- `upakovki_json` (string, необязательно) - JSON массив упаковок/хозтоваров

#### Формат JSON полей

Каждый JSON массив содержит объекты с полями:
- `name` (string) - Название товара
- `count` (integer > 0) - Количество

**Примеры:**

```json
// kuxnya_json
[
  {"name": "Мука пшеничная", "count": 5},
  {"name": "Масло подсолнечное", "count": 3}
]

// bar_json  
[
  {"name": "Кола 0.5л", "count": 24},
  {"name": "Сок яблочный", "count": 12}
]

// upakovki_json
[
  {"name": "Стаканы пластиковые", "count": 100},
  {"name": "Салфетки", "count": 50}
]
```

#### Пример запроса (JavaScript)

```javascript
const formData = new FormData();
formData.append('location', 'Кафе Центральный');

const kuxnyaItems = [
  {"name": "Мука пшеничная", "count": 5},
  {"name": "Масло подсолнечное", "count": 3}
];
formData.append('kuxnya_json', JSON.stringify(kuxnyaItems));

const barItems = [
  {"name": "Кола 0.5л", "count": 24},
  {"name": "Сок яблочный", "count": 12}
];
formData.append('bar_json', JSON.stringify(barItems));

const upakovkiItems = [
  {"name": "Стаканы пластиковые", "count": 100},
  {"name": "Салфетки", "count": 50}
];
formData.append('upakovki_json', JSON.stringify(upakovkiItems));

const response = await fetch('/report-on-goods/create', {
  method: 'POST',
  body: formData
});
```

#### Ответ (201 Created)

```json
{
  "id": 1,
  "location": "Кафе Центральный",
  "date": "2025-05-28T10:30:00Z",
  "kuxnya": [
    {"name": "Мука пшеничная", "count": 5},
    {"name": "Масло подсолнечное", "count": 3}
  ],
  "bar": [
    {"name": "Кола 0.5л", "count": 24},
    {"name": "Сок яблочный", "count": 12}
  ],
  "upakovki_xoz": [
    {"name": "Стаканы пластиковые", "count": 100},
    {"name": "Салфетки", "count": 50}
  ]
}
```

---

## 4. Акты списания/перемещения

### POST `/writeoff-transfer/create`

Создает акт списания и перемещения товаров.

#### Параметры запроса (multipart/form-data)

- `location` (string, обязательно) - Название локации
- `report_date` (date, обязательно) - Дата отчёта (YYYY-MM-DD)
- `writeoffs_json` (string, необязательно) - JSON массив списаний
- `transfers_json` (string, необязательно) - JSON массив перемещений

#### Допустимые локации
- `"Гагарина 48/1"`
- `"Абдулхакима Исмаилова 51"`
- `"Гайдара Гаджиева 7Б"`

#### Формат JSON полей

Каждый JSON массив содержит объекты с полями:
- `name` (string) - Наименование товара
- `weight` (float > 0) - Вес в кг
- `reason` (string) - Причина

**Примеры:**

```json
// writeoffs_json (списания)
[
  {
    "name": "Курица жареная",
    "weight": 2.0,
    "reason": "Пересушена"
  },
  {
    "name": "Соус сырный", 
    "weight": 1.0,
    "reason": "Истёк срок годности"
  }
]

// transfers_json (перемещения)
[
  {
    "name": "Вода Горная",
    "weight": 12.0, 
    "reason": "На точку Гайдара"
  },
  {
    "name": "Лаваш",
    "weight": 6.0,
    "reason": "На точку Гагарина"
  }
]
```

#### Пример запроса (JavaScript)

```javascript
const formData = new FormData();
formData.append('location', 'Абдулхакима Исмаилова 51');
formData.append('report_date', '2025-05-24');

const writeoffs = [
  {
    "name": "Курица жареная",
    "weight": 2.0,
    "reason": "Пересушена"
  }
];
formData.append('writeoffs_json', JSON.stringify(writeoffs));

const transfers = [
  {
    "name": "Вода Горная", 
    "weight": 12.0,
    "reason": "На точку Гайдара"
  }
];
formData.append('transfers_json', JSON.stringify(transfers));

const response = await fetch('/writeoff-transfer/create', {
  method: 'POST',
  body: formData
});
```

#### Ответ (201 Created)

```json
{
  "id": 1,
  "location": "Абдулхакима Исмаилова 51",
  "report_date": "2025-05-24",
  "created_date": "2025-05-24T10:30:00Z",
  "writeoffs": [
    {
      "name": "Курица жареная",
      "weight": 2.0,
      "reason": "Пересушена"
    }
  ],
  "transfers": [
    {
      "name": "Вода Горная",
      "weight": 12.0,
      "reason": "На точку Гайдара"
    }
  ]
}
```

#### Ограничения
- Максимум 10 записей списаний
- Максимум 10 записей перемещений
- Должна быть хотя бы одна запись (списание или перемещение)

---

## Коды ответов

### Успешные ответы
- `201 Created` - Ресурс успешно создан

### Ошибки клиента (4xx)
- `400 Bad Request` - Ошибка валидации данных
- `404 Not Found` - Ресурс не найден
- `422 Unprocessable Entity` - Ошибка обработки данных

### Ошибки сервера (5xx)  
- `500 Internal Server Error` - Внутренняя ошибка сервера

### Примеры ошибок

```json
// 400 Bad Request
{
  "detail": "Некорректный JSON в income_entries_json"
}

// 400 Bad Request для writeoff-transfer
{
  "detail": "Недопустимая локация. Выберите одну из: Гагарина 48/1, Абдулхакима Исмаилова 51, Гайдара Гаджиева 7Б"
}

// 422 Unprocessable Entity
{
  "detail": [
    {
      "loc": ["body", "total_revenue"],
      "msg": "ensure this value is greater than or equal to 0",
      "type": "value_error.number.not_ge"
    }
  ]
}
```

---

## Дополнительные особенности

### Telegram интеграция
- Все отчеты автоматически отправляются в Telegram
- Отправка происходит асинхронно (не влияет на создание отчета)
- Если Telegram недоступен, отчет все равно создается в БД

### Файлы
- Фото отчетов сохраняются в папку `./uploads/shift_reports/`
- Поддерживаемые форматы: JPG, JPEG, PNG, GIF, BMP
- Файлы получают уникальные имена (UUID)

### Автоматические расчеты (для отчетов смены)
Система автоматически рассчитывает:
- `total_income` - сумма всех приходов
- `total_expenses` - сумма всех расходов  
- `total_acquiring` - сумма всех безналичных платежей
- `calculated_amount` - расчетная сумма по формуле
- `surplus_shortage` - излишек/недостача (факт - расчет)

**Формула расчета:**
```
Расчетная сумма = Выручка - Возвраты + Приходы - Расходы - Эквайринг
```

### Типы данных
- `string` - строка
- `integer` - целое число
- `decimal/float` - десятичное число
- `date` - дата в формате YYYY-MM-DD
- `datetime` - дата и время в формате ISO 8601
- `file` - файл для загрузки

### Валидация
- Все суммы должны быть ≥ 0
- Количества товаров должны быть > 0
- JSON поля должны быть валидными JSON массивами
- Обязательные поля должны быть заполнены
- Типы смен: только `"morning"` или `"night"`

---

## Примеры использования с различными фреймворками

### React (с axios)

```javascript
import axios from 'axios';

// Создание отчета смены
const createShiftReport = async (reportData, photo) => {
  const formData = new FormData();
  
  // Основные поля
  formData.append('location', reportData.location);
  formData.append('shift_type', reportData.shift_type);
  formData.append('cashier_name', reportData.cashier_name);
  formData.append('total_revenue', reportData.total_revenue);
  formData.append('fact_cash', reportData.fact_cash);
  
  // JSON поля
  if (reportData.income_entries) {
    formData.append('income_entries_json', JSON.stringify(reportData.income_entries));
  }
  
  // Фото
  formData.append('photo', photo);
  
  try {
    const response = await axios.post('/shift-reports/create', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка создания отчета:', error.response.data);
    throw error;
  }
};
```

### Vue.js

```javascript
// В компоненте Vue
async submitReport() {
  const formData = new FormData();
  
  formData.append('location', this.form.location);
  formData.append('shift_type', this.form.shift_type);
  formData.append('cashier_name', this.form.cashier_name);
  // ... другие поля
  
  try {
    const response = await this.$http.post('/shift-reports/create', formData);
    this.$message.success('Отчет создан успешно');
    return response.data;
  } catch (error) {
    this.$message.error('Ошибка создания отчета');
    console.error(error);
  }
}
```

### Angular

```typescript
import { HttpClient } from '@angular/common/http';

constructor(private http: HttpClient) {}

createShiftReport(reportData: any, photo: File) {
  const formData = new FormData();
  
  formData.append('location', reportData.location);
  formData.append('shift_type', reportData.shift_type);
  formData.append('cashier_name', reportData.cashier_name);
  formData.append('photo', photo);
  
  return this.http.post('/shift-reports/create', formData);
}
```

---

Данная документация покрывает все основные аспекты работы с API ReportBot. При возникновении вопросов или необходимости дополнительной информации, обращайтесь к разработчикам бэкенда.