import JSZip from "jszip";
import { z } from "zod";
import type { ImportedSkillsApi, ImportedSkillDetail, ImportedSkillSource, ImportedSkillSummary } from "./imported-skills";

export const BROWSER_SKILL_LIMITS = Object.freeze({ archiveBytes: 16 * 1024 * 1024, expandedBytes: 12 * 1024 * 1024, entries: 128, storedSkills: 64, fileBytes: 2 * 1024 * 1024, textBytes: 128 * 1024, networkRequests: 64, networkMs: 20000 });
const L = BROWSER_SKILL_LIMITS;
const LIMITATIONS = ["scripts-not-executed", "binary-assets-not-loaded", "context-size-limited"] as const;
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const RESERVED = /^(?:con|prn|aux|nul|com[1-9\u00b9\u00b2\u00b3]|lpt[1-9\u00b9\u00b2\u00b3]|conin\$|conout\$)(?:\.|$)/i;
const TEXT = new Set(["md", "markdown", "txt", "rst", "csv", "json", "yaml", "yml"]);
const SCRIPTS = new Set(["py", "js", "mjs", "cjs", "ts", "tsx", "sh", "ps1", "bat", "cmd", "rb", "r", "sql"]);
const HOSTS = new Set(["github.com", "api.github.com", "raw.githubusercontent.com", "codeload.github.com"]);
const encoder = new TextEncoder();
type Role = "skill" | "reference" | "inactive-attachment";
type InputFile = { path: string; data: Uint8Array };
type Prepared = { name: string; description: string; files: Array<{ path: string; text: string; role: Role }>; ignoredFileCount: number };

export class BrowserSkillError extends Error {
  constructor(public readonly code: string) { super(code); this.name = "BrowserSkillError"; }
}
const fail: (code: string) => never = code => { throw new BrowserSkillError(code); };
const exact = <T>(schema: z.ZodType<T>, value: unknown, code = "INVALID_INPUT"): T => {
  const result = schema.safeParse(value);
  return result.success ? result.data : fail(code);
};

