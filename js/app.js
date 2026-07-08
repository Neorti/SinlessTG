// Основная логика UI: логин, шаблоны, выбор чатов, подсчёт и удаление.

import { configIsValid } from "./config.js";
import { t, getLang, setLang, applyStaticI18n } from "./i18n.js";
import {
  allTemplates,
  loadBuiltinTemplates,
  loadUserTemplates,
  saveUserTemplates,
  templateName,
  newTemplateId,
} from "./templates.js";
import * as tg from "./telegram.js";

const $ = (id) => document.getElementById(id);

// Максимум строк в логе — чтобы длинная сессия не растила DOM бесконечно.
const LOG_MAX_LINES = 800;

const state = {
  me: null,
  dialogs: { personal: [], groups: [] },
  dialogsLoaded: false,
  selectedTpl: new Set(),
  selPc: new Set(), // выбранные личные чаты (id)
  selGr: new Set(), // выбранные группы/каналы (id)
  scan: null, // { perChat: [{id,title,entity,ids}], total }
  running: false,
  stopFlag: false,
};

/* ============================== утилиты ============================== */

function show(el, visible = true) {
  el.classList.toggle("hidden", !visible);
}

function log(msg, cls) {
  const box = $("log");
  show(box);
  const line = document.createElement("div");
  if (cls) line.className = cls;
  line.textContent = msg;
  box.appendChild(line);
  while (box.childNodes.length > LOG_MAX_LINES) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
}

function clearLog() {
  $("log").innerHTML = "";
  show($("log"), false);
}

function setProgress(done, total) {
  show($("progressWrap"), total > 0);
  $("progressBar").style.width = total > 0 ? Math.round((done / total) * 100) + "%" : "0";
}

function maskPhone(phone) {
  if (!phone) return "";
  const d = String(phone).replace(/\D/g, "");
  if (d.length < 5) return "+" + d;
  return "+" + d.slice(0, 2) + "•".repeat(d.length - 4) + d.slice(-2);
}

/* ============================== модалки ============================== */

let modalCloseCb = null;

function openModal(build) {
  const modal = $("modal");
  modal.innerHTML = "";
  build(modal);
  show($("modalBack"));
}

function closeModal() {
  show($("modalBack"), false);
  $("modal").innerHTML = "";
  if (modalCloseCb) {
    const cb = modalCloseCb;
    modalCloseCb = null;
    cb();
  }
}

