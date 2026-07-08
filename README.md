# Sinless TG

**RU** · [EN below](#english)

Узконаправленный инструмент цифровой гигиены: находит и удаляет **только ваши собственные сообщения** в Telegram — по наборам ключевых слов (шаблонам) или полностью в выбранном чате.

Работает **целиком в браузере**: статические HTML/CSS/JS без бэкенда, без сборки, без аналитики. Подходит для хостинга на GitHub Pages. Подключение к Telegram идёт напрямую из вашего браузера по протоколу MTProto через библиотеку [GramJS](https://gram.js.org) (браузерная сборка, соединение по WSS). Сессия хранится в `localStorage` вашего браузера и никуда не передаётся.

Это **не** Telegram-клиент: здесь нет чтения переписки, отправки сообщений и прочего. Только: вход → выбор шаблонов/слов → выбор чатов → подсчёт → удаление.

## Возможности

- Вход по номеру телефона, коду и паролю 2FA; карточка профиля; выход с очисткой сессии.
- Встроенные шаблоны ключевых слов + свои шаблоны: создание с нуля, клонирование встроенных, редактирование (построчный ввод — одна строка = одно слово/фраза).
- Поиск по шаблонам сразу по названию и по ключевым словам.
- Произвольные ключевые слова без шаблона (объединяются с выбранными шаблонами).
- Выбор чатов: «Личные чаты» и «Группы» (обычные группы и супергруппы) — целиком или по отдельности, с поиском по названию. Вещательные каналы намеренно не показываются.
- Поиск: глобальный поиск Telegram по слову (`messages.searchGlobal`) с фильтрацией по выбранным чатам. Результаты не блокируют вкладку (периодическая уступка потоку рендера); когда чужие сообщения не нужны, они отсекаются ещё до попадания в память.
- **Опции отдельно для ЛС и для групп** — у каждой категории свой выбор «чьи сообщения» (мои / чужие / все) и «как удалять» (для всех / только у себя).
- Ограничения Telegram учитываются автоматически:
  - «только у себя» доступно в ЛС и обычных группах; в супергруппах локального удаления нет.
  - удаление чужих «для всех» требует прав администратора. Если прав нет: в **обычной** группе такие сообщения удаляются «только у себя» (и их число показывается отдельной строкой в итоге), а в **супергруппе** (где локального удаления не существует) — пропускаются с пояснением в логе.
- Кнопка **«Подсчитать»**: сначала показывает, сколько сообщений будет удалено, и только потом — **«Удалить»** с явным подтверждением (в тексте — выбранный режим).
- Кнопка «Удалить все подходящие сообщения в этом чате» у каждого чата — без ключевых слов, по текущим настройкам «чьи/как».
- Очередь удаления пачками с паузами и автоматической обработкой `FLOOD_WAIT`.
- Интерфейс на русском и английском, тёмная тема.

## Как задеплоить свой форк

1. **Форкните** этот репозиторий (или создайте свой и скопируйте файлы).
2. **Получите `api_id` и `api_hash`**:
   - зайдите на <https://my.telegram.org> под своим номером;
   - откройте «API development tools», создайте приложение (название и платформа — любые);
   - скопируйте `api_id` (число) и `api_hash` (строка).
3. Откройте `js/config.js` и замените плейсхолдеры:
   ```js
   export const API_ID = Number("YOUR_API_ID");   // → Number("1234567") или просто 1234567
   export const API_HASH = "YOUR_API_HASH";       // → "0123456789abcdef0123456789abcdef"
   ```
4. Включите GitHub Pages: **Settings → Pages → Deploy from a branch**, ветка `main`, папка `/ (root)`.
5. Откройте `https://<ваш-логин>.github.io/<репозиторий>/`.

Никакой сборки не требуется — это просто статические файлы.

## ⚠️ Предупреждение о безопасности

- Это **неофициальный** инструмент, никак не связанный с Telegram.
- **Не доверяйте чужим деплоям вслепую.** Сайт, размещённый на чужом GitHub Pages, исполняет чужой код с доступом к вашей сессии Telegram. Прочитайте исходники (они небольшие) и разверните **свой** форк со своими `api_id`/`api_hash`.
- Удаление необратимо: сообщения удаляются «для всех», где Telegram это позволяет.
- Учтите ограничение поиска Telegram: серверный поиск находит совпадения по словам и их началу, а не по произвольным подстрокам внутри слова.
- Активное массовое удаление может временно упереться в лимиты Telegram (`FLOOD_WAIT`) — приложение само выдерживает паузы, это нормально.

## Технические детали

- GramJS (версия 2.26.22) поставляется **готовым браузерным ESM-бандлом, закоммиченным в репозиторий** — `vendor/telegram.js`. Деплою по-прежнему не нужен шаг сборки: это просто статический файл. Загрузка с CDN (esm.sh / jsdelivr `+esm`) сознательно не используется: их автоматическая конвертация CommonJS→ESM ломает внутренние циклические зависимости GramJS (симптом — ошибка `Cannot read properties of undefined (reading 'generateRandomLong')` при подключении).
- Пересобрать/обновить бандл (например, под новую версию GramJS): `cd tools && npm install && node build-gramjs.mjs`. Скрипт повторяет подмены официального webpack-конфига GramJS: node-модуль `crypto` заменяется на чистую JS-реализацию из самого GramJS (`telegram/crypto/crypto` на базе `@cryptography/aes` — в том числе AES-ECB/IGE/CTR, которых нет в Web Crypto API), `fs`/`os`/`path`/`net`/`socks`/`node-localstorage` — заглушками, `Buffer`/`process` — полифилами.
- Сессия (`StringSession`), пользовательские шаблоны и язык интерфейса хранятся в `localStorage`.
- Поиск своих сообщений: серверный фильтр по отправителю (`fromUser: "me"`); если конкретный чат его не поддерживает — fallback с фильтрацией по флагу `message.out` на клиенте.
- Удаление: `client.deleteMessages(..., { revoke: true })` пачками по 100 id с паузами.

### Troubleshooting

- **`Cannot read properties of undefined (reading 'generateRandomLong')`** — вы загрузили GramJS через CDN-конвертер (esm.sh и т.п.) вместо `vendor/telegram.js`. Верните в `js/config.js` путь к локальному бандлу или пересоберите его: `cd tools && npm install && node build-gramjs.mjs`.
- **Зависает на «Подключение к Telegram»** — убедитесь, что сайт открыт по `https` (для GitHub Pages это так по умолчанию): браузерное соединение идёт через WSS.
- **`AUTH_KEY_DUPLICATED` / битая сессия** — нажмите «Выйти» или очистите `localStorage` сайта и войдите заново.

## Структура репозитория

```
index.html                    — разметка приложения
css/style.css                 — стили (тёмная тема в стиле Telegram)
data/builtin-templates.json   — системные наборы ключевых слов (правьте здесь)
js/config.js                  — api_id / api_hash, путь к бандлу GramJS, константы
js/i18n.js                    — локализация RU/EN
js/templates.js               — загрузка шаблонов + хранилище пользовательских
js/telegram.js                — обёртка над GramJS (логин, чаты, скан, удаление)
js/app.js                     — логика интерфейса
vendor/telegram.js            — браузерный бандл GramJS (собран tools/build-gramjs.mjs)
tools/build-gramjs.mjs        — скрипт пересборки бандла (для деплоя не нужен)
```

### Как изменить системные шаблоны

Все встроенные наборы ключевых слов лежат в **`data/builtin-templates.json`** — это обычный файл данных, код трогать не нужно. Каждый шаблон:

```json
{
  "id": "my-template",
  "name": { "ru": "Моё название", "en": "My name" },
  "keywords": ["слово", "фраза из нескольких слов", "keyword"]
}
```

Добавьте/удалите объект в массиве `templates`, сохраните файл, обновите страницу. `id` должен быть уникальным. Пользователи приложения всегда могут склонировать встроенный шаблон в свой и редактировать копию, не меняя файл.

## Лицензия

[MIT](LICENSE)

---

## English

A single-purpose digital-hygiene tool: finds and deletes **only your own Telegram messages** — by keyword sets (templates) or entirely within a selected chat.

Runs **entirely in your browser**: static HTML/CSS/JS, no backend, no build step, no analytics. Designed for GitHub Pages hosting. It talks to Telegram directly from your browser via MTProto using [GramJS](https://gram.js.org) (browser build over WSS). Your session lives in your browser's `localStorage` and is never sent anywhere else.

This is **not** a Telegram client — no message reading UI, no sending. Only: sign in → pick templates/keywords → pick chats → count → delete.

### Deploying your own fork

1. Fork this repository.
2. Get your `api_id` / `api_hash` at <https://my.telegram.org> → “API development tools”.
3. Put them into `js/config.js` replacing `YOUR_API_ID` / `YOUR_API_HASH`.
4. Enable GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root.

### ⚠️ Security warning

This is an **unofficial** tool. Do not blindly trust anyone else's deployment: a site hosted on someone's GitHub Pages runs their code with access to your Telegram session. Read the source (it is small) and deploy **your own** fork with your own credentials. Deletion is irreversible (messages are revoked for everyone where Telegram allows it). Note that Telegram's server-side search matches words and word prefixes, not arbitrary substrings.

### License

MIT — see [LICENSE](LICENSE).