export function validateSkillPath(value: string): string {
  if (!value || value.length > 512 || /[\\<>:"|?*\x00-\x1f\x7f]/.test(value)) fail("INVALID_PATH");
  const parts = value.split("/");
  if (parts.length > 12 || parts.some(part => !part || part === "." || part === ".." || /[. ]$/.test(part) || RESERVED.test(part))) fail("INVALID_PATH");
  return value;
}
function validatePaths(paths: string[]): void {
  const seen = new Map<string, boolean>();
  for (const original of paths) {
    const directory = original.endsWith("/");
    const path = validateSkillPath(directory ? original.slice(0, -1) : original).toLowerCase();
    if (seen.has(path)) fail("INVALID_PATH");
    seen.set(path, directory);
  }
  for (const path of seen.keys()) {
    const parts = path.split("/");
    for (let n = 1; n < parts.length; n++) if (seen.get(parts.slice(0, n).join("/")) === false) fail("INVALID_PATH");
  }
}
function decodeText(bytes: Uint8Array): string {
  if (bytes.byteLength > L.textBytes) fail("LIMIT_EXCEEDED");
  let result: string;
  try { result = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return fail("INVALID_UTF8"); }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(result)) fail("INVALID_UTF8");
  return result.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}
function scalar(value: string): string {
  const text = value.trim();
  if (text.startsWith('"')) {
    try { const decoded: unknown = JSON.parse(text); return typeof decoded === "string" ? decoded : fail("INVALID_FRONTMATTER"); } catch { return fail("INVALID_FRONTMATTER"); }
  }
  if (text.startsWith("'")) {
    if (text.length < 2 || !text.endsWith("'")) fail("INVALID_FRONTMATTER");
    return text.slice(1, -1).replace(/''/g, "'");
  }
  if (/^[\[\]{},!&*]/.test(text)) fail("INVALID_FRONTMATTER");
  return text;
}

/** Restricted metadata only: no YAML evaluator, tool grants or executable imports. */
export function parseBrowserSkill(bytes: Uint8Array): { name: string; description: string; content: string } {
  const content = decodeText(bytes);
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/.exec(content);
  if (!match || match[1].length > 8192 || !match[2].trim()) fail("INVALID_SKILL");
  const lines = match[1].split("\n");
  if (lines.length > 80 || lines.some(line => line.includes("\t"))) fail("INVALID_FRONTMATTER");
  const allowed = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools", "disable-model-invocation", "user-invocable", "argument-hint"]);
  const values: Record<string, string> = Object.create(null);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const item = /^([a-z][a-z-]*):(?:\s+(.*))?$/.exec(line);
    if (!item || !allowed.has(item[1]) || Object.hasOwn(values, item[1])) fail("INVALID_FRONTMATTER");
    const [, key, raw = ""] = item;
    if ([">", ">-", "|", "|-"].includes(raw.trim())) {
      const block: string[] = [];
      while (i + 1 < lines.length && (/^\s/.test(lines[i + 1]) || !lines[i + 1].trim())) block.push(lines[++i].trim());
      values[key] = block.join(raw.startsWith(">") ? " " : "\n").trim();
    } else if (!raw && key === "metadata") {
      const block: string[] = [];
      while (i + 1 < lines.length && /^ {2,}[a-zA-Z0-9_-]+:\s*[^\x00-\x1f]*$/.test(lines[i + 1])) block.push(lines[++i]);
      if (!block.length || block.join("\n").length > 2048) fail("INVALID_FRONTMATTER");
      values[key] = block.join("\n");
    } else if (key === "allowed-tools") {
      if (raw.length > 2048 || /(?:^|[\s,[{])[!&*][a-zA-Z_]/.test(raw)) fail("INVALID_FRONTMATTER");
      values[key] = raw;
    } else values[key] = scalar(raw);
  }
  if (!ID.test(values.name || "") || RESERVED.test(values.name) || !values.description?.trim() || values.description.length > 1024) fail("INVALID_SKILL");
  return { name: values.name, description: values.description.trim(), content };
}
function roleFor(path: string): Role | null {
  if (path === "SKILL.md") return "skill";
  const extension = path.split("/").at(-1)!.split(".").slice(1).at(-1)?.toLowerCase() || "";
  const inactive = path.split("/").some(part => ["scripts", "agents", ".github"].includes(part.toLowerCase())) || SCRIPTS.has(extension);
  return inactive ? (TEXT.has(extension) || SCRIPTS.has(extension) ? "inactive-attachment" : null) : TEXT.has(extension) ? "reference" : null;
}
function prepare(files: InputFile[]): Prepared {
  if (!files.length || files.length > L.entries) fail("LIMIT_EXCEEDED");
  validatePaths(files.map(file => file.path));
  const mains = files.filter(file => file.path.split("/").at(-1) === "SKILL.md");
  if (mains.length !== 1) fail("INVALID_ARCHIVE");
  const main = mains[0], prefix = main.path.slice(0, -8), parsed = parseBrowserSkill(main.data);
  const accepted: Prepared["files"] = [];
  let ignoredFileCount = 0, expanded = 0;
  for (const file of files) {
    if (file.data.byteLength > L.fileBytes || (expanded += file.data.byteLength) > L.expandedBytes) fail("LIMIT_EXCEEDED");
    const path = file.path.slice(prefix.length), role = file.path.startsWith(prefix) ? roleFor(path) : null;
    if (!role) { ignoredFileCount++; continue; }
    accepted.push({ path, role, text: decodeText(file.data) });
  }
  return { name: parsed.name, description: parsed.description, files: accepted, ignoredFileCount };
}

type ZipEntry = { path: string; directory: boolean; size: number; compressedSize: number; crc: number; local: number; end: number };
function extraFields(bytes: Uint8Array, start: number, length: number, rawName: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), end = start + length;
  for (let offset = start; offset < end;) {
    if (offset + 4 > end) fail("INVALID_ARCHIVE");
    const id = view.getUint16(offset, true), size = view.getUint16(offset + 2, true);
    if ([0x0001, 0x756e].includes(id) || offset + 4 + size > end) fail("INVALID_ARCHIVE");
    // Unicode names are allowed only when they cannot override the inspected name.
    if (id === 0x7075 && (size < 5 || bytes[offset + 4] !== 1 || view.getUint32(offset + 5, true) !== ((crcChunk(0xffffffff, rawName) ^ 0xffffffff) >>> 0) || !sameBytes(bytes.subarray(offset + 9, offset + 4 + size), rawName))) fail("INVALID_ARCHIVE");
    offset += 4 + size;
  }
}
const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((byte, i) => byte === b[i]);

/** Inspect original ZIP names and declared sizes before JSZip sees any data. */
export function preflightSkillZip(bytes: Uint8Array): ZipEntry[] {
  if (bytes.length < 22 || bytes.length > L.archiveBytes) fail("LIMIT_EXCEEDED");
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (n: number) => v.getUint16(n, true), u32 = (n: number) => v.getUint32(n, true);
  let end = -1;
  for (let n = bytes.length - 22; n >= Math.max(0, bytes.length - 65557); n--) if (u32(n) === 0x06054b50 && n + 22 + u16(n + 20) === bytes.length) { end = n; break; }
  if (end < 0 || u16(end + 4) || u16(end + 6)) fail("INVALID_ARCHIVE");
  const count = u16(end + 10), centralSize = u32(end + 12), central = u32(end + 16);
  if (count > L.entries) fail("LIMIT_EXCEEDED");
  if (!count || count !== u16(end + 8) || central + centralSize !== end) fail("INVALID_ARCHIVE");
  const entries: ZipEntry[] = [];
  let offset = central, expanded = 0;
  for (let n = 0; n < count; n++) {
    if (offset + 46 > end || u32(offset) !== 0x02014b50) fail("INVALID_ARCHIVE");
    const host = bytes[offset + 5], flags = u16(offset + 8), method = u16(offset + 10), crc = u32(offset + 16);
    const compressedSize = u32(offset + 20), size = u32(offset + 24), nameLength = u16(offset + 28), extraLength = u16(offset + 30), commentLength = u16(offset + 32), attr = u32(offset + 38), local = u32(offset + 42);
    if (offset + 46 + nameLength + extraLength + commentLength > end || ![0, 3].includes(host) || u16(offset + 6) > 20 || flags & ~0x080e || ![0, 8].includes(method) || method === 0 && flags & 6 || u16(offset + 34) || [compressedSize, size, local].includes(0xffffffff)) fail("INVALID_ARCHIVE");
    const rawName = bytes.subarray(offset + 46, offset + 46 + nameLength);
    if (!(flags & 0x800) && rawName.some(byte => byte > 127)) fail("INVALID_ARCHIVE");
    const path = decodeText(rawName), directory = path.endsWith("/");
    validateSkillPath(directory ? path.slice(0, -1) : path);
    const type = (attr >>> 16) & 0xf000;
    if (type && type !== 0x8000 && type !== 0x4000 || type === 0x4000 && !directory || type === 0x8000 && directory || attr & 8 || Boolean(attr & 16) !== directory) fail("INVALID_ARCHIVE");
    if (size > L.fileBytes || (expanded += size) > L.expandedBytes) fail("LIMIT_EXCEEDED");
    if (directory && (size || compressedSize || crc) || method === 0 && size !== compressedSize) fail("INVALID_ARCHIVE");
    extraFields(bytes, offset + 46 + nameLength, extraLength, rawName);
    if (local + 30 > central || u32(local) !== 0x04034b50 || u16(local + 4) > 20 || u16(local + 6) !== flags || u16(local + 8) !== method) fail("INVALID_ARCHIVE");
    const localNameLength = u16(local + 26), localExtraLength = u16(local + 28), start = local + 30 + localNameLength + localExtraLength;
    if (start + compressedSize > central || !sameBytes(bytes.subarray(local + 30, local + 30 + localNameLength), rawName)) fail("INVALID_ARCHIVE");
    extraFields(bytes, local + 30 + localNameLength, localExtraLength, rawName);
    let entryEnd = start + compressedSize;
    if (flags & 8) {
      if ([u32(local + 14), u32(local + 18), u32(local + 22)].some((value, i) => value !== 0 && value !== [crc, compressedSize, size][i])) fail("INVALID_ARCHIVE");
      if (entryEnd + 12 > central) fail("INVALID_ARCHIVE");
      if (u32(entryEnd) === 0x08074b50) entryEnd += 4;
      if (entryEnd + 12 > central || u32(entryEnd) !== crc || u32(entryEnd + 4) !== compressedSize || u32(entryEnd + 8) !== size) fail("INVALID_ARCHIVE");
      entryEnd += 12;
    } else if (u32(local + 14) !== crc || u32(local + 18) !== compressedSize || u32(local + 22) !== size) fail("INVALID_ARCHIVE");
    entries.push({ path, directory, size, compressedSize, crc, local, end: entryEnd });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== end) fail("INVALID_ARCHIVE");
  validatePaths(entries.map(entry => entry.path));
  let next = 0;
  for (const entry of [...entries].sort((a, b) => a.local - b.local)) { if (entry.local !== next) fail("INVALID_ARCHIVE"); next = entry.end; }
  if (next !== central) fail("INVALID_ARCHIVE");
  const mains = entries.filter(entry => !entry.directory && entry.path.split("/").at(-1) === "SKILL.md");
  if (mains.length !== 1) fail("INVALID_ARCHIVE");
  const prefix = mains[0].path.slice(0, -8);
  for (const entry of entries) if (!entry.directory && entry.path.startsWith(prefix) && roleFor(entry.path.slice(prefix.length)) && entry.size > L.textBytes) fail("LIMIT_EXCEEDED");
  return entries;
}
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crcChunk(crc: number, bytes: Uint8Array): number { for (const byte of bytes) crc = CRC[(crc ^ byte) & 255] ^ (crc >>> 8); return crc; }
function concatenate(chunks: Uint8Array[], size: number): Uint8Array {
  const result = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
async function unpack(bytes: Uint8Array): Promise<InputFile[]> {
  const entries = preflightSkillZip(bytes);
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(bytes, { checkCRC32: false, createFolders: false }); } catch { return fail("INVALID_ARCHIVE"); }
  if (Object.keys(zip.files).length !== entries.length) fail("INVALID_ARCHIVE");
  const files: InputFile[] = [];
  let expanded = 0;
  for (const entry of entries) {
    const file = zip.files[entry.path];
    if (!file || file.name !== entry.path || file.dir !== entry.directory || file.unsafeOriginalName && file.unsafeOriginalName !== entry.path) fail("INVALID_ARCHIVE");
    if (entry.directory) continue;
    const data = await new Promise<Uint8Array>((resolve, reject) => {
      // JSZip does not declare this public streaming method in its bundled types.
      const stream = (file as JSZip.JSZipObject & { internalStream(type: "uint8array"): JSZip.JSZipStreamHelper<Uint8Array> }).internalStream("uint8array");
      const chunks: Uint8Array[] = []; let size = 0, crc = 0xffffffff, stopped = false;
      const stop = (code: string) => { stopped = true; stream.pause(); reject(new BrowserSkillError(code)); };
      stream.on("data", (chunk: Uint8Array) => {
        if (stopped) return;
        size += chunk.length; expanded += chunk.length;
        if (size > entry.size || size > L.fileBytes || expanded > L.expandedBytes) { stop("LIMIT_EXCEEDED"); return; }
        crc = crcChunk(crc, chunk); chunks.push(chunk.slice());
      }).on("error", () => { if (!stopped) stop("INVALID_ARCHIVE"); }).on("end", () => {
        if (stopped) return;
        if (size !== entry.size || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) stop("INVALID_ARCHIVE");
        else resolve(concatenate(chunks, size));
      }).resume();
    });
    files.push({ path: entry.path, data });
  }
  return files;
}

const sha40 = z.string().regex(/^[a-f0-9]{40}$/);
const sha64 = z.string().regex(/^[a-f0-9]{64}$/);
const sourceSchema = z.object({ kind: z.enum(["file", "github"]), label: z.string().min(1).max(2048), url: z.string().max(2048).optional(), revision: sha40.optional(), sha256: sha64.optional() }).strict();
const payloadSchema = z.object({
  version: z.literal(1), id: z.string().regex(ID), name: z.string().regex(ID), description: z.string().min(1).max(1024), enabled: z.boolean(), importedAt: z.string().max(32),
  source: sourceSchema, ignoredFileCount: z.number().int().min(0).max(L.entries),
  files: z.array(z.object({ path: z.string().min(1).max(512), role: z.enum(["skill", "reference", "inactive-attachment"]), text: z.string().max(L.textBytes), bytes: z.number().int().min(0).max(L.textBytes), sha256: sha64 }).strict()).min(1).max(L.entries),
}).strict();
const recordSchema = payloadSchema.extend({ integrity: sha64 }).strict();
type Payload = z.infer<typeof payloadSchema>;
type StoredSkill = z.infer<typeof recordSchema>;
async function digest(bytes: Uint8Array, algorithm = "SHA-256"): Promise<string> {
  if (!globalThis.crypto?.subtle) return fail("CRYPTO_UNAVAILABLE");
  const result = await globalThis.crypto.subtle.digest(algorithm, bytes.slice().buffer);
  return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, "0")).join("");
}
async function seal(payload: Payload): Promise<StoredSkill> {
  const checked = exact(payloadSchema, payload, "CONTENT_CHANGED");
  return { ...checked, integrity: await digest(encoder.encode(JSON.stringify(checked))) };
}
async function validateRecord(value: unknown): Promise<StoredSkill> {
  const record = exact(recordSchema, value, "CONTENT_CHANGED");
  try {
    const { integrity, ...payload } = record;
    if (record.id !== record.name || RESERVED.test(record.id) || new Date(record.importedAt).toISOString() !== record.importedAt || (await seal(payload)).integrity !== integrity) fail("CONTENT_CHANGED");
    if (record.source.kind === "github") { parseGithubSkillUrl(record.source.url || ""); if (!record.source.revision) fail("CONTENT_CHANGED"); }
    else if (record.source.url || record.source.revision || !record.source.sha256 || record.source.label.length > 255 || /[/\\\x00-\x1f]/.test(record.source.label)) fail("CONTENT_CHANGED");
    validatePaths(record.files.map(file => file.path));
    let size = 0;
    if (record.files.length + record.ignoredFileCount > L.entries) fail("CONTENT_CHANGED");
    for (const file of record.files) {
      const bytes = encoder.encode(file.text); size += bytes.length;
      if (roleFor(file.path) !== file.role || bytes.length !== file.bytes || bytes.length > L.textBytes || decodeText(bytes) !== file.text || await digest(bytes) !== file.sha256) fail("CONTENT_CHANGED");
    }
    if (size > L.expandedBytes || record.files.filter(file => file.role === "skill").length !== 1) fail("CONTENT_CHANGED");
    const main = record.files.find(file => file.path === "SKILL.md");
    if (!main) fail("CONTENT_CHANGED");
    const parsed = parseBrowserSkill(encoder.encode(main.text));
    if (parsed.name !== record.name || parsed.description !== record.description) fail("CONTENT_CHANGED");
  } catch { return fail("CONTENT_CHANGED"); }
  return record;
}
function summary(record: StoredSkill): ImportedSkillSummary {
  return { id: record.id, name: record.name, description: record.description, enabled: record.enabled, importedAt: record.importedAt, source: { ...record.source }, fileCount: record.files.length, referenceCount: record.files.filter(file => file.role === "reference").length, ignoredFileCount: record.ignoredFileCount, executionMode: "prompt-context", limitations: [...LIMITATIONS] };
}