$("modalBack").addEventListener("click", (e) => {
  if (e.target === $("modalBack")) closeModal();
});

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, cls, onClick) {
  const b = el("button", "btn" + (cls ? " " + cls : ""), label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

// Модалка подтверждения; резолвится true/false.
function confirmModal(title, message) {
  return new Promise((resolve) => {
    modalCloseCb = () => resolve(false);
    openModal((box) => {
      box.appendChild(el("h3", null, title));
      box.appendChild(el("p", null, message));
      const actions = el("div", "modal-actions");
      actions.appendChild(
        button(t("confirmNo"), null, () => closeModal())
      );
      actions.appendChild(
        button(t("confirmYes"), "btn-danger", () => {
          modalCloseCb = null;
          closeModal();
          resolve(true);
        })
      );
      box.appendChild(actions);
    });
  });
}

/* ============================== язык ============================== */

function applyAllI18n() {
  applyStaticI18n();
  $("langToggle").textContent = t("langToggle");
  document.documentElement.lang = getLang();
  renderTemplates();
  renderChatList("pc");
  renderChatList("gr");
  updateSelectionBadges();
}

$("langToggle").addEventListener("click", () => {
  setLang(getLang() === "ru" ? "en" : "ru");
  applyAllI18n();
});

/* ============================== аккордеоны ============================== */

document.querySelectorAll(".acc-head[data-acc]").forEach((head) => {
  head.addEventListener("click", (e) => {
    if (e.target.classList.contains("cb")) return; // чекбокс не сворачивает секцию
    const body = $(head.dataset.acc);
    const isOpen = body.classList.contains("hidden");
    show(body, isOpen);
    head.closest(".acc").classList.toggle("open", isOpen);
  });
});

/* ============================== логин ============================== */

let loginResolve = null;
let loginStep = null;

function askLoginStep(step) {
  return new Promise((resolve) => {
    loginResolve = resolve;
    loginStep = step;
    show($("loginCard"));
    show($("loginStatus"), false);
    const input = $("loginInput");
    $("loginLabel").textContent = t(step + "Label");
    input.type = step === "password" ? "password" : "text";
    input.placeholder = t(step + "Placeholder");
    input.value = "";
    $("loginSubmit").disabled = false;
    input.focus();
  });
}

$("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!loginResolve) return;
  const value = $("loginInput").value.trim();
  if (!value) return;
  const resolve = loginResolve;
  loginResolve = null;
  show($("loginError"), false);
  $("loginStatus").textContent = t("loginWait");
  show($("loginStatus"));
  $("loginSubmit").disabled = true;
  resolve(value);
});

function loginErrorText(err) {
  const m = String((err && (err.errorMessage || err.message)) || err || "");
  if (m.includes("PHONE_NUMBER_INVALID") || m.includes("PHONE_NUMBER_BANNED")) return t("errPhoneInvalid");
  if (m.includes("PHONE_CODE_INVALID") || m.includes("PHONE_CODE_EMPTY")) return t("errCodeInvalid");
  if (m.includes("PHONE_CODE_EXPIRED")) return t("errCodeExpired");
  if (m.includes("PASSWORD_HASH_INVALID")) return t("errPasswordInvalid");
  if (tg.isFloodError(err)) return t("errFloodWait", { s: err.seconds });
  return t("errGeneric", { msg: m });
}

async function startLoginFlow() {
  try {
    await tg.login({
      phoneNumber: () => askLoginStep("phone"),
      phoneCode: () => askLoginStep("code"),
      password: () => askLoginStep("password"),
      onError: (err) => {
        $("loginError").textContent = loginErrorText(err);
        show($("loginError"));
        show($("loginStatus"), false);
        return false; // false → GramJS запросит ввод заново
      },
    });
    show($("loginCard"), false);
    await enterApp();
  } catch (err) {
    $("loginError").textContent = loginErrorText(err);
    show($("loginError"));
    show($("loginStatus"), false);
    $("loginSubmit").disabled = false;
  }
}

/* ============================== профиль ============================== */

async function renderProfile() {
  const me = state.me;
  const first = me.firstName || "";
  const last = me.lastName || "";
  $("profileName").textContent = (first + " " + last).trim() || "—";
  $("profileUsername").textContent = me.username ? "@" + me.username : "";
  $("profilePhone").textContent = maskPhone(me.phone);
  show($("profileBox"));

  const url = await tg.getProfilePhotoUrl();
  if (url) {
    $("profileAvatar").src = url;
    show($("profileAvatar"));
    show($("profileAvatarFallback"), false);
  } else {
    $("profileAvatarFallback").textContent = (first || me.username || "?").charAt(0).toUpperCase();
    show($("profileAvatarFallback"));
    show($("profileAvatar"), false);
  }
}

$("logoutBtn").addEventListener("click", async () => {
  const yes = await confirmModal(t("logoutConfirmTitle"), t("logoutConfirmMsg"));
  if (!yes) return;
  await tg.logout();
  location.reload();
});

/* ============================== шаблоны ============================== */

function renderTemplates() {
  const listBox = $("tplList");
  listBox.innerHTML = "";
  const query = $("tplSearch").value.trim().toLowerCase();

  const templates = allTemplates().filter((tpl) => {
    if (!query) return true;
    const name = templateName(tpl).toLowerCase();
    return name.includes(query) || tpl.keywords.some((k) => k.toLowerCase().includes(query));
  });

  if (!templates.length) {
    listBox.appendChild(el("p", "muted small", t("tplEmpty")));
    return;
  }

  for (const tpl of templates) {
    const card = el("div", "tpl-card" + (state.selectedTpl.has(tpl.id) ? " checked" : ""));

    const top = el("div", "tpl-top");
    top.appendChild(el("span", "tpl-name", templateName(tpl)));
    const cb = el("input", "cb");
    cb.type = "checkbox";
    cb.checked = state.selectedTpl.has(tpl.id);
    cb.addEventListener("change", () => {
      if (cb.checked) state.selectedTpl.add(tpl.id);
      else state.selectedTpl.delete(tpl.id);
      card.classList.toggle("checked", cb.checked);
      updateSelectionBadges();
      invalidateScan();
    });
    top.appendChild(cb);
    card.appendChild(top);

    card.appendChild(el("span", "tpl-badge", t(tpl.builtin ? "tplBuiltinBadge" : "tplMineBadge")));
    card.appendChild(el("div", "tpl-preview", tpl.keywords.join(", ")));

    const actions = el("div", "tpl-actions");
    const info = button("ⓘ", "btn-icon", () => showTemplateInfo(tpl));
    info.title = t("tplInfoBtn");
    actions.appendChild(info);

    if (tpl.builtin) {
      const clone = button("⧉", "btn-icon", () => cloneTemplate(tpl));
      clone.title = t("tplCloneBtn");
      actions.appendChild(clone);
    } else {
      const edit = button("✎", "btn-icon", () => openTemplateEditor(tpl));
      edit.title = t("tplEditBtn");
      actions.appendChild(edit);
      const del = button("🗑", "btn-icon", () => deleteTemplateWithConfirm(tpl));
      del.title = t("tplDeleteBtn");
      actions.appendChild(del);
    }
    card.appendChild(actions);
    listBox.appendChild(card);
  }
}

function showTemplateInfo(tpl) {
  openModal((box) => {
    box.appendChild(el("h3", null, templateName(tpl)));
    box.appendChild(el("p", "muted small", t("tplKeywordsCount", { n: tpl.keywords.length })));
    const ul = el("ul", "kw-list");
    tpl.keywords.forEach((k) => ul.appendChild(el("li", null, k)));
    box.appendChild(ul);
    const actions = el("div", "modal-actions");
    actions.appendChild(button(t("editorCancel"), null, closeModal));
    box.appendChild(actions);
  });
}

// Удаляет пользовательский шаблон после подтверждения; встроенные удалить нельзя.
async function deleteTemplateWithConfirm(tpl) {
  if (tpl.builtin) return;
  const yes = await confirmModal(
    t("tplDeleteConfirmTitle"),
    t("tplDeleteConfirmMsg", { name: templateName(tpl) })
  );
  if (!yes) return;
  saveUserTemplates(loadUserTemplates().filter((x) => x.id !== tpl.id));
  state.selectedTpl.delete(tpl.id);
  renderTemplates();
  updateSelectionBadges();
  invalidateScan();
}

function cloneTemplate(tpl) {
  const list = loadUserTemplates();
  list.push({
    id: newTemplateId(),
    builtin: false,
    name: templateName(tpl) + t("tplCloneSuffix"),
    keywords: [...tpl.keywords],
  });
  saveUserTemplates(list);
  renderTemplates();
}

// existing === null → создание нового шаблона
function openTemplateEditor(existing) {
  openModal((box) => {
    box.appendChild(el("h3", null, t(existing ? "editorTitleEdit" : "editorTitleNew")));

    box.appendChild(el("label", "block-label", t("editorNameLabel")));
    const nameInput = el("input");
    nameInput.type = "text";
    nameInput.value = existing ? existing.name : "";
    box.appendChild(nameInput);

    box.appendChild(el("label", "block-label", t("editorKeywordsLabel")));
    const kwArea = el("textarea");
    kwArea.rows = 8;
    kwArea.spellcheck = false;
    kwArea.value = existing ? existing.keywords.join("\n") : "";
    box.appendChild(kwArea);

    const errLine = el("p", "error-text hidden");
    box.appendChild(errLine);

    const actions = el("div", "modal-actions");
    if (existing) {
      actions.appendChild(
        button(t("editorDelete"), "btn-danger", () => {
          closeModal();
          deleteTemplateWithConfirm(existing);
        })
      );
    }
    actions.appendChild(button(t("editorCancel"), null, closeModal));
    actions.appendChild(
      button(t("editorSave"), "btn-primary", () => {
        const name = nameInput.value.trim();
        const keywords = kwArea.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        if (!name) {
          errLine.textContent = t("editorNameRequired");
          show(errLine);
          return;
        }
        if (!keywords.length) {
          errLine.textContent = t("editorKeywordsRequired");
          show(errLine);
          return;
        }
        const list = loadUserTemplates();
        if (existing) {
          const target = list.find((x) => x.id === existing.id);
          if (target) {
            target.name = name;
            target.keywords = keywords;
          }
        } else {
          list.push({ id: newTemplateId(), builtin: false, name, keywords });
        }
        saveUserTemplates(list);
        closeModal();
        renderTemplates();
        invalidateScan();
      })
    );
    box.appendChild(actions);
    nameInput.focus();
  });
}

$("tplSearch").addEventListener("input", renderTemplates);
$("tplNewBtn").addEventListener("click", () => openTemplateEditor(null));
$("freeWords").addEventListener("input", invalidateScan);
document
  .querySelectorAll(
    'input[name="ownership-pc"], input[name="scope-pc"], input[name="ownership-gr"], input[name="scope-gr"]'
  )
  .forEach((r) => r.addEventListener("change", invalidateScan));

/* ============================== чаты ============================== */

const chatSections = {
  pc: { list: () => state.dialogs.personal, sel: () => state.selPc, listEl: "pcList", search: "pcSearch", master: "pcMaster", badge: "pcCount" },
  gr: { list: () => state.dialogs.groups, sel: () => state.selGr, listEl: "grList", search: "grSearch", master: "grMaster", badge: "grCount" },
};

function renderChatList(key) {
  const section = chatSections[key];
  const box = $(section.listEl);
  box.innerHTML = "";

  if (!state.dialogsLoaded) {
    box.appendChild(el("p", "muted small", t("chatsLoading")));
    return;
  }

  const query = $(section.search).value.trim().toLowerCase();
  const chats = section.list().filter((c) => !query || c.title.toLowerCase().includes(query));

  if (!chats.length) {
    box.appendChild(el("p", "muted small", t("chatsEmpty")));
    return;
  }

  const sel = section.sel();
  for (const chat of chats) {
    const row = el("div", "chat-row");
    const cb = el("input", "cb");
    cb.type = "checkbox";
    cb.checked = sel.has(chat.id);
    cb.addEventListener("change", () => {
      if (cb.checked) sel.add(chat.id);
      else sel.delete(chat.id);
      updateMasterCheckbox(key);
      updateSelectionBadges();
      invalidateScan();
    });
    row.appendChild(cb);
    row.appendChild(el("span", "chat-title", chat.title));

    const clearBtn = button("🧹", "btn-icon chat-clear", () => runFullChatClear(chat));
    clearBtn.title = t("clearChatBtn");
    row.appendChild(clearBtn);
    box.appendChild(row);
  }
}

function updateMasterCheckbox(key) {
  const section = chatSections[key];
  const master = $(section.master);
  const total = section.list().length;
  const selected = section.sel().size;
  master.checked = total > 0 && selected === total;
  master.indeterminate = selected > 0 && selected < total;
}

function updateSelectionBadges() {
  const tplBadge = $("tplSelectedCount");
  show(tplBadge, state.selectedTpl.size > 0);
  tplBadge.textContent = state.selectedTpl.size;

  for (const key of ["pc", "gr"]) {
    const section = chatSections[key];
    const badge = $(section.badge);
    const n = section.sel().size;
    show(badge, n > 0);
    badge.textContent = t("chatsSelected", { n });
  }
}

for (const key of ["pc", "gr"]) {
  const section = chatSections[key];
  $(section.master).addEventListener("change", () => {
    const sel = section.sel();
    if ($(section.master).checked) section.list().forEach((c) => sel.add(c.id));
    else sel.clear();
    renderChatList(key);
    updateMasterCheckbox(key);
    updateSelectionBadges();
    invalidateScan();
  });
  $(section.search).addEventListener("input", () => renderChatList(key));
}

async function loadDialogs() {
  renderChatList("pc");
  renderChatList("gr");
  state.dialogs = await tg.fetchDialogs();
  state.dialogsLoaded = true;
  renderChatList("pc");
  renderChatList("gr");
  updateMasterCheckbox("pc");
  updateMasterCheckbox("gr");
}

/* ============================== подсчёт и удаление ============================== */

function collectKeywords() {
  const raw = [];
  for (const tpl of allTemplates()) {
    if (state.selectedTpl.has(tpl.id)) raw.push(...tpl.keywords);
  }
  $("freeWords").value.split(/\r?\n/).forEach((line) => {
    const s = line.trim();
    if (s) raw.push(s);
  });
  const seen = new Set();
  const out = [];
  for (const kw of raw) {
    const lower = kw.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      out.push(kw);
    }
  }
  return out;
}

