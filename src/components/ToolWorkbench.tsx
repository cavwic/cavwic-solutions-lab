import {
  AlertTriangle,
  Check,
  ChevronRight,
  FileDown,
  FileJson,
  Languages,
  Plus,
  Printer,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createInitialState, sampleState, toolConfigs, toolStateSchema, type Locale, type ToolKind, type ToolState } from "../lib/model";
import { calculateScore, scoreBand, toMarkdown } from "../lib/scoring";

type Props = { kind: ToolKind };

const copy = {
  zh: {
    local: "仅在本地浏览器运行，不上传输入数据",
    autosaved: "已自动保存",
    sample: "载入示例",
    reset: "重置",
    import: "导入 JSON",
    json: "导出 JSON",
    markdown: "导出 Markdown",
    print: "打印 / PDF",
    project: "项目与边界",
    projectName: "项目 / 候选名称",
    owner: "责任角色",
    objective: "业务目标或目标任务",
    constraints: "约束与不可承诺项",
    scoring: "资格评分",
    score: "证据评分",
    weight: "权重",
    unknown: "字段未知",
    note: "核验说明",
    risk: "风险登记",
    customRisk: "新增风险",
    add: "添加",
    acceptance: "验收矩阵",
    metric: "指标",
    target: "目标",
    evidence: "证据与复测方式",
    notes: "评审备注",
    summary: "决策摘要",
    readiness: "资格得分",
    completeness: "证据完整度",
    unknownCount: "未知项",
    sensitivity: "权重敏感性",
    formula: "加权得分 - 每个未知项 4 分；权重敏感性按单项上下浮动 20% 计算。",
    disclaimer: "决策辅助，不是行业标准。进入真实项目仍需正式询证、样机测试和责任方签字。",
    invalid: "导入文件格式不符合当前工具结构。",
  },
  en: {
    local: "Runs only in this browser; inputs are not uploaded",
    autosaved: "Autosaved",
    sample: "Load sample",
    reset: "Reset",
    import: "Import JSON",
    json: "Export JSON",
    markdown: "Export Markdown",
    print: "Print / PDF",
    project: "Project and boundary",
    projectName: "Project / candidate name",
    owner: "Responsible roles",
    objective: "Business objective or target task",
    constraints: "Constraints and non-commitments",
    scoring: "Qualification scoring",
    score: "Evidence score",
    weight: "Weight",
    unknown: "Unknown field",
    note: "Verification note",
    risk: "Risk register",
    customRisk: "Add a risk",
    add: "Add",
    acceptance: "Acceptance matrix",
    metric: "Metric",
    target: "Target",
    evidence: "Evidence and rerun method",
    notes: "Review notes",
    summary: "Decision summary",
    readiness: "Qualification score",
    completeness: "Evidence completeness",
    unknownCount: "Unknowns",
    sensitivity: "Weight sensitivity",
    formula: "Weighted score minus 4 points per unknown; sensitivity moves one weight by +/-20%.",
    disclaimer: "Decision aid only, not an industry standard. Real projects still require formal verification, physical tests, and accountable sign-off.",
    invalid: "The imported file does not match this tool's schema.",
  },
} as const;