/** all must be bounded; add must enforce storedSkills atomically with its write. No project DB is reused. */
export interface BrowserSkillStore {
  all(): Promise<unknown[]>;
  get(id: string): Promise<unknown | undefined>;
  add(record: { id: string }): Promise<void>;
  compareAndSwap(id: string, expectedJson: string, record: { id: string }): Promise<void>;
}
function storageError(error: unknown): BrowserSkillError {
  if (error instanceof BrowserSkillError) return error;
  const name = error && typeof error === "object" && "name" in error ? error.name : "";
  return new BrowserSkillError(name === "QuotaExceededError" ? "STORAGE_QUOTA" : name === "ConstraintError" ? "ALREADY_EXISTS" : "STORAGE_FAILED");
}
export function createIndexedDbSkillStore(factory?: IDBFactory): BrowserSkillStore {
  let opening: Promise<IDBDatabase> | undefined;
  let connection: IDBDatabase | undefined;
  const invalidate = (db: IDBDatabase) => {
    if (connection === db) { connection = undefined; opening = undefined; }
  };
  function open(): Promise<IDBDatabase> {
    if (opening) return opening;
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const api = factory ?? globalThis.indexedDB;
      if (!api) { reject(new BrowserSkillError("STORAGE_UNAVAILABLE")); return; }
      let request: IDBOpenDBRequest;
      try { request = api.open("cavwic-browser-imported-skills", 1); } catch (error) { reject(storageError(error)); return; }
      let settled = false;
      const timer = setTimeout(() => { settled = true; reject(new BrowserSkillError("STORAGE_UNAVAILABLE")); }, 5000);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("skills")) request.result.createObjectStore("skills", { keyPath: "id" }); };
      request.onerror = () => { settled = true; clearTimeout(timer); reject(storageError(request.error)); };
      request.onblocked = () => { settled = true; clearTimeout(timer); reject(new BrowserSkillError("STORAGE_UNAVAILABLE")); };
      request.onsuccess = () => {
        clearTimeout(timer);
        const db = request.result;
        if (settled) { db.close(); return; }
        settled = true;
        connection = db;
        db.onclose = () => invalidate(db);
        db.onversionchange = () => { invalidate(db); db.close(); };
        resolve(db);
      };
    }).catch(error => { opening = undefined; throw error; });
    return opening;
  }
  async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore, set: (value: T) => void, abort: (error: unknown) => void) => void, reopened = false): Promise<T> {
    const db = await open();
    let tx: IDBTransaction;
    try { tx = db.transaction("skills", mode); }
    catch (error) {
      if (error && typeof error === "object" && "name" in error && error.name === "InvalidStateError") {
        invalidate(db);
        // No transaction exists yet: retrying here cannot replay a committed write.
        if (!reopened) return transaction(mode, work, true);
      }
      throw storageError(error);
    }
    return new Promise<T>((resolve, reject) => {
      let value: T, reason: unknown;
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(storageError(reason || tx.error));
      tx.onerror = () => { if (!reason) reason = tx.error; };
      const abort = (error: unknown) => { reason = error; try { tx.abort(); } catch { reject(storageError(error)); } };
      try { work(tx.objectStore("skills"), next => { value = next; }, abort); } catch (error) { abort(error); }
    });
  }
  return {
    all: () => transaction<unknown[]>("readonly", (store, set, abort) => {
      const count = store.count();
      count.onsuccess = () => {
        if (count.result > L.storedSkills) { abort(new BrowserSkillError("STORAGE_CAPACITY")); return; }
        const request = store.getAll(undefined, L.storedSkills);
        request.onsuccess = () => {
          if (request.result.length !== count.result) { abort(new BrowserSkillError("CONTENT_CHANGED")); return; }
          set(request.result);
        };
      };
    }),
    get: id => transaction<unknown>("readonly", (store, set) => { const request = store.get(id); request.onsuccess = () => set(request.result); }),
    add: record => transaction<void>("readwrite", (store, set, abort) => {
      const existing = store.count(record.id);
      existing.onsuccess = () => {
        if (existing.result) { abort(new BrowserSkillError("ALREADY_EXISTS")); return; }
        const count = store.count();
        count.onsuccess = () => {
          if (count.result >= L.storedSkills) { abort(new BrowserSkillError("STORAGE_CAPACITY")); return; }
          const request = store.add(record); request.onsuccess = () => set(undefined);
        };
      };
    }),
    compareAndSwap: (id, expected, record) => transaction<void>("readwrite", (store, set, abort) => {
      const request = store.get(id);
      request.onsuccess = () => {
        try {
          if (JSON.stringify(request.result) !== expected) { abort(new BrowserSkillError("CONTENT_CHANGED")); return; }
          const update = store.put(record); update.onsuccess = () => set(undefined);
        } catch (error) { abort(error); }
      };
    }),
  };
}