function collectChats() {
  return [
    ...state.dialogs.personal.filter((c) => state.selPc.has(c.id)),
    ...state.dialogs.groups.filter((c) => state.selGr.has(c.id)),
  ];
}

// Категория чата: "pc" (личные) или "gr" (группы) — у каждой свой набор опций.
function chatCategory(entity) {
  return tg.entityKind(entity) === "user" ? "pc" : "gr";
}
function getOwnership(cat) {
  return document.querySelector(`input[name="ownership-${cat}"]:checked`).value; // mine|others|all
}
function getRevoke(cat) {
  return document.querySelector(`input[name="scope-${cat}"]:checked`).value === "everyone";
}
function scopeTextFor(revoke) {
  return revoke ? t("scopeEveryone") : t("scopeMe");
}
// Нужны ли чужие сообщения хотя бы для одной из выбранных категорий чатов.
function needOthersAnywhere(chats) {
  const cats = new Set(chats.map((c) => chatCategory(c.entity)));
  for (const cat of cats) if (getOwnership(cat) !== "mine") return true;
  return false;
}

// Обёртка над tg.planDeletion: применяет опции категории чата и локализует пропуски.
// Возвращает { forEveryone, forMe, downgraded, notes } для этого чата.
function buildChatPlan(chat, buckets) {
  const cat = chatCategory(chat.entity);
  const { forEveryone, forMe, downgraded, skips } = tg.planDeletion(chat.entity, buckets, {
    ownership: getOwnership(cat),
    revoke: getRevoke(cat),
  });
  const notes = skips.map((s) => ({
    text:
      s.reason === "local-megagroup"
        ? t("skipLocalMega", { title: chat.title, n: s.n })
        : t("skipNoAdmin", { title: chat.title, n: s.n }),
  }));
  return { forEveryone, forMe, downgraded, notes };
}

