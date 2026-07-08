// Обёртка над GramJS: подключение, авторизация, список чатов, поиск и удаление сообщений.
//
// GramJS подключается локальным браузерным бандлом (vendor/telegram.js, путь
// задан в config.GRAMJS_BUNDLE_URL) — см. README о том, как он собран и почему не
// используется CDN. Криптографию MTProto (включая AES-IGE/ECB, которых нет в
// Web Crypto API) GramJS выполняет собственной pure-JS реализацией — шимы не нужны.

import {
  API_ID,
  API_HASH,
  GRAMJS_BUNDLE_URL,
  SESSION_KEY,
  DELETE_BATCH_DELAY_MS,
  DELETE_BATCH_SIZE,
} from "./config.js";

let gram = null; // модуль GramJS
let client = null; // TelegramClient

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Уступка главному потоку: setTimeout(0) — это макрозадача, она даёт браузеру
// отрисоваться и не показывать «страница не отвечает» во время долгого перебора
// сообщений (for-await по буферу GramJS иначе крутится микрозадачами без рендера).
const yieldToUi = () => new Promise((r) => setTimeout(r, 0));
const YIELD_EVERY = 80; // уступать поток каждые N обработанных сообщений

export async function loadLibrary() {
  if (!gram) {
    gram = await import(/* @vite-ignore */ GRAMJS_BUNDLE_URL);
  }
  return gram;
}

export async function createClient() {
  await loadLibrary();
  const { TelegramClient, sessions } = gram;
  const session = new sessions.StringSession(localStorage.getItem(SESSION_KEY) || "");
  client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
    useWSS: true, // GitHub Pages отдаётся по https — нужен wss
    // совсем короткие FLOOD_WAIT GramJS пересиживает сам; более длинные
    // всплывают ошибкой, мы ловим их в withFloodRetry и показываем в логе,
    // чтобы пауза не выглядела зависанием
    floodSleepThreshold: 5,
  });
  await client.connect();

  // Отключаем обработку входящих апдейтов. Этому инструменту они не нужны, а
  // GramJS на каждый апдейт (любое сообщение в любом вашем чате) складывает
  // сущности в постоянно растущий Set с линейным поиском — на активном аккаунте
  // это грузит главный поток в простое и со временем всё замедляет. Гасим их у
  // главного сендера: запрос-ответ (поиск/удаление) от этого не страдает.
  silenceUpdates();

  // Сохраняем сессию сразу после подключения: auth key генерируется тяжёлой
  // bigint-математикой в главном потоке, и без сохранения она повторялась бы
  // при каждой загрузке страницы (заметное подвисание на слабых машинах).
  try {
    localStorage.setItem(SESSION_KEY, client.session.save());
  } catch {}
  return client;
}

// Гасит обработку входящих апдейтов у главного сендера (см. пояснение в createClient).
function silenceUpdates() {
  try {
    if (client && client._sender) client._sender._updateCallback = () => {};
  } catch {}
}

export function isConnected() {
  try {
    return !!(client && client.connected);
  } catch {
    return false;
  }
}

// Поднимает соединение, если оно было закрыто в простое. Быстро при наличии
// сохранённого auth key. Повторно глушит апдейты после реконнекта.
export async function ensureConnected() {
  if (!client || client.connected) return;
  await client.connect();
  silenceUpdates();
}

// Закрывает соединение (сокет), не трогая сессию — чтобы в фоне/простое GramJS
// не принимал и не разбирал поток апдейтов аккаунта. Переподключение — ensureConnected().
export async function goOffline() {
  try {
    if (client && client.connected) await client.disconnect();
  } catch {}
}

export async function isAuthorized() {
  try {
    return await client.isUserAuthorized();
  } catch {
    return false;
  }
}

// Интерактивный вход. Все три колбэка должны возвращать Promise<string>.
// onError вызывается на ошибках (неверный код и т.п.); верните false, чтобы
// GramJS запросил ввод заново, true — чтобы прервать вход.
export async function login({ phoneNumber, phoneCode, password, onError }) {
  await client.start({
    phoneNumber,
    phoneCode,
    password,
    onError: async (err) => (onError ? onError(err) : true),
  });
  localStorage.setItem(SESSION_KEY, client.session.save());
}

