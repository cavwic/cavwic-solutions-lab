import { afterEach, describe, expect, it, vi } from "vitest";
import type { ModelChannel, ModelSettings, SubscriptionProtocol } from "./model-settings";
import { BROWSER_MODEL_LIMITS, readBrowserLocalModels, readBrowserPlanModels, requestBrowserModel, testBrowserModel } from "./browser-model";

const keys = { apiKey: "synthetic-cloud-secret", localApiKey: "synthetic-local-secret", subscriptionApiKey: "synthetic-plan-secret" };
const picture = "data:image/png;base64,YWJj";
const settings = (patch: Partial<ModelSettings> = {}): ModelSettings => ({
  schemaVersion: "3.0.0", provider: "local", localRuntime: "ollama", localProfiles: {},
  localEndpoint: "http://127.0.0.1:11434", localModel: "local-model:exact",
  cloudEndpoint: "https://api.example/v1/chat/completions", cloudModel: "cloud-exact",
  codexModel: "codex-exact", subscriptionProvider: "compatible", subscriptionVendor: "other",
  subscriptionProtocol: "openai", subscriptionEndpoint: "https://plan.example/v1", subscriptionModel: "plan-exact",
  enabledProviders: ["local", "codex", "cloud"], hybridRoutes: { analysis: "local", draft: "codex", ocr: "cloud" }, ...patch,
});
const json = (value: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(value), { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
const openai = (patch: Record<string, unknown> = {}) => ({ model: "resolved-exact", choices: [{ finish_reason: "stop", message: { content: "Complete text" } }], ...patch });
const ollama = (patch: Record<string, unknown> = {}) => ({ model: "resolved-exact", done: true, done_reason: "stop", message: { content: "Complete text" }, ...patch });
const anthropic = (patch: Record<string, unknown> = {}) => ({ model: "resolved-exact", stop_reason: "end_turn", content: [{ type: "text", text: "Complete text" }], ...patch });
const gemini = (patch: Record<string, unknown> = {}) => ({ modelVersion: "resolved-exact", candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Complete text" }] } }], ...patch });
const mock = (value: unknown = openai()) => vi.fn<typeof fetch>().mockImplementation(async () => json(value));
const outgoing = (fetcher: ReturnType<typeof mock>) => {
  const [url, init] = fetcher.mock.calls[0];
  return { url: String(url), init: init!, headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : undefined };
};
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("browser local protocols", () => {
  it.each([
    ["http://127.0.0.1:11434", "http://127.0.0.1:11434/api/chat"],
    ["http://localhost:11434/prefix/api/tags/", "http://localhost:11434/prefix/api/chat"],
    ["http://[::1]:11434/prefix/v1/chat/completions", "http://[::1]:11434/prefix/api/chat"],
  ])("normalizes Ollama %s and uses only its local key", async (localEndpoint, expected) => {
    const fetcher = mock(ollama());
    const result = await requestBrowserModel({ settings: settings({ localEndpoint }), ...keys, prompt: "Synthetic source", task: "ocr", images: [picture] }, fetcher);
    const request = outgoing(fetcher);
    expect(request.url).toBe(expected);
    expect(request.headers.get("Authorization")).toBe(`Bearer ${keys.localApiKey}`);
    expect(JSON.stringify(request)).not.toContain(keys.apiKey);
    expect(JSON.stringify(request)).not.toContain(keys.subscriptionApiKey);
    expect(request.body).toMatchObject({ model: "local-model:exact", stream: false, think: false, options: { temperature: 0 } });
    expect(request.body.messages[1]).toEqual({ role: "user", content: "Synthetic source", images: ["YWJj"] });
    expect(result).toEqual({ content: "Complete text", model: "resolved-exact", provider: "local" });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each(["lmstudio", "openai"] as const)("normalizes %s and builds multimodal Chat Completions", async localRuntime => {
    const fetcher = mock();
    await requestBrowserModel({ settings: settings({ localRuntime, localEndpoint: "http://localhost:1234/proxy/v1/models" }), ...keys, prompt: "Synthetic", images: [picture] }, fetcher);
    const request = outgoing(fetcher);
    expect(request.url).toBe("http://localhost:1234/proxy/v1/chat/completions");
    expect(request.body.messages[1].content).toEqual([{ type: "text", text: "Synthetic" }, { type: "image_url", image_url: { url: picture } }]);
    expect(request.body.temperature).toBe(0.2);
  });
  it("does not infer Ollama from a legacy port and never borrows the cloud key", async () => {
    const fetcher = mock();
    await requestBrowserModel({ settings: settings({ localRuntime: undefined }), apiKey: keys.apiKey, prompt: "Synthetic" }, fetcher);
    expect(outgoing(fetcher).url).toBe("http://127.0.0.1:11434/v1/chat/completions");
    expect(outgoing(fetcher).headers.has("Authorization")).toBe(false);
  });
  it.each(["ollama", "lmstudio", "openai"] as const)("reads %s catalog with GET only and no invented selection", async localRuntime => {
    const fetcher = mock(localRuntime === "ollama" ? { models: [{ name: "one:latest" }, { model: "one:latest" }, { model: "two" }, null] } : { data: [{ id: "one:latest" }, { id: "one:latest" }, { id: "two" }, {}] });
    const candidate = settings({ localRuntime });
    const result = await readBrowserLocalModels(candidate, keys.localApiKey, fetcher);
    expect(result.models).toEqual([{ model: "one:latest", displayName: "one:latest" }, { model: "two", displayName: "two" }]);
    expect(result.endpoint.endsWith(localRuntime === "ollama" ? "/api/tags" : "/v1/models")).toBe(true);
    expect(outgoing(fetcher).init.method).toBe("GET");
    expect(outgoing(fetcher).init.body).toBeUndefined();
    expect(outgoing(fetcher).headers.get("Authorization")).toBe(`Bearer ${keys.localApiKey}`);
    expect(candidate.localModel).toBe("local-model:exact");
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("allows empty directories without inventing a model", async () => {
    expect((await readBrowserLocalModels(settings(), "", mock({ models: [] }))).models).toEqual([]);
    await expect(readBrowserLocalModels(settings(), "", mock({ models: {} }))).rejects.toMatchObject({ code: "MODEL_RESPONSE_INVALID" });
  });
});

describe("browser cloud and authorized plan protocols", () => {
  it("preserves the explicit API endpoint, uses only cloud credentials, and isolates OCR temperature", async () => {
    const fetcher = mock();
    await requestBrowserModel({ settings: settings({ provider: "cloud" }), ...keys, prompt: "Synthetic", task: "ocr", images: [picture] }, fetcher);
    const request = outgoing(fetcher);
    expect(request.url).toBe("https://api.example/v1/chat/completions");
    expect(request.headers.get("Authorization")).toBe(`Bearer ${keys.apiKey}`);
    expect(request.body.model).toBe("cloud-exact");
    expect(request.body.temperature).toBe(0);
    expect(JSON.stringify(request)).not.toContain(keys.localApiKey);
    expect(JSON.stringify(request)).not.toContain(keys.subscriptionApiKey);
  });
  it.each(["openai", "anthropic", "gemini"] as const)("converts %s text/images with only the plan credential", async subscriptionProtocol => {
    const responses = { openai: openai(), anthropic: anthropic(), gemini: gemini() };
    const fetcher = mock(responses[subscriptionProtocol]);
    const result = await requestBrowserModel({ settings: settings({ provider: "codex", subscriptionProtocol }), ...keys, prompt: "Synthetic", images: [picture] }, fetcher);
    const request = outgoing(fetcher);
    expect(JSON.stringify(request)).not.toContain(keys.apiKey);
    expect(JSON.stringify(request)).not.toContain(keys.localApiKey);
    expect(result).toEqual({ content: "Complete text", model: "resolved-exact", provider: "codex" });
    if (subscriptionProtocol === "openai") {
      expect(request.url).toBe("https://plan.example/v1/chat/completions");
      expect(request.headers.get("Authorization")).toBe(`Bearer ${keys.subscriptionApiKey}`);
      expect(request.body.messages[1].content[1]).toEqual({ type: "image_url", image_url: { url: picture } });
    } else if (subscriptionProtocol === "anthropic") {
      expect(request.url).toBe("https://plan.example/v1/messages");
      expect(request.headers.has("Authorization")).toBe(false);
      expect(request.headers.get("x-api-key")).toBe(keys.subscriptionApiKey);
      expect(request.headers.get("anthropic-version")).toBe("2023-06-01");
      expect(request.body).toMatchObject({ max_tokens: 8192, stream: false });
      expect(request.body.messages[0].content[1]).toEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: "YWJj" } });
    } else {
      expect(request.url).toBe("https://plan.example/v1/models/plan-exact:generateContent");
      expect(request.headers.has("Authorization")).toBe(false);
      expect(request.headers.get("x-goog-api-key")).toBe(keys.subscriptionApiKey);
      expect(request.body.contents[0].parts[1]).toEqual({ inlineData: { mimeType: "image/png", data: "YWJj" } });
    }
    expect(JSON.stringify(request.body)).not.toMatch(/"tools"|"tool_choice"/);
  });
  it.each([
    ["openai", "https://plan.example/v1/chat/completions", "https://plan.example/v1/chat/completions"],
    ["anthropic", "https://plan.example/anthropic", "https://plan.example/anthropic/v1/messages"],
    ["gemini", "https://plan.example/v1beta/models/old:generateContent", "https://plan.example/v1beta/models/new:generateContent"],
    ["gemini", "https://plan.example/v1beta/models", "https://plan.example/v1beta/models/new:generateContent"],
  ])("preserves/normalizes complete %s endpoints", async (protocol, endpoint, expected) => {
    const values = { openai: openai(), anthropic: anthropic(), gemini: gemini() };
    const fetcher = mock(values[protocol as SubscriptionProtocol]);
    await requestBrowserModel({ settings: settings({ provider: "codex", subscriptionProtocol: protocol as SubscriptionProtocol, subscriptionEndpoint: endpoint, subscriptionModel: "models/new" }), ...keys, prompt: "Synthetic" }, fetcher);
    expect(outgoing(fetcher).url).toBe(expected);
  });
  it("sends MiniMax's verified OpenAI option only to an official domain", async () => {
    const fetcher = mock();
    const candidate = settings({ provider: "codex", subscriptionProvider: "minimax", subscriptionEndpoint: "https://api.minimax.cn/v1" });
    await requestBrowserModel({ settings: candidate, ...keys, prompt: "Synthetic" }, fetcher);
    expect(outgoing(fetcher).body.reasoning_split).toBe(true);
    await expect(requestBrowserModel({ settings: { ...candidate, subscriptionEndpoint: "https://api.minimax.cn.evil.example/v1" }, ...keys, prompt: "Synthetic" }, fetcher)).rejects.toMatchObject({ code: "SUBSCRIPTION_ENDPOINT_INVALID" });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("adds Anthropic's browser opt-in only to its official endpoint", async () => {
    const fetcher = mock(anthropic());
    await requestBrowserModel({ settings: settings({ provider: "codex", subscriptionProtocol: "anthropic", subscriptionEndpoint: "https://api.anthropic.com/v1" }), ...keys, prompt: "Synthetic" }, fetcher);
    expect(outgoing(fetcher).headers.get("anthropic-dangerous-direct-browser-access")).toBe("true");
    const compatible = mock(anthropic());
    await requestBrowserModel({ settings: settings({ provider: "codex", subscriptionProtocol: "anthropic", subscriptionEndpoint: "https://plan.example/v1" }), ...keys, prompt: "Synthetic" }, compatible);
    expect(outgoing(compatible).headers.has("anthropic-dangerous-direct-browser-access")).toBe(false);
  });
  it("returns an honest manual plan directory without inference or entitlement guesses", async () => {
    const fetcher = mock();
    expect(await readBrowserPlanModels(settings(), keys.subscriptionApiKey, fetcher)).toEqual({ models: [], defaultModel: "", manualRequired: true });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("routing, native Codex and connectivity tests", () => {
  it("refuses true Codex sign-in before chat, catalog or test requests", async () => {
    const fetcher = mock();
    const candidate = settings({ provider: "codex", subscriptionProvider: "codex" });
    await expect(requestBrowserModel({ settings: candidate, ...keys, prompt: "Synthetic" }, fetcher)).rejects.toMatchObject({ code: "CODEX_DESKTOP_REQUIRED" });
    await expect(readBrowserPlanModels(candidate, "", fetcher)).rejects.toMatchObject({ code: "CODEX_DESKTOP_REQUIRED" });
    await expect(testBrowserModel(candidate, keys, "codex", fetcher)).rejects.toMatchObject({ code: "CODEX_DESKTOP_REQUIRED" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["analysis", "draft", "ocr"] as const)("dispatches hybrid %s exactly once to its configured destination", async task => {
    const fetcher = mock(task === "analysis" ? ollama() : openai());
    const result = await requestBrowserModel({ settings: settings({ provider: "hybrid" }), ...keys, task, prompt: "Synthetic" }, fetcher);
    expect(result.provider).toBe({ analysis: "local", draft: "codex", ocr: "cloud" }[task]);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("does not retry a failed local call through the configured API or plan", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => json({ error: "Synthetic failure" }, { status: 503 }));
    await expect(requestBrowserModel({ settings: settings({ provider: "hybrid" }), ...keys, task: "analysis", prompt: "Synthetic" }, fetcher)).rejects.toMatchObject({ code: "MODEL_REQUEST_FAILED" });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0][0])).toContain("127.0.0.1");
  });
  it("rejects disabled or invalid routes and disabled tests without network traffic", async () => {
    const fetcher = mock();
    const candidate = settings({ provider: "hybrid", enabledProviders: ["local"] });
    await expect(requestBrowserModel({ settings: candidate, prompt: "Synthetic" }, fetcher)).rejects.toMatchObject({ code: "MODEL_ROUTE_DISABLED" });
    await expect(testBrowserModel(candidate, keys, "cloud", fetcher)).rejects.toMatchObject({ code: "MODEL_CHANNEL_DISABLED" });
    await expect(requestBrowserModel({ settings: candidate, task: "bad" as never, prompt: "Synthetic" }, fetcher)).rejects.toMatchObject({ code: "MODEL_SETTINGS_INVALID" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["local", "cloud", "codex"] as ModelChannel[])("tests only %s and returns actual completed model identity", async provider => {
    const fetcher = mock(provider === "local" ? ollama() : openai());
    expect(await testBrowserModel(settings(), keys, provider, fetcher)).toEqual({ provider, model: "resolved-exact", verified: true });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(JSON.stringify(outgoing(fetcher).body)).toContain("BID_READY");
  });
  it("never marks a truncated connectivity response as verified", async () => {
    await expect(testBrowserModel(settings(), keys, "cloud", mock(openai({ choices: [{ finish_reason: "length", message: { content: "BID_READY" } }] })))).rejects.toMatchObject({ code: "MODEL_RESPONSE_INVALID" });
  });
});

describe("finished text only", () => {
  const cases: [string, Partial<ModelSettings>, unknown][] = [
    ["OpenAI length", { provider: "cloud" }, openai({ choices: [{ finish_reason: "length", message: { content: "Partial" } }] })],
    ["OpenAI missing finish", { provider: "cloud" }, openai({ choices: [{ message: { content: "Partial" } }] })],
    ["OpenAI tool calls", { provider: "cloud" }, openai({ choices: [{ finish_reason: "stop", message: { content: "Text", tool_calls: [{}] } }] })],
    ["OpenAI function call", { provider: "cloud" }, openai({ choices: [{ finish_reason: "stop", message: { content: "Text", function_call: {} } }] })],
    ["OpenAI refusal", { provider: "cloud" }, openai({ choices: [{ finish_reason: "stop", message: { content: "Text", refusal: "blocked" } }] })],
    ["Ollama unfinished", {}, ollama({ done: false })],
    ["Ollama length", {}, ollama({ done_reason: "length" })],
    ["Ollama thinking only", {}, ollama({ message: { thinking: "Private thoughts", content: "" } })],
    ["Anthropic max tokens", { provider: "codex", subscriptionProtocol: "anthropic" }, anthropic({ stop_reason: "max_tokens" })],
    ["Anthropic tools", { provider: "codex", subscriptionProtocol: "anthropic" }, anthropic({ content: [{ type: "text", text: "Text" }, { type: "tool_use" }] })],
    ["Anthropic thinking only", { provider: "codex", subscriptionProtocol: "anthropic" }, anthropic({ content: [{ type: "thinking", thinking: "Private" }] })],
    ["Gemini truncated", { provider: "codex", subscriptionProtocol: "gemini" }, gemini({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "Partial" }] } }] })],
    ["Gemini blocked", { provider: "codex", subscriptionProtocol: "gemini" }, gemini({ promptFeedback: { blockReason: "SAFETY" } })],
    ["Gemini tools", { provider: "codex", subscriptionProtocol: "gemini" }, gemini({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Text" }, { functionCall: {} }] } }] })],
    ["Gemini code", { provider: "codex", subscriptionProtocol: "gemini" }, gemini({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Text", executableCode: {} }] } }] })],
    ["Gemini thinking only", { provider: "codex", subscriptionProtocol: "gemini" }, gemini({ candidates: [{ finishReason: "STOP", content: { parts: [{ thought: true, text: "Private" }] } }] })],
    ["provider error", { provider: "cloud" }, openai({ error: { message: "Do not expose" } })],
    ["MiniMax error", { provider: "cloud" }, openai({ base_resp: { status_code: 1004 } })],
    ["bad identity", { provider: "cloud" }, openai({ model: "invalid model\n" })],
    ["non-object", { provider: "cloud" }, []],
    ["null", { provider: "cloud" }, null],
  ];
  it.each(cases)("rejects %s", async (_name, patch, payload) => {
    await expect(requestBrowserModel({ settings: settings(patch), ...keys, prompt: "Synthetic" }, mock(payload))).rejects.toThrow();
  });
  it.each(["<think>private</think>", "<think>unfinished", "<think>private</think> <think>unfinished"])("never reports thought-only or unfinished thought markup as text", async content => {
    await expect(requestBrowserModel({ settings: settings({ provider: "cloud" }), prompt: "Synthetic" }, mock(openai({ choices: [{ finish_reason: "stop", message: { content } }] })))).rejects.toThrow();
  });
  it("strips completed thinking and records resolved aliases without retrying", async () => {
    const fetcher = mock(openai({ choices: [{ finish_reason: "stop", message: { content: "<think>private</think> Final text", reasoning_content: "private" } }] }));
    const result = await requestBrowserModel({ settings: settings({ provider: "cloud" }), prompt: "Synthetic" }, fetcher);
    expect(result).toEqual({ content: "Final text", model: "resolved-exact", provider: "cloud" });
    expect(outgoing(fetcher).body.model).toBe("cloud-exact");
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each([
    ["anthropic", anthropic({ content: [{ type: "thinking", thinking: "Private" }, { type: "text", text: "Final text" }] })],
    ["gemini", gemini({ candidates: [{ finishReason: "STOP", content: { parts: [{ thought: true, text: "Private" }, { text: "Final text" }] } }] })],
  ])("excludes structured %s thoughts", async (protocol, payload) => {
    const result = await requestBrowserModel({ settings: settings({ provider: "codex", subscriptionProtocol: protocol as SubscriptionProtocol }), ...keys, prompt: "Synthetic" }, mock(payload));
    expect(result.content).toBe("Final text");
  });
});

describe("request boundaries and transport", () => {
  it.each([
    "http://public.example/v1", "http://localhost.evil.example/v1", "http://127.0.0.1.evil.example/v1", "ftp://127.0.0.1/v1", "file:///private", "javascript:alert(1)",
    "https://user:password@api.example/v1", "https://@api.example/v1", "https://api.example/v1?key=secret", "https://api.example/v1?", "https://api.example/v1#", "https://api.example/v1#fragment", "https://api.example/white space", "https://api.example\\evil", "https://api.example/\u0000",
  ])("rejects unsafe endpoint %s before fetch", async cloudEndpoint => {
    const fetcher = mock();
    await expect(requestBrowserModel({ settings: settings({ provider: "cloud", cloudEndpoint }), ...keys, prompt: "Synthetic" }, fetcher)).rejects.toMatchObject({ code: "MODEL_ENDPOINT_INVALID" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["http://10.0.0.1/v1/chat/completions", "http://192.168.1.2/v1/chat/completions", "http://172.16.0.1/v1/chat/completions", "http://[::1]/v1/chat/completions"])("allows explicit local HTTP %s", async cloudEndpoint => {
    const fetcher = mock();
    await requestBrowserModel({ settings: settings({ provider: "cloud", cloudEndpoint }), prompt: "Synthetic" }, fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each(["https://coding.dashscope.aliyuncs.com/v1", "https://api.kimi.com/coding/v1", "https://open.bigmodel.cn/api/coding/paas/v4"])("preserves custom-client restrictions for %s", async subscriptionEndpoint => {
    const fetcher = mock();
    await expect(requestBrowserModel({ settings: settings({ provider: "codex", subscriptionEndpoint }), ...keys, prompt: "Synthetic" }, fetcher)).rejects.toMatchObject({ code: "SUBSCRIPTION_ENDPOINT_UNSUPPORTED" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects invalid selected credentials and missing plan keys without borrowing other keys", async () => {
    const fetcher = mock();
    for (const localApiKey of ["bad\r\nheader", "bad\0header", "x".repeat(16385)]) {
      await expect(requestBrowserModel({ settings: settings(), prompt: "Synthetic", localApiKey }, fetcher)).rejects.toMatchObject({ code: "MODEL_KEY_INVALID" });
    }
    await expect(requestBrowserModel({ settings: settings({ provider: "codex" }), apiKey: keys.apiKey, localApiKey: keys.localApiKey, prompt: "Synthetic" }, fetcher)).rejects.toMatchObject({ code: "MODEL_KEY_INVALID" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["https://image.example/private.png", "data:text/plain;base64,YWJj", "data:image/png;base64,***=", "data:image/png;base64,YQ=", "data:image/png;base64,=AAA"])("rejects non-inline or invalid image %s", async image => {
    const fetcher = mock();
    await expect(requestBrowserModel({ settings: settings(), prompt: "Synthetic", images: [image] }, fetcher)).rejects.toMatchObject({ code: "MODEL_IMAGE_INVALID" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects oversized source, image count, image bytes and combined request bytes before fetch", async () => {
    const fetcher = mock();
    await expect(requestBrowserModel({ settings: settings(), prompt: "x".repeat(BROWSER_MODEL_LIMITS.promptBytes + 1) }, fetcher)).rejects.toMatchObject({ code: "MODEL_INPUT_INVALID" });
    await expect(requestBrowserModel({ settings: settings(), prompt: "Synthetic", images: Array(11).fill(picture) }, fetcher)).rejects.toMatchObject({ code: "MODEL_IMAGE_INVALID" });
    const oversized = `data:image/png;base64,${"A".repeat(Math.ceil((BROWSER_MODEL_LIMITS.imageBytes + 3) / 3) * 4)}`;
    await expect(requestBrowserModel({ settings: settings(), prompt: "Synthetic", images: [oversized] }, fetcher)).rejects.toThrow();
    const large = `data:image/png;base64,${"A".repeat(12 * 1024 * 1024)}`;
    await expect(requestBrowserModel({ settings: settings(), prompt: "Synthetic", images: Array(6).fill(large) }, fetcher)).rejects.toMatchObject({ code: "MODEL_REQUEST_TOO_LARGE" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("omits cookies/referrers, refuses redirects and applies an abort signal", async () => {
    const fetcher = mock();
    await requestBrowserModel({ settings: settings({ provider: "cloud" }), prompt: "Synthetic" }, fetcher);
    expect(outgoing(fetcher).init).toMatchObject({ redirect: "error", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", mode: "cors" });
    expect(outgoing(fetcher).init.signal).toBeInstanceOf(AbortSignal);
    const redirected = json(openai()); Object.defineProperty(redirected, "redirected", { value: true });
    const redirectFetch = vi.fn<typeof fetch>().mockResolvedValue(redirected);
    await expect(requestBrowserModel({ settings: settings({ provider: "cloud" }), ...keys, prompt: "Synthetic" }, redirectFetch)).rejects.toMatchObject({ code: "MODEL_REDIRECT_FORBIDDEN" });
    expect(redirectFetch).toHaveBeenCalledOnce();
  });
  it("bounds a stalled fetch even when a mock ignores abort", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
    const pending = requestBrowserModel({ settings: settings(), prompt: "Synthetic" }, fetcher);
    const assertion = expect(pending).rejects.toMatchObject({ code: "MODEL_REQUEST_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(BROWSER_MODEL_LIMITS.chatTimeoutMs);
    await assertion;
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
  it("times out and cancels stalled catalog response bodies", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { headers: { "Content-Type": "application/json" } }));
    const assertion = expect(readBrowserLocalModels(settings(), "", fetcher)).rejects.toMatchObject({ code: "MODEL_REQUEST_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(BROWSER_MODEL_LIMITS.catalogTimeoutMs);
    await assertion;
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("enforces streamed response bytes, not just Content-Length", async () => {
    const cancel = vi.fn();
    const block = new Uint8Array(1024 * 1024).fill(32);
    const body = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(block); }, cancel });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { headers: { "Content-Type": "application/json" } }));
    await expect(requestBrowserModel({ settings: settings(), prompt: "Synthetic" }, fetcher)).rejects.toMatchObject({ code: "MODEL_RESPONSE_TOO_LARGE" });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("rejects declared oversize, malformed JSON, UTF-8 and non-JSON formats", async () => {
    const responses = [
      new Response("{}", { headers: { "Content-Type": "application/json", "Content-Length": String(BROWSER_MODEL_LIMITS.responseBytes + 1) } }),
      new Response("{broken", { headers: { "Content-Type": "application/json" } }),
      new Response(new Uint8Array([0xc3, 0x28]), { headers: { "Content-Type": "application/json" } }),
      new Response("event: content", { headers: { "Content-Type": "text/event-stream" } }),
    ];
    for (const response of responses) {
      await expect(requestBrowserModel({ settings: settings(), prompt: "Synthetic" }, vi.fn<typeof fetch>().mockResolvedValue(response))).rejects.toThrow();
    }
  });
  it("sanitizes network diagnostics, including forged error codes", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(Object.assign(new Error(`Failure ${keys.apiKey}`), { code: "MODEL_FORGED" }));
    await expect(requestBrowserModel({ settings: settings(), prompt: "Synthetic" }, fetcher)).rejects.toMatchObject({ code: "MODEL_CONNECTION_FAILED", message: "MODEL_CONNECTION_FAILED" });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("requires no storage, desktop bridge, runtime settings reads or skill injection", async () => {
    const forbidden = () => { throw new Error("Unexpected application state access"); };
    vi.stubGlobal("localStorage", new Proxy({}, { get: forbidden }));
    vi.stubGlobal("sessionStorage", new Proxy({}, { get: forbidden }));
    vi.stubGlobal("window", new Proxy({}, { get: forbidden }));
    const fetcher = mock();
    await requestBrowserModel({ settings: settings({ provider: "cloud" }), prompt: "Caller-owned context" }, fetcher);
    expect(outgoing(fetcher).body.messages[1].content).toBe("Caller-owned context");
  });
});