function invalidateScan() {
  if (state.running) return;
  if (state.scan) {
    $("scanSummary").textContent = t("selectionChanged");
    show($("scanSummary"));
  }
  state.scan = null;
  $("btnDelete").disabled = true;
}

function beginRun() {
  state.running = true;
  state.stopFlag = false;
  $("btnCount").disabled = true;
  $("btnDelete").disabled = true;
  show($("btnStop"));
  clearLog();
  setProgress(0, 0);
}

function endRun() {
  state.running = false;
  $("btnCount").disabled = false;
  show($("btnStop"), false);
}

$("btnStop").addEventListener("click", () => {
  state.stopFlag = true;
});

const shouldStop = () => state.stopFlag;
const onFloodWait = (s) => log(t("floodWaiting", { s }), "log-warn");

// Переподключается, если соединение было закрыто в простое. Возвращает false и
// показывает ошибку, если подключиться не удалось.
async function ensureOnline() {
  if (tg.isConnected()) return true;
  try {
    $("scanSummary").textContent = t("connecting");
    show($("scanSummary"));
    await tg.ensureConnected();
    return true;
  } catch (err) {
    $("scanSummary").textContent = t("errGeneric", { msg: tg.errorText(err) });
    show($("scanSummary"));
    return false;
  }
}

