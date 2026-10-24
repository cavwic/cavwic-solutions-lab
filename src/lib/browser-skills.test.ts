import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { brotliCompressSync, gzipSync } from "node:zlib";
import JSZip from "jszip";
import { BROWSER_SKILL_LIMITS as L, BrowserSkillError, createBrowserSkillsApi, createIndexedDbSkillStore, parseBrowserSkill, parseGithubSkillUrl, preflightSkillZip, validateSkillPath, type BrowserSkillStore } from "./browser-skills";

// node:test + synthetic inputs only. No browser, installed profile, disk DB or live HTTP.
const enc = new TextEncoder();
const text = (name = "synthetic-skill", body = "Use verified facts.") => `---\nname: ${name}\ndescription: Synthetic test guidance\n---\n${body}`;
const bytes = (value: string) => enc.encode(value);
const clone = <T>(value: T): T => structuredClone(value);
const code = (expected: string) => (error: unknown) => { assert.equal((error as BrowserSkillError).code, expected); return true; };
const clock = () => "2026-10-24T00:00:00.000Z";
class MemoryStore implements BrowserSkillStore {
  records = new Map<string, unknown>();
  quota = false;
  beforeSwap?: () => void;
  async all() {
    if (this.records.size > L.storedSkills) throw new BrowserSkillError("STORAGE_CAPACITY");
    return clone([...this.records.values()]);
  }
  async get(id: string) { return clone(this.records.get(id)); }
  async add(record: { id: string }) {
    if (this.quota) throw new DOMException("Synthetic quota", "QuotaExceededError");
    if (this.records.has(record.id)) throw new DOMException("Synthetic collision", "ConstraintError");
    if (this.records.size >= L.storedSkills) throw new BrowserSkillError("STORAGE_CAPACITY");
    this.records.set(record.id, clone(record));
  }
  async compareAndSwap(id: string, expected: string, record: { id: string }) {
    this.beforeSwap?.();
    if (this.quota) throw new DOMException("Synthetic quota", "QuotaExceededError");
    if (JSON.stringify(this.records.get(id)) !== expected) throw new BrowserSkillError("CONTENT_CHANGED");
    this.records.set(id, clone(record));
  }
}
const isolated = () => { const store = new MemoryStore(); return { store, api: createBrowserSkillsApi({ store, now: clock }) }; };
async function zip(files: Record<string, string | Uint8Array>, compression: "STORE" | "DEFLATE" = "DEFLATE") {
  const archive = new JSZip();
  for (const [path, data] of Object.entries(files)) archive.file(path, data, { createFolders: false });
  return archive.generateAsync({ type: "uint8array", compression });
}
function centralOffsets(data: Uint8Array): number[] {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength), end = data.length - 22;
  let offset = v.getUint32(end + 16, true);
  const result: number[] = [];
  while (offset < end) { result.push(offset); offset += 46 + v.getUint16(offset + 28, true) + v.getUint16(offset + 30, true) + v.getUint16(offset + 32, true); }
  return result;
}
function patchSize(data: Uint8Array, central: number, size: number) {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const local = v.getUint32(central + 42, true);
  v.setUint32(central + 24, size, true); v.setUint32(local + 22, size, true);
}

describe("restricted parser and paths", () => {
  it("normalizes BOM/CRLF and accepts inert desktop-compatible metadata", () => {
    const skill = "\ufeff---\r\nname: synthetic-skill\r\ndescription: >-\r\n  Verified facts\r\n  only.\r\nmetadata:\r\n  owner: synthetic\r\nallowed-tools: [Bash, Read]\r\n---\r\nBody.";
    const parsed = parseBrowserSkill(bytes(skill));
    assert.equal(parsed.description, "Verified facts only.");
    assert.ok(!parsed.content.includes("\r"));
    assert.ok(parsed.content.includes("allowed-tools: [Bash, Read]"));
  });
  for (const [label, value] of Object.entries({ missing: "No metadata", duplicate: "---\nname: a\nname: b\ndescription: ok\n---\nx", tag: "---\nname: a\ndescription: !!js/function evil\n---\nx", alias: "---\nname: a\ndescription: *alias\n---\nx", unknown: "---\nname: a\ndescription: ok\nhooks: run\n---\nx", nested: "---\nname: a\ndescription:\n  nested: value\n---\nx", reserved: text("con"), empty: text("a", " "), tab: "---\nname: a\ndescription:\tbad\n---\nx" })) {
    it(`rejects ${label} frontmatter`, () => assert.throws(() => parseBrowserSkill(bytes(value)), BrowserSkillError));
  }
  it("enforces fatal UTF-8, control-character and text limits", () => {
    assert.throws(() => parseBrowserSkill(new Uint8Array([0xc0, 0xaf])), code("INVALID_UTF8"));
    assert.throws(() => parseBrowserSkill(bytes(text("a", "\0"))), code("INVALID_UTF8"));
    assert.throws(() => parseBrowserSkill(new Uint8Array(L.textBytes + 1)), code("LIMIT_EXCEEDED"));
    assert.equal(parseBrowserSkill(bytes(text("a", "Chinese: \u4e2d\u6587"))).name, "a");
  });
  for (const path of ["../a", "/a", "a//b", "a/./b", "a\\b", "C:/x", "a/CON.txt", "a/file.", "a/file ", "a/\0", Array(14).fill("x").join("/")]) it(`rejects path ${JSON.stringify(path)}`, () => assert.throws(() => validateSkillPath(path), code("INVALID_PATH")));
});

