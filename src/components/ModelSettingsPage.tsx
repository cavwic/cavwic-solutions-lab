import { ArrowLeft, Check, Cloud, Cpu, KeyRound, Languages, Moon, RotateCcw, Save, Sun, TerminalSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_MODEL_SETTINGS,
  readModelApiKey,
  readModelSettings,
  saveModelSettings,
  type ModelProvider,
  type ModelSettings,
} from "../lib/model-settings";
import { hasBrowserCallableModel, readModelActionReturnState } from "../lib/model-action";
import type { Locale } from "../lib/workspace-schema";

const copy = {
  zh: {
    eyebrow: "全局执行方式 / 当前浏览器",
    title: "模型配置",
    summary: "统一控制售前、招标要求、技术标和交底模块的分析与文件生成方式。",
    back: "返回工作台",
    current: "当前执行方式",
    saved: "配置已保存。",
    reset: "已恢复 Codex 工作流。",
    directRequired: "当前执行方式不能由网页直接调用。请选择本机或内网接口，或云模型 / API，并填写接口地址和模型名称。",
    save: "保存配置",
    resetAction: "恢复默认",
    codex: "Codex 工作流",
    local: "本机或内网接口",
    cloud: "云模型 / API",
    codexTitle: "使用当前 Codex 套餐",
    codexBody: "网站负责整理项目、资料和执行任务；Codex 在你授权的项目目录内完成分析、文档生成和项目清单更新。无需填写模型地址或 API Key。",
    codexBoundary: "公开静态网站不能直接调用你的个人 Codex 套餐，也不会自动启动 Codex。点击大模型功能后选择“否，输出任务”，再选择保存位置并在 Codex 中执行该任务。",
    localTitle: "连接兼容 Chat Completions 的本机或内网接口",
    localBody: "适用于你自行部署或公司提供的兼容接口。地址和模型名只保存在当前浏览器，不预设任何本地模型软件。",
    cloudTitle: "由使用者提供云模型接口",
    cloudBody: "适用于允许浏览器直接访问的兼容接口。不要把共享密钥写入网站代码；每位使用者应配置自己的地址、模型和密钥。",
    endpoint: "Chat Completions 接口地址",
    model: "模型名称",
    apiKey: "API Key（仅当前浏览器会话）",
    apiHint: "密钥写入 sessionStorage，不进入项目文件或静态构建。接口仍需允许浏览器跨域访问。",
    flowTitle: "Codex 使用流程",
    flow: ["在工作台选择项目路径", "整理资料并生成 Codex 任务", "在 Codex 中执行项目目录里的任务文件", "进入“输出与 Skills”点击重新扫描"],
    docs: "查看 OpenAI 的 Codex 套餐说明",
    switchDark: "切换到深色模式",
    switchLight: "切换到浅色模式",
  },
  en: {
    eyebrow: "GLOBAL EXECUTION / THIS BROWSER",
    title: "Model configuration",
    summary: "Set one analysis and file-generation method for presales, tender review, bid preparation, and handover.",
    back: "Back to workbench",
    current: "Current execution method",
    saved: "Configuration saved.",
    reset: "Codex workflow restored.",
    directRequired: "This execution method cannot be called directly by the site. Choose a local, intranet, or cloud API and enter both the endpoint and model name.",
    save: "Save configuration",
    resetAction: "Restore default",
    codex: "Codex workflow",
    local: "Local or intranet endpoint",
    cloud: "Cloud model / API",
    codexTitle: "Use your current Codex plan",
    codexBody: "The site organizes the project, sources, and execution task. Codex analyzes the material, creates files, and updates the manifest inside the folder you authorize. No endpoint or API key is required.",
    codexBoundary: "A public static site cannot directly consume your personal Codex plan or start Codex. Choose “No, output task” after selecting a model action, choose where to save it, then run the task in Codex.",
    localTitle: "Connect a local or intranet Chat Completions endpoint",
    localBody: "Use an endpoint deployed by you or your organization. The address and model name stay in this browser, and no local model software is preconfigured.",
    cloudTitle: "Use a cloud endpoint supplied by each user",
    cloudBody: "Use a compatible endpoint that permits browser requests. Never bundle a shared secret in the site; each user configures their own endpoint, model, and key.",
    endpoint: "Chat Completions endpoint",
    model: "Model name",
    apiKey: "API key (current browser session only)",
    apiHint: "The key is kept in sessionStorage and never enters project files or the static build. The endpoint must still allow cross-origin browser requests.",
    flowTitle: "Codex workflow",
    flow: ["Choose a project folder in the workbench", "Organize sources and create a Codex task", "Run the task file from the project folder in Codex", "Open Outputs and Skills, then select Rescan"],
    docs: "Read OpenAI's Codex plan guidance",
    switchDark: "Switch to dark mode",
    switchLight: "Switch to light mode",
  },
} as const;