$("btnCount").addEventListener("click", async () => {
  if (state.running) return;
  const keywords = collectKeywords();
  const chats = collectChats();
  if (!keywords.length) {
    $("scanSummary").textContent = t("needKeywords");
    show($("scanSummary"));
    return;
  }
  if (!chats.length) {
    $("scanSummary").textContent = t("needChats");
    show($("scanSummary"));
    return;
  }
  if (!(await ensureOnline())) return;

  beginRun();
  show($("scanSummary"), false);

  const perChat = [];
  let total = 0;
  let downgradedTotal = 0; // чужих, что удалятся только у себя (нет прав админа)
  let scannedNow = 0; // сколько всего просмотрено (для «дышащего» статуса)
  // Троттлинг статуса: обновляем текст не чаще ~8 раз/сек, чтобы частые события
  // поиска не грузили DOM (значение всё равно финализируется в конце).
  let lastLive = 0;
  const renderStatus = (force) => {
    const now = Date.now();
    if (!force && now - lastLive < 120) return;
    lastLive = now;
    const box = $("scanSummary");
    box.textContent = t("foundTotal", { n: total });
    if (scannedNow > 0) {
      const sub = document.createElement("div");
      sub.className = "summary-sub muted-sub";
      sub.textContent = t("scanned", { n: scannedNow });
      box.appendChild(sub);
    }
    show(box);
  };
  const liveFound = (n) => {
    total = n; // во время скана n — это накопленное «сырое» число совпадений
    renderStatus();
  };
  const liveScanned = (n) => {
    scannedNow = n;
    renderStatus();
  };

  // Применяет план к одному чату: логирует найденное/пропущенное, копит total.
  const addChat = (chat, buckets) => {
    const { forEveryone, forMe, downgraded, notes } = buildChatPlan(chat, buckets);
    notes.forEach((note) => log(note.text, "log-warn"));
    const found = forEveryone.length + forMe.length;
    if (found) {
      perChat.push({ ...chat, forEveryone, forMe });
      total += found;
      downgradedTotal += downgraded;
    }
    log(t("chatFoundLine", { title: chat.title, found }), found ? "log-ok" : undefined);
  };

  const method = document.querySelector('input[name="scanMethod"]:checked').value;
  const onlyMine = !needOthersAnywhere(chats);

  try {
    if (method === "perchat") {
      // Постепенный перебор: серверный поиск внутри каждого выбранного чата.
      log(t("scanStartPerChat", { chats: chats.length, kw: keywords.length }));
      total = 0;
      for (let i = 0; i < chats.length; i++) {
        if (state.stopFlag) break;
        const chat = chats[i];
        const pos = { i: i + 1, n: chats.length, title: chat.title };
        log(t("scanningChat", pos));
        try {
          const buckets = await tg.scanChat(chat.entity, keywords, {
            onlyMine,
            shouldStop,
            onFloodWait,
            onScanned: liveScanned,
          });
          addChat(chat, buckets);
          renderStatus(true);
        } catch (err) {
          log(t("scanChatError", { ...pos, msg: tg.errorText(err) }), "log-err");
        }
        setProgress(i + 1, chats.length);
      }
    } else {
      // Глобальный поиск: качаем совпадения по слову и фильтруем по выбранным чатам.
      log(t("scanStartGlobal", { chats: chats.length, kw: keywords.length }));
      log(t("globalScanHint"), "log-warn");
      const allowed = new Set(chats.map((c) => c.id));
      const byId = new Map(chats.map((c) => [c.id, c]));
      const perChatBuckets = await tg.scanGlobal(keywords, allowed, {
        onlyMine, // не тащить чужих в память, если не нужны
        shouldStop,
        onFloodWait,
        onKeyword: (kw, i, n) => {
          log(t("scanKeyword", { kw, i, n }));
          setProgress(i - 1, n);
        },
        onFound: liveFound,
        onScanned: liveScanned,
      });
      total = 0;
      for (const [chatId, buckets] of perChatBuckets) {
        const chat = byId.get(chatId);
        if (chat) addChat(chat, buckets);
      }
      setProgress(keywords.length, keywords.length);
    }
  } catch (err) {
    log(t("scanGlobalError", { msg: tg.errorText(err) }), "log-err");
  }

  if (state.stopFlag) log(t("scanStopped"), "log-warn");
  else log(t("scanDone"));

  state.scan = { perChat, total, downgradedTotal };
  $("scanSummary").innerHTML = "";
  if (total > 0) {
    $("scanSummary").textContent = t("foundTotal", { n: total });
    if (downgradedTotal > 0) {
      const sub = document.createElement("div");
      sub.className = "summary-sub";
      sub.textContent = t("foundLocalFallback", { n: downgradedTotal });
      $("scanSummary").appendChild(sub);
    }
  } else {
    $("scanSummary").textContent = t("foundNothing");
  }
  show($("scanSummary"));
  endRun();
  $("btnDelete").disabled = total === 0;
});