describe("ZIP preflight and bounded CRC-checked extraction", () => {
  it("imports one wrapped skill with inert script/agent text and ignored binaries", async () => {
    const { api } = isolated();
    const data = await zip({ "demo/SKILL.md": text(), "demo/references/facts.md": "Verified reference", "demo/scripts/notes.txt": "DO NOT inject this", "demo/SCRIPTS/upper.md": "DO NOT inject this either", "demo/agents/instructions.md": "Not a reference", "demo/run.py": "raise Exception('never execute')", "demo/image.png": new Uint8Array([0, 255]), "outside.txt": "Outside the skill" });
    assert.equal(preflightSkillZip(data).length, 8);
    const imported = await api.importFile({ name: "demo.zip", data });
    assert.equal(imported.enabled, false); assert.equal(imported.fileCount, 6); assert.equal(imported.referenceCount, 1); assert.equal(imported.ignoredFileCount, 2);
    const detail = await api.read({ id: imported.id });
    assert.deepEqual(detail.references, [{ path: "references/facts.md", text: "Verified reference" }]);
    assert.equal(detail.executionMode, "prompt-context"); assert.equal(detail.limitations.length, 3);
  });
  it("accepts explicit directory entries and streamed data descriptors", async () => {
    const archive = new JSZip(); archive.folder("demo"); archive.file("demo/SKILL.md", text());
    const data = await archive.generateAsync({ type: "uint8array", compression: "DEFLATE", streamFiles: true });
    await isolated().api.importFile({ name: "descriptor.zip", data });
  });
  it("accepts identical Unicode name metadata but rejects alternate-name overrides", async () => {
    const data = await zip({ "SKILL.md": text(), "references/\u53c2\u8003.md": "Reference" });
    assert.equal((await isolated().api.importFile({ name: "unicode.zip", data })).referenceCount, 1);
    const changed = data.slice(), v = new DataView(changed.buffer), c = centralOffsets(changed)[1];
    const extra = c + 46 + v.getUint16(c + 28, true); assert.equal(v.getUint16(extra, true), 0x7075);
    changed[extra + 9] ^= 1;
    assert.throws(() => preflightSkillZip(changed), code("INVALID_ARCHIVE"));
  });
  it("rejects traversal before JSZip can sanitize it", async () => {
    const data = await zip({ "SKILL.md": text(), "../escape.txt": "No" });
    assert.throws(() => preflightSkillZip(data), code("INVALID_PATH"));
    await assert.rejects(isolated().api.importFile({ name: "bad.zip", data }), code("INVALID_PATH"));
  });
  it("rejects duplicate/case-colliding names, ancestor collisions and multiple skills", async () => {
    const cases: Array<Record<string, string>> = [{ "SKILL.md": text(), "Readme.md": "a", "README.md": "b" }, { "SKILL.md": text(), "ref": "a", "ref/a.md": "b" }, { "one/SKILL.md": text("one"), "two/SKILL.md": text("two") }];
    for (const entries of cases) await assert.rejects(isolated().api.importFile({ name: "bad.zip", data: await zip(entries) }), BrowserSkillError);
  });
  it("rejects symlink modes, encrypted/ZIP64 flags and local-header mismatches", async () => {
    const original = await zip({ "SKILL.md": text() });
    const cases = [
      (data: Uint8Array, c: number, v: DataView) => v.setUint32(c + 38, 0xa1ff0000, true),
      (data: Uint8Array, c: number, v: DataView) => v.setUint16(c + 8, 1, true),
      (data: Uint8Array, c: number, v: DataView) => v.setUint16(c + 6, 45, true),
      (data: Uint8Array, c: number, v: DataView) => { const local = v.getUint32(c + 42, true); data[local + 30] = 88; },
    ];
    for (const mutate of cases) { const data = original.slice(); const c = centralOffsets(data)[0]; mutate(data, c, new DataView(data.buffer)); assert.throws(() => preflightSkillZip(data), code("INVALID_ARCHIVE")); }
  });
  it("checks 16MB archive, 128-entry, 2MB file, 128KB text and 12MB total limits", async () => {
    assert.throws(() => preflightSkillZip(new Uint8Array(L.archiveBytes + 1)), code("LIMIT_EXCEEDED"));
    const tooMany: Record<string, string> = { "SKILL.md": text() }; for (let n = 0; n < 128; n++) tooMany[`binary-${n}.png`] = "";
    const crowded = await zip(tooMany); assert.throws(() => preflightSkillZip(crowded), code("LIMIT_EXCEEDED"));
    for (const [filename, size] of [["a.png", L.fileBytes + 1], ["a.md", L.textBytes + 1]] as const) {
      const data = await zip({ "SKILL.md": text(), [filename]: "x" }); patchSize(data, centralOffsets(data)[1], size);
      assert.throws(() => preflightSkillZip(data), code("LIMIT_EXCEEDED"));
    }
    const many: Record<string, string> = { "SKILL.md": text() }; for (let n = 0; n < 7; n++) many[`binary-${n}.png`] = "x";
    const data = await zip(many); for (const c of centralOffsets(data).slice(1)) patchSize(data, c, L.fileBytes);
    assert.throws(() => preflightSkillZip(data), code("LIMIT_EXCEEDED"));
  });
  it("detects stored-content CRC corruption", async () => {
    const data = await zip({ "SKILL.md": text() }, "STORE"), v = new DataView(data.buffer);
    const start = 30 + v.getUint16(26, true) + v.getUint16(28, true); data[start + 10] ^= 1;
    const { store, api } = isolated();
    await assert.rejects(api.importFile({ name: "crc.zip", data }), code("INVALID_ARCHIVE")); assert.equal(store.records.size, 0);
  });
  it("stops output that exceeds a deliberately false uncompressed size", async () => {
    const data = await zip({ "SKILL.md": text(), "bomb.png": "X".repeat(500000) }); patchSize(data, centralOffsets(data)[1], 1);
    await assert.rejects(isolated().api.importFile({ name: "bomb.zip", data }), code("LIMIT_EXCEEDED"));
  });
  it("rejects invalid UTF-8 in accepted inactive attachments too", async () => {
    await assert.rejects(isolated().api.importFile({ name: "invalid.zip", data: await zip({ "SKILL.md": text(), "scripts/run.py": new Uint8Array([255]) }) }), code("INVALID_UTF8"));
  });
});