export async function logout() {
  try {
    await client.invoke(new gram.Api.auth.LogOut());
  } catch {
    // сессия могла уже истечь — всё равно чистим локальное состояние
  }
  try {
    await client.disconnect();
  } catch {}
  localStorage.removeItem(SESSION_KEY);
  client = null;
}

export async function getMe() {
  return client.getMe();
}

// Возвращает object URL аватарки или null.
export async function getProfilePhotoUrl() {
  try {
    const buf = await client.downloadProfilePhoto("me");
    if (buf && buf.length) {
      return URL.createObjectURL(new Blob([buf], { type: "image/jpeg" }));
    }
  } catch {}
  return null;
}

// Список диалогов, разделённый на личные чаты и группы/каналы.
export async function fetchDialogs() {
  const dialogs = await client.getDialogs({ limit: 2000 });
  const personal = [];
  const groups = [];
  for (const d of dialogs) {
    if (!d.entity) continue;
    const item = {
      id: String(d.id),
      title: d.title || d.name || String(d.id),
      entity: d.entity,
    };
    if (d.isUser) {
      personal.push(item);
      continue;
    }
    // Только личные чаты и группы (обычные + супергруппы).
    // Вещательные каналы (broadcast) полностью игнорируем.
    const kind = entityKind(d.entity);
    if (kind === "basicgroup" || kind === "megagroup") groups.push(item);
  }
  return { personal, groups };
}

// Тип чата: "user" (ЛС), "basicgroup" (обычная группа), "megagroup", "channel".
export function entityKind(entity) {
  const c = entity && entity.className;
  if (c === "Channel") return entity.megagroup ? "megagroup" : "channel";
  if (c === "Chat" || c === "ChatForbidden") return "basicgroup";
  return "user";
}

// Есть ли у нас право удалять чужие сообщения «для всех» в этом чате.
export function canDeleteOthersForEveryone(entity) {
  return !!(entity && (entity.creator || (entity.adminRights && entity.adminRights.deleteMessages)));
}

export function isFloodError(err) {
  return !!(err && typeof err.seconds === "number" && err.seconds > 0 &&
    String(err.errorMessage || err.message || "").toUpperCase().includes("FLOOD"));
}

export function errorText(err) {
  if (!err) return "unknown";
  return err.errorMessage || err.message || String(err);
}

async function withFloodRetry(fn, onFloodWait) {
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (isFloodError(err)) {
        onFloodWait?.(err.seconds);
        await sleep((err.seconds + 1) * 1000);
        continue;
      }
      throw err;
    }
  }
}

const sortIds = (set) => [...set].sort((a, b) => a - b);

// Ищет id сообщений в одном чате, разделяя на свои (mine) и чужие (others).
// keywords === null  → все сообщения (для полной очистки чата);
// keywords: string[] → объединение результатов поиска по каждому слову/фразе.
// onlyMine: true → серверный фильтр fromUser:"me" — Telegram возвращает лишь
// ваши сообщения, что резко сокращает объём загрузки (когда чужие не нужны).
export async function scanChat(entity, keywords, { onlyMine = false, onFound, onScanned, onFloodWait, shouldStop } = {}) {
  const mine = new Set();
  const others = new Set();
  const searches = keywords === null ? [null] : keywords;
  let processed = 0;

  const iterate = async (extra, requireOutFlag) => {
    for await (const msg of client.iterMessages(entity, { ...extra, waitTime: 1 })) {
      if (shouldStop?.()) return;
      if (++processed % YIELD_EVERY === 0) {
        onScanned?.(processed);
        await yieldToUi();
      }
      if (!msg || !msg.id) continue;
      if (requireOutFlag && msg.out !== true) continue;
      const target = msg.out === true ? mine : others;
      if (!target.has(msg.id)) {
        target.add(msg.id);
        onFound?.(mine.size + others.size);
      }
    }
  };

  for (const kw of searches) {
    if (shouldStop?.()) break;
    const params = kw === null ? {} : { search: kw };
    if (onlyMine) {
      try {
        await withFloodRetry(() => iterate({ ...params, fromUser: "me" }, false), onFloodWait);
      } catch {
        // Пир не принял фильтр по отправителю — фильтруем свои на клиенте.
        await withFloodRetry(() => iterate(params, true), onFloodWait);
      }
    } else {
      await withFloodRetry(() => iterate(params, false), onFloodWait);
    }
  }
  return { mine: sortIds(mine), others: sortIds(others) };
}