// Текст режима для подтверждения: по фактическому составу удаления.
function combinedScopeText(perChat) {
  const hasEveryone = perChat.some((c) => c.forEveryone.length);
  const hasMe = perChat.some((c) => c.forMe.length);
  if (hasEveryone && hasMe) return t("scopeMixed");
  if (hasMe) return t("scopeMe");
  return t("scopeEveryone");
}

$("btnDelete").addEventListener("click", async () => {
  if (state.running || !state.scan || !state.scan.total) return;
  const { perChat, total } = state.scan;

  const yes = await confirmModal(
    t("confirmTitle"),
    t("confirmDeleteMsg", { n: total, scope: combinedScopeText(perChat) })
  );
  if (!yes) return;
  if (!(await ensureOnline())) return;

  beginRun();
  log(t("deleteStart", { n: total }));

  let okTotal = 0;
  let failTotal = 0;
  let processed = 0;

  for (let i = 0; i < perChat.length; i++) {
    if (state.stopFlag) break;
    const chat = perChat[i];
    const pos = { i: i + 1, n: perChat.length, title: chat.title };
    const count = chat.forEveryone.length + chat.forMe.length;
    log(t("deletingChat", { ...pos, count }));

    let ok = 0;
    const errors = [];
    // Два независимых прохода: «для всех» (revoke=true) и «только у себя» (revoke=false).
    for (const [ids, revoke] of [
      [chat.forEveryone, true],
      [chat.forMe, false],
    ]) {
      if (!ids.length || state.stopFlag) continue;
      const res = await tg.deleteInChat(chat.entity, ids, {
        revoke,
        shouldStop,
        onFloodWait,
        onProgress: (done) => setProgress(processed + done, total),
      });
      ok += res.ok;
      errors.push(...res.errors);
      processed += ids.length;
    }

    const fail = count - ok;
    okTotal += ok;
    failTotal += fail;
    log(t("deleteChatDone", { ...pos, ok, fail }), fail ? "log-warn" : "log-ok");
    errors.forEach((e) => log(t("deleteErrorReason", { count: e.count, msg: e.reason }), "log-err"));
  }

  if (state.stopFlag) log(t("deleteStopped"), "log-warn");
  log(t("deleteDone", { ok: okTotal, fail: failTotal }), failTotal ? "log-warn" : "log-ok");
  $("scanSummary").textContent = t("deleteDone", { ok: okTotal, fail: failTotal });
  show($("scanSummary"));
  state.scan = null;
  endRun();
});