function downloadFile(name: string, content: string, type: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function ToolWorkbench({ kind }: Props) {
  const config = toolConfigs[kind];
  const [locale, setLocale] = useState<Locale>("zh");
  const [state, setState] = useState<ToolState>(() => createInitialState(kind));
  const [ready, setReady] = useState(false);
  const [customRisk, setCustomRisk] = useState("");
  const [notice, setNotice] = useState("");
  const loaded = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = copy[locale];
  const score = useMemo(() => calculateScore(state), [state]);

  useEffect(() => {
    const systemLocale: Locale = navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    const savedLocale = localStorage.getItem("cavwic-lab-locale");
    setLocale(savedLocale === "zh" || savedLocale === "en" ? savedLocale : systemLocale);
    const saved = localStorage.getItem(`cavwic-lab-${kind}`);
    if (saved) {
      const parsed = toolStateSchema.safeParse(JSON.parse(saved));
      if (parsed.success && parsed.data.kind === kind) setState(parsed.data);
    }
    loaded.current = true;
    setReady(true);
  }, [kind]);

  useEffect(() => {
    if (!loaded.current) return;
    const handle = window.setTimeout(() => {
      localStorage.setItem(`cavwic-lab-${kind}`, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
      setNotice(t.autosaved);
      window.setTimeout(() => setNotice(""), 1200);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [state, kind, t.autosaved]);

  const update = <K extends keyof ToolState>(key: K, value: ToolState[K]) => setState((current) => ({ ...current, [key]: value, updatedAt: new Date().toISOString() }));
  const updateCriterion = (index: number, patch: Partial<ToolState["criteria"][number]>) => update("criteria", state.criteria.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const updateAcceptance = (index: number, key: "metric" | "target" | "evidence", value: string) => update("acceptance", state.acceptance.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  const toggleRisk = (risk: string) => update("risks", state.risks.includes(risk) ? state.risks.filter((item) => item !== risk) : [...state.risks, risk]);

  const switchLocale = () => {
    const next = locale === "zh" ? "en" : "zh";
    localStorage.setItem("cavwic-lab-locale", next);
    setLocale(next);
  };

  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = toolStateSchema.parse(JSON.parse(await file.text()));
      if (parsed.kind !== kind) throw new Error("kind mismatch");
      setState(parsed);
    } catch {
      setNotice(t.invalid);
    }
  };

  return (
    <div className="workbench" data-tool={kind} data-ready={ready ? "true" : "false"}>
      <header className="tool-hero">
        <div>
          <p className="tool-code">{config.code} / LOCAL FIRST</p>
          <h1>{config.title[locale]}</h1>
          <p>{config.description[locale]}</p>
        </div>
        <div className="score-dial" aria-label={`${t.readiness}: ${score.score}`}>
          <strong>{score.score}</strong><span>/ 100</span>
        </div>
      </header>

      <div className="privacy-line"><ShieldCheck size={17} /><span>{t.local}</span><span className="save-state" aria-live="polite">{notice}</span></div>

      <nav className="tool-actions" aria-label="Tool actions">
        <button type="button" disabled={!ready} onClick={() => setState(sampleState(kind))} title={t.sample}><Sparkles size={18}/><span>{t.sample}</span></button>
        <button type="button" disabled={!ready} onClick={() => setState(createInitialState(kind))} title={t.reset}><RotateCcw size={18}/><span>{t.reset}</span></button>
        <button type="button" disabled={!ready} onClick={() => inputRef.current?.click()} title={t.import}><Upload size={18}/><span>{t.import}</span></button>
        <input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={(event) => void importJson(event.target.files?.[0])}/>
        <button type="button" disabled={!ready} onClick={() => downloadFile(`${kind}-poc.json`, JSON.stringify(state, null, 2), "application/json")} title={t.json}><FileJson size={18}/><span>{t.json}</span></button>
        <button type="button" disabled={!ready} onClick={() => downloadFile(`${kind}-poc.md`, toMarkdown(state, locale), "text/markdown;charset=utf-8")} title={t.markdown}><FileDown size={18}/><span>{t.markdown}</span></button>
        <button type="button" disabled={!ready} onClick={() => window.print()} title={t.print}><Printer size={18}/><span>{t.print}</span></button>
        <button className="language-action" type="button" onClick={switchLocale} title={locale === "zh" ? "Switch to English" : "切换到中文"}><Languages size={18}/><span>{locale === "zh" ? "EN" : "中"}</span></button>
      </nav>

      <div className="workbench-grid">
        <main className="editor-column">
          <section className="tool-section">
            <div className="section-title"><span>01</span><div><p>CONTEXT</p><h2>{t.project}</h2></div></div>
            <div className="field-grid">
              <label><span>{t.projectName}</span><input value={state.project} onChange={(event) => update("project", event.target.value)}/></label>
              <label><span>{t.owner}</span><input value={state.owner} onChange={(event) => update("owner", event.target.value)}/></label>
              <label className="wide"><span>{t.objective}</span><textarea rows={3} value={state.objective} onChange={(event) => update("objective", event.target.value)}/></label>
              <label className="wide"><span>{t.constraints}</span><textarea rows={3} value={state.constraints} onChange={(event) => update("constraints", event.target.value)}/></label>
            </div>
          </section>

          <section className="tool-section">
            <div className="section-title"><span>02</span><div><p>QUALIFICATION</p><h2>{t.scoring}</h2></div></div>
            <div className="criteria-head"><span></span><span>{t.score}</span><span>{t.weight}</span><span>{t.unknown}</span></div>
            <div className="criteria-list">
              {state.criteria.map((criterion, index) => {
                const definition = config.criteria.find((item) => item.id === criterion.id)!;
                return <div className="criterion-row" key={criterion.id}>
                  <div className="criterion-label"><h3>{definition.label[locale]}</h3><p>{definition.hint[locale]}</p></div>
                  <div className="range-field"><input aria-label={`${definition.label[locale]} ${t.score}`} type="range" min="0" max="100" value={criterion.score} onChange={(event) => updateCriterion(index, { score: Number(event.target.value) })}/><output>{criterion.score}</output></div>
                  <label className="weight-field"><input aria-label={`${definition.label[locale]} ${t.weight}`} type="number" min="0" max="100" value={criterion.weight} onChange={(event) => updateCriterion(index, { weight: Number(event.target.value) })}/><span>%</span></label>
                  <label className="unknown-field"><input type="checkbox" checked={criterion.unknown} onChange={(event) => updateCriterion(index, { unknown: event.target.checked })}/><span><Check size={15}/></span></label>
                  <label className="criterion-note"><span className="sr-only">{t.note}</span><input placeholder={t.note} value={criterion.note} onChange={(event) => updateCriterion(index, { note: event.target.value })}/></label>
                </div>;
              })}
            </div>
          </section>

          <section className="tool-section split-section">
            <div>
              <div className="section-title"><span>03</span><div><p>RISK</p><h2>{t.risk}</h2></div></div>
              <div className="risk-list">{config.defaultRisks[locale].map((risk) => <label key={risk}><input type="checkbox" checked={state.risks.includes(risk)} onChange={() => toggleRisk(risk)}/><span><Check size={15}/></span><em>{risk}</em></label>)}</div>
              <div className="add-line"><input value={customRisk} placeholder={t.customRisk} onChange={(event) => setCustomRisk(event.target.value)}/><button type="button" aria-label={t.add} title={t.add} onClick={() => { if (customRisk.trim()) { update("risks", [...state.risks, customRisk.trim()]); setCustomRisk(""); } }}><Plus size={18}/></button></div>
              {state.risks.filter((risk) => !config.defaultRisks[locale].includes(risk)).map((risk) => <div className="custom-risk" key={risk}><AlertTriangle size={16}/><span>{risk}</span><button type="button" title="Remove" onClick={() => update("risks", state.risks.filter((item) => item !== risk))}><Trash2 size={16}/></button></div>)}
            </div>
            <label className="notes-field"><span>{t.notes}</span><textarea rows={10} value={state.notes} onChange={(event) => update("notes", event.target.value)}/></label>
          </section>

          <section className="tool-section">
            <div className="section-title"><span>04</span><div><p>ACCEPTANCE</p><h2>{t.acceptance}</h2></div></div>
            <div className="acceptance-table">
              <div className="acceptance-head"><span>{t.metric}</span><span>{t.target}</span><span>{t.evidence}</span><span></span></div>
              {state.acceptance.map((item, index) => <div className="acceptance-row" key={index}>
                <input aria-label={t.metric} value={item.metric} onChange={(event) => updateAcceptance(index, "metric", event.target.value)}/>
                <input aria-label={t.target} value={item.target} onChange={(event) => updateAcceptance(index, "target", event.target.value)}/>
                <input aria-label={t.evidence} value={item.evidence} onChange={(event) => updateAcceptance(index, "evidence", event.target.value)}/>
                <button type="button" title="Remove" onClick={() => update("acceptance", state.acceptance.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16}/></button>
              </div>)}
            </div>
            <button className="add-row" type="button" onClick={() => update("acceptance", [...state.acceptance, { metric: "", target: "", evidence: "" }])}><Plus size={17}/>{t.add}</button>
          </section>
        </main>

        <aside className="decision-panel">
          <p className="panel-code">DECISION / LIVE</p><h2>{t.summary}</h2>
          <div className="readiness"><strong>{score.score}</strong><span>/ 100</span></div>
          <p className="score-band">{scoreBand(score.score, locale)}</p>
          <dl><div><dt>{t.completeness}</dt><dd>{score.completeness}%</dd></div><div><dt>{t.unknownCount}</dt><dd>{score.unknownCount}</dd></div><div><dt>{t.sensitivity}</dt><dd>{score.sensitivity.low}–{score.sensitivity.high}</dd></div></dl>
          <div className="mini-bars">{state.criteria.map((item) => <div key={item.id}><span style={{ width: `${item.score}%` }}></span></div>)}</div>
          <p className="formula">{t.formula}</p>
          <p className="disclaimer"><AlertTriangle size={17}/>{t.disclaimer}</p>
          <a className="next-tool" href={kind === "ai" ? "/robot-poc" : kind === "robot" ? "/dexterous-hand" : "/ai-poc"}>{locale === "zh" ? "下一个工作台" : "Next workbench"}<ChevronRight size={17}/></a>
        </aside>
      </div>
    </div>
  );
}
