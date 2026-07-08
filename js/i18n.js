// Локализация интерфейса: русский / английский.
// t(key, vars) подставляет {placeholder} из vars.

import { LANG_KEY } from "./config.js";

export const I18N = {
  ru: {
    appTitle: "Sinless TG",
    privacyNotice:
      "Это приложение работает полностью в вашем браузере. Ваши данные и сессия не покидают это устройство и не передаются на сервер сайта.",
    langToggle: "EN",

    // --- конфиг / загрузка ---
    configMissing:
      "Приложение не настроено: в js/config.js не заданы api_id и api_hash. Владелец сайта должен получить их на my.telegram.org и вписать в код (см. README).",
    libLoading: "Загрузка библиотеки Telegram (GramJS)…",
    libError:
      "Не удалось загрузить GramJS с CDN. Проверьте подключение к интернету или см. раздел Troubleshooting в README.",
    connecting: "Подключение к Telegram…",

    // --- логин ---
    loginTitle: "Вход в Telegram",
    phoneLabel: "Номер телефона (в международном формате)",
    phonePlaceholder: "+48123456789",
    codeLabel: "Код подтверждения из Telegram",
    codePlaceholder: "12345",
    passwordLabel: "Пароль двухфакторной аутентификации (2FA)",
    passwordPlaceholder: "Пароль",
    nextBtn: "Далее",
    loginWait: "Ожидание ответа Telegram…",

    // --- ошибки Telegram ---
    errPhoneInvalid: "Неверный номер телефона. Проверьте формат: +код страны и номер.",
    errCodeInvalid: "Неверный код подтверждения. Попробуйте ещё раз.",
    errCodeExpired: "Код подтверждения истёк. Запросите вход заново.",
    errPasswordInvalid: "Неверный пароль 2FA. Попробуйте ещё раз.",
    errFloodWait: "Telegram ограничил частоту запросов. Подождите {s} сек. и попробуйте снова.",
    errGeneric: "Ошибка Telegram: {msg}",

    // --- профиль ---
    logoutBtn: "Выйти",
    loggedInAs: "Вы вошли как",

    // --- основная вкладка ---
    tabDelete: "Удаление сообщений",
    ownOnlyHint:
      "Инструмент ищет и удаляет только ваши собственные сообщения. Поиск Telegram работает по словам (и их началу), а не по произвольным подстрокам.",

    // --- шаблоны ---
    templatesTitle: "Шаблоны",
    tplSearchPlaceholder: "Поиск по названию и ключевым словам…",
    tplNewBtn: "+ Новый шаблон",
    tplBuiltinBadge: "встроенный",
    tplMineBadge: "мой",
    tplCloneBtn: "Клонировать",
    tplEditBtn: "Редактировать",
    tplInfoBtn: "Все ключевые слова",
    tplEmpty: "Шаблоны не найдены.",
    tplCloneSuffix: " (копия)",
    tplKeywordsCount: "{n} слов/фраз",

    // --- редактор шаблона ---
    editorTitleNew: "Новый шаблон",
    editorTitleEdit: "Редактирование шаблона",
    editorNameLabel: "Название шаблона",
    editorKeywordsLabel: "Ключевые слова — по одному слову или фразе на строку",
    editorSave: "Сохранить",
    editorCancel: "Отмена",
    editorDelete: "Удалить шаблон",
    tplDeleteBtn: "Удалить шаблон",
    tplDeleteConfirmTitle: "Удаление шаблона",
    tplDeleteConfirmMsg: "Удалить шаблон «{name}»? Это действие нельзя отменить.",
    editorNameRequired: "Введите название шаблона.",
    editorKeywordsRequired: "Добавьте хотя бы одно ключевое слово.",

    // --- свободные слова ---
    freeWordsTitle: "Ключевые слова без шаблона",
    freeWordsHint: "По одному слову или фразе на строку. Участвуют в поиске вместе с выбранными шаблонами.",

    // --- чаты ---
    personalChats: "Личные чаты",
    groupChats: "Группы",
    chatSearchPlaceholder: "Поиск чата по названию…",
    chatsLoading: "Загрузка списка чатов…",
    chatsEmpty: "Чатов не найдено.",
    chatsSelected: "выбрано: {n}",
    clearChatBtn: "Удалить все подходящие сообщения в этом чате",

    // --- опции удаления ---
    optOwnershipTitle: "Чьи сообщения",
    optMine: "Мои",
    optOthers: "Чужие",
    optAll: "Все",
    optScopeTitle: "Как удалять",
    optForEveryone: "Для всех",
    optForMe: "Только у себя",
    optHint:
      "«Только у себя» доступно лишь в личных чатах и обычных группах (в супергруппах локального удаления нет). При режиме «для всех» чужие сообщения там, где вы не администратор, будут удалены только у вас — в обычных группах (их число показывается отдельной строкой в итоге). В супергруппах без прав администратора удалить чужие нельзя — они пропускаются.",
    skipLocalMega: "«{title}»: в супергруппах нельзя удалить только у себя — пропущено {n}",
    skipNoAdmin: "«{title}»: нет прав администратора для удаления чужих — пропущено {n}",

    // --- подсчёт / удаление ---
    countBtn: "Подсчитать",
    deleteBtn: "Удалить",
    stopBtn: "Стоп",
    needKeywords: "Выберите хотя бы один шаблон или введите ключевые слова.",
    needChats: "Выберите хотя бы один чат.",
    scanStartGlobal: "Глобальный поиск по аккаунту: {kw} слов/фраз (фильтр по {chats} чатам)…",
    scanStartPerChat: "Постепенный перебор по чатам ({chats}): {kw} слов/фраз…",
    scanKeyword: "[{i}/{n}] Поиск слова: «{kw}»…",
    scanningChat: "[{i}/{n}] {title}…",
    scanned: "просмотрено сообщений: {n}",
    foundLocalFallback: "из них будут удалены только у вас (вы не админ): {n}",

    // --- заголовки настроек и выбор метода ---
    deleteOptionsTitle: "Настройки удаления",
    methodTitle: "Метод поиска",
    methodGlobalName: "Глобальный поиск (рекомендуется)",
    methodGlobalDesc:
      "Быстрый общий поиск Telegram по всему аккаунту. Подходит в большинстве случаев.",
    methodPerChatName: "Постепенный перебор по чатам",
    methodPerChatDesc:
      "Если глобальный поиск тормозит или зависает на частых словах — выберите этот: медленнее, но идёт по одному чату и грузит меньше данных.",
    methodNote:
      "Глобальный поиск на частых словах может ненадолго подвисать — это нормально, дождитесь окончания. Если мешает, выберите постепенный перебор по чатам.",
    globalScanHint:
      "Глобальный поиск: на частых словах возможны кратковременные подвисания — это нормально, дождитесь.",
    chatFoundLine: "{title}: найдено {found}",
    scanChatError: "[{i}/{n}] {title}: ошибка — {msg}",
    scanGlobalError: "Ошибка поиска: {msg}",
    scanStopped: "Сканирование остановлено пользователем.",
    scanDone: "Подсчёт завершён.",
    foundTotal: "Найдено сообщений к удалению: {n}",
    foundNothing: "Ничего не найдено — удалять нечего.",
    countFirst: "Сначала выполните подсчёт.",
    selectionChanged: "Выбор изменился — подсчёт сброшен, выполните его заново.",

    confirmTitle: "Подтверждение удаления",
    scopeEveryone: "Сообщения будут удалены у всех участников (где это позволяет Telegram).",
    scopeMe: "Сообщения будут удалены только у вас.",
    scopeMixed: "Режим удаления зависит от чата (см. настройки ЛС и групп).",
    confirmDeleteMsg:
      "Вы уверены? Найдено {n} сообщений. {scope} Действие необратимо.",
    confirmClearChatMsg:
      "Вы уверены? В чате «{chat}» найдено {n} сообщений. {scope} Действие необратимо.",
    confirmYes: "Да, удалить",
    confirmNo: "Отмена",

    deleteStart: "Удаление {n} сообщений…",
    deletingChat: "[{i}/{n}] {title}: удаление {count} сообщений…",
    deleteChatDone: "[{i}/{n}] {title}: удалено {ok}, ошибок {fail}",
    deleteErrorReason: "  ошибка ({count} шт.): {msg}",
    deleteStopped: "Удаление остановлено пользователем.",
    deleteDone: "Готово. Удалено: {ok}. С ошибкой: {fail}.",
    floodWaiting: "Telegram просит подождать {s} сек. (FLOOD_WAIT) — пауза…",

    // --- очистка чата ---
    clearChatCounting: "Подсчёт ваших сообщений в «{chat}»…",
    clearChatFound: "В «{chat}» найдено ваших сообщений: {n}",
    clearChatNothing: "В «{chat}» ваших сообщений не найдено.",

    logoutConfirmTitle: "Выход",
    logoutConfirmMsg: "Выйти из аккаунта и удалить сессию из этого браузера?",
  },

  en: {
    appTitle: "Sinless TG",
    privacyNotice:
      "This app runs entirely in your browser. Your data and session never leave this device and are never sent to the site's server.",
    langToggle: "RU",

    configMissing:
      "The app is not configured: api_id and api_hash are missing in js/config.js. The site owner must obtain them at my.telegram.org and put them into the code (see README).",
    libLoading: "Loading the Telegram library (GramJS)…",
    libError:
      "Failed to load GramJS from the CDN. Check your internet connection or see the Troubleshooting section in the README.",
    connecting: "Connecting to Telegram…",

    loginTitle: "Sign in to Telegram",
    phoneLabel: "Phone number (international format)",
    phonePlaceholder: "+48123456789",
    codeLabel: "Confirmation code from Telegram",
    codePlaceholder: "12345",
    passwordLabel: "Two-factor authentication (2FA) password",
    passwordPlaceholder: "Password",
    nextBtn: "Next",
    loginWait: "Waiting for Telegram…",

    errPhoneInvalid: "Invalid phone number. Check the format: +country code and number.",
    errCodeInvalid: "Invalid confirmation code. Please try again.",
    errCodeExpired: "The confirmation code has expired. Start the sign-in again.",
    errPasswordInvalid: "Invalid 2FA password. Please try again.",
    errFloodWait: "Telegram rate limit hit. Wait {s} seconds and try again.",
    errGeneric: "Telegram error: {msg}",

    logoutBtn: "Log out",
    loggedInAs: "Signed in as",

    tabDelete: "Message deletion",
    ownOnlyHint:
      "This tool finds and deletes only your own messages. Telegram search matches words (and word prefixes), not arbitrary substrings.",

    templatesTitle: "Templates",
    tplSearchPlaceholder: "Search by name and keywords…",
    tplNewBtn: "+ New template",
    tplBuiltinBadge: "built-in",
    tplMineBadge: "mine",
    tplCloneBtn: "Clone",
    tplEditBtn: "Edit",
    tplInfoBtn: "All keywords",
    tplEmpty: "No templates found.",
    tplCloneSuffix: " (copy)",
    tplKeywordsCount: "{n} words/phrases",

    editorTitleNew: "New template",
    editorTitleEdit: "Edit template",
    editorNameLabel: "Template name",
    editorKeywordsLabel: "Keywords — one word or phrase per line",
    editorSave: "Save",
    editorCancel: "Cancel",
    editorDelete: "Delete template",
    tplDeleteBtn: "Delete template",
    tplDeleteConfirmTitle: "Delete template",
    tplDeleteConfirmMsg: "Delete the template “{name}”? This cannot be undone.",
    editorNameRequired: "Enter a template name.",
    editorKeywordsRequired: "Add at least one keyword.",

    freeWordsTitle: "Keywords without a template",
    freeWordsHint: "One word or phrase per line. Used in the scan together with the selected templates.",

    personalChats: "Private chats",
    groupChats: "Groups",
    chatSearchPlaceholder: "Search chats by title…",
    chatsLoading: "Loading chat list…",
    chatsEmpty: "No chats found.",
    chatsSelected: "selected: {n}",
    clearChatBtn: "Delete all matching messages in this chat",

    optOwnershipTitle: "Whose messages",
    optMine: "Mine",
    optOthers: "Others'",
    optAll: "All",
    optScopeTitle: "Deletion mode",
    optForEveryone: "For everyone",
    optForMe: "Only for me",
    optHint:
      "“Only for me” works in private chats and basic groups only (supergroups have no local deletion). In “for everyone” mode, others' messages where you are not an admin will be deleted only for you — in basic groups (their count is shown as a separate line in the summary). In supergroups without admin rights, others' messages can't be deleted and are skipped.",
    skipLocalMega: "“{title}”: supergroups don't allow deleting only for you — {n} skipped",
    skipNoAdmin: "“{title}”: no admin rights to delete others' messages — {n} skipped",

    countBtn: "Count",
    deleteBtn: "Delete",
    stopBtn: "Stop",
    needKeywords: "Select at least one template or enter keywords.",
    needChats: "Select at least one chat.",
    scanStartGlobal: "Account-wide global search: {kw} words/phrases (filtered to {chats} chats)…",
    scanStartPerChat: "Gradual per-chat scan ({chats}): {kw} words/phrases…",
    scanKeyword: "[{i}/{n}] Searching word: “{kw}”…",
    scanningChat: "[{i}/{n}] {title}…",
    scanned: "messages scanned: {n}",
    foundLocalFallback: "of those, will be deleted only for you (not an admin): {n}",

    // --- settings headers and method choice ---
    deleteOptionsTitle: "Deletion settings",
    methodTitle: "Search method",
    methodGlobalName: "Global search (recommended)",
    methodGlobalDesc:
      "Fast account-wide Telegram search. Works well in most cases.",
    methodPerChatName: "Gradual per-chat scan",
    methodPerChatDesc:
      "If global search lags or freezes on frequent words — pick this: slower, but goes chat by chat and downloads less data.",
    methodNote:
      "Global search may briefly freeze on frequent words — that's normal, let it finish. If it bothers you, choose the gradual per-chat scan.",
    globalScanHint:
      "Global search: brief freezes are possible on frequent words — that's normal, please wait.",
    chatFoundLine: "{title}: found {found}",
    scanChatError: "[{i}/{n}] {title}: error — {msg}",
    scanGlobalError: "Search error: {msg}",
    scanStopped: "Scan stopped by user.",
    scanDone: "Counting finished.",
    foundTotal: "Messages found for deletion: {n}",
    foundNothing: "Nothing found — nothing to delete.",
    countFirst: "Run the count first.",
    selectionChanged: "Selection changed — the count was reset, run it again.",

    confirmTitle: "Confirm deletion",
    scopeEveryone: "Messages will be deleted for all participants (where Telegram allows it).",
    scopeMe: "Messages will be deleted only for you.",
    scopeMixed: "Deletion mode depends on the chat (see the private/group settings).",
    confirmDeleteMsg:
      "Are you sure? {n} messages found. {scope} This cannot be undone.",
    confirmClearChatMsg:
      "Are you sure? {n} messages found in “{chat}”. {scope} This cannot be undone.",
    confirmYes: "Yes, delete",
    confirmNo: "Cancel",

    deleteStart: "Deleting {n} messages…",
    deletingChat: "[{i}/{n}] {title}: deleting {count} messages…",
    deleteChatDone: "[{i}/{n}] {title}: deleted {ok}, failed {fail}",
    deleteErrorReason: "  error ({count} msgs): {msg}",
    deleteStopped: "Deletion stopped by user.",
    deleteDone: "Done. Deleted: {ok}. Failed: {fail}.",
    floodWaiting: "Telegram asks to wait {s} s (FLOOD_WAIT) — pausing…",

    clearChatCounting: "Counting your messages in “{chat}”…",
    clearChatFound: "Found {n} of your messages in “{chat}”.",
    clearChatNothing: "No messages of yours found in “{chat}”.",

    logoutConfirmTitle: "Log out",
    logoutConfirmMsg: "Log out and remove the session from this browser?",
  },
};

let currentLang = localStorage.getItem(LANG_KEY) || "ru";

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  currentLang = lang === "en" ? "en" : "ru";
  localStorage.setItem(LANG_KEY, currentLang);
}

export function t(key, vars) {
  let s = (I18N[currentLang] && I18N[currentLang][key]) || I18N.ru[key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll("{" + k + "}", String(v));
    }
  }
  return s;
}

// Проставляет тексты во все элементы с data-i18n / data-i18n-ph (placeholder) / data-i18n-title
export function applyStaticI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll("[data-i18n-ph]").forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
  root.querySelectorAll("[data-i18n-title]").forEach((el) => (el.title = t(el.dataset.i18nTitle)));
}