const SEARCH_PAGE = 100;

// Постранично обходит messages.searchGlobal ЧЕРЕЗ СЫРОЙ invoke — намеренно без
// iterMessages, чтобы не платить за тяжёлый _finishInit (резолв отправителя/чата)
// на каждом сообщении: нам нужны только id/out/peer. Смещения offsetRate/
// offsetPeer/offsetId ведём так же, как GramJS в _updateOffset.
// deps = { invoke, Api, utils }; onMessage(rawMsg) на каждое; onPage(n) после
// страницы (там уступаем поток). Чистая функция — тестируется с моком invoke.
export async function paginateSearchGlobal(deps, kw, { limit = SEARCH_PAGE, shouldStop, onMessage, onPage } = {}) {
  const { invoke, Api, utils } = deps;
  let offsetRate = 0;
  let offsetId = 0;
  let offsetPeer = new Api.InputPeerEmpty();
  for (;;) {
    if (shouldStop && shouldStop()) return;
    const res = await invoke(
      new Api.messages.SearchGlobal({
        q: kw,
        filter: new Api.InputMessagesFilterEmpty(),
        offsetRate,
        offsetPeer,
        offsetId,
        limit,
      })
    );
    const msgs = (res && res.messages) || [];
    if (!msgs.length) return;
    const ents = new Map();
    for (const e of [...(res.users || []), ...(res.chats || [])]) {
      try { ents.set(String(utils.getPeerId(e)), e); } catch {}
    }
    for (const m of msgs) if (m) onMessage(m, ents);
    if (onPage) await onPage(msgs.length);
    if (msgs.length < limit) return; // последняя (неполная) страница
    const last = msgs[msgs.length - 1];
    const prevId = offsetId;
    offsetId = Number(last.id) || 0;
    offsetRate = res.nextRate != null ? res.nextRate : offsetRate;
    let lastPeer;
    try { lastPeer = ents.get(String(utils.getPeerId(last.peerId))); } catch {}
    offsetPeer = lastPeer ? utils.getInputPeer(lastPeer) : new Api.InputPeerEmpty();
    if (offsetId === prevId) return; // страховка от зацикливания
  }
}

// Глобальный поиск по аккаунту. Telegram отдаёт ВСЕ совпадения по слову (и чужие,
// из всех чатов) — фильтр по отправителю тут невозможен, поэтому фильтруем сами
// по out/allowedChatIds, храня только подходящие id. Возвращает
// Map(chatId -> { mine:Set→[], others:Set→[] }).
export async function scanGlobal(keywords, allowedChatIds, { onlyMine = false, onKeyword, onFound, onScanned, onFloodWait, shouldStop } = {}) {
  const { Api, utils } = gram;
  const perChat = new Map();
  let total = 0;
  let scanned = 0;
  // Каждый invoke сам пересиживает FLOOD_WAIT, не теряя текущую страницу.
  const invoke = (req) => withFloodRetry(() => client.invoke(req), onFloodWait);

  const onMessage = (m) => {
    if (!m || m.id == null || !m.peerId) return;
    const isOut = m.out === true;
    if (onlyMine && !isOut) return; // чужих не держим в памяти, если не нужны
    let chatId;
    try { chatId = String(utils.getPeerId(m.peerId)); } catch { return; }
    if (allowedChatIds && !allowedChatIds.has(chatId)) return;
    let bucket = perChat.get(chatId);
    if (!bucket) {
      bucket = { mine: new Set(), others: new Set() };
      perChat.set(chatId, bucket);
    }
    const id = Number(m.id);
    const target = isOut ? bucket.mine : bucket.others;
    if (!target.has(id)) {
      target.add(id);
      total++;
      onFound?.(total);
    }
  };

  for (let i = 0; i < keywords.length; i++) {
    if (shouldStop?.()) break;
    const kw = keywords[i];
    onKeyword?.(kw, i + 1, keywords.length);
    await paginateSearchGlobal({ invoke, Api, utils }, kw, {
      shouldStop,
      onMessage,
      onPage: async (n) => {
        scanned += n;
        onScanned?.(scanned);
        await yieldToUi(); // уступаем поток между страницами
      },
    });
  }

  const out = new Map();
  for (const [id, b] of perChat) out.set(id, { mine: sortIds(b.mine), others: sortIds(b.others) });
  return out;
}

