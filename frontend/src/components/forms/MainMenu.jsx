import { DraftCard } from '../common/DraftCard';

// Main Menu Component - ДОБАВЛЕНО: отдельные кнопки для списаний и перемещений
export const MainMenu = ({
  drafts,
  setCurrentForm,
  setCurrentDraftId,
  setValidationErrors,
  deleteDraft,
  loadDraft
}) => {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">📊 Отчетность кассира</h1>
          <p className="text-gray-600">Выберите тип отчета</p>
        </div>

        {/* Черновики */}
        {drafts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">📝 Черновики</h2>
            <div className="space-y-3">
              {drafts.map(draft => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  loadDraft={loadDraft}
                  deleteDraft={deleteDraft}
                />
              ))}
            </div>
            <hr className="my-6 border-gray-300" />
          </div>
        )}

        {/* НОВОЕ: Кнопка управления товарами (только для админов) */}
        <div className="mb-6">
          <button
            onClick={() => {
              setCurrentDraftId(null);
              setValidationErrors({});
              setCurrentForm('inventory-management');
            }}
            className="w-full p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">⚙️</div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Управление товарами</h3>
                  <p className="text-purple-100 text-sm">Настройка товаров для инвентаризации</p>
                </div>
              </div>
              <div className="text-purple-100">→</div>
            </div>
          </button>
          <hr className="my-6 border-gray-300" />
        </div>

        {/* Новые отчеты */}
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Создать новый отчет:</h2>
        <div className="space-y-4">
          <button
            onClick={() => {
              setCurrentDraftId(null);
              setValidationErrors({});
              setCurrentForm('cashier');
            }}
            className="w-full p-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">💰</div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Я завершил смену, сдать отчёт</h3>
                  <p className="text-green-100 text-sm">Завершение смены</p>
                </div>
              </div>
              <div className="text-green-100">→</div>
            </div>
          </button>

          <button
            onClick={() => {
              setCurrentDraftId(null);
              setValidationErrors({});
              setCurrentForm('receiving');
            }}
            className="w-full p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">📥</div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Отчёт прием товара</h3>
                  <p className="text-purple-100 text-sm">Поступления товаров</p>
                </div>
              </div>
              <div className="text-purple-100">→</div>
            </div>
          </button>

          <button
            onClick={() => {
              setCurrentDraftId(null);
              setValidationErrors({});
              setCurrentForm('writeoff');
            }}
            className="w-full p-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">🗑️</div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Акты списания</h3>
                  <p className="text-red-100 text-sm">Списание товаров</p>
                </div>
              </div>
              <div className="text-red-100">→</div>
            </div>
          </button>

          <button
            onClick={() => {
              setCurrentDraftId(null);
              setValidationErrors({});
              setCurrentForm('transfer');
            }}
            className="w-full p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">↔️</div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Акты перемещения</h3>
                  <p className="text-blue-100 text-sm">Перемещение товаров</p>
                </div>
              </div>
              <div className="text-blue-100">→</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
