// Пересборка браузерного бандла GramJS → ../vendor/telegram.js
//
// Использование:
//   cd tools
//   npm install
//   node build-gramjs.mjs
//
// Скрипт повторяет то, что делает официальный webpack-конфиг GramJS для
// браузера: подменяет файлы-переходники на node-модули (crypto, fs, os, path,
// net) заглушками либо чистыми JS-реализациями и собирает один ESM-файл.
// CDN-варианты (esm.sh / jsdelivr +esm) НЕ работают: их конвертация CJS→ESM
// ломает внутренние циклические зависимости GramJS
// (симптом: "Cannot read properties of undefined (reading 'generateRandomLong')").

import { build } from "esbuild";
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const here = path.dirname(fileURLToPath(import.meta.url));
const T = path.join(here, "node_modules", "telegram");
const shims = path.join(here, "shims");
mkdirSync(shims, { recursive: true });

const cjs = (body) =>
  '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\n' + body;

// --- патчи внутри пакета telegram (то же делает их webpack-alias) ---

// node crypto → чистая JS-реализация из самого GramJS (@cryptography/aes и др.)
const cryptoFile = path.join(T, "CryptoFile.js");
writeFileSync(
  cryptoFile,
  readFileSync(cryptoFile, "utf8").replace('require("crypto")', 'require("./crypto/crypto")')
);

writeFileSync(
  path.join(T, "client", "fs.js"),
  cjs(`const notSupported = () => { throw new Error("File system access is not available in the browser build"); };
exports.createWriteStream = notSupported;
exports.promises = { open: notSupported, writeFile: notSupported, readFile: notSupported };
`)
);

writeFileSync(
  path.join(T, "client", "os.js"),
  cjs(`exports.default = {
  EOL: "\\n",
  type: () => "Browser",
  release: () => (typeof navigator !== "undefined" ? navigator.userAgent : "unknown"),
  platform: () => "browser",
  homedir: () => "/",
};
`)
);

writeFileSync(
  path.join(T, "client", "path.js"),
  cjs(`exports.default = {
  sep: "/",
  join: (...a) => a.join("/"),
  resolve: (...a) => a.join("/"),
  basename: (p) => String(p).split(/[\\\\/]/).pop(),
};
`)
);

writeFileSync(path.join(T, "extensions", "net.js"), cjs(""));

writeFileSync(
  path.join(T, "inspect.js"),
  cjs(`const inspect = (obj) => { try { return JSON.stringify(obj); } catch { return String(obj); } };
inspect.custom = Symbol.for("nodejs.util.inspect.custom");
exports.inspect = inspect;
`)
);

// --- заглушки для пакетов, не нужных в браузере ---

writeFileSync(
  path.join(shims, "node-localstorage.js"),
  `export class LocalStorage { constructor() { throw new Error("StoreSession is not supported in the browser build"); } }
export class JSONStorage extends LocalStorage {}
`
);

writeFileSync(
  path.join(shims, "socks.js"),
  `export class SocksClient {
  static createConnection() { return Promise.reject(new Error("SOCKS proxies are not supported in the browser build")); }
}
`
);

// --- полифилы глобалов Buffer / process ---

writeFileSync(
  path.join(shims, "node-globals.js"),
  `import { Buffer } from "buffer";
import process from "process/browser.js";
export { Buffer, process };
`
);

// --- входная точка бандла ---

const entry = path.join(shims, "entry.js");
writeFileSync(
  entry,
  `import * as telegram from "telegram";
export const TelegramClient = telegram.TelegramClient;
export const Api = telegram.Api;
export const sessions = telegram.sessions;
export const errors = telegram.errors;
export const utils = telegram.utils;
export const helpers = telegram.helpers;
export default telegram;
`
);

await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "browser",
  minify: true,
  outfile: path.join(here, "..", "vendor", "telegram.js"),
  define: { "process.env.NODE_ENV": '"production"', global: "globalThis" },
  inject: [path.join(shims, "node-globals.js")],
  alias: {
    "node-localstorage": path.join(shims, "node-localstorage.js"),
    socks: path.join(shims, "socks.js"),
  },
  logLevel: "info",
});

console.log("OK: vendor/telegram.js rebuilt");