describe("shared persistent record semantics", () => {
  it("defaults disabled, persists across API instances and toggles atomically", async () => {
    const { api, store } = isolated();
    const imported = await api.importFile({ name: "SKILL.md", data: bytes(text()) });
    assert.equal(imported.enabled, false); assert.match(imported.source.sha256!, /^[a-f0-9]{64}$/);
    const other = createBrowserSkillsApi({ store, now: clock });
    assert.equal((await other.list())[0].enabled, false);
    await other.setEnabled({ id: imported.id, enabled: true });
    assert.equal((await api.read({ id: imported.id })).enabled, true);
    await api.setEnabled({ id: imported.id, enabled: false });
    assert.equal((await other.list())[0].enabled, false);
    const detail = await other.read({ id: imported.id }); detail.source.label = "Caller mutation";
    assert.equal((await api.read({ id: imported.id })).source.label, "SKILL.md");
  });
  it("never overwrites a duplicate, including simultaneous API instances", async () => {
    const store = new MemoryStore(), first = createBrowserSkillsApi({ store, now: clock }), second = createBrowserSkillsApi({ store, now: clock });
    const results = await Promise.allSettled([first.importFile({ name: "a.md", data: bytes(text()) }), second.importFile({ name: "b.md", data: bytes(text()) })]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult; code("ALREADY_EXISTS")(rejected.reason);
    assert.equal(store.records.size, 1);
  });
  it("fails closed for corrupt manifests, content, enabled state and attachment roles", async () => {
    for (const mutate of [(record: any) => { record.files[0].text += "tampered"; }, (record: any) => { record.enabled = true; }, (record: any) => { record.source.extra = "not allowed"; }, (record: any) => { record.files[0].role = "reference"; }]) {
      const { api, store } = isolated(); await api.importFile({ name: "a.md", data: bytes(text()) }); mutate(store.records.get("synthetic-skill"));
      await assert.rejects(api.list(), code("CONTENT_CHANGED")); await assert.rejects(api.read({ id: "synthetic-skill" }), code("CONTENT_CHANGED")); await assert.rejects(api.setEnabled({ id: "synthetic-skill", enabled: true }), code("CONTENT_CHANGED"));
    }
  });
  it("quota failures preserve records and a failed queue remains usable", async () => {
    const { api, store } = isolated(); store.quota = true;
    await assert.rejects(api.importFile({ name: "a.md", data: bytes(text()) }), code("STORAGE_QUOTA")); assert.equal(store.records.size, 0);
    store.quota = false; await api.importFile({ name: "a.md", data: bytes(text()) }); const original = clone(store.records.get("synthetic-skill")); store.quota = true;
    await assert.rejects(api.setEnabled({ id: "synthetic-skill", enabled: true }), code("STORAGE_QUOTA")); assert.deepEqual(store.records.get("synthetic-skill"), original);
    store.quota = false; assert.equal((await api.list()).length, 1);
  });
  it("does not overwrite a record changed between validation and commit", async () => {
    const { api, store } = isolated(); await api.importFile({ name: "a.md", data: bytes(text()) });
    store.beforeSwap = () => { (store.records.get("synthetic-skill") as any).description = "Changed concurrently"; };
    await assert.rejects(api.setEnabled({ id: "synthetic-skill", enabled: true }), code("CONTENT_CHANGED"));
    assert.equal((store.records.get("synthetic-skill") as any).enabled, false);
  });
  it("rejects extra inputs, wrong IDs, empty files and unknown extensions", async () => {
    const { api } = isolated();
    await assert.rejects(api.importFile({ name: "x.exe", data: bytes(text()) }), code("INVALID_INPUT"));
    await assert.rejects(api.importFile({ name: "x.md", data: new Uint8Array() }), code("INVALID_INPUT"));
    await assert.rejects(api.setEnabled({ id: "../bad", enabled: true }), code("INVALID_INPUT"));
    await assert.rejects(api.read({ id: "missing" }), code("NOT_FOUND"));
    await assert.rejects(api.read({ id: "missing", provider: "cloud" } as any), code("INVALID_INPUT"));
  });
  it("lists 64 valid skills but rejects the 65th without changing existing records", async () => {
    const { api, store } = isolated();
    for (let n = 0; n < L.storedSkills; n++) await api.importFile({ name: "SKILL.md", data: bytes(text(`skill-${n}`)) });
    assert.equal((await api.list()).length, L.storedSkills);
    const before = clone(store.records);
    await assert.rejects(api.importFile({ name: "SKILL.md", data: bytes(text("over-capacity")) }), code("STORAGE_CAPACITY"));
    await assert.rejects(api.importFile({ name: "SKILL.md", data: bytes(text("skill-0")) }), code("ALREADY_EXISTS"));
    assert.deepEqual(store.records, before);
    assert.equal((await api.setEnabled({ id: "skill-0", enabled: true })).enabled, true);
  });
  it("defensively rejects over-capacity enumeration from an injected adapter", async () => {
    const store = new MemoryStore();
    store.all = async () => Array.from({ length: L.storedSkills + 1 }, () => null);
    await assert.rejects(createBrowserSkillsApi({ store }).list(), code("STORAGE_CAPACITY"));
  });
});

function idbHarness() {
  const state = { records: new Map<string, unknown>(), abortCommit: false, opened: [] as unknown[], connections: [] as any[], commits: 0, writes: 0, getAllLimits: [] as number[], invalidTransactions: 0, afterAdd: undefined as (() => void) | undefined };
  const waiting: Array<() => void> = [];
  let occupied = false;
  const advance = () => {
    if (occupied) return;
    const next = waiting.shift(); if (!next) return;
    occupied = true; queueMicrotask(next);
  };
  function connection() {
    const running = new Set<any>();
    const db: any = {
      closed: false, objectStoreNames: { contains: () => true },
      close() { db.closed = true; },
      forceClose() {
        db.closed = true;
        for (const tx of running) { tx.error = new DOMException("Synthetic connection loss", "AbortError"); tx.abort(); }
        db.onclose?.();
      },
      transaction(name: string, mode: string) {
        assert.equal(name, "skills");
        if (db.closed || state.invalidTransactions > 0) {
          if (state.invalidTransactions > 0) state.invalidTransactions--;
          db.closed = true; throw new DOMException("Synthetic closed connection", "InvalidStateError");
        }
        let snapshot: Map<string, unknown>, pending = 0, finished = false, active = false;
        const operations: Array<() => void> = [];
        const release = () => { running.delete(tx); occupied = false; advance(); };
        const tx: any = { error: null, abort() {
          if (finished) return; finished = true;
          queueMicrotask(() => { tx.onabort?.(); if (active) release(); });
        } };
        const finish = () => queueMicrotask(() => {
          if (finished || pending) return;
          if (state.abortCommit && mode === "readwrite") { tx.error = new DOMException("Synthetic late quota", "QuotaExceededError"); tx.abort(); return; }
          finished = true;
          if (mode === "readwrite") { state.records = snapshot; state.commits++; }
          tx.oncomplete?.(); release();
        });
        const request = (operation: () => unknown, afterSuccess?: () => void) => {
          pending++; const req: any = {};
          const execute = () => queueMicrotask(() => {
            if (finished) return;
            try { req.result = clone(operation()); req.onsuccess?.(); afterSuccess?.(); }
            catch (error) { req.error = error; tx.error = error; req.onerror?.(); tx.onerror?.(); tx.abort(); }
            pending--; finish();
          });
          if (active) execute(); else operations.push(execute);
          return req;
        };
        tx.objectStore = () => ({
          count: (id?: string) => request(() => id === undefined ? snapshot.size : Number(snapshot.has(id))),
          get: (id: string) => request(() => snapshot.get(id)),
          getAll: (_query?: unknown, limit?: number) => request(() => { assert.equal(limit, L.storedSkills); state.getAllLimits.push(limit!); return [...snapshot.values()].slice(0, limit); }),
          add: (record: any) => request(() => { state.writes++; if (snapshot.has(record.id)) throw new DOMException("Duplicate", "ConstraintError"); snapshot.set(record.id, clone(record)); return record.id; }, () => state.afterAdd?.()),
          put: (record: any) => request(() => { state.writes++; snapshot.set(record.id, clone(record)); return record.id; }),
        });
        // Serialize overlapping transactions as IndexedDB does, including across connections.
        waiting.push(() => {
          active = true;
          if (finished) { release(); return; }
          running.add(tx); snapshot = clone(state.records);
          for (const operation of operations) operation();
          finish();
        });
        advance(); return tx;
      },
    };
    state.connections.push(db); return db;
  }
  const factory = { open(name: string, version: number) { state.opened.push([name, version]); const req: any = { result: connection() }; queueMicrotask(() => req.onsuccess?.()); return req; } } as unknown as IDBFactory;
  return { state, factory };
}
describe("IndexedDB adapter event/transaction contracts (synthetic factory)", () => {
  it("is lazy, uses only a dedicated DB and waits for transaction completion", async () => {
    const { state, factory } = idbHarness(), store = createIndexedDbSkillStore(factory); assert.equal(state.opened.length, 0);
    await store.add({ id: "a" }); assert.equal(state.commits, 1); assert.deepEqual(state.opened, [["cavwic-browser-imported-skills", 1]]);
    assert.deepEqual(await store.get("a"), { id: "a" }); assert.equal((await store.all()).length, 1);
  });
  it("rolls back a late quota abort after add request success", async () => {
    const { state, factory } = idbHarness(), store = createIndexedDbSkillStore(factory); state.abortCommit = true;
    await assert.rejects(store.add({ id: "a" }), code("STORAGE_QUOTA")); assert.equal(state.records.size, 0); assert.equal(state.commits, 0);
  });
  it("checks compare-and-swap in the same write transaction", async () => {
    const { state, factory } = idbHarness(), store = createIndexedDbSkillStore(factory); await store.add({ id: "a" });
    await assert.rejects(store.compareAndSwap("a", "wrong", { id: "a" }), code("CONTENT_CHANGED")); assert.deepEqual(state.records.get("a"), { id: "a" });
    await store.compareAndSwap("a", JSON.stringify({ id: "a" }), { id: "a", enabled: true } as any); assert.deepEqual(state.records.get("a"), { id: "a", enabled: true });
  });
  it("maps duplicate constraints without committing a partial write", async () => {
    const { state, factory } = idbHarness(), store = createIndexedDbSkillStore(factory); await store.add({ id: "a" });
    await assert.rejects(store.add({ id: "a" }), code("ALREADY_EXISTS")); assert.equal(state.commits, 1); assert.equal(state.records.size, 1);
  });
  it("invalidates abnormal-close caches and ignores a stale old-connection event", async () => {
    const { state, factory } = idbHarness(), store = createIndexedDbSkillStore(factory);
    await store.add({ id: "a" }); const old = state.connections[0]; old.forceClose();
    assert.deepEqual(await store.get("a"), { id: "a" }); assert.equal(state.opened.length, 2);
    old.onclose();
    assert.deepEqual(await store.get("a"), { id: "a" }); assert.equal(state.opened.length, 2);
  });
  it("still closes and invalidates on versionchange", async () => {
    const { state, factory } = idbHarness(), store = createIndexedDbSkillStore(factory);
    await store.add({ id: "a" }); state.connections[0].onversionchange();
    assert.equal(state.connections[0].closed, true);
    assert.deepEqual(await store.get("a"), { id: "a" }); assert.equal(state.opened.length, 2);
  });
  it("reopens once when a silent close prevents transaction creation", async () => {
    const { state, factory } = idbHarness(), store = createIndexedDbSkillStore(factory);
    await store.all(); state.invalidTransactions = 1;
    await store.add({ id: "a" });
    assert.equal(state.opened.length, 2); assert.equal(state.writes, 1); assert.equal(state.commits, 1);
  });
  it("bounds reopen retries and leaves the next operation able to recover", async () => {
    const { state, factory } = idbHarness(), store = createIndexedDbSkillStore(factory); state.invalidTransactions = 2;
    await assert.rejects(store.add({ id: "a" }), code("STORAGE_FAILED"));
    assert.equal(state.opened.length, 2); assert.equal(state.writes, 0);
    await store.add({ id: "a" }); assert.equal(state.opened.length, 3); assert.equal(state.commits, 1);
  });
  it("never replays an already-started write after abnormal close", async () => {
    const { state, factory } = idbHarness(), store = createIndexedDbSkillStore(factory);
    state.afterAdd = () => state.connections[0].forceClose();
    await assert.rejects(store.add({ id: "a" }), code("STORAGE_FAILED"));
    assert.equal(state.opened.length, 1); assert.equal(state.writes, 1); assert.equal(state.records.size, 0);
    state.afterAdd = undefined;
    assert.deepEqual(await store.all(), []); assert.equal(state.opened.length, 2);
  });
  it("checks legacy over-capacity stores before cloning any records and never deletes them", async () => {
    const { state, factory } = idbHarness(), store = createIndexedDbSkillStore(factory);
    for (let n = 0; n <= L.storedSkills; n++) state.records.set(`skill-${n}`, { id: `skill-${n}` });
    const before = clone(state.records);
    await assert.rejects(store.all(), code("STORAGE_CAPACITY"));
    await assert.rejects(store.add({ id: "new" }), code("STORAGE_CAPACITY"));
    assert.deepEqual(state.getAllLimits, []); assert.deepEqual(state.records, before); assert.equal(state.writes, 0);
    assert.deepEqual(await store.get("skill-64"), { id: "skill-64" });
  });
  it("enumerates at most 64 records and enforces capacity atomically across connections", async () => {
    const { state, factory } = idbHarness();
    for (let n = 0; n < L.storedSkills - 1; n++) state.records.set(`skill-${n}`, { id: `skill-${n}` });
    const first = createIndexedDbSkillStore(factory), second = createIndexedDbSkillStore(factory);
    const result = await Promise.allSettled([first.add({ id: "last" }), second.add({ id: "overflow" })]);
    assert.equal(result.filter(item => item.status === "fulfilled").length, 1);
    code("STORAGE_CAPACITY")((result.find(item => item.status === "rejected") as PromiseRejectedResult).reason);
    assert.equal(state.records.size, L.storedSkills); assert.equal(state.commits, 1);
    assert.equal((await first.all()).length, L.storedSkills); assert.deepEqual(state.getAllLimits, [L.storedSkills]);
    const before = clone(state.records);
    await assert.rejects(second.add({ id: "last" }), code("ALREADY_EXISTS")); assert.deepEqual(state.records, before);
  });
});

const sha = (letter: string) => letter.repeat(40);
const gitHash = (data: Uint8Array) => createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex");
type Route = Response | (() => Response | Promise<Response>);
function http(routes: Map<string, Route>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetcher: typeof fetch = async (url, init) => {
    const address = String(url); calls.push({ url: address, init: init || {} });
    const route = routes.get(address); assert.ok(route, `Unexpected mock URL: ${address}`);
    return typeof route === "function" ? route() : route;
  };
  return { calls, fetcher };
}
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
function githubFixture(extra: Record<string, string> = {}) {
  const api = "https://api.github.com/repos/owner/repo", revision = sha("a"), root = sha("b"), subtree = sha("c");
  const files = { "SKILL.md": text(), "references/facts.md": "Facts", "scripts/inert.txt": "Not model context", ...extra };
  const routes = new Map<string, Route>([
    [`${api}/commits/main`, json({ sha: revision, commit: { tree: { sha: root } } })],
    [`${api}/git/trees/${root}`, json({ sha: root, tree: [{ path: "demo", mode: "040000", type: "tree", sha: subtree }] })],
  ]);
  const tree = Object.entries(files).map(([path, value]) => { const data = bytes(value), hash = gitHash(data); routes.set(`${api}/git/blobs/${hash}`, () => json({ sha: hash, size: data.length, encoding: "base64", content: Buffer.from(data).toString("base64") })); return { path, mode: "100644", type: "blob", sha: hash, size: data.length }; });
  routes.set(`${api}/git/trees/${subtree}?recursive=1`, () => json({ sha: subtree, truncated: false, tree }));
  routes.set(`${api}/git/trees/${subtree}`, () => json({ sha: subtree, tree: [tree[0]] }));
  return { api, revision, root, subtree, tree, routes };
}
describe("GitHub-only URLs and anonymous bounded downloads", () => {
  for (const url of ["http://github.com/o/r/tree/main/demo", "https://user:pass@github.com/o/r/tree/main/demo", "https://github.com:443/o/r/tree/main/demo", "https://github.com:444/o/r/tree/main/demo", "https://github.com/o/r/tree/main/demo#x", "https://github.com/o/r/tree/main/demo?token=secret", "https://localhost/a", "https://127.0.0.1/a", "https://[::1]/a", "https://github.com.evil.test/o/r/tree/main/demo", "https://github.com/o/r/tree/main/%2e%2e/secret", "https://github.com/o/r/tree/main/a%2fb", "https://api.github.com/repos/o/r", "https://github.com/o/r/tree/main", "https://github.com/o/r/blob/main/README.md"]) it(`rejects ${url}`, () => assert.throws(() => parseGithubSkillUrl(url), BrowserSkillError));
  it("accepts only explicit directory, SKILL.md and archive forms", () => {
    assert.equal(parseGithubSkillUrl("https://github.com/o/r/tree/main/demo").kind, "directory");
    assert.equal(parseGithubSkillUrl("https://github.com/o/r/blob/main/demo/SKILL.md").kind, "file");
    assert.equal(parseGithubSkillUrl("https://raw.githubusercontent.com/o/r/main/demo/SKILL.md").kind, "file");
    assert.equal(parseGithubSkillUrl("https://github.com/o/r/archive/refs/heads/main.zip").kind, "zip");
    assert.equal(parseGithubSkillUrl("https://codeload.github.com/o/r/zip/refs/tags/v1").ref, "v1");
  });
  it("pins a commit and fetches only the selected subtree's immutable blobs", async () => {
    const fixture = githubFixture(), mock = http(fixture.routes), store = new MemoryStore();
    const api = createBrowserSkillsApi({ store, fetcher: mock.fetcher, now: clock });
    const imported = await api.installUrl({ url: "https://github.com/owner/repo/tree/main/demo" });
    assert.equal(imported.source.revision, fixture.revision); assert.equal(imported.enabled, false);
    assert.deepEqual((await api.read({ id: imported.id })).references, [{ path: "references/facts.md", text: "Facts" }]);
    for (const { url, init } of mock.calls) {
      assert.ok(url.startsWith("https://api.github.com/")); assert.equal(init.credentials, "omit"); assert.equal(init.redirect, "error"); assert.equal(init.referrerPolicy, "no-referrer"); assert.equal(init.cache, "no-store");
      assert.ok(!(init.headers as Record<string, string>).Authorization); assert.ok(!(init.headers as Record<string, string>).Cookie);
    }
    assert.ok(!mock.calls.some(call => call.url.includes("codeload") || call.url.includes("/contents/")));
  });
  it("accepts browser-decoded gzip and br bodies with encoded Content-Length headers", async () => {
    for (const encoding of ["gzip", "br"] as const) {
      const fixture = githubFixture();
      for (const [url, route] of fixture.routes) fixture.routes.set(url, async () => {
        const response = typeof route === "function" ? await route() : route;
        const decoded = new Uint8Array(await response.arrayBuffer());
        const encoded = encoding === "gzip" ? gzipSync(decoded) : brotliCompressSync(decoded);
        return new Response(decoded.buffer, { headers: { "content-type": "application/json", "content-encoding": encoding, "content-length": String(encoded.length) } });
      });
      const mock = http(fixture.routes), api = createBrowserSkillsApi({ store: new MemoryStore(), fetcher: mock.fetcher, now: clock });
      const result = await api.installUrl({ url: "https://github.com/owner/repo/tree/main/demo" });
      assert.equal(result.source.revision, fixture.revision);
      assert.deepEqual((await api.read({ id: result.id })).references, [{ path: "references/facts.md", text: "Facts" }]);
    }
  });
  it("SKILL.md links fetch only that file, never an implicit repository ZIP", async () => {
    for (const url of ["https://github.com/owner/repo/blob/main/demo/SKILL.md", "https://raw.githubusercontent.com/owner/repo/main/demo/SKILL.md"]) {
      const fixture = githubFixture(), mock = http(fixture.routes), api = createBrowserSkillsApi({ store: new MemoryStore(), fetcher: mock.fetcher, now: clock });
      const result = await api.installUrl({ url }); assert.equal(result.fileCount, 1);
      assert.equal(mock.calls.filter(call => call.url.includes("/blobs/")).length, 1); assert.ok(!mock.calls.some(call => call.url.includes("recursive") || call.url.includes("/zip/")));
    }
  });
  it("translates an explicitly requested archive to a pinned codeload URL without following redirects", async () => {
    const fixture = githubFixture();
    fixture.routes.set(`${fixture.api}/git/ref/heads/main`, json({ object: { type: "commit", sha: fixture.revision } }));
    fixture.routes.set(`${fixture.api}/git/commits/${fixture.revision}`, json({ sha: fixture.revision, tree: { sha: fixture.root } }));
    fixture.routes.set(`https://codeload.github.com/owner/repo/zip/${fixture.revision}`, new Response((await zip({ "repo-hash/SKILL.md": text() })).slice().buffer));
    const mock = http(fixture.routes), api = createBrowserSkillsApi({ store: new MemoryStore(), fetcher: mock.fetcher, now: clock });
    const result = await api.installUrl({ url: "https://github.com/owner/repo/archive/refs/heads/main.zip" });
    assert.equal(result.source.revision, fixture.revision); assert.match(result.source.sha256!, /^[a-f0-9]{64}$/); assert.equal(mock.calls.length, 3);
    assert.ok(!mock.calls.some(call => call.url.endsWith("/commits/main")));
  });
  it("peels explicitly requested annotated tags before downloading an immutable archive", async () => {
    const fixture = githubFixture(), tag = sha("e");
    fixture.routes.set(`${fixture.api}/git/ref/tags/v1`, json({ object: { type: "tag", sha: tag } }));
    fixture.routes.set(`${fixture.api}/git/tags/${tag}`, json({ object: { type: "commit", sha: fixture.revision } }));
    fixture.routes.set(`${fixture.api}/git/commits/${fixture.revision}`, json({ sha: fixture.revision, tree: { sha: fixture.root } }));
    fixture.routes.set(`https://codeload.github.com/owner/repo/zip/${fixture.revision}`, new Response((await zip({ "root/SKILL.md": text() })).slice().buffer));
    const mock = http(fixture.routes);
    const result = await createBrowserSkillsApi({ store: new MemoryStore(), fetcher: mock.fetcher, now: clock }).installUrl({ url: "https://codeload.github.com/owner/repo/zip/refs/tags/v1" });
    assert.equal(result.source.revision, fixture.revision); assert.equal(mock.calls.length, 4);
  });
  it("rejects redirects, opaque responses, unexpected final URLs and non-public/not-found responses", async () => {
    for (const response of [new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }), Object.assign(new Response("x"), {}), new Response(null, { status: 404 })]) {
      if (response.status === 200) Object.defineProperty(response, "url", { value: "https://api.github.com/unexpected" });
      const mock = http(new Map([["https://api.github.com/repos/o/r/commits/main", response]])), store = new MemoryStore();
      await assert.rejects(createBrowserSkillsApi({ store, fetcher: mock.fetcher }).installUrl({ url: "https://github.com/o/r/tree/main/demo" }), BrowserSkillError); assert.equal(store.records.size, 0); assert.equal(mock.calls.length, 1);
    }
    const response = new Response("x"); Object.defineProperty(response, "type", { value: "opaqueredirect" });
    await assert.rejects(createBrowserSkillsApi({ store: new MemoryStore(), fetcher: http(new Map([["https://api.github.com/repos/o/r/commits/main", response]])).fetcher }).installUrl({ url: "https://github.com/o/r/tree/main/demo" }), code("NETWORK_BLOCKED"));
  });
  it("rejects truncated trees, symlinks/submodules, duplicate paths and malformed blob hashes", async () => {
    for (const change of [(fixture: ReturnType<typeof githubFixture>) => { fixture.routes.set(`${fixture.api}/git/trees/${fixture.subtree}?recursive=1`, json({ sha: fixture.subtree, truncated: true, tree: fixture.tree })); }, (fixture: ReturnType<typeof githubFixture>) => { fixture.tree[1].mode = "120000"; }, (fixture: ReturnType<typeof githubFixture>) => { fixture.tree[1].mode = "160000"; fixture.tree[1].type = "commit"; }, (fixture: ReturnType<typeof githubFixture>) => { fixture.tree[1].path = "skill.MD"; }, (fixture: ReturnType<typeof githubFixture>) => { const item = fixture.tree[0]; fixture.routes.set(`${fixture.api}/git/blobs/${item.sha}`, json({ sha: item.sha, size: item.size, encoding: "base64", content: Buffer.alloc(item.size, 65).toString("base64") })); }]) {
      const fixture = githubFixture(); change(fixture); const store = new MemoryStore();
      await assert.rejects(createBrowserSkillsApi({ store, fetcher: http(fixture.routes).fetcher, now: clock }).installUrl({ url: "https://github.com/owner/repo/tree/main/demo" }), BrowserSkillError); assert.equal(store.records.size, 0);
    }
  });
  it("caps request count without ZIP fallback or partial installation", async () => {
    const extra: Record<string, string> = {}; for (let n = 0; n < 65; n++) extra[`references/${n}.md`] = String(n);
    const fixture = githubFixture(extra), mock = http(fixture.routes), store = new MemoryStore();
    await assert.rejects(createBrowserSkillsApi({ store, fetcher: mock.fetcher, now: clock }).installUrl({ url: "https://github.com/owner/repo/tree/main/demo" }), code("LIMIT_EXCEEDED")); assert.equal(mock.calls.length, 64); assert.equal(store.records.size, 0);
  });
  it("caps declared and streamed response bytes, cancelling over-limit streams", async () => {
    const url = "https://api.github.com/repos/o/r/commits/main";
    let cancelled = false;
    for (const response of [new Response("x", { headers: { "content-length": String(L.fileBytes + 1) } }), new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(L.fileBytes + 1)); }, cancel() { cancelled = true; } }))]) await assert.rejects(createBrowserSkillsApi({ store: new MemoryStore(), fetcher: http(new Map([[url, response]])).fetcher }).installUrl({ url: "https://github.com/o/r/tree/main/demo" }), code("LIMIT_EXCEEDED"));
    assert.equal(cancelled, true);
  });
  it("still caps both encoded declarations and decoded streams for compressed responses", async () => {
    const url = "https://api.github.com/repos/o/r/commits/main";
    const responses = [
      new Response("small", { headers: { "content-encoding": "gzip", "content-length": String(L.fileBytes + 1) } }),
      new Response(new Uint8Array(L.fileBytes + 1), { headers: { "content-encoding": "br", "content-length": "16" } }),
    ];
    for (const response of responses) await assert.rejects(createBrowserSkillsApi({ store: new MemoryStore(), fetcher: http(new Map([[url, response]])).fetcher }).installUrl({ url: "https://github.com/o/r/tree/main/demo" }), code("LIMIT_EXCEEDED"));
  });
  it("times out hung fetch and body reads even when a mock ignores AbortSignal", async () => {
    const hanging: typeof fetch = () => new Promise(() => {});
    await assert.rejects(createBrowserSkillsApi({ store: new MemoryStore(), fetcher: hanging, networkTimeoutMs: 10 }).installUrl({ url: "https://github.com/o/r/tree/main/demo" }), code("DOWNLOAD_TIMEOUT"));
    let cancelled = false;
    const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }));
    await assert.rejects(createBrowserSkillsApi({ store: new MemoryStore(), fetcher: http(new Map([["https://api.github.com/repos/o/r/commits/main", response]])).fetcher, networkTimeoutMs: 10 }).installUrl({ url: "https://github.com/o/r/tree/main/demo" }), code("DOWNLOAD_TIMEOUT")); assert.equal(cancelled, true);
  });
});