type GithubTarget = { owner: string; repository: string; ref: string; refType?: "heads" | "tags"; path: string[]; kind: "directory" | "file" | "zip"; url: string };
function officialUrl(value: string, recursive = false): { url: URL; parts: string[] } {
  if (typeof value !== "string" || value.length > 2048 || /[\x00-\x20\x7f\\]/.test(value)) fail("INVALID_URL");
  const match = /^https:\/\/([^/?#]+)(\/[^?#]*)?(\?recursive=1)?$/.exec(value);
  if (!match || /[:@%]/.test(match[1]) || match[3] && !recursive) fail("NETWORK_BLOCKED");
  const url = new URL(value);
  if (!HOSTS.has(url.hostname) || url.username || url.password || url.port || url.hash || match[3] && url.hostname !== "api.github.com") fail("NETWORK_BLOCKED");
  const raw = (match[2] || "").split("/").slice(1); if (raw.at(-1) === "") raw.pop();
  const parts = raw.map(part => {
    let decoded: string; try { decoded = decodeURIComponent(part); } catch { return fail("INVALID_URL"); }
    validateSkillPath(decoded); if (decoded.includes("/")) fail("INVALID_URL"); return decoded;
  });
  return { url, parts };
}
export function parseGithubSkillUrl(value: string): GithubTarget {
  const { url, parts } = officialUrl(value);
  const [owner, repository, kind, ...rest] = parts;
  if (!owner || !repository || !/^[a-zA-Z0-9_.-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(repository)) fail("INVALID_URL");
  if (url.hostname === "github.com" && ["tree", "blob"].includes(kind)) {
    const [ref, ...path] = rest;
    if (!ref || kind === "tree" && !path.length || kind === "blob" && path.at(-1) !== "SKILL.md" || path.length > 9) fail("INVALID_URL");
    return { owner, repository, ref, path, kind: kind === "tree" ? "directory" : "file", url: url.href };
  }
  if (url.hostname === "raw.githubusercontent.com" && parts.length >= 4 && parts.at(-1) === "SKILL.md") return { owner, repository, ref: kind, path: rest, kind: "file", url: url.href };
  if (url.hostname === "github.com" && kind === "archive" || url.hostname === "codeload.github.com" && kind === "zip") {
    const refs = [...rest];
    if (url.hostname === "github.com") {
      if (!refs.at(-1)?.endsWith(".zip")) fail("INVALID_URL");
      refs[refs.length - 1] = refs.at(-1)!.slice(0, -4);
    }
    const ref = refs.length === 1 ? refs[0] : refs.length === 3 && refs[0] === "refs" && ["heads", "tags"].includes(refs[1]) ? refs[2] : "";
    if (!ref) fail("INVALID_URL");
    return { owner, repository, ref, refType: refs.length === 3 ? refs[1] as "heads" | "tags" : undefined, path: [], kind: "zip", url: url.href };
  }
  return fail("INVALID_URL");
}
type Budget = { requests: number; bytes: number; signal: AbortSignal };
async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return fail("DOWNLOAD_TIMEOUT");
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new BrowserSkillError("DOWNLOAD_TIMEOUT"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}
async function download(url: string, budget: Budget, fetcher: typeof fetch, max: number): Promise<Uint8Array> {
  officialUrl(url, true);
  if (++budget.requests > L.networkRequests) fail("LIMIT_EXCEEDED");
  let response: Response;
  try { response = await abortable(fetcher(url, { method: "GET", redirect: "error", credentials: "omit", mode: "cors", cache: "no-store", referrerPolicy: "no-referrer", headers: { Accept: url.startsWith("https://api.github.com/") ? "application/vnd.github+json" : "application/octet-stream" }, signal: budget.signal }), budget.signal); }
  catch (error) { if (error instanceof BrowserSkillError) throw error; return fail("DOWNLOAD_FAILED"); }
  const rejectResponse = (code: string): never => { void response.body?.cancel().catch(() => {}); return fail(code); };
  if (response.redirected || ["opaque", "opaqueredirect"].includes(response.type) || response.status >= 300 && response.status < 400 || response.url && response.url !== url) rejectResponse("NETWORK_BLOCKED");
  if (!response.ok || !response.body?.getReader) rejectResponse("DOWNLOAD_FAILED");
  const declared = response.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)) || Number(declared) > max || budget.bytes + Number(declared) > L.archiveBytes)) rejectResponse("LIMIT_EXCEEDED");
  const reader = response.body!.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await abortable(reader.read(), budget.signal); if (next.done) break;
      if (!(next.value instanceof Uint8Array)) fail("DOWNLOAD_FAILED");
      size += next.value.length; budget.bytes += next.value.length;
      if (size > max || budget.bytes > L.archiveBytes) fail("LIMIT_EXCEEDED");
      chunks.push(next.value.slice());
    }
  } catch (error) { void reader.cancel().catch(() => {}); if (error instanceof BrowserSkillError) throw error; return fail("DOWNLOAD_FAILED"); }
  finally { try { reader.releaseLock(); } catch { /* A cancelled read can still be pending. */ } }
  // Fetch may decode the body while Content-Length still describes the encoded bytes.
  return concatenate(chunks, size);
}
const treeEntrySchema = z.object({ path: z.string().max(512), mode: z.string(), type: z.string(), sha: sha40, size: z.number().int().min(0).optional() });
const treeSchema = z.object({ sha: sha40, truncated: z.boolean().optional(), tree: z.array(treeEntrySchema).max(4096) });
async function githubFiles(target: GithubTarget, fetcher: typeof fetch, timeoutMs: number): Promise<{ prepared: Prepared; source: ImportedSkillSource }> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  const budget: Budget = { requests: 0, bytes: 0, signal: controller.signal };
  const api = `https://api.github.com/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repository)}`;
  const json = async (url: string, max = L.fileBytes): Promise<unknown> => {
    const bytes = await download(url, budget, fetcher, max);
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return fail("DOWNLOAD_FAILED"); }
  };
  try {
    let commit: { sha: string; commit: { tree: { sha: string } } };
    if (target.refType) {
      const objectSchema = z.object({ object: z.object({ type: z.enum(["commit", "tag"]), sha: sha40 }) });
      let reference = exact(objectSchema, await json(`${api}/git/ref/${target.refType}/${encodeURIComponent(target.ref)}`), "DOWNLOAD_FAILED").object;
      let depth = 0;
      while (reference.type === "tag") {
        if (++depth > 4) fail("LIMIT_EXCEEDED");
        reference = exact(objectSchema, await json(`${api}/git/tags/${reference.sha}`), "DOWNLOAD_FAILED").object;
      }
      const resolved = exact(z.object({ sha: sha40, tree: z.object({ sha: sha40 }) }), await json(`${api}/git/commits/${reference.sha}`), "DOWNLOAD_FAILED");
      if (resolved.sha !== reference.sha) fail("CONTENT_CHANGED");
      commit = { sha: resolved.sha, commit: { tree: resolved.tree } };
    } else {
      commit = exact(z.object({ sha: sha40, commit: z.object({ tree: z.object({ sha: sha40 }) }) }), await json(`${api}/commits/${encodeURIComponent(target.ref)}`), "DOWNLOAD_FAILED");
    }
    if (/^[a-f0-9]{40}$/i.test(target.ref) && commit.sha !== target.ref.toLowerCase()) fail("CONTENT_CHANGED");
    const source: ImportedSkillSource = { kind: "github", label: new URL(target.url).pathname, url: target.url, revision: commit.sha };
    if (target.kind === "zip") {
      const data = await download(`https://codeload.github.com/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repository)}/zip/${commit.sha}`, budget, fetcher, L.archiveBytes);
      return { prepared: prepare(await unpack(data)), source: { ...source, sha256: await digest(data) } };
    }
    const readTree = async (sha: string) => {
      const tree = exact(treeSchema, await json(`${api}/git/trees/${sha}`), "DOWNLOAD_FAILED");
      if (tree.sha !== sha || tree.truncated) fail("DOWNLOAD_FAILED");
      validatePaths(tree.tree.map(entry => entry.type === "tree" ? `${entry.path}/` : entry.path));
      if (tree.tree.some(entry => entry.path.includes("/"))) fail("INVALID_PATH");
      return tree;
    };
    let treeSha = commit.commit.tree.sha;
    const directory = target.kind === "file" ? target.path.slice(0, -1) : target.path;
    if (directory.length > 8) fail("LIMIT_EXCEEDED");
    for (const segment of directory) {
      const tree = await readTree(treeSha), found = tree.tree.find(entry => entry.path === segment);
      if (!found || found.type !== "tree" || found.mode !== "040000") fail("INVALID_PATH");
      treeSha = found.sha;
    }
    let entries: z.infer<typeof treeEntrySchema>[];
    if (target.kind === "file") {
      const tree = await readTree(treeSha), found = tree.tree.find(entry => entry.path === "SKILL.md");
      if (!found) fail("INVALID_SKILL");
      entries = [found];
    } else {
      const listing = exact(treeSchema, await json(`${api}/git/trees/${treeSha}?recursive=1`), "DOWNLOAD_FAILED");
      if (listing.sha !== treeSha || listing.truncated || listing.tree.length > L.entries) fail("LIMIT_EXCEEDED");
      entries = listing.tree;
    }
    validatePaths(entries.map(entry => entry.type === "tree" ? `${entry.path}/` : entry.path));
    let expanded = 0;
    for (const entry of entries) {
      if (entry.type === "tree" && entry.mode === "040000") continue;
      if (entry.type !== "blob" || !["100644", "100755"].includes(entry.mode)) fail("INVALID_PATH");
      if (entry.size === undefined || entry.size > L.fileBytes || (expanded += entry.size) > L.expandedBytes) fail("LIMIT_EXCEEDED");
    }
    const blobs = entries.filter(entry => entry.type === "blob");
    const mains = blobs.filter(entry => entry.path.split("/").at(-1) === "SKILL.md");
    if (mains.length !== 1) fail("INVALID_ARCHIVE");
    const prefix = mains[0].path.slice(0, -8), files: InputFile[] = [];
    for (const entry of blobs) {
      if (!entry.path.startsWith(prefix) || !roleFor(entry.path.slice(prefix.length))) { files.push({ path: entry.path, data: new Uint8Array() }); continue; }
      if (entry.size! > L.textBytes) fail("LIMIT_EXCEEDED");
      const blob = exact(z.object({ sha: sha40, size: z.number().int().min(0).max(L.textBytes), encoding: z.literal("base64"), content: z.string().max(L.textBytes * 2) }), await json(`${api}/git/blobs/${entry.sha}`, L.textBytes * 2), "DOWNLOAD_FAILED");
      const base64 = blob.content.replace(/[\r\n]/g, "");
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) fail("DOWNLOAD_FAILED");
      const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
      if (blob.sha !== entry.sha || blob.size !== entry.size || bytes.length !== entry.size || await digest(concatenate([encoder.encode(`blob ${bytes.length}\0`), bytes], encoder.encode(`blob ${bytes.length}\0`).length + bytes.length), "SHA-1") !== entry.sha) fail("CONTENT_CHANGED");
      files.push({ path: entry.path, data: bytes });
    }
    return { prepared: prepare(files), source };
  } finally { clearTimeout(timer); controller.abort(); }
}

