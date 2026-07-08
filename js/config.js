// ============================================================
// Конфигурация / Configuration
//
// Получите свои api_id и api_hash на https://my.telegram.org
// (App configuration) и вставьте их вместо плейсхолдеров ниже.
//
// Get your own api_id and api_hash at https://my.telegram.org
// (App configuration) and put them here instead of placeholders.
// ============================================================

export const API_ID = 2040;
export const API_HASH = "b18441a1ff607e10a989891a5462e627";

// GramJS (MTProto для браузера) — собранный браузерный бандл, закоммиченный
// в репозиторий (vendor/telegram.js, версия 2.26.22). Как он собран и как его
// обновить — см. README. CDN-вариант (esm.sh) НЕ работает: его конвертация
// CJS→ESM ломает внутренние циклические зависимости GramJS.
export const GRAMJS_BUNDLE_URL = new URL("../vendor/telegram.js", import.meta.url).href;

// Ключи localStorage
export const SESSION_KEY = "tgcleaner_session";
export const LANG_KEY = "tgcleaner_lang";
export const USER_TEMPLATES_KEY = "tgcleaner_user_templates";

// Пауза между пачками удаления (мс) — защита от FLOOD_WAIT
export const DELETE_BATCH_DELAY_MS = 700;
// Размер пачки удаления (лимит Telegram API — 100 id за запрос)
export const DELETE_BATCH_SIZE = 100;

export function configIsValid() {
  return Number.isFinite(API_ID) && API_ID > 0 && !/YOUR_API_HASH/i.test(API_HASH) && API_HASH.length >= 16;
}