/* ============================== полная очистка чата ============================== */

async function runFullChatClear(chat) {
  if (state.running) return;
  if (!(await ensureOnline())) return;
  beginRun();
  log(t("clearChatCounting", { chat: chat.title }));

  let buckets;
  try {
    buckets = await tg.scanChat(chat.entity, null, {
      shouldStop,
      onFloodWait,
      onFound: (n) => {
        $("scanSummary").textContent = t("clearChatFound", { chat: chat.title, n });
        show($("scanSummary"));
      },
    });
  } catch (err) {
    log(t("scanChatError", { i: 1, n: 1, title: chat.title, msg: tg.errorText(err) }), "log-err");
    endRun();
    return;
  }

  if (state.stopFlag) {
    log(t("scanStopped"), "log-warn");
    endRun();
    return;
  }

  endRun();

  const { forEveryone, forMe, downgraded, notes } = buildChatPlan(chat, buckets);
  notes.forEach((note) => log(note.text, "log-warn"));
  const count = forEveryone.length + forMe.length;

  if (!count) {
    log(t("clearChatNothing", { chat: chat.title }));
    $("scanSummary").textContent = t("clearChatNothing", { chat: chat.title });
    show($("scanSummary"));
    return;
  }

  log(t("clearChatFound", { chat: chat.title, n: count }), "log-ok");
  if (downgraded > 0) log(t("foundLocalFallback", { n: downgraded }), "log-warn");

  const scope = forEveryone.length && forMe.length ? t("scopeMixed") : forMe.length ? t("scopeMe") : t("scopeEveryone");
  const yes = await confirmModal(
    t("confirmTitle"),
    t("confirmClearChatMsg", { chat: chat.title, n: count, scope })
  );
  if (!yes) return;

  beginRun();
  log(t("deleteStart", { n: count }));
  let ok = 0;
  const errors = [];
  let processed = 0;
  for (const [ids, revoke] of [
    [forEveryone, true],
    [forMe, false],
  ]) {
    if (!ids.length || state.stopFlag) continue;
    const res = await tg.deleteInChat(chat.entity, ids, {
      revoke,
      shouldStop,
      onFloodWait,
      onProgress: (done) => setProgress(processed + done, count),
    });
    ok += res.ok;
    errors.push(...res.errors);
    processed += ids.length;
  }
  const fail = count - ok;
  errors.forEach((e) => log(t("deleteErrorReason", { count: e.count, msg: e.reason }), "log-err"));
  if (state.stopFlag) log(t("deleteStopped"), "log-warn");
  log(t("deleteDone", { ok, fail }), fail ? "log-warn" : "log-ok");
  $("scanSummary").textContent = t("deleteDone", { ok, fail });
  show($("scanSummary"));
  endRun();
}