function SettingField({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={wide ? "field wide" : "field"}><span>{label}</span>{children}</label>;
}

export default function ModelSettingsPage() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [settings, setSettings] = useState<ModelSettings>(DEFAULT_MODEL_SETTINGS);
  const [apiKey, setApiKey] = useState("");
  const [notice, setNotice] = useState("");
  const t = copy[locale];
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const requestedReturn = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("return") || "";
  const returnHref = requestedReturn.startsWith("/") && !requestedReturn.startsWith("//") ? requestedReturn : `${base}/`;

  useEffect(() => {
    const storedLocale = localStorage.getItem("cavwic-lab-locale");
    const nextLocale: Locale = storedLocale === "zh" || storedLocale === "en" ? storedLocale : navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    const storedTheme = localStorage.getItem("cavwic-lab-theme");
    const nextTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setLocale(nextLocale);
    setTheme(nextTheme);
    setSettings(readModelSettings());
    setApiKey(readModelApiKey());
    document.documentElement.dataset.locale = nextLocale;
    document.documentElement.lang = nextLocale === "zh" ? "zh-CN" : "en";
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  const providerName = useMemo(() => t[settings.provider], [settings.provider, t]);

  const switchLocale = () => {
    const next = locale === "zh" ? "en" : "zh";
    setLocale(next);
    localStorage.setItem("cavwic-lab-locale", next);
    document.documentElement.dataset.locale = next;
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
    window.dispatchEvent(new CustomEvent("cavwic-locale-change", { detail: next }));
  };

  const switchTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("cavwic-lab-theme", next);
    document.documentElement.dataset.theme = next;
  };

  const save = () => {
    const pendingAction = readModelActionReturnState();
    if (requestedReturn && pendingAction?.returnPath === returnHref && !hasBrowserCallableModel(settings)) {
      setNotice(t.directRequired);
      return;
    }
    saveModelSettings(settings, apiKey);
    setNotice(t.saved);
    if (requestedReturn) window.location.href = returnHref;
  };

  const reset = () => {
    setSettings(DEFAULT_MODEL_SETTINGS);
    setApiKey("");
    saveModelSettings(DEFAULT_MODEL_SETTINGS, "");
    setNotice(t.reset);
  };

  const setProvider = (provider: ModelProvider) => setSettings((current) => ({ ...current, provider }));

  return <div className="settings-app">
    <header className="settings-hero">
      <div><p>{t.eyebrow}</p><h1>{t.title}</h1><span>{t.summary}</span></div>
      <div className="settings-page-actions">
        <a className="command-button" href={returnHref}><ArrowLeft size={17}/>{t.back}</a>
        <button className="icon-command" type="button" aria-label={theme === "light" ? t.switchDark : t.switchLight} title={theme === "light" ? t.switchDark : t.switchLight} onClick={switchTheme}>{theme === "light" ? <Moon size={18}/> : <Sun size={18}/>}</button>
        <button className="command-button language-command" type="button" aria-label={locale === "zh" ? "Switch to English" : "切换到中文"} onClick={switchLocale}><Languages size={17}/><span>{locale === "zh" ? "EN" : "中"}</span></button>
      </div>
    </header>

    <section className="settings-current" aria-live="polite">
      <span>{t.current}</span><strong>{providerName}</strong><p>{notice}</p>
    </section>

    <section className="settings-provider-section">
      <div className="settings-provider-tabs" role="group" aria-label={t.current}>
        <button type="button" className={settings.provider === "codex" ? "active" : ""} onClick={() => setProvider("codex")}><TerminalSquare size={19}/><span>{t.codex}</span></button>
        <button type="button" className={settings.provider === "local" ? "active" : ""} onClick={() => setProvider("local")}><Cpu size={19}/><span>{t.local}</span></button>
        <button type="button" className={settings.provider === "cloud" ? "active" : ""} onClick={() => setProvider("cloud")}><Cloud size={19}/><span>{t.cloud}</span></button>
      </div>

      {settings.provider === "codex" && <div className="settings-mode" data-provider="codex">
        <div className="settings-mode-copy"><p>CODEX / TASK WORKFLOW</p><h2>{t.codexTitle}</h2><span>{t.codexBody}</span><aside>{t.codexBoundary} <a href="https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan" target="_blank" rel="noreferrer">{t.docs}</a></aside></div>
        <div className="settings-flow"><strong>{t.flowTitle}</strong><ol>{t.flow.map((item) => <li key={item}><Check size={16}/><span>{item}</span></li>)}</ol></div>
      </div>}

      {settings.provider === "local" && <div className="settings-mode" data-provider="local">
        <div className="settings-mode-copy"><p>COMPATIBLE ENDPOINT / LOCAL NETWORK</p><h2>{t.localTitle}</h2><span>{t.localBody}</span></div>
        <div className="settings-fields">
          <SettingField label={t.endpoint}><input placeholder="http://127.0.0.1:PORT/v1/chat/completions" value={settings.localEndpoint} onChange={(event) => setSettings((current) => ({ ...current, localEndpoint: event.target.value }))}/></SettingField>
          <SettingField label={t.model}><input value={settings.localModel} onChange={(event) => setSettings((current) => ({ ...current, localModel: event.target.value }))}/></SettingField>
          <SettingField label={t.apiKey} wide><div className="key-input"><KeyRound size={17}/><input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)}/></div><small>{t.apiHint}</small></SettingField>
        </div>
      </div>}

      {settings.provider === "cloud" && <div className="settings-mode" data-provider="cloud">
        <div className="settings-mode-copy"><p>CLOUD ENDPOINT / USER SUPPLIED</p><h2>{t.cloudTitle}</h2><span>{t.cloudBody}</span></div>
        <div className="settings-fields">
          <SettingField label={t.endpoint}><input placeholder="https://.../v1/chat/completions" value={settings.cloudEndpoint} onChange={(event) => setSettings((current) => ({ ...current, cloudEndpoint: event.target.value }))}/></SettingField>
          <SettingField label={t.model}><input value={settings.cloudModel} onChange={(event) => setSettings((current) => ({ ...current, cloudModel: event.target.value }))}/></SettingField>
          <SettingField label={t.apiKey} wide><div className="key-input"><KeyRound size={17}/><input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)}/></div><small>{t.apiHint}</small></SettingField>
        </div>
      </div>}
    </section>

    <footer className="settings-footer">
      <button className="command-button" type="button" onClick={reset}><RotateCcw size={17}/>{t.resetAction}</button>
      <button className="settings-save" type="button" onClick={save}><Save size={18}/>{t.save}</button>
    </footer>
  </div>;
}