// Чистая логика планирования: по bucket'ам {mine, others} и опциям решает, что и
// как удалять в этом чате с учётом лимитов Telegram. Возвращает:
//   forEveryone: number[]  — удалить для всех (revoke=true)
//   forMe:       number[]  — удалить только у себя (revoke=false)
//   downgraded:  number    — сколько чужих ушло в forMe вместо forEveryone, т.к.
//                            нет прав админа (для отдельного показа пользователю)
//   skips:       [{ reason, n }] — что удалить нельзя вовсе
//                reason: "local-megagroup" | "no-admin"
//
// Правила: в ЛС и обычных группах локальное удаление доступно всегда (в т.ч.
// чужих сообщений из своей копии). В супергруппах локального удаления нет —
// там всё только «для всех» и только с правами админа. Поэтому чужие «для всех»
// без прав: в обычной группе → понижаем до «только у себя»; в супергруппе →
// пропускаем (иначе никак).
export function planDeletion(entity, buckets, { ownership, revoke }) {
  const wantMine = ownership !== "others";
  const wantOthers = ownership !== "mine";
  const selMine = wantMine ? buckets.mine || [] : [];
  const selOthers = wantOthers ? buckets.others || [] : [];
  const kind = entityKind(entity);
  const forEveryone = [];
  const forMe = [];
  const skips = [];
  let downgraded = 0;

  if (kind === "user") {
    // ЛС: оба режима работают и для своих, и для чужих.
    (revoke ? forEveryone : forMe).push(...selMine, ...selOthers);
  } else if (kind === "basicgroup") {
    if (!revoke) {
      forMe.push(...selMine, ...selOthers); // всё локально — всегда можно
    } else {
      forEveryone.push(...selMine); // свои «для всех» — можно
      if (selOthers.length) {
        if (canDeleteOthersForEveryone(entity)) {
          forEveryone.push(...selOthers);
        } else {
          forMe.push(...selOthers); // нет прав → удаляем чужих только у себя
          downgraded += selOthers.length;
        }
      }
    }
  } else {
    // megagroup: локального удаления нет вообще.
    if (!revoke) {
      const n = selMine.length + selOthers.length;
      if (n) skips.push({ reason: "local-megagroup", n });
    } else {
      forEveryone.push(...selMine); // свои сообщения удалить можно
      if (selOthers.length) {
        if (canDeleteOthersForEveryone(entity)) {
          forEveryone.push(...selOthers);
        } else {
          skips.push({ reason: "no-admin", n: selOthers.length }); // локально нельзя — только пропуск
        }
      }
    }
  }

  forEveryone.sort((a, b) => a - b);
  forMe.sort((a, b) => a - b);
  return { forEveryone, forMe, downgraded, skips };
}

// Удаляет сообщения пачками с паузами. revoke=true — для всех, false — только у себя.
export async function deleteInChat(entity, ids, { revoke = true, onProgress, onFloodWait, shouldStop } = {}) {
  let ok = 0;
  const errors = [];
  for (let i = 0; i < ids.length; i += DELETE_BATCH_SIZE) {
    if (shouldStop?.()) break;
    const chunk = ids.slice(i, i + DELETE_BATCH_SIZE);
    try {
      await withFloodRetry(() => client.deleteMessages(entity, chunk, { revoke }), onFloodWait);
      ok += chunk.length;
    } catch (err) {
      errors.push({ count: chunk.length, reason: errorText(err) });
    }
    onProgress?.(Math.min(i + DELETE_BATCH_SIZE, ids.length), ids.length);
    if (i + DELETE_BATCH_SIZE < ids.length) await sleep(DELETE_BATCH_DELAY_MS);
  }
  return { ok, errors };
}