export function createBrowserSkillsApi(options: { store?: BrowserSkillStore; indexedDB?: IDBFactory; fetcher?: typeof fetch; now?: () => string; networkTimeoutMs?: number } = {}): ImportedSkillsApi {
  const store = options.store ?? createIndexedDbSkillStore(options.indexedDB);
  const fetcher: typeof fetch = options.fetcher ?? ((...args) => globalThis.fetch(...args));
  const now = options.now ?? (() => new Date().toISOString());
  const timeout = options.networkTimeoutMs ?? L.networkMs;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > L.networkMs) fail("INVALID_INPUT");
  let queue = Promise.resolve<unknown>(undefined);
  const serial = <T>(action: () => Promise<T>): Promise<T> => {
    const pending = queue.then(action, action).catch(error => { if (error instanceof BrowserSkillError) throw error; throw storageError(error); });
    queue = pending.catch(() => undefined); return pending;
  };
  const idInput = z.string().regex(ID).refine(id => !RESERVED.test(id));
  const get = async (id: string) => { const raw = await store.get(id); if (raw === undefined) fail("NOT_FOUND"); const record = await validateRecord(raw); if (record.id !== id) fail("CONTENT_CHANGED"); return { raw, record }; };
  const save = async (prepared: Prepared, source: ImportedSkillSource) => {
    const files: Payload["files"] = [];
    for (const file of prepared.files) { const bytes = encoder.encode(file.text); files.push({ ...file, bytes: bytes.length, sha256: await digest(bytes) }); }
    const record = await seal({ version: 1, id: prepared.name, name: prepared.name, description: prepared.description, enabled: false, importedAt: now(), source, ignoredFileCount: prepared.ignoredFileCount, files });
    await validateRecord(record);
    // One structured-clone record, including all attachments, commits or aborts together.
    await store.add(record); return summary(record);
  };
  return {
    list: () => serial(async () => {
      const result: ImportedSkillSummary[] = [], ids = new Set<string>();
      const records = await store.all();
      if (records.length > L.storedSkills) fail("STORAGE_CAPACITY");
      for (const raw of records) { const record = await validateRecord(raw); if (ids.has(record.id)) fail("CONTENT_CHANGED"); ids.add(record.id); result.push(summary(record)); }
      return result.sort((a, b) => a.name.localeCompare(b.name, "en"));
    }),
    read: input => serial(async () => {
      const { id } = exact(z.object({ id: idInput }).strict(), input), { record } = await get(id);
      const detail: ImportedSkillDetail = { ...summary(record), skillText: record.files.find(file => file.role === "skill")!.text, references: record.files.filter(file => file.role === "reference").map(({ path, text }) => ({ path, text })) };
      return detail;
    }),
    importFile: input => serial(async () => {
      const { name, data } = exact(z.object({ name: z.string().min(1).max(255).regex(/^[^/\\\x00-\x1f]+\.(?:md|zip)$/i), data: z.instanceof(Uint8Array).refine(bytes => bytes.length > 0 && bytes.length <= L.archiveBytes) }).strict(), input);
      const snapshot = data.slice();
      return save(prepare(/\.zip$/i.test(name) ? await unpack(snapshot) : [{ path: "SKILL.md", data: snapshot }]), { kind: "file", label: name, sha256: await digest(snapshot) });
    }),
    installUrl: input => serial(async () => {
      const { url } = exact(z.object({ url: z.string() }).strict(), input), target = parseGithubSkillUrl(url);
      const { prepared, source } = await githubFiles(target, fetcher, timeout); return save(prepared, source);
    }),
    setEnabled: input => serial(async () => {
      const { id, enabled } = exact(z.object({ id: idInput, enabled: z.boolean() }).strict(), input), { raw, record } = await get(id);
      const { integrity: _integrity, ...payload } = record;
      const updated = await seal({ ...payload, enabled }); await validateRecord(updated);
      await store.compareAndSwap(id, JSON.stringify(raw), updated); return summary(updated);
    }),
  };
}

// Lazy: importing this module neither opens storage nor makes network requests.
export const browserSkillsApi: ImportedSkillsApi = createBrowserSkillsApi();