/* ============================== управление простоем ============================== */

// Закрываем соединение, когда вкладка ушла в фон или пользователь долго
// бездействует: иначе GramJS в фоне принимает/разбирает весь поток апдейтов
// аккаунта и держит пинги — это и есть фоновая нагрузка. Переподключаемся
// лениво — перед операциями (ensureOnline) и при возврате на вкладку.
const IDLE_ACTIVE_MS = 120000; // простой на активной вкладке — 2 мин
const IDLE_HIDDEN_MS = 20000; //  в фоне — 20 сек
let idleTimer = null;

function armIdle(ms) {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!state.running) tg.goOffline().catch(() => {});
  }, ms);
}

function setupIdleManagement() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      armIdle(IDLE_HIDDEN_MS);
    } else {
      armIdle(IDLE_ACTIVE_MS);
      if (!state.running) tg.ensureConnected().catch(() => {});
    }
  });
  ["click", "keydown", "input"].forEach((ev) =>
    document.addEventListener(ev, () => { if (!document.hidden) armIdle(IDLE_ACTIVE_MS); }, { passive: true })
  );
  armIdle(IDLE_ACTIVE_MS);
}

/* ============================== запуск ============================== */

async function enterApp() {
  state.me = await tg.getMe();
  await renderProfile();
  show($("aboutCard"), false); // описание нужно только до входа
  show($("appMain"));
  await loadBuiltinTemplates(); // системные шаблоны из data/builtin-templates.json
  renderTemplates();
  updateSelectionBadges();
  await loadDialogs();
  setupIdleManagement();
}

async function boot() {
  applyAllI18n();

  if (!configIsValid()) {
    show($("setupWarn"));
    show($("bootStatus"), false);
    return;
  }

  $("bootStatusText").textContent = t("libLoading");
  try {
    await tg.loadLibrary();
  } catch (err) {
    $("bootStatusText").textContent = t("libError");
    $("bootStatus").classList.add("error-card");
    console.error(err);
    return;
  }

  $("bootStatusText").textContent = t("connecting");
  try {
    await tg.createClient();
  } catch (err) {
    $("bootStatusText").textContent = t("errGeneric", { msg: tg.errorText(err) });
    $("bootStatus").classList.add("error-card");
    console.error(err);
    return;
  }

  show($("bootStatus"), false);

  if (await tg.isAuthorized()) {
    await enterApp();
  } else {
    startLoginFlow();
  }
}

boot();
