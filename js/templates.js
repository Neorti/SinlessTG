// Работа с шаблонами ключевых слов.
//
// Встроенные («системные») шаблоны лежат в data/builtin-templates.json — это
// обычный редактируемый файл данных, менять код для правки шаблонов не нужно.
// Пользовательские шаблоны хранятся в localStorage браузера.
//
// Форма шаблона в приложении:
//   встроенный:      { id, builtin: true,  name: { ru, en }, keywords: [...] }  (только чтение)
//   пользовательский:{ id, builtin: false, name: "строка",   keywords: [...] }  (редактируемый)

import { USER_TEMPLATES_KEY } from "./config.js";
import { getLang } from "./i18n.js";

const BUILTIN_URL = new URL("../data/builtin-templates.json", import.meta.url).href;

let builtinTemplates = []; // заполняется один раз в loadBuiltinTemplates()

// Приводит запись из JSON к внутренней форме встроенного шаблона; отбрасывает мусор.
function normalizeBuiltin(raw) {
  if (!raw || typeof raw.id !== "string") return null;
  const keywords = Array.isArray(raw.keywords)
    ? raw.keywords.map((k) => String(k).trim()).filter(Boolean)
    : [];
  if (!keywords.length) return null;
  const name =
    raw.name && typeof raw.name === "object"
      ? { ru: raw.name.ru || raw.name.en || raw.id, en: raw.name.en || raw.name.ru || raw.id }
      : { ru: String(raw.name || raw.id), en: String(raw.name || raw.id) };
  return { id: "builtin:" + raw.id, builtin: true, name, keywords };
}

// Загружает встроенные шаблоны из JSON (один раз). Ошибка загрузки не критична:
// приложение продолжит работать с пользовательскими шаблонами и вернёт false.
export async function loadBuiltinTemplates() {
  try {
    const res = await fetch(BUILTIN_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.templates;
    builtinTemplates = (Array.isArray(list) ? list : []).map(normalizeBuiltin).filter(Boolean);
    return true;
  } catch (err) {
    console.warn("Не удалось загрузить встроенные шаблоны:", err);
    builtinTemplates = [];
    return false;
  }
}

export function loadUserTemplates() {
  try {
    const raw = localStorage.getItem(USER_TEMPLATES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((tpl) => tpl && tpl.id && Array.isArray(tpl.keywords)) : [];
  } catch {
    return [];
  }
}

export function saveUserTemplates(list) {
  localStorage.setItem(USER_TEMPLATES_KEY, JSON.stringify(list));
}

export function templateName(tpl) {
  if (tpl.builtin) return tpl.name[getLang()] || tpl.name.ru;
  return tpl.name;
}

export function allTemplates() {
  return [...builtinTemplates, ...loadUserTemplates()];
}

export function newTemplateId() {
  const rnd = crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2);
  return "u-" + rnd;
}
