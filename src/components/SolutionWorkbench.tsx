import {
  AlertTriangle,
  Archive,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  FileCheck2,
  FileInput,
  FileImage,
  FileOutput,
  FileSearch,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Languages,
  Moon,
  PackageCheck,
  Plus,
  Presentation,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildBidFilePrompt,
  buildCodexBidFileTask,
} from "../lib/bid-generation";
import {
  buildProjectArchive,
  downloadBlob,
  presentationMarkdown,
  projectFileStem,
  projectToCsv,
  projectToDocx,
  projectToMarkdown,
  projectToPptx,
  projectToXlsx,
} from "../lib/exporters";
import { hasReadableSourceText, parseSourceFile } from "../lib/parsers";
import {
  buildCodexCustomerAnalysisTask,
  buildCodexPresalesTask,
  buildCustomerNeedsAnalysisPrompt,
  buildPresalesPrompt,
  analysisResultBaseName,
  createGeneratedFile,
  getActionResponseTarget,
  requestPresalesDraft,
  templateFileFormat,
  type ResponseFileFormat,
} from "../lib/presales-generation";
import {
  readModelApiKey,
  readModelSettings,
} from "../lib/model-settings";
import {
  consumeModelActionReturnState,
  hasBrowserCallableModel,
  saveModelActionReturnState,
  type ModelActionReturnState,
  type WorkspaceView,
} from "../lib/model-action";
import {
  chooseWorkspaceDirectory,
  chooseTaskOutputDirectory,
  clearPersistedSourceFiles,
  importProjectArchive,
  loadActiveProject,
  loadSourceFilesFromDirectory,
  persistWorkspaceDirectory,
  persistSourceFiles,
  readGeneratedFileFromDirectory,
  readWorkspaceFileFromRelativePath,
  removeWorkspaceFileFromRelativePath,
  removePersistedSourceFile,
  restoreSourceFiles,
  restoreWorkspaceDirectory,
  saveGeneratedFileToDirectory,
  saveAnalysisFileToDirectory,
  saveTaskFileToDirectory,
  saveProjectStateToDirectory,
  saveProjectToDirectory,
  supportsDirectoryAccess,
  type DirectoryHandleLike,
} from "../lib/workspace-io";
import {
  buildCodexOcrTask,
  buildCodexTenderTask,
  buildTenderAnalysisPrompt,
  buildTenderComparisonPrompt,
  createTenderGeneratedFile,
  extractTenderStructuredData,
  requestOcrRecognition,
  tenderTemplateFileFormat,
} from "../lib/tender-generation";
import {
  createRequirement,
  inferProjectStage,
  localizeBuiltInProject,
  requirementCoverage,
  syncProjectStage,
  validateProject,
} from "../lib/workflow";
import {
  createEmptyProject,
  createId,
  createPresalesRound,
  projectManifestSchema,
  type Locale,
  type PresalesGeneratedFile,
  type PresalesAnalysisResult,
  type PresalesParticipant,
  type PresalesRound,
  type PresalesRoundAction,
  type ProjectManifest,
  type BidFileChecklistItem,
  type SourceDocument,
  type TenderAnalysisResult,
  type BidGeneratedFile,
  type TenderOutputFormat,
} from "../lib/workspace-schema";

type View = WorkspaceView;
type Props = { initialView?: View };
type ModelInvocation = { settings: ReturnType<typeof readModelSettings>; apiKey: string };
type PendingModelAction =
  | { kind: "customer-analysis"; roundId: string; anchorId: string }
  | { kind: "response-files"; roundId: string; actionIds: string[]; anchorId: string }
  | { kind: "tender-ocr"; sourceIds: string[]; anchorId: string }
  | { kind: "tender-analysis"; anchorId: string }
  | { kind: "tender-comparison"; anchorId: string }
  | { kind: "bid-output"; bidFileId: string; anchorId: string };

const copy = {
  zh: {
    local: "资料只在当前浏览器和您授权的本地目录中处理",
    project: "解决方案项目工作台",
    projectContext: "项目与边界",
    presales: "售前准备",
    requirements: "招标",
    bid: "投标",
    handover: "中标交底",
    outputs: "输出与 Skills",
    reset: "新建项目",
    projectPath: "项目路径",
    projectName: "项目名称",
    customer: "客户代称",
    industry: "行业",
    owner: "项目责任人",
    budget: "预算信息",
    deadline: "计划截止日期",
    objective: "业务目标",
    constraints: "约束与不可承诺项",
    presalesPack: "售前清单包",
    actions: "会后执行清单",
    add: "新增",
    sourceLibrary: "招标文件",
    importSources: "导入文件",
    noSource: "导入招标书及相关文件",
    sourceSegments: "来源片段",
    addRequirement: "加入要求",
    requirementReview: "要求复核队列",
    baselineDiff: "售前与招标差异",
    commitments: "承诺基线",
    handoverList: "技术交底与项目协同",
    audit: "发布前检查",
    directory: "选择工作区目录",
    sync: "写入目录",
    rescan: "重新扫描",
    importZip: "导入项目 ZIP",
    exportZip: "导出完整 ZIP",
    includeSources: "在 ZIP 中包含原始来源文件",
    taskPrompt: "生成 Skill 执行任务",
    copyTask: "复制任务",
    skillDownloads: "Skills 下载",
    skillHint: "网页不会自动启动 Codex。复制任务后，在 Codex 中调用对应 Skill，再回到这里重新扫描项目。",
    noIssues: "当前没有阻断问题。",
    pending: "待批准",
    evidenced: "已绑定证据",
    approved: "已批准",
    total: "招标要求",
    saved: "已保存到浏览器",
    folderSaved: "项目及正式输出已写入本地工作区。",
    projectPathSaved: "项目已保存到所选路径。",
    loaded: "已载入项目。",
    invalid: "文件结构无法识别，请检查项目版本或文件类型。",
    parsing: "正在解析来源文件",
    noRequirement: "选择一条要求查看并编辑响应、偏离和证据。",
    ocr: "该 PDF 几乎没有可提取文字，请先完成 OCR，再导入识别结果。",
    workspaceEyebrow: "解决方案工作区 / 本地处理",
    projectEyebrow: "项目 / 边界",
    meetingEyebrow: "沟通前 / 客户会议",
    followupEyebrow: "会后跟进",
    sourceEyebrow: "来源 / 追溯",
    sourceOnlyEyebrow: "来源",
    reviewEyebrow: "复核队列",
    baselineEyebrow: "基线 / 变更",
    commitmentEyebrow: "承诺基线",
    handoverEyebrow: "交底 / 交付",
    localWorkspaceEyebrow: "本地工作区",
    formalOutputsEyebrow: "正式输出",
    codexEyebrow: "CODEX / 本地 SKILL",
    downloadsEyebrow: "下载 / V1.0.0",
    qualityEyebrow: "质量检查",
    darkMode: "切换到深色模式",
    lightMode: "切换到浅色模式",
    remove: "删除",
    ready: "已就绪",
  },
  en: {
    local: "Files stay in this browser and the local folder you authorize",
    project: "Solution Project Workbench",
    projectContext: "Project and boundary",
    presales: "Presales",
    requirements: "Tender",
    bid: "Bid",
    handover: "Award handover",
    outputs: "Outputs and Skills",
    reset: "New project",
    projectPath: "Project folder",
    projectName: "Project name",
    customer: "Customer alias",
    industry: "Industry",
    owner: "Project owner",
    budget: "Budget information",
    deadline: "Target deadline",
    objective: "Business objective",
    constraints: "Constraints and non-commitments",
    presalesPack: "Presales pack",
    actions: "Follow-up actions",
    add: "Add",
    sourceLibrary: "Tender files",
    importSources: "Import files",
    noSource: "Import the tender and related files.",
    sourceSegments: "Source segments",
    addRequirement: "Add requirement",
    requirementReview: "Requirement review queue",
    baselineDiff: "Presales and tender differences",
    commitments: "Commitment baseline",
    handoverList: "Technical handover and project actions",
    audit: "Pre-release checks",
    directory: "Choose workspace folder",
    sync: "Write to folder",
    rescan: "Rescan",
    importZip: "Import project ZIP",
    exportZip: "Export complete ZIP",
    includeSources: "Include original sources in ZIP",
    taskPrompt: "Create Skill task",
    copyTask: "Copy task",
    skillDownloads: "Skill downloads",
    skillHint: "The site does not start Codex. Copy a task, run the matching Skill in Codex, then rescan the project here.",
    noIssues: "No blocking issues found.",
    pending: "Pending approval",
    evidenced: "With evidence",
    approved: "Approved",
    total: "Tender requirements",
    saved: "Saved in browser",
    folderSaved: "Project and formal outputs were written to the local workspace.",
    projectPathSaved: "Project saved to the selected folder.",
    loaded: "Project loaded.",
    invalid: "The file structure is not supported. Check its project version or file type.",
    parsing: "Parsing source files",
    noRequirement: "Select a requirement to edit its response, deviation, and evidence.",
    ocr: "This PDF contains almost no selectable text. Run OCR and import the recognized text.",
    workspaceEyebrow: "SOLUTION WORKSPACE / LOCAL FIRST",
    projectEyebrow: "PROJECT / BOUNDARY",
    meetingEyebrow: "PRE-CALL / CUSTOMER MEETING",
    followupEyebrow: "FOLLOW-UP",
    sourceEyebrow: "SOURCE / TRACEABILITY",
    sourceOnlyEyebrow: "SOURCE",
    reviewEyebrow: "REVIEW QUEUE",
    baselineEyebrow: "BASELINE / CHANGE",
    commitmentEyebrow: "COMMITMENT BASELINE",
    handoverEyebrow: "HANDOVER / DELIVERY",
    localWorkspaceEyebrow: "LOCAL WORKSPACE",
    formalOutputsEyebrow: "FORMAL OUTPUTS",
    codexEyebrow: "CODEX / LOCAL SKILL",
    downloadsEyebrow: "DOWNLOADS / V1.0.0",
    qualityEyebrow: "QUALITY GATE",
    darkMode: "Switch to dark mode",
    lightMode: "Switch to light mode",
    remove: "Remove",
    ready: "Ready",
  },
} as const;

const viewMeta: Array<{ id: View; icon: typeof BriefcaseBusiness; code: string }> = [
  { id: "presales", icon: BriefcaseBusiness, code: "01" },
  { id: "requirements", icon: FileSearch, code: "02" },
  { id: "bid", icon: PackageCheck, code: "03" },
];

const responseLabels = {
  zh: { confirmed: "已证实满足", conditional: "条件满足", custom: "需定制", missing_evidence: "缺少证据", unsupported: "不满足" },
  en: { confirmed: "Confirmed", conditional: "Conditional", custom: "Customization required", missing_evidence: "Evidence missing", unsupported: "Unsupported" },
} as const;
const actionStatusLabels = {
  zh: { open: "待处理", working: "进行中", blocked: "受阻", done: "已完成" },
  en: { open: "Open", working: "Working", blocked: "Blocked", done: "Done" },
} as const;
const projectStageLabels = {
  zh: { presales: "售前", tender: "投标", delivery: "交底" },
  en: { presales: "Presales", tender: "Tender", delivery: "Handover" },
} as const;
const diffRelationLabels = {
  zh: { added: "新增", changed: "已修改", unchanged: "未变化", removed: "已删除", conflict: "有冲突" },
  en: { added: "Added", changed: "Changed", unchanged: "Unchanged", removed: "Removed", conflict: "Conflict" },
} as const;
const issueAreaLabels = {
  zh: { project: "项目", source: "来源", requirement: "要求", evidence: "证据", action: "任务", deliverable: "交付物", section: "章节" },
  en: { project: "Project", source: "Source", requirement: "Requirement", evidence: "Evidence", action: "Action", deliverable: "Deliverable", section: "Section" },
} as const;
const preprocessStatusLabels = {
  zh: { uploaded: "已上传，等待预处理", ready: "上传并预处理完成", "needs-ocr": "存在无法识别内容", skipped: "仅上传，未处理", processing: "正在识别", failed: "识别失败" },
  en: { uploaded: "Uploaded, preprocessing pending", ready: "Uploaded and preprocessed", "needs-ocr": "Unrecognized content detected", skipped: "Uploaded only, not processed", processing: "Recognizing", failed: "Recognition failed" },
} as const;
const bidFileCategoryLabels = {
  zh: { technical: "技术文件", business: "商务文件", qualification: "资格文件", delivery: "交付与验收", other: "其他" },
  en: { technical: "Technical", business: "Business", qualification: "Qualification", delivery: "Delivery and acceptance", other: "Other" },
} as const;
const recommendedAnalysisKeywords = {
  zh: ["技术参数", "评标办法", "时间", "进度", "资质"],
  en: ["Technical parameters", "Evaluation method", "Schedule", "Progress", "Qualifications"],
} as const;
const participantCategoryLabels = {
  zh: { customer: "客户", "third-party": "第三方", internal: "公司内人员" },
  en: { customer: "Customer", "third-party": "Third party", internal: "Internal" },
} as const;

function selectedCustomerSourceIds(round: PresalesRound): string[] {
  return round.selectedRequirementSourceIds ?? round.requirementSourceIds;
}

function uniqueAnalysisResultName(baseName: string, results: PresalesAnalysisResult[]): string {
  if (!results.some((result) => result.name === baseName)) return baseName;
  let index = 2;
  while (results.some((result) => result.name === `${baseName}-${index}`)) index += 1;
  return `${baseName}-${index}`;
}

function safeDirectoryName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "").slice(0, 80);
}

function sourceIsReferenced(project: ProjectManifest, sourceId: string): boolean {
  return project.enterpriseContext.sourceIds.includes(sourceId)
    || project.tenderSourceIds.includes(sourceId)
    || project.tenderClarificationRounds.some((round) => round.sourceIds.includes(sourceId))
    || project.tenderAnalysis.templateSourceIds.includes(sourceId)
    || project.tenderAnalysis.results.some((result) => result.sourceId === sourceId || result.sourceIds.includes(sourceId) || result.templateSourceIds.includes(sourceId))
    || project.tenderComparison.selectedPresalesSourceIds.includes(sourceId)
    || project.tenderComparison.templateSourceIds.includes(sourceId)
    || project.tenderComparison.results.some((result) => result.sourceId === sourceId || result.sourceIds.includes(sourceId) || result.templateSourceIds.includes(sourceId))
    || project.bidFileChecklist.some((item) => item.templateSourceIds.includes(sourceId)
      || item.referenceSourceIds.includes(sourceId)
      || item.generatedFiles.some((file) => file.sourceId === sourceId || file.referenceSourceIds.includes(sourceId) || file.templateSourceIds.includes(sourceId)))
    || project.requirements.some((item) => item.sourceRef?.documentId === sourceId)
    || project.evidence.some((item) => item.sourceRef?.documentId === sourceId)
    || project.presalesRounds.some((round) => round.requirementSourceIds.includes(sourceId)
      || round.referenceSourceIds.includes(sourceId)
      || round.templateSourceIds.includes(sourceId)
      || round.actions.some((action) => action.templateSourceIds.includes(sourceId))
      || round.generatedFiles.some((file) => file.sourceId === sourceId)
      || round.analysisResults.some((result) => result.sourceId === sourceId || result.sourceIds.includes(sourceId) || result.templateSourceIds.includes(sourceId)));
}

function downloadText(name: string, content: string, type: string): void {
  downloadBlob(name, new Blob([content], { type }));
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={wide ? "field wide" : "field"}><span>{label}</span>{children}</label>;
}

export default function SolutionWorkbench({ initialView = "presales" }: Props) {
  const [locale, setLocale] = useState<Locale>("zh");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [view, setView] = useState<View>(initialView);
  const [project, setProject] = useState<ProjectManifest>(() => createEmptyProject("zh"));
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedRequirementId, setSelectedRequirementId] = useState("");
  const [directoryHandle, setDirectoryHandle] = useState<DirectoryHandleLike | null>(null);
  const [includeSources, setIncludeSources] = useState(false);
  const [taskKind, setTaskKind] = useState<"workflow" | "extract" | "bid">("workflow");
  const [sourceFiles, setSourceFiles] = useState<Map<string, File>>(new Map());
  const [generatedBlobs, setGeneratedBlobs] = useState<Map<string, Blob>>(new Map());
  const [generatingActionId, setGeneratingActionId] = useState("");
  const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(new Set());
  const [keywordDrafts, setKeywordDrafts] = useState<Record<string, string>>({});
  const [analyzingRoundId, setAnalyzingRoundId] = useState("");
  const [expandedAnalysisId, setExpandedAnalysisId] = useState("");
  const [expandedTenderSourceId, setExpandedTenderSourceId] = useState("");
  const [expandedTenderResultId, setExpandedTenderResultId] = useState("");
  const [expandedBidFileId, setExpandedBidFileId] = useState("");
  const [tenderKeywordDraft, setTenderKeywordDraft] = useState("");
  const [ocrChoiceSourceIds, setOcrChoiceSourceIds] = useState<string[] | null>(null);
  const [ocrProgress, setOcrProgress] = useState<Record<string, number>>({});
  const [resumeModelAction, setResumeModelAction] = useState<PendingModelAction | null>(null);
  const [filesHydrated, setFilesHydrated] = useState(false);
  const [participantDrafts, setParticipantDrafts] = useState<Record<string, { name: string; category: PresalesParticipant["category"] }>>({});
  const [returnState, setReturnState] = useState<ModelActionReturnState | null>(null);
  const [pendingModelAction, setPendingModelAction] = useState<PendingModelAction | null>(null);
  const sourceInput = useRef<HTMLInputElement>(null);
  const archiveInput = useRef<HTMLInputElement>(null);
  const modelChoicePrimary = useRef<HTMLButtonElement>(null);
  const t = copy[locale];
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const issues = useMemo(() => validateProject(project, locale), [project, locale]);
  const coverage = useMemo(() => requirementCoverage(project), [project]);
  const currentStage = useMemo(() => inferProjectStage(project), [project]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const storedLocale = localStorage.getItem("cavwic-lab-locale");
      const systemLocale: Locale = navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
      const nextLocale = storedLocale === "zh" || storedLocale === "en" ? storedLocale : systemLocale;
      const storedTheme = localStorage.getItem("cavwic-lab-theme");
      const nextTheme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      let nextProject = syncProjectStage(createEmptyProject(nextLocale));
      const stored = localStorage.getItem("cavwic-solution-workspace");
      if (stored) {
        const parsed = projectManifestSchema.safeParse(JSON.parse(stored));
        if (parsed.success) nextProject = syncProjectStage(localizeBuiltInProject(parsed.data, nextLocale));
      }
      const handle = await restoreWorkspaceDirectory().catch(() => null);
      const persistedFiles = await restoreSourceFiles(nextProject.id).catch(() => new Map<string, File>());
      if (handle) {
        const directoryFiles = await loadSourceFilesFromDirectory(handle, nextProject).catch(() => new Map<string, File>());
        for (const [id, file] of directoryFiles) if (!persistedFiles.has(id)) persistedFiles.set(id, file);
      }
      if (cancelled) return;
      setLocale(nextLocale);
      setTheme(nextTheme);
      setProject(nextProject);
      setSourceFiles(persistedFiles);
      setDirectoryHandle(handle);
      document.documentElement.dataset.locale = nextLocale;
      document.documentElement.lang = nextLocale === "zh" ? "zh-CN" : "en";
      document.documentElement.dataset.theme = nextTheme;
      const currentPath = `${window.location.pathname}${window.location.search}`;
      const pendingReturn = consumeModelActionReturnState(currentPath);
      if (pendingReturn) {
        setView(pendingReturn.view);
        setSelectedSourceId(pendingReturn.selectedSourceId);
        setSelectedRequirementId(pendingReturn.selectedRequirementId);
        setSelectedActionIds(new Set(pendingReturn.selectedActionIds));
        setExpandedAnalysisId(pendingReturn.expandedAnalysisId);
        setTaskKind(pendingReturn.taskKind);
        setReturnState(pendingReturn);
        if (pendingReturn.action === "tender-ocr") setResumeModelAction({ kind: "tender-ocr", sourceIds: pendingReturn.targetIds, anchorId: pendingReturn.anchorId });
        else if (pendingReturn.action === "tender-analysis") setResumeModelAction({ kind: "tender-analysis", anchorId: pendingReturn.anchorId });
        else if (pendingReturn.action === "tender-comparison") setResumeModelAction({ kind: "tender-comparison", anchorId: pendingReturn.anchorId });
        else if (pendingReturn.action === "bid-output" && pendingReturn.targetIds[0]) {
          setExpandedBidFileId(pendingReturn.targetIds[0]);
          setResumeModelAction({ kind: "bid-output", bidFileId: pendingReturn.targetIds[0], anchorId: pendingReturn.anchorId });
        }
      }
      setFilesHydrated(true);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || !returnState) return;
    const timer = window.setTimeout(() => {
      const anchor = returnState.anchorId ? document.getElementById(returnState.anchorId) : null;
      if (anchor) anchor.scrollIntoView({ block: "center" });
      else window.scrollTo({ top: returnState.scrollY });
      setReturnState(null);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [ready, returnState, view]);

  useEffect(() => {
    if (pendingModelAction || ocrChoiceSourceIds) modelChoicePrimary.current?.focus();
  }, [ocrChoiceSourceIds, pendingModelAction]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("cavwic-solution-workspace", JSON.stringify({ ...project, updatedAt: new Date().toISOString() }));
      setNotice(t.saved);
      const timer = window.setTimeout(() => setNotice(""), 1100);
      return () => window.clearTimeout(timer);
    } catch {
      setNotice(locale === "zh" ? "项目过大，请写入本地工作区目录。" : "Project is too large for browser storage. Write it to a local workspace folder.");
    }
  }, [project, locale, ready, t.saved]);

  useEffect(() => {
    if (!ready || !directoryHandle) return;
    const timer = window.setTimeout(() => {
      void saveProjectStateToDirectory(directoryHandle, project, sourceFiles)
        .then(() => setNotice(t.projectPathSaved))
        .catch(() => setNotice(locale === "zh" ? "项目路径授权已失效，请重新选择。" : "Project folder access expired. Choose it again."));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [directoryHandle, locale, project, ready, sourceFiles, t.projectPathSaved]);

  useEffect(() => {
    if (!ready || !filesHydrated || !sourceFiles.size) return;
    const timer = window.setTimeout(() => {
      void persistSourceFiles(project.id, sourceFiles).catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [filesHydrated, project.id, ready, sourceFiles]);

  const persistProjectSnapshot = (snapshot: ProjectManifest) => {
    try {
      localStorage.setItem("cavwic-solution-workspace", JSON.stringify(snapshot));
    } catch {
      // The authorized project directory remains the fallback when browser storage is full.
    }
  };
  const commitProject = (snapshot: ProjectManifest) => {
    persistProjectSnapshot(snapshot);
    setProject(snapshot);
  };
  const updateProject = <K extends keyof ProjectManifest>(key: K, value: ProjectManifest[K]) => setProject((current) => {
    const nextProject = syncProjectStage({ ...current, [key]: value, updatedAt: new Date().toISOString() });
    persistProjectSnapshot(nextProject);
    return nextProject;
  });
  const updatePresalesRound = (id: string, patch: Partial<PresalesRound>) => updateProject("presalesRounds", project.presalesRounds.map((item) => item.id === id ? { ...item, ...patch } : item));
  const updateBidFile = (id: string, patch: Partial<BidFileChecklistItem>) => updateProject("bidFileChecklist", project.bidFileChecklist.map((item) => item.id === id ? { ...item, ...patch } : item));

  const switchLocale = () => {
    const next = locale === "zh" ? "en" : "zh";
    setLocale(next);
    localStorage.setItem("cavwic-lab-locale", next);
    document.documentElement.dataset.locale = next;
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
    window.dispatchEvent(new CustomEvent("cavwic-locale-change", { detail: next }));
    setProject((current) => {
      const nextProject = syncProjectStage(localizeBuiltInProject(current, next));
      persistProjectSnapshot(nextProject);
      return nextProject;
    });
  };
  const switchTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("cavwic-lab-theme", next);
    document.documentElement.dataset.theme = next;
  };

  const importTenderFiles = async (files: FileList | null, target: { kind: "tender" } | { kind: "clarification"; roundId: string } | { kind: "analysis-template" | "comparison-template" }) => {
    if (!files?.length) return;
    setBusy(true);
    setNotice(`${t.parsing}…`);
    try {
      const parsed: SourceDocument[] = [];
      const nextFiles = new Map(sourceFiles);
      for (const file of Array.from(files)) {
        const rawSource = await parseSourceFile(file);
        const automaticallyPrepared = target.kind !== "tender" && hasReadableSourceText(rawSource);
        const source: SourceDocument = automaticallyPrepared ? {
          ...rawSource,
          preprocessStatus: "ready",
          preprocessedAt: new Date().toISOString(),
          preprocessMessage: locale === "zh" ? "上传并预处理完成" : "Uploaded and preprocessed",
        } : rawSource;
        parsed.push(source);
        nextFiles.set(source.id, file);
      }
      const sourceIds = parsed.map((source) => source.id);
      let nextProject: ProjectManifest = { ...project, sources: [...project.sources, ...parsed], updatedAt: new Date().toISOString() };
      if (target.kind === "tender") nextProject = {
        ...nextProject,
        tenderSourceIds: [...new Set([...project.tenderSourceIds, ...sourceIds])],
        selectedTenderSourceIds: [...new Set([...project.selectedTenderSourceIds, ...sourceIds])],
      };
      else if (target.kind === "clarification") nextProject = {
        ...nextProject,
        tenderClarificationRounds: project.tenderClarificationRounds.map((round) => round.id === target.roundId ? {
          ...round,
          sourceIds: [...new Set([...round.sourceIds, ...sourceIds])],
          selectedSourceIds: [...new Set([...round.selectedSourceIds, ...sourceIds])],
        } : round),
      };
      else if (target.kind === "analysis-template") nextProject = { ...nextProject, tenderAnalysis: { ...project.tenderAnalysis, templateSourceIds: [...new Set([...project.tenderAnalysis.templateSourceIds, ...sourceIds])] } };
      else nextProject = { ...nextProject, tenderComparison: { ...project.tenderComparison, templateSourceIds: [...new Set([...project.tenderComparison.templateSourceIds, ...sourceIds])] } };
      nextProject = syncProjectStage(nextProject);
      commitProject(nextProject);
      setSourceFiles(nextFiles);
      setSelectedSourceId(parsed[0]?.id || "");
      await persistSourceFiles(project.id, new Map(parsed.map((source) => [source.id, nextFiles.get(source.id) as File]))).catch(() => undefined);
      if (directoryHandle) await saveProjectStateToDirectory(directoryHandle, nextProject, nextFiles);
      setNotice(locale === "zh" ? `${parsed.length} 个文件已导入。` : `${parsed.length} file(s) imported.`);
    } catch {
      setNotice(t.invalid);
    } finally {
      setBusy(false);
      if (sourceInput.current) sourceInput.current.value = "";
    }
  };

  const importPresalesFiles = async (files: FileList | null, target: { kind: "requirements" | "references" | "templates"; roundId: string } | { kind: "action-templates"; roundId: string; actionId: string }) => {
    if (!files?.length) return;
    setBusy(true);
    setNotice(`${t.parsing}…`);
    try {
      const parsed = [];
      const nextFiles = new Map(sourceFiles);
      for (const file of Array.from(files)) {
        const source = await parseSourceFile(file);
        parsed.push(source);
        nextFiles.set(source.id, file);
      }
      const sourceIds = parsed.map((source) => source.id);
      const nextProject = syncProjectStage({
        ...project,
        sources: [...project.sources, ...parsed],
        presalesRounds: project.presalesRounds.map((round) => {
          if (round.id !== target.roundId) return round;
          if (target.kind === "requirements") return {
            ...round,
            requirementSourceIds: [...new Set([...round.requirementSourceIds, ...sourceIds])],
            selectedRequirementSourceIds: [...new Set([...selectedCustomerSourceIds(round), ...sourceIds])],
          };
          if (target.kind === "templates") return {
            ...round,
            templateSourceIds: [...new Set([...round.templateSourceIds, ...sourceIds])],
          };
          if (target.kind === "action-templates") return {
            ...round,
            actions: round.actions.map((action) => action.id === target.actionId ? {
              ...action,
              templateSourceIds: [...new Set([...action.templateSourceIds, ...sourceIds])],
            } : action),
          };
          return {
            ...round,
            referenceSourceIds: [...new Set([...round.referenceSourceIds, ...sourceIds])],
          };
        }),
        updatedAt: new Date().toISOString(),
      } as ProjectManifest);
      commitProject(nextProject);
      setSourceFiles(nextFiles);
      if (directoryHandle) await saveProjectStateToDirectory(directoryHandle, nextProject, nextFiles);
      setNotice(locale === "zh" ? `${parsed.length} 个文件已导入。` : `${parsed.length} file(s) imported.`);
    } catch {
      setNotice(t.invalid);
    } finally {
      setBusy(false);
    }
  };

  const toggleCustomerSource = (round: PresalesRound, sourceId: string, checked: boolean) => {
    const selected = selectedCustomerSourceIds(round);
    updatePresalesRound(round.id, {
      selectedRequirementSourceIds: checked ? [...new Set([...selected, sourceId])] : selected.filter((id) => id !== sourceId),
    });
  };

  const selectAllCustomerSources = (round: PresalesRound, checked: boolean) => updatePresalesRound(round.id, {
    selectedRequirementSourceIds: checked ? [...round.requirementSourceIds] : [],
  });

  const removePresalesSource = async (round: PresalesRound, sourceId: string, kind: "requirements" | "templates" | "action-templates", actionId?: string) => {
    const source = project.sources.find((item) => item.id === sourceId);
    const nextRounds = project.presalesRounds.map((item) => {
      if (item.id !== round.id) return item;
      if (kind === "requirements") return {
        ...item,
        requirementSourceIds: item.requirementSourceIds.filter((id) => id !== sourceId),
        selectedRequirementSourceIds: selectedCustomerSourceIds(item).filter((id) => id !== sourceId),
      };
      if (kind === "action-templates") return {
        ...item,
        actions: item.actions.map((action) => action.id === actionId ? {
          ...action,
          templateSourceIds: action.templateSourceIds.filter((id) => id !== sourceId),
          selectedTemplateSourceIds: action.selectedTemplateSourceIds.filter((id) => id !== sourceId),
        } : action),
      };
      return {
        ...item,
        templateSourceIds: item.templateSourceIds.filter((id) => id !== sourceId),
        selectedTemplateSourceIds: item.selectedTemplateSourceIds.filter((id) => id !== sourceId),
      };
    });
    const detachedProject = syncProjectStage({ ...project, presalesRounds: nextRounds, updatedAt: new Date().toISOString() });
    const removeSource = !sourceIsReferenced(detachedProject, sourceId);
    const nextProject = removeSource ? { ...detachedProject, sources: detachedProject.sources.filter((item) => item.id !== sourceId) } : detachedProject;
    const nextFiles = new Map(sourceFiles);
    if (removeSource) nextFiles.delete(sourceId);
    commitProject(nextProject);
    setSourceFiles(nextFiles);
    if (directoryHandle) {
      if (removeSource && source) await removeWorkspaceFileFromRelativePath(directoryHandle, `projects/${project.id}/sources/${source.name}`).catch(() => undefined);
      await saveProjectStateToDirectory(directoryHandle, nextProject, nextFiles).catch(() => undefined);
    }
  };

  const addAnalysisKeyword = (round: PresalesRound, value: string) => {
    const keyword = value.trim();
    if (!keyword || round.keywords.includes(keyword)) return;
    updatePresalesRound(round.id, { keywords: [...round.keywords, keyword] });
    setKeywordDrafts((current) => ({ ...current, [round.id]: "" }));
  };

  const alertTemplateMismatch = (sourceName: string, format: ResponseFileFormat) => {
    const target = format === "docx" ? "Word" : format === "pptx" ? "PPT" : "Markdown";
    window.alert(locale === "zh"
      ? `模板“${sourceName}”与 ${target} 输出格式不匹配，请更换模板或输出格式。`
      : `Template “${sourceName}” does not match the ${target} output format. Choose another template or output format.`);
  };

  const toggleAnalysisTemplate = (round: PresalesRound, sourceId: string) => {
    const selected = round.selectedTemplateSourceIds.includes(sourceId);
    if (!selected && round.analysisOutputFormat) {
      const source = project.sources.find((item) => item.id === sourceId);
      if (source && templateFileFormat(source.name) !== round.analysisOutputFormat) {
        alertTemplateMismatch(source.name, round.analysisOutputFormat);
        return;
      }
    }
    updatePresalesRound(round.id, {
      selectedTemplateSourceIds: selected
        ? round.selectedTemplateSourceIds.filter((id) => id !== sourceId)
        : [...round.selectedTemplateSourceIds, sourceId],
    });
  };

  const setAnalysisOutputFormat = (round: PresalesRound, format: ResponseFileFormat | "") => {
    if (format) {
      const mismatch = round.selectedTemplateSourceIds
        .map((id) => project.sources.find((source) => source.id === id))
        .find((source) => source && templateFileFormat(source.name) !== format);
      if (mismatch) {
        alertTemplateMismatch(mismatch.name, format);
        return;
      }
    }
    updatePresalesRound(round.id, { analysisOutputFormat: format || undefined });
  };

  const toggleActionTemplate = (round: PresalesRound, action: PresalesRoundAction, sourceId: string) => {
    const selected = action.selectedTemplateSourceIds.includes(sourceId);
    if (!selected && action.responseFileFormat) {
      const source = project.sources.find((item) => item.id === sourceId);
      if (source && templateFileFormat(source.name) !== action.responseFileFormat) {
        alertTemplateMismatch(source.name, action.responseFileFormat);
        return;
      }
    }
    updateRoundAction(round, action.id, {
      selectedTemplateSourceIds: selected
        ? action.selectedTemplateSourceIds.filter((id) => id !== sourceId)
        : [...action.selectedTemplateSourceIds, sourceId],
    });
  };

  const setActionResponseFormat = (round: PresalesRound, action: PresalesRoundAction, format: ResponseFileFormat | "") => {
    if (format) {
      const mismatch = action.selectedTemplateSourceIds
        .map((id) => project.sources.find((source) => source.id === id))
        .find((source) => source && templateFileFormat(source.name) !== format);
      if (mismatch) {
        alertTemplateMismatch(mismatch.name, format);
        return;
      }
    }
    updateRoundAction(round, action.id, { responseFileFormat: format || undefined });
  };

  const addRoundParticipant = (round: PresalesRound) => {
    const draft = participantDrafts[round.id] || { name: "", category: "customer" as const };
    const name = draft.name.trim();
    if (!name || round.participants.some((participant) => participant.category === draft.category && participant.name === name)) return;
    updatePresalesRound(round.id, {
      participants: [...round.participants, { id: createId("participant"), name, category: draft.category }],
    });
    setParticipantDrafts((current) => ({ ...current, [round.id]: { ...draft, name: "" } }));
  };

  const addRoundAction = (round: PresalesRound) => {
    const action: PresalesRoundAction = {
      id: createId("round-action"),
      title: "",
      owner: "",
      dueDate: "",
      status: "open",
      responseFileName: "",
      fileRequirements: "",
      templateSourceIds: [],
      selectedTemplateSourceIds: [],
    };
    updatePresalesRound(round.id, { actions: [...round.actions, action] });
  };

  const updateRoundAction = (round: PresalesRound, actionId: string, patch: Partial<PresalesRoundAction>) => updatePresalesRound(round.id, {
    actions: round.actions.map((action) => action.id === actionId ? { ...action, ...patch } : action),
  });

  const checkedActions = (round: PresalesRound) => round.actions.filter((action) => selectedActionIds.has(action.id));

  const setActionSelected = (actionId: string, checked: boolean) => setSelectedActionIds((current) => {
    const next = new Set(current);
    if (checked) next.add(actionId);
    else next.delete(actionId);
    return next;
  });

  const setRoundActionsSelected = (round: PresalesRound, checked: boolean) => setSelectedActionIds((current) => {
    const next = new Set(current);
    round.actions.forEach((action) => checked ? next.add(action.id) : next.delete(action.id));
    return next;
  });

  const validateResponseActions = (round: PresalesRound, actions: PresalesRoundAction[]) => {
    if (!actions.length) {
      setNotice(locale === "zh" ? "请先勾选需要处理的响应文件。" : "Select at least one response file first.");
      return false;
    }
    const incomplete = actions.find((action) => {
      const target = getActionResponseTarget(round, action);
      return !target.name || !target.format;
    });
    if (incomplete) {
      setNotice(locale === "zh" ? "请先填写响应文件名称并选择文件格式。" : "Enter a response file name and select its format first.");
      return false;
    }
    return true;
  };

  const generatePresalesTasks = async (round: PresalesRound, actions: PresalesRoundAction[]) => {
    if (!validateResponseActions(round, actions)) return;
    setGeneratingActionId(actions.length === 1 ? `task-${actions[0].id}` : `batch-task-${round.id}`);
    setBusy(true);
    try {
      const tasks = actions.map((action) => buildCodexPresalesTask(project, round, action, locale));
      if (supportsDirectoryAccess()) {
        const outputDirectory = await chooseTaskOutputDirectory(directoryHandle);
        for (const task of tasks) await saveTaskFileToDirectory(outputDirectory, task.name, task.content);
        setNotice(locale === "zh" ? `${tasks.length} 个独立任务文件已保存到“${outputDirectory.name}”。` : `${tasks.length} separate task file(s) saved to “${outputDirectory.name}”.`);
      } else {
        tasks.forEach((task) => downloadText(task.name, task.content, "text/markdown;charset=utf-8"));
        setNotice(locale === "zh" ? `${tasks.length} 个独立任务文件已下载。` : `${tasks.length} separate task file(s) downloaded.`);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setNotice(locale === "zh" ? "已取消保存任务。" : "Task saving cancelled.");
      else setNotice(locale === "zh" ? "任务文件保存失败，请重新选择可写目录。" : "Task files could not be saved. Select a writable folder and try again.");
    } finally {
      setBusy(false);
      setGeneratingActionId("");
    }
  };

  const configuredModel = (): ModelInvocation | null => {
    const currentSettings = readModelSettings();
    const currentApiKey = readModelApiKey();
    if (hasBrowserCallableModel(currentSettings)) return { settings: currentSettings, apiKey: currentApiKey };
    return null;
  };

  const selectedClarificationSourceIds = () => project.tenderClarificationRounds.flatMap((round) => round.selectedSourceIds);

  const resolveSourceFile = async (source: SourceDocument): Promise<File | null> => {
    const current = sourceFiles.get(source.id);
    if (current) return current;
    if (!directoryHandle) return null;
    return readWorkspaceFileFromRelativePath(directoryHandle, `projects/${project.id}/sources/${source.name}`).catch(() => null);
  };

  const openSourceFile = async (source: SourceDocument) => {
    const file = await resolveSourceFile(source);
    if (!file) {
      setNotice(locale === "zh" ? "当前浏览器中找不到原始文件，请重新导入或选择项目路径。" : "The original file is unavailable. Import it again or select the project folder.");
      return;
    }
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const preprocessTenderSources = (sourceIds: string[]) => {
    const targetIds = sourceIds.filter((id) => project.sources.some((source) => source.id === id && source.preprocessStatus !== "ready"));
    if (!targetIds.length) return;
    const needsOcr: string[] = [];
    const now = new Date().toISOString();
    const nextProject = syncProjectStage({
      ...project,
      sources: project.sources.map((source) => {
        if (!targetIds.includes(source.id)) return source;
        if (hasReadableSourceText(source)) return { ...source, requiresOcr: false, preprocessStatus: "ready" as const, preprocessedAt: now, preprocessMessage: locale === "zh" ? "上传并预处理完成" : "Uploaded and preprocessed" };
        needsOcr.push(source.id);
        return { ...source, requiresOcr: true, preprocessStatus: "needs-ocr" as const, preprocessMessage: locale === "zh" ? "存在无法识别内容" : "Unrecognized content detected" };
      }),
      updatedAt: now,
    });
    commitProject(nextProject);
    if (needsOcr.length) setOcrChoiceSourceIds(needsOcr);
    else setNotice(locale === "zh" ? "所选文件预处理完成。" : "Selected files were preprocessed.");
  };

  const skipTenderOcr = () => {
    const sourceIds = ocrChoiceSourceIds || [];
    setOcrChoiceSourceIds(null);
    const nextProject = syncProjectStage({
      ...project,
      sources: project.sources.map((source) => sourceIds.includes(source.id) ? { ...source, preprocessStatus: "skipped", preprocessMessage: locale === "zh" ? "仅上传，未处理" : "Uploaded only, not processed" } : source),
      updatedAt: new Date().toISOString(),
    });
    commitProject(nextProject);
  };

  const performTenderOcr = async (sourceIds: string[], invocation: ModelInvocation) => {
    if (!sourceIds.length) return;
    setBusy(true);
    let nextProject = project;
    let completed = 0;
    for (const sourceId of sourceIds) {
      const source = nextProject.sources.find((item) => item.id === sourceId);
      if (!source) continue;
      setOcrProgress((current) => ({ ...current, [sourceId]: 2 }));
      nextProject = { ...nextProject, sources: nextProject.sources.map((item) => item.id === sourceId ? { ...item, preprocessStatus: "processing", preprocessMessage: locale === "zh" ? "正在识别" : "Recognizing" } : item) };
      nextProject = syncProjectStage(nextProject);
      commitProject(nextProject);
      try {
        const file = await resolveSourceFile(source);
        if (!file) throw new Error("SOURCE_FILE_UNAVAILABLE");
        const segments = await requestOcrRecognition(invocation.settings, invocation.apiKey, file, (progress) => setOcrProgress((current) => ({ ...current, [sourceId]: progress })));
        const now = new Date().toISOString();
        nextProject = syncProjectStage({
          ...nextProject,
          sources: nextProject.sources.map((item) => item.id === sourceId ? {
            ...item,
            segments: segments.map((segment, index) => ({ ...segment, id: `${sourceId}-ocr-${index + 1}` })),
            requiresOcr: false,
            preprocessStatus: "ready",
            preprocessedAt: now,
            preprocessMessage: locale === "zh" ? "上传并预处理完成" : "Uploaded and preprocessed",
          } : item),
          updatedAt: now,
        });
        completed += 1;
      } catch {
        nextProject = syncProjectStage({
          ...nextProject,
          sources: nextProject.sources.map((item) => item.id === sourceId ? { ...item, preprocessStatus: "failed", preprocessMessage: locale === "zh" ? "识别失败，请检查模型是否支持视觉识别或将文件转换为图片/PDF" : "Recognition failed. Check vision support or convert the file to an image/PDF." } : item),
          updatedAt: new Date().toISOString(),
        });
      }
      commitProject(nextProject);
      if (directoryHandle) await saveProjectStateToDirectory(directoryHandle, nextProject, sourceFiles).catch(() => undefined);
    }
    setOcrProgress((current) => { const next = { ...current }; sourceIds.forEach((id) => delete next[id]); return next; });
    setBusy(false);
    if (completed) window.alert(locale === "zh" ? "识别完成" : "Recognition complete");
    if (completed !== sourceIds.length) setNotice(locale === "zh" ? `${completed} 个文件识别完成，${sourceIds.length - completed} 个文件未完成。` : `${completed} file(s) recognized; ${sourceIds.length - completed} incomplete.`);
  };

  const confirmTenderOcr = () => {
    const sourceIds = ocrChoiceSourceIds || [];
    setOcrChoiceSourceIds(null);
    const invocation = configuredModel();
    if (invocation) {
      void performTenderOcr(sourceIds, invocation);
      return;
    }
    setPendingModelAction({ kind: "tender-ocr", sourceIds, anchorId: "tender-files" });
  };

  const toggleTenderTemplate = (kind: "analysis" | "comparison", sourceId: string) => {
    const config = kind === "analysis" ? project.tenderAnalysis : project.tenderComparison;
    const selected = config.selectedTemplateSourceIds.includes(sourceId);
    if (!selected && config.outputFormat) {
      const source = project.sources.find((item) => item.id === sourceId);
      if (source && tenderTemplateFileFormat(source.name) !== config.outputFormat) {
        const target = config.outputFormat === "docx" ? "Word" : config.outputFormat === "pptx" ? "PPT" : config.outputFormat === "xlsx" ? "Excel" : "Markdown";
        window.alert(locale === "zh" ? `模板“${source.name}”与 ${target} 输出格式不匹配。` : `Template “${source.name}” does not match ${target}.`);
        return;
      }
    }
    const selectedTemplateSourceIds = selected ? config.selectedTemplateSourceIds.filter((id) => id !== sourceId) : [...config.selectedTemplateSourceIds, sourceId];
    if (kind === "analysis") updateProject("tenderAnalysis", { ...project.tenderAnalysis, selectedTemplateSourceIds });
    else updateProject("tenderComparison", { ...project.tenderComparison, selectedTemplateSourceIds });
  };

  const setTenderOutputFormat = (kind: "analysis" | "comparison", format: TenderOutputFormat | "") => {
    const config = kind === "analysis" ? project.tenderAnalysis : project.tenderComparison;
    if (format) {
      const mismatch = config.selectedTemplateSourceIds.map((id) => project.sources.find((source) => source.id === id)).find((source) => source && tenderTemplateFileFormat(source.name) !== format);
      if (mismatch) {
        const target = format === "docx" ? "Word" : format === "pptx" ? "PPT" : format === "xlsx" ? "Excel" : "Markdown";
        window.alert(locale === "zh" ? `模板“${mismatch.name}”与 ${target} 输出格式不匹配。` : `Template “${mismatch.name}” does not match ${target}.`);
        return;
      }
    }
    if (kind === "analysis") updateProject("tenderAnalysis", { ...project.tenderAnalysis, outputFormat: format || undefined });
    else updateProject("tenderComparison", { ...project.tenderComparison, outputFormat: format || undefined });
  };

  const removeTenderSources = async (sourceIds: string[]) => {
    if (!sourceIds.length) return;
    const sourceIdSet = new Set(sourceIds);
    const detached = syncProjectStage({
      ...project,
      tenderSourceIds: project.tenderSourceIds.filter((id) => !sourceIdSet.has(id)),
      selectedTenderSourceIds: project.selectedTenderSourceIds.filter((id) => !sourceIdSet.has(id)),
      tenderClarificationRounds: project.tenderClarificationRounds.map((round) => ({ ...round, sourceIds: round.sourceIds.filter((id) => !sourceIdSet.has(id)), selectedSourceIds: round.selectedSourceIds.filter((id) => !sourceIdSet.has(id)) })),
      tenderAnalysis: { ...project.tenderAnalysis, templateSourceIds: project.tenderAnalysis.templateSourceIds.filter((id) => !sourceIdSet.has(id)), selectedTemplateSourceIds: project.tenderAnalysis.selectedTemplateSourceIds.filter((id) => !sourceIdSet.has(id)) },
      tenderComparison: { ...project.tenderComparison, templateSourceIds: project.tenderComparison.templateSourceIds.filter((id) => !sourceIdSet.has(id)), selectedTemplateSourceIds: project.tenderComparison.selectedTemplateSourceIds.filter((id) => !sourceIdSet.has(id)), selectedPresalesSourceIds: project.tenderComparison.selectedPresalesSourceIds.filter((id) => !sourceIdSet.has(id)) },
      requirements: project.requirements.filter((requirement) => !requirement.sourceRef || !sourceIdSet.has(requirement.sourceRef.documentId)),
      updatedAt: new Date().toISOString(),
    });
    const removableIds = sourceIds.filter((id) => !sourceIsReferenced(detached, id));
    const removableSet = new Set(removableIds);
    const nextProject = { ...detached, sources: detached.sources.filter((source) => !removableSet.has(source.id)) };
    const nextFiles = new Map(sourceFiles);
    removableIds.forEach((id) => nextFiles.delete(id));
    commitProject(nextProject);
    setSourceFiles(nextFiles);
    if (sourceIdSet.has(expandedTenderSourceId)) setExpandedTenderSourceId("");
    for (const id of removableIds) {
      const source = project.sources.find((item) => item.id === id);
      await removePersistedSourceFile(project.id, id).catch(() => undefined);
      if (directoryHandle && source) await removeWorkspaceFileFromRelativePath(directoryHandle, `projects/${project.id}/sources/${source.name}`).catch(() => undefined);
    }
    if (directoryHandle) await saveProjectStateToDirectory(directoryHandle, nextProject, nextFiles).catch(() => undefined);
  };

  const tenderAnalysisInputs = (kind: "analysis" | "comparison") => {
    const tenderSources = project.selectedTenderSourceIds.map((id) => project.sources.find((source) => source.id === id)).filter((source): source is SourceDocument => Boolean(source));
    const clarificationSources = selectedClarificationSourceIds().map((id) => project.sources.find((source) => source.id === id)).filter((source): source is SourceDocument => Boolean(source));
    const incomplete = [...tenderSources, ...clarificationSources].find((source) => source.preprocessStatus !== "ready");
    if (!tenderSources.length) {
      window.alert(locale === "zh" ? "请先选择至少一个招标文件。" : "Select at least one tender file.");
      return null;
    }
    if (incomplete) {
      window.alert(locale === "zh" ? `文件“${incomplete.name}”尚未完成预处理。` : `File “${incomplete.name}” has not been preprocessed.`);
      return null;
    }
    if (kind === "analysis") {
      if (!project.tenderAnalysis.outputFormat) {
        window.alert(locale === "zh" ? "请先选择招标要求分析的文件格式。" : "Select an output format for tender analysis.");
        return null;
      }
      const templates = project.tenderAnalysis.selectedTemplateSourceIds.map((id) => project.sources.find((source) => source.id === id)).filter((source): source is SourceDocument => Boolean(source));
      return { tenderSources, clarificationSources, presalesSources: [] as SourceDocument[], templates, outputFormat: project.tenderAnalysis.outputFormat };
    }
    const presalesSources = project.tenderComparison.selectedPresalesSourceIds.map((id) => project.sources.find((source) => source.id === id)).filter((source): source is SourceDocument => Boolean(source));
    if (!presalesSources.length) {
      window.alert(locale === "zh" ? "请先选择至少一个售前文件。" : "Select at least one presales file.");
      return null;
    }
    if (!project.tenderComparison.outputFormat) {
      window.alert(locale === "zh" ? "请先选择对比结果的文件格式。" : "Select an output format for the comparison.");
      return null;
    }
    const templates = project.tenderComparison.selectedTemplateSourceIds.map((id) => project.sources.find((source) => source.id === id)).filter((source): source is SourceDocument => Boolean(source));
    return { tenderSources, clarificationSources, presalesSources, templates, outputFormat: project.tenderComparison.outputFormat };
  };

  const nextTenderResultName = (kind: "analysis" | "comparison") => {
    const baseName = kind === "analysis"
      ? analysisResultBaseName(project.tenderAnalysis.keywords, locale)
      : (locale === "zh" ? "售前与招标对比结果" : "Presales and tender comparison");
    const results = kind === "analysis" ? project.tenderAnalysis.results : project.tenderComparison.results;
    if (!results.some((result) => result.name === baseName)) return baseName;
    let sequence = 2;
    while (results.some((result) => result.name === `${baseName}-${sequence}`)) sequence += 1;
    return `${baseName}-${sequence}`;
  };

  const createTenderRequirements = (data: ReturnType<typeof extractTenderStructuredData>["data"], sources: SourceDocument[]) => data.requirements.map((item) => {
    const source = sources.find((candidate) => candidate.name === item.sourceName) || sources[0];
    const segment = source?.segments.find((candidate) => candidate.locator === item.locator || (item.originalText && candidate.text.includes(item.originalText.slice(0, 32)))) || source?.segments[0];
    return createRequirement("tender", {
      title: item.title,
      category: item.category,
      originalText: item.originalText,
      normalizedText: item.normalizedText || item.originalText || item.title,
      mandatory: item.mandatory,
      scored: item.scored,
      dueDate: item.dueDate,
      sourceRef: source && segment ? { documentId: source.id, segmentId: segment.id, locator: segment.locator, excerpt: (item.originalText || segment.text).slice(0, 240) } : null,
    }, locale);
  });

  const runTenderAnalysis = async (kind: "analysis" | "comparison", invocation: ModelInvocation) => {
    const inputs = tenderAnalysisInputs(kind);
    if (!inputs) return;
    setBusy(true);
    setGeneratingActionId(kind === "analysis" ? "tender-analysis" : "tender-comparison");
    try {
      const prompt = kind === "analysis"
        ? buildTenderAnalysisPrompt(project, inputs.tenderSources, inputs.clarificationSources, inputs.templates, locale)
        : buildTenderComparisonPrompt(project, inputs.presalesSources, inputs.tenderSources, inputs.clarificationSources, inputs.templates, locale);
      const draft = await requestPresalesDraft(invocation.settings, invocation.apiKey, prompt);
      const extracted = extractTenderStructuredData(draft.content);
      const resultName = nextTenderResultName(kind);
      const generated = await createTenderGeneratedFile(extracted.content, resultName, inputs.outputFormat);
      const generatedFile = new File([generated.blob], generated.name, { type: generated.blob.type });
      const parsedOutput = await parseSourceFile(generatedFile);
      const source: SourceDocument = { ...parsedOutput, preprocessStatus: "ready", preprocessedAt: new Date().toISOString(), preprocessMessage: locale === "zh" ? "模型分析结果" : "Model analysis result" };
      const folderName = safeDirectoryName(locale === "zh" ? "投标阶段-招标文件分析" : "Tender-File-Analysis");
      const relativePath = directoryHandle ? await saveAnalysisFileToDirectory(directoryHandle, project, folderName, generated.name, generated.blob) : `downloads/${generated.name}`;
      const sourceIds = [...inputs.tenderSources, ...inputs.clarificationSources, ...(kind === "comparison" ? inputs.presalesSources : [])].map((item) => item.id);
      const record: TenderAnalysisResult = {
        id: createId("tender-analysis"),
        kind: kind === "analysis" ? "requirements" : "comparison",
        name: resultName,
        fileName: generated.name,
        format: inputs.outputFormat,
        createdAt: new Date().toISOString(),
        provider: draft.provider,
        model: draft.model,
        sourceId: source.id,
        relativePath,
        prompt: kind === "analysis" ? project.tenderAnalysis.analysisRequirements : "",
        keywords: kind === "analysis" ? [...project.tenderAnalysis.keywords] : [],
        sourceIds,
        templateSourceIds: inputs.templates.map((item) => item.id),
        differences: extracted.data.differences,
      };
      const nextFiles = new Map(sourceFiles).set(source.id, generatedFile);
      const existingNormalized = new Set(project.requirements.filter((item) => item.baseline === "tender").map((item) => item.normalizedText.trim()));
      const extractedRequirements = kind === "analysis" ? createTenderRequirements(extracted.data, [...inputs.tenderSources, ...inputs.clarificationSources]).filter((item) => !existingNormalized.has(item.normalizedText.trim())) : [];
      const checklist: BidFileChecklistItem[] = kind === "analysis" ? extracted.data.bidFileChecklist.map((item) => ({
        id: createId("bid-file"),
        title: item.title,
        category: item.category,
        status: "pending",
        sourceResultId: record.id,
        notes: item.notes,
        templateSourceIds: [],
        selectedTemplateSourceIds: [],
        referenceSourceIds: [],
        selectedReferenceSourceIds: [],
        detailRequirements: "",
        generatedFiles: [],
      })) : [];
      const knownChecklist = new Set(project.bidFileChecklist.map((item) => item.title.trim()));
      const nextProject = syncProjectStage({
        ...project,
        sources: [...project.sources, source],
        requirements: [...project.requirements, ...extractedRequirements],
        tenderAnalysis: kind === "analysis" ? { ...project.tenderAnalysis, results: [...project.tenderAnalysis.results, record] } : project.tenderAnalysis,
        tenderComparison: kind === "comparison" ? { ...project.tenderComparison, results: [...project.tenderComparison.results, record] } : project.tenderComparison,
        bidFileChecklist: [...project.bidFileChecklist, ...checklist.filter((item) => !knownChecklist.has(item.title.trim()))],
        updatedAt: new Date().toISOString(),
      });
      commitProject(nextProject);
      setSourceFiles(nextFiles);
      setGeneratedBlobs((current) => new Map(current).set(record.id, generated.blob));
      await persistSourceFiles(project.id, new Map([[source.id, generatedFile]])).catch(() => undefined);
      if (directoryHandle) await saveProjectStateToDirectory(directoryHandle, nextProject, nextFiles);
      else downloadBlob(generated.name, generated.blob);
      setNotice(locale === "zh" ? `${resultName}已生成。` : `${resultName} generated.`);
    } catch {
      setNotice(locale === "zh" ? "招标文件分析失败，请检查模型服务、文件预处理状态和接口配置。" : "Tender analysis failed. Check preprocessing and model configuration.");
    } finally {
      setBusy(false);
      setGeneratingActionId("");
    }
  };

  const openTenderResult = async (result: TenderAnalysisResult) => {
    const file = generatedBlobs.get(result.id) || sourceFiles.get(result.sourceId) || (directoryHandle ? await readWorkspaceFileFromRelativePath(directoryHandle, result.relativePath).catch(() => null) : null);
    if (!file) {
      setNotice(locale === "zh" ? "找不到分析结果文件，请重新选择项目路径。" : "The analysis result is unavailable. Select the project folder again.");
      return;
    }
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const removeTenderResult = async (result: TenderAnalysisResult) => {
    const detached = syncProjectStage({
      ...project,
      tenderAnalysis: { ...project.tenderAnalysis, results: project.tenderAnalysis.results.filter((item) => item.id !== result.id) },
      tenderComparison: { ...project.tenderComparison, results: project.tenderComparison.results.filter((item) => item.id !== result.id) },
      bidFileChecklist: project.bidFileChecklist.filter((item) => item.sourceResultId !== result.id),
      updatedAt: new Date().toISOString(),
    });
    const removeSource = !sourceIsReferenced(detached, result.sourceId);
    const nextProject = removeSource ? { ...detached, sources: detached.sources.filter((source) => source.id !== result.sourceId) } : detached;
    const nextFiles = new Map(sourceFiles);
    const nextBlobs = new Map(generatedBlobs);
    if (removeSource) {
      nextFiles.delete(result.sourceId);
      await removePersistedSourceFile(project.id, result.sourceId).catch(() => undefined);
    }
    nextBlobs.delete(result.id);
    commitProject(nextProject);
    setSourceFiles(nextFiles);
    setGeneratedBlobs(nextBlobs);
    if (expandedTenderResultId === result.id) setExpandedTenderResultId("");
    if (directoryHandle) {
      await removeWorkspaceFileFromRelativePath(directoryHandle, result.relativePath).catch(() => undefined);
      await saveProjectStateToDirectory(directoryHandle, nextProject, nextFiles).catch(() => undefined);
    }
  };

  const startTenderAnalysis = (kind: "analysis" | "comparison") => {
    if (!tenderAnalysisInputs(kind)) return;
    const invocation = configuredModel();
    if (invocation) {
      void runTenderAnalysis(kind, invocation);
      return;
    }
    setPendingModelAction({ kind: kind === "analysis" ? "tender-analysis" : "tender-comparison", anchorId: "tender-analysis" });
  };

  const rememberModelActionAndOpenSettings = async (pending: PendingModelAction) => {
    try {
      localStorage.setItem("cavwic-solution-workspace", JSON.stringify({ ...project, updatedAt: new Date().toISOString() }));
      await persistSourceFiles(project.id, sourceFiles);
    } catch {
      // The authorized project directory remains the source of truth when browser storage is full.
    }
    const returnPath = `${window.location.pathname}${window.location.search}`;
    saveModelActionReturnState({
      schemaVersion: "1.0.0",
      action: pending.kind,
      returnPath,
      view,
      anchorId: pending.anchorId,
      scrollY: Math.max(0, window.scrollY),
      selectedSourceId,
      selectedRequirementId,
      selectedActionIds: [...selectedActionIds],
      expandedAnalysisId,
      targetIds: pending.kind === "tender-ocr" ? pending.sourceIds : pending.kind === "response-files" ? pending.actionIds : pending.kind === "bid-output" ? [pending.bidFileId] : [],
      taskKind,
      savedAt: new Date().toISOString(),
    });
    setPendingModelAction(null);
    window.location.href = `${base}/model-settings?return=${encodeURIComponent(returnPath)}`;
  };

  const customerAnalysisInputs = (round: PresalesRound) => {
    const sourceIds = selectedCustomerSourceIds(round);
    if (!sourceIds.length) {
      window.alert(locale === "zh" ? "请先选择需要分析的客户附件。" : "Select at least one customer attachment to analyze.");
      return null;
    }
    if (!round.analysisOutputFormat) {
      window.alert(locale === "zh" ? "请先选择分析结果的文件格式。" : "Select an output format for the analysis result.");
      return null;
    }
    const selectedTemplates = round.selectedTemplateSourceIds
      .map((id) => project.sources.find((source) => source.id === id))
      .filter((source): source is NonNullable<typeof source> => Boolean(source));
    const mismatch = selectedTemplates.find((source) => templateFileFormat(source.name) !== round.analysisOutputFormat);
    if (mismatch) {
      alertTemplateMismatch(mismatch.name, round.analysisOutputFormat);
      return null;
    }
    const selectedSources = sourceIds
      .map((id) => project.sources.find((source) => source.id === id))
      .filter((source): source is NonNullable<typeof source> => Boolean(source));
    return { sourceIds, selectedSources, selectedTemplates, outputFormat: round.analysisOutputFormat };
  };

  const analyzeCustomerSources = async (round: PresalesRound, invocation: ModelInvocation) => {
    const inputs = customerAnalysisInputs(round);
    if (!inputs) return;
    const { sourceIds, selectedSources, selectedTemplates, outputFormat } = inputs;
    setAnalyzingRoundId(round.id);
    setBusy(true);
    try {
      const prompt = buildCustomerNeedsAnalysisPrompt(project, round, selectedSources, selectedTemplates, locale);
      const draft = await requestPresalesDraft(invocation.settings, invocation.apiKey, prompt);
      const baseName = analysisResultBaseName(round.keywords, locale);
      const resultName = uniqueAnalysisResultName(baseName, round.analysisResults);
      const generated = await createGeneratedFile(draft.content, resultName, outputFormat);
      const generatedFile = new File([generated.blob], generated.name, { type: generated.blob.type });
      const source = await parseSourceFile(generatedFile);
      const roundIndex = Math.max(0, project.presalesRounds.findIndex((item) => item.id === round.id));
      const folderName = safeDirectoryName(locale === "zh"
        ? `售前阶段-第${roundIndex + 1}次沟通-分析要求`
        : `Presales-Communication-${roundIndex + 1}-Analysis`);
      const relativePath = directoryHandle
        ? await saveAnalysisFileToDirectory(directoryHandle, project, folderName, generated.name, generated.blob)
        : `downloads/${generated.name}`;
      const record: PresalesAnalysisResult = {
        id: createId("analysis"),
        name: resultName,
        fileName: generated.name,
        format: outputFormat,
        createdAt: new Date().toISOString(),
        provider: draft.provider,
        model: draft.model,
        sourceId: source.id,
        relativePath,
        prompt: round.analysisRequirements,
        keywords: [...round.keywords],
        sourceIds: [...sourceIds],
        templateSourceIds: [...round.selectedTemplateSourceIds],
      };
      const nextFiles = new Map(sourceFiles).set(source.id, generatedFile);
      const nextProject = syncProjectStage({
        ...project,
        sources: [...project.sources, source],
        presalesRounds: project.presalesRounds.map((item) => item.id === round.id ? { ...item, analysisResults: [...item.analysisResults, record] } : item),
        updatedAt: new Date().toISOString(),
      });
      commitProject(nextProject);
      setSourceFiles(nextFiles);
      setGeneratedBlobs((current) => new Map(current).set(record.id, generated.blob));
      if (directoryHandle) await saveProjectStateToDirectory(directoryHandle, nextProject, nextFiles);
      else downloadBlob(generated.name, generated.blob);
      setNotice(locale === "zh"
        ? `${resultName}已生成${directoryHandle ? `并保存到 ${relativePath}` : "并下载"}。`
        : `${resultName} generated${directoryHandle ? ` and saved to ${relativePath}` : " and downloaded"}.`);
    } catch {
      setNotice(locale === "zh" ? "需求分析失败，请检查模型服务、跨域授权和接口配置。" : "Analysis failed. Check the model service, CORS permission, and endpoint settings.");
    } finally {
      setBusy(false);
      setAnalyzingRoundId("");
    }
  };

  const openAnalysisResult = async (result: PresalesAnalysisResult) => {
    try {
      const file = generatedBlobs.get(result.id)
        || sourceFiles.get(result.sourceId)
        || (directoryHandle ? await readWorkspaceFileFromRelativePath(directoryHandle, result.relativePath) : null);
      if (!file) throw new Error("FILE_NOT_AVAILABLE");
      if (result.format === "md") {
        const url = URL.createObjectURL(file);
        window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else downloadBlob(result.fileName, file);
    } catch {
      setNotice(locale === "zh" ? "找不到该分析文件，请重新选择项目路径。" : "The analysis file is unavailable. Select the project folder again.");
    }
  };

  const removeAnalysisResult = async (round: PresalesRound, result: PresalesAnalysisResult) => {
    const nextRounds = project.presalesRounds.map((item) => item.id === round.id
      ? { ...item, analysisResults: item.analysisResults.filter((entry) => entry.id !== result.id) }
      : item);
    const detachedProject = syncProjectStage({ ...project, presalesRounds: nextRounds, updatedAt: new Date().toISOString() });
    const removeSource = !sourceIsReferenced(detachedProject, result.sourceId);
    const nextProject = removeSource ? { ...detachedProject, sources: detachedProject.sources.filter((source) => source.id !== result.sourceId) } : detachedProject;
    const nextFiles = new Map(sourceFiles);
    const nextBlobs = new Map(generatedBlobs);
    if (removeSource) nextFiles.delete(result.sourceId);
    nextBlobs.delete(result.id);
    commitProject(nextProject);
    setSourceFiles(nextFiles);
    setGeneratedBlobs(nextBlobs);
    if (expandedAnalysisId === result.id) setExpandedAnalysisId("");
    if (directoryHandle) {
      await removeWorkspaceFileFromRelativePath(directoryHandle, result.relativePath).catch(() => undefined);
      await saveProjectStateToDirectory(directoryHandle, nextProject, nextFiles).catch(() => undefined);
    }
  };

  const generatePresalesFiles = async (round: PresalesRound, actions: PresalesRoundAction[], invocation: ModelInvocation) => {
    if (!validateResponseActions(round, actions)) return;
    if (!window.confirm(locale === "zh" ? "是否使用模型生成该文件？" : "Use the configured model to generate this file?")) return;

    setGeneratingActionId(actions.length === 1 ? `file-${actions[0].id}` : `batch-file-${round.id}`);
    setBusy(true);
    try {
      let nextProject = project;
      const nextFiles = new Map(sourceFiles);
      const nextBlobs = new Map(generatedBlobs);
      const pendingWrites: Array<{ name: string; blob: Blob }> = [];

      for (const action of actions) {
        const currentRound = nextProject.presalesRounds.find((item) => item.id === round.id) || round;
        const target = getActionResponseTarget(currentRound, action);
        if (!target.name || !target.format) throw new Error("RESPONSE_FILE_CONFIG_REQUIRED");
        const prompt = buildPresalesPrompt(nextProject, currentRound, locale, action);
        const draft = await requestPresalesDraft(invocation.settings, invocation.apiKey, prompt);
        const generated = await createGeneratedFile(draft.content, target.name, target.format);
        const generatedFile = new File([generated.blob], generated.name, { type: generated.blob.type });
        const source = await parseSourceFile(generatedFile);
        const record: PresalesGeneratedFile = {
          id: createId("generated"),
          name: generated.name,
          format: target.format,
          createdAt: new Date().toISOString(),
          provider: draft.provider,
          model: draft.model,
          sourceId: source.id,
          relativePath: `projects/${project.id}/outputs/${generated.name}`,
          actionId: action.id,
        };
        nextFiles.set(source.id, generatedFile);
        nextBlobs.set(record.id, generated.blob);
        pendingWrites.push({ name: generated.name, blob: generated.blob });
        nextProject = syncProjectStage({
          ...nextProject,
          sources: [...nextProject.sources, source],
          presalesRounds: nextProject.presalesRounds.map((item) => item.id === round.id ? { ...item, generatedFiles: [...item.generatedFiles, record] } : item),
          updatedAt: new Date().toISOString(),
        });
      }

      if (directoryHandle) {
        for (const file of pendingWrites) await saveGeneratedFileToDirectory(directoryHandle, nextProject, file.name, file.blob);
        await saveProjectStateToDirectory(directoryHandle, nextProject, nextFiles);
      }
      commitProject(nextProject);
      setSourceFiles(nextFiles);
      setGeneratedBlobs(nextBlobs);
      setNotice(locale === "zh" ? `${pendingWrites.length} 个响应文件已生成${directoryHandle ? "并写入项目目录" : ""}。` : `${pendingWrites.length} response file(s) generated${directoryHandle ? " and written to the project folder" : ""}.`);
    } catch {
      setNotice(locale === "zh" ? "文件生成失败，请检查模型服务、跨域授权和接口配置。" : "Generation failed. Check the model service, CORS permission, and endpoint settings.");
    } finally {
      setBusy(false);
      setGeneratingActionId("");
    }
  };

  const generateCustomerAnalysisTask = async (round: PresalesRound) => {
    const inputs = customerAnalysisInputs(round);
    if (!inputs) return;
    setGeneratingActionId(`task-analysis-${round.id}`);
    setBusy(true);
    try {
      const task = buildCodexCustomerAnalysisTask(project, round, inputs.selectedSources, inputs.selectedTemplates, locale);
      if (supportsDirectoryAccess()) {
        const outputDirectory = await chooseTaskOutputDirectory(directoryHandle);
        await saveTaskFileToDirectory(outputDirectory, task.name, task.content);
        setNotice(locale === "zh" ? `大模型任务已保存到“${outputDirectory.name}”。` : `Model task saved to “${outputDirectory.name}”.`);
      } else {
        downloadText(task.name, task.content, "text/markdown;charset=utf-8");
        setNotice(locale === "zh" ? "大模型任务已下载。" : "Model task downloaded.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setNotice(locale === "zh" ? "已取消保存任务。" : "Task saving cancelled.");
      else setNotice(locale === "zh" ? "任务文件保存失败，请重新选择可写目录。" : "The task could not be saved. Select a writable folder and try again.");
    } finally {
      setBusy(false);
      setGeneratingActionId("");
    }
  };

  const startCustomerAnalysis = (round: PresalesRound) => {
    const invocation = configuredModel();
    if (invocation) {
      void analyzeCustomerSources(round, invocation);
      return;
    }
    setPendingModelAction({ kind: "customer-analysis", roundId: round.id, anchorId: `communication-${round.id}` });
  };

  const startPresalesFiles = (round: PresalesRound, actions: PresalesRoundAction[]) => {
    const invocation = configuredModel();
    if (invocation) {
      void generatePresalesFiles(round, actions, invocation);
      return;
    }
    const anchorId = actions.length === 1 ? `response-action-${actions[0].id}` : `communication-${round.id}`;
    setPendingModelAction({ kind: "response-files", roundId: round.id, actionIds: actions.map((action) => action.id), anchorId });
  };

  const alertBidTemplateMismatch = (sourceName: string, format: TenderOutputFormat) => {
    const target = format === "docx" ? "Word" : format === "pptx" ? "PPT" : format === "xlsx" ? "Excel" : "Markdown";
    window.alert(locale === "zh"
      ? `模板“${sourceName}”与 ${target} 输出格式不匹配，请更换模板或输出格式。`
      : `Template “${sourceName}” does not match the ${target} output format. Choose another template or output format.`);
  };

  const importBidFiles = async (item: BidFileChecklistItem, files: FileList | null, kind: "template" | "reference") => {
    if (!files?.length) return;
    setBusy(true);
    setNotice(`${t.parsing}…`);
    try {
      const parsed: SourceDocument[] = [];
      const nextFiles = new Map(sourceFiles);
      for (const file of Array.from(files)) {
        const rawSource = await parseSourceFile(file);
        const source: SourceDocument = hasReadableSourceText(rawSource) ? {
          ...rawSource,
          preprocessStatus: "ready",
          preprocessedAt: new Date().toISOString(),
          preprocessMessage: locale === "zh" ? "上传并预处理完成" : "Uploaded and preprocessed",
        } : rawSource;
        parsed.push(source);
        nextFiles.set(source.id, file);
      }
      const sourceIds = parsed.map((source) => source.id);
      const mismatched = kind === "template" && item.outputFormat
        ? parsed.filter((source) => tenderTemplateFileFormat(source.name) !== item.outputFormat)
        : [];
      const selectableIds = sourceIds.filter((id) => !mismatched.some((source) => source.id === id));
      const nextItem: BidFileChecklistItem = kind === "template" ? {
        ...item,
        templateSourceIds: [...new Set([...item.templateSourceIds, ...sourceIds])],
        selectedTemplateSourceIds: [...new Set([...item.selectedTemplateSourceIds, ...selectableIds])],
      } : {
        ...item,
        referenceSourceIds: [...new Set([...item.referenceSourceIds, ...sourceIds])],
        selectedReferenceSourceIds: [...new Set([...item.selectedReferenceSourceIds, ...sourceIds])],
      };
      const nextProject = syncProjectStage({
        ...project,
        sources: [...project.sources, ...parsed],
        bidFileChecklist: project.bidFileChecklist.map((candidate) => candidate.id === item.id ? nextItem : candidate),
        updatedAt: new Date().toISOString(),
      });
      commitProject(nextProject);
      setSourceFiles(nextFiles);
      await persistSourceFiles(project.id, new Map(parsed.map((source) => [source.id, nextFiles.get(source.id) as File]))).catch(() => undefined);
      if (directoryHandle) await saveProjectStateToDirectory(directoryHandle, nextProject, nextFiles);
      if (mismatched[0] && item.outputFormat) alertBidTemplateMismatch(mismatched[0].name, item.outputFormat);
      setNotice(locale === "zh" ? `${parsed.length} 个文件已导入。` : `${parsed.length} file(s) imported.`);
    } catch {
      setNotice(locale === "zh" ? "文件导入失败，请检查文件格式。" : "Import failed. Check the file format.");
    } finally {
      setBusy(false);
    }
  };

  const removeBidSource = async (item: BidFileChecklistItem, sourceId: string, kind: "template" | "reference") => {
    const nextItem: BidFileChecklistItem = kind === "template" ? {
      ...item,
      templateSourceIds: item.templateSourceIds.filter((id) => id !== sourceId),
      selectedTemplateSourceIds: item.selectedTemplateSourceIds.filter((id) => id !== sourceId),
    } : {
      ...item,
      referenceSourceIds: item.referenceSourceIds.filter((id) => id !== sourceId),
      selectedReferenceSourceIds: item.selectedReferenceSourceIds.filter((id) => id !== sourceId),
    };
    const detached = syncProjectStage({
      ...project,
      bidFileChecklist: project.bidFileChecklist.map((candidate) => candidate.id === item.id ? nextItem : candidate),
      updatedAt: new Date().toISOString(),
    });
    const removeSource = !sourceIsReferenced(detached, sourceId);
    const nextProject = removeSource ? { ...detached, sources: detached.sources.filter((source) => source.id !== sourceId) } : detached;
    const source = project.sources.find((candidate) => candidate.id === sourceId);
    const nextFiles = new Map(sourceFiles);
    if (removeSource) {
      nextFiles.delete(sourceId);
      await removePersistedSourceFile(project.id, sourceId).catch(() => undefined);
    }
    commitProject(nextProject);
    setSourceFiles(nextFiles);
    if (directoryHandle) {
      if (removeSource && source) await removeWorkspaceFileFromRelativePath(directoryHandle, `projects/${project.id}/sources/${source.name}`).catch(() => undefined);
      await saveProjectStateToDirectory(directoryHandle, nextProject, nextFiles).catch(() => undefined);
    }
  };

  const toggleBidTemplate = (item: BidFileChecklistItem, sourceId: string) => {
    const selected = item.selectedTemplateSourceIds.includes(sourceId);
    if (!selected && item.outputFormat) {
      const source = project.sources.find((candidate) => candidate.id === sourceId);
      if (source && tenderTemplateFileFormat(source.name) !== item.outputFormat) {
        alertBidTemplateMismatch(source.name, item.outputFormat);
        return;
      }
    }
    updateBidFile(item.id, { selectedTemplateSourceIds: selected ? item.selectedTemplateSourceIds.filter((id) => id !== sourceId) : [...item.selectedTemplateSourceIds, sourceId] });
  };

  const setBidOutputFormat = (item: BidFileChecklistItem, format: TenderOutputFormat | "") => {
    if (format) {
      const mismatch = item.selectedTemplateSourceIds
        .map((id) => project.sources.find((source) => source.id === id))
        .find((source) => source && tenderTemplateFileFormat(source.name) !== format);
      if (mismatch) {
        alertBidTemplateMismatch(mismatch.name, format);
        return;
      }
    }
    updateBidFile(item.id, { outputFormat: format || undefined });
  };

  const bidFileInputs = (item: BidFileChecklistItem, requireReadableReferences = false) => {
    if (!item.outputFormat) {
      window.alert(locale === "zh" ? "请先选择输出格式。" : "Select an output format first.");
      return null;
    }
    const templates = item.selectedTemplateSourceIds.map((id) => project.sources.find((source) => source.id === id)).filter((source): source is SourceDocument => Boolean(source));
    const mismatch = templates.find((source) => tenderTemplateFileFormat(source.name) !== item.outputFormat);
    if (mismatch) {
      alertBidTemplateMismatch(mismatch.name, item.outputFormat);
      return null;
    }
    const references = item.selectedReferenceSourceIds.map((id) => project.sources.find((source) => source.id === id)).filter((source): source is SourceDocument => Boolean(source));
    if (requireReadableReferences) {
      const unreadable = references.find((source) => source.requiresOcr || !source.segments.some((segment) => segment.text.trim()));
      if (unreadable) {
        window.alert(locale === "zh" ? `参考资料“${unreadable.name}”无法提取文本，请先转换为可读取文件，或选择“输出任务”交由 Codex 处理原文件。` : `Reference “${unreadable.name}” has no extractable text. Convert it first or output a Codex task to process the original file.`);
        return null;
      }
    }
    return { templates, references, outputFormat: item.outputFormat };
  };

  const generateBidFile = async (item: BidFileChecklistItem, invocation: ModelInvocation) => {
    const inputs = bidFileInputs(item, true);
    if (!inputs) return;
    setBusy(true);
    setGeneratingActionId(`bid-output-${item.id}`);
    try {
      const prompt = buildBidFilePrompt(project, item, inputs.references, inputs.templates, locale);
      const draft = await requestPresalesDraft(invocation.settings, invocation.apiKey, prompt);
      const generated = await createTenderGeneratedFile(draft.content, item.title, inputs.outputFormat);
      const generatedFile = new File([generated.blob], generated.name, { type: generated.blob.type });
      const parsedOutput = await parseSourceFile(generatedFile);
      const source: SourceDocument = {
        ...parsedOutput,
        preprocessStatus: "ready",
        preprocessedAt: new Date().toISOString(),
        preprocessMessage: locale === "zh" ? "模型生成文件" : "Model-generated file",
      };
      const folderName = safeDirectoryName("投标阶段-投标文件输出");
      const relativePath = directoryHandle
        ? await saveAnalysisFileToDirectory(directoryHandle, project, folderName, generated.name, generated.blob)
        : `downloads/${generated.name}`;
      const record: BidGeneratedFile = {
        id: createId("bid-output"),
        name: generated.name,
        format: inputs.outputFormat,
        createdAt: new Date().toISOString(),
        provider: draft.provider,
        model: draft.model,
        sourceId: source.id,
        relativePath,
        referenceSourceIds: inputs.references.map((candidate) => candidate.id),
        templateSourceIds: inputs.templates.map((candidate) => candidate.id),
        detailRequirements: item.detailRequirements,
      };
      const nextFiles = new Map(sourceFiles).set(source.id, generatedFile);
      const nextProject = syncProjectStage({
        ...project,
        sources: [...project.sources, source],
        bidFileChecklist: project.bidFileChecklist.map((candidate) => candidate.id === item.id ? { ...candidate, status: "confirmed", generatedFiles: [...candidate.generatedFiles, record] } : candidate),
        updatedAt: new Date().toISOString(),
      });
      commitProject(nextProject);
      setSourceFiles(nextFiles);
      setGeneratedBlobs((current) => new Map(current).set(record.id, generated.blob));
      await persistSourceFiles(project.id, new Map([[source.id, generatedFile]])).catch(() => undefined);
      if (directoryHandle) await saveProjectStateToDirectory(directoryHandle, nextProject, nextFiles);
      else downloadBlob(generated.name, generated.blob);
      setNotice(locale === "zh" ? `“${generated.name}”已生成。` : `“${generated.name}” generated.`);
    } catch {
      setNotice(locale === "zh" ? "投标文件生成失败，请检查模型服务、参考资料和接口配置。" : "Bid file generation failed. Check the model service, references, and API settings.");
    } finally {
      setBusy(false);
      setGeneratingActionId("");
    }
  };

  const startBidFileGeneration = (item: BidFileChecklistItem) => {
    const invocation = configuredModel();
    if (invocation) {
      void generateBidFile(item, invocation);
      return;
    }
    if (!bidFileInputs(item)) return;
    setPendingModelAction({ kind: "bid-output", bidFileId: item.id, anchorId: `bid-output-${item.id}` });
  };

  const openBidGeneratedFile = async (record: BidGeneratedFile) => {
    try {
      const file = generatedBlobs.get(record.id) || sourceFiles.get(record.sourceId) || (directoryHandle ? await readWorkspaceFileFromRelativePath(directoryHandle, record.relativePath) : null);
      if (!file) throw new Error("FILE_NOT_AVAILABLE");
      if (record.format === "md") {
        const url = URL.createObjectURL(file);
        window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else downloadBlob(record.name, file);
    } catch {
      setNotice(locale === "zh" ? "找不到该投标文件，请重新选择项目路径。" : "The bid file is unavailable. Select the project folder again.");
    }
  };

  const removeBidGeneratedFile = async (item: BidFileChecklistItem, record: BidGeneratedFile) => {
    const detached = syncProjectStage({
      ...project,
      bidFileChecklist: project.bidFileChecklist.map((candidate) => candidate.id === item.id ? { ...candidate, generatedFiles: candidate.generatedFiles.filter((file) => file.id !== record.id) } : candidate),
      updatedAt: new Date().toISOString(),
    });
    const removeSource = !sourceIsReferenced(detached, record.sourceId);
    const nextProject = removeSource ? { ...detached, sources: detached.sources.filter((source) => source.id !== record.sourceId) } : detached;
    const nextFiles = new Map(sourceFiles);
    const nextBlobs = new Map(generatedBlobs);
    if (removeSource) {
      nextFiles.delete(record.sourceId);
      await removePersistedSourceFile(project.id, record.sourceId).catch(() => undefined);
    }
    nextBlobs.delete(record.id);
    commitProject(nextProject);
    setSourceFiles(nextFiles);
    setGeneratedBlobs(nextBlobs);
    if (directoryHandle) {
      await removeWorkspaceFileFromRelativePath(directoryHandle, record.relativePath).catch(() => undefined);
      await saveProjectStateToDirectory(directoryHandle, nextProject, nextFiles).catch(() => undefined);
    }
  };

  useEffect(() => {
    if (!ready || !filesHydrated || !resumeModelAction) return;
    const pending = resumeModelAction;
    setResumeModelAction(null);
    const invocation = configuredModel();
    if (!invocation) {
      setPendingModelAction(pending);
      return;
    }
    if (pending.kind === "tender-ocr") void performTenderOcr(pending.sourceIds, invocation);
    else if (pending.kind === "tender-analysis") void runTenderAnalysis("analysis", invocation);
    else if (pending.kind === "tender-comparison") void runTenderAnalysis("comparison", invocation);
    else if (pending.kind === "bid-output") {
      const item = project.bidFileChecklist.find((candidate) => candidate.id === pending.bidFileId);
      if (item) void generateBidFile(item, invocation);
    }
  }, [filesHydrated, ready, resumeModelAction]);

  const saveTenderTask = async (task: { name: string; content: string }) => {
    setBusy(true);
    try {
      if (supportsDirectoryAccess()) {
        const outputDirectory = await chooseTaskOutputDirectory(directoryHandle);
        await saveTaskFileToDirectory(outputDirectory, task.name, task.content);
        setNotice(locale === "zh" ? `大模型任务已保存到“${outputDirectory.name}”。` : `Model task saved to “${outputDirectory.name}”.`);
      } else {
        downloadText(task.name, task.content, "text/markdown;charset=utf-8");
        setNotice(locale === "zh" ? "大模型任务已下载。" : "Model task downloaded.");
      }
    } catch {
      setNotice(locale === "zh" ? "任务文件保存失败。" : "The task file could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const outputPendingModelTask = () => {
    const pending = pendingModelAction;
    setPendingModelAction(null);
    if (!pending) return;
    if (pending.kind === "tender-ocr") {
      const sources = pending.sourceIds.map((id) => project.sources.find((source) => source.id === id)).filter((source): source is SourceDocument => Boolean(source));
      void saveTenderTask(buildCodexOcrTask(project, sources, locale));
      return;
    }
    if (pending.kind === "tender-analysis" || pending.kind === "tender-comparison") {
      const kind = pending.kind === "tender-analysis" ? "analysis" : "comparison";
      const inputs = tenderAnalysisInputs(kind);
      if (!inputs) return;
      const prompt = kind === "analysis"
        ? buildTenderAnalysisPrompt(project, inputs.tenderSources, inputs.clarificationSources, inputs.templates, locale)
        : buildTenderComparisonPrompt(project, inputs.presalesSources, inputs.tenderSources, inputs.clarificationSources, inputs.templates, locale);
      void saveTenderTask(buildCodexTenderTask(kind === "analysis" ? "requirements" : "comparison", project, prompt, inputs.outputFormat, locale));
      return;
    }
    if (pending.kind === "bid-output") {
      const item = project.bidFileChecklist.find((candidate) => candidate.id === pending.bidFileId);
      if (!item) return;
      const inputs = bidFileInputs(item);
      if (!inputs) return;
      void saveTenderTask(buildCodexBidFileTask(project, item, inputs.references, inputs.templates, locale));
      return;
    }
    const round = project.presalesRounds.find((item) => item.id === pending.roundId);
    if (!round) return;
    if (pending.kind === "customer-analysis") {
      void generateCustomerAnalysisTask(round);
      return;
    }
    const actions = pending.actionIds
      .map((id) => round.actions.find((action) => action.id === id))
      .filter((action): action is PresalesRoundAction => Boolean(action));
    void generatePresalesTasks(round, actions);
  };

  const openGeneratedFile = async (record: PresalesGeneratedFile) => {
    try {
      const file = generatedBlobs.get(record.id) || sourceFiles.get(record.sourceId) || (directoryHandle ? await readGeneratedFileFromDirectory(directoryHandle, project, record.name) : null);
      if (!file) throw new Error("FILE_NOT_AVAILABLE");
      if (record.format === "md") {
        const url = URL.createObjectURL(file);
        window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else downloadBlob(record.name, file);
    } catch {
      setNotice(locale === "zh" ? "当前会话中找不到该文件，请重新选择项目路径后再试。" : "The file is unavailable in this session. Select the project folder and try again.");
    }
  };

  const resetCurrentProject = () => {
    const previousProjectId = project.id;
    commitProject(syncProjectStage(createEmptyProject(locale)));
    setSourceFiles(new Map());
    setGeneratedBlobs(new Map());
    setSelectedSourceId("");
    setSelectedRequirementId("");
    setSelectedActionIds(new Set());
    setExpandedTenderSourceId("");
    setExpandedTenderResultId("");
    setExpandedBidFileId("");
    void clearPersistedSourceFiles(previousProjectId).catch(() => undefined);
  };

  const chooseDirectory = async () => {
    setBusy(true);
    try {
      const handle = await chooseWorkspaceDirectory();
      await persistWorkspaceDirectory(handle);
      setDirectoryHandle(handle);
      await saveProjectStateToDirectory(handle, project, sourceFiles);
      setNotice(`${locale === "zh" ? "项目路径已设置" : "Project folder selected"}: ${handle.name}`);
    } catch {
      setNotice(locale === "zh" ? "未选择目录，可继续使用 ZIP。" : "No folder selected. ZIP remains available.");
    } finally { setBusy(false); }
  };
  const syncDirectory = async () => {
    if (!directoryHandle) return;
    setBusy(true);
    try {
      await saveProjectToDirectory(directoryHandle, project, sourceFiles);
      setNotice(t.folderSaved);
    } catch {
      setNotice(t.invalid);
    } finally { setBusy(false); }
  };
  const rescanDirectory = async () => {
    if (!directoryHandle) return;
    setBusy(true);
    try {
      commitProject(syncProjectStage(await loadActiveProject(directoryHandle)));
      setNotice(t.loaded);
    } catch {
      setNotice(t.invalid);
    } finally { setBusy(false); }
  };
  const importArchive = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const imported = await importProjectArchive(file);
      const nextProject = syncProjectStage(imported.project);
      commitProject(nextProject);
      setSourceFiles(imported.sourceFiles);
      if (directoryHandle) await saveProjectStateToDirectory(directoryHandle, nextProject, imported.sourceFiles);
      setNotice(t.loaded);
    } catch { setNotice(t.invalid); }
    finally { setBusy(false); if (archiveInput.current) archiveInput.current.value = ""; }
  };
  const exportArchive = async () => {
    setBusy(true);
    try {
      const result = await buildProjectArchive(project, includeSources, sourceFiles);
      const name = `${projectFileStem(project)}-package.zip`;
      if (directoryHandle) await saveGeneratedFileToDirectory(directoryHandle, project, name, result.blob);
      else downloadBlob(name, result.blob);
      setNotice(locale === "zh"
        ? `ZIP 已生成，包含 ${result.manifest.files.length} 个正式输出${directoryHandle ? "，并已保存到项目路径" : ""}。`
        : `ZIP created with ${result.manifest.files.length} formal outputs${directoryHandle ? " and saved to the project folder" : ""}.`);
    } finally { setBusy(false); }
  };

  const saveOutput = async (name: string, content: Blob | string | ArrayBuffer | Promise<Blob | string | ArrayBuffer>, type: string) => {
    setBusy(true);
    try {
      const resolved = await content;
      if (directoryHandle) {
        await saveGeneratedFileToDirectory(directoryHandle, project, name, resolved);
        setNotice(locale === "zh" ? `${name} 已保存到项目路径。` : `${name} saved to the project folder.`);
      } else if (typeof resolved === "string") downloadText(name, resolved, type);
      else downloadBlob(name, resolved instanceof Blob ? resolved : new Blob([resolved], { type }));
    } catch {
      setNotice(t.invalid);
    } finally { setBusy(false); }
  };

  const taskPrompt = useMemo(() => {
    const path = directoryHandle
      ? `<${locale === "zh" ? `请在 Codex 中指定已选择的“${directoryHandle.name}”文件夹完整路径` : `specify the full path of the selected “${directoryHandle.name}” folder in Codex`}>`
      : `<${locale === "zh" ? "请在 Codex 中指定项目目录的完整路径" : "specify the full project folder path in Codex"}>`;
    if (locale === "zh") {
      if (taskKind === "extract") return `使用 $tender-requirement-extraction 处理工作区 ${path} 中项目 ${project.id}。读取 sources 目录的招标文件及澄清文件，逐条保留页码或段落来源，输出 requirements.csv、requirements.md 和更新后的 project.json。不得把缺少证据的要求写成满足。`;
      if (taskKind === "bid") return `使用 $technical-bid-package 处理工作区 ${path} 中项目 ${project.id}。只使用已复核的招标要求和 library 中已核验资料，生成技术方案、响应表、偏离表、部署与验收文件以及 presentation.md。未知、缺少证据和商务价格事项必须保留待确认。`;
      return `使用 $solution-workflow 处理工作区 ${path} 中项目 ${project.id}。按售前、招标要求、技术标和中标交底流程检查现状，必要时调用 $tender-requirement-extraction 与 $technical-bid-package。完成后更新 project.json 和 outputs，并列出仍需人工确认的事项。`;
    }
    if (taskKind === "extract") return `Use $tender-requirement-extraction for project ${project.id} in workspace ${path}. Read the tender and amendment files under sources, preserve a page or paragraph locator for every requirement, and produce requirements.csv, requirements.md, and an updated project.json. Never mark a requirement as compliant when evidence is missing.`;
    if (taskKind === "bid") return `Use $technical-bid-package for project ${project.id} in workspace ${path}. Use only reviewed tender requirements and verified materials from library. Produce the technical proposal, response matrix, deviation table, deployment and acceptance documents, and presentation.md. Keep unknown items, evidence gaps, and commercial pricing matters pending for human review.`;
    return `Use $solution-workflow for project ${project.id} in workspace ${path}. Review the presales, tender requirement, technical bid, and award handover stages. Call $tender-requirement-extraction and $technical-bid-package when needed. Update project.json and outputs, then list every item that still requires human confirmation.`;
  }, [directoryHandle, project.id, taskKind, locale]);

  const renderProjectContext = () => <section className="work-section">
    <div className="section-heading">
      <div><p>{t.projectEyebrow}</p><h2>{t.projectContext}</h2></div>
      <span>{project.schemaVersion}</span>
    </div>
    <div className="field-grid">
      <Field label={t.projectName}><input value={project.name} onChange={(event) => updateProject("name", event.target.value)} /></Field>
      <Field label={t.customer}><input value={project.customerAlias} onChange={(event) => updateProject("customerAlias", event.target.value)} /></Field>
      <Field label={t.industry}><input value={project.industry} onChange={(event) => updateProject("industry", event.target.value)} /></Field>
      <Field label={t.owner}><input value={project.owner} onChange={(event) => updateProject("owner", event.target.value)} /></Field>
      <Field label={t.budget}><input value={project.budget} onChange={(event) => updateProject("budget", event.target.value)} /></Field>
      <Field label={t.deadline}><input type="date" value={project.deadline} onChange={(event) => updateProject("deadline", event.target.value)} /></Field>
      <Field label={t.objective} wide><textarea rows={4} value={project.objective} onChange={(event) => updateProject("objective", event.target.value)} /></Field>
      <Field label={t.constraints} wide><textarea rows={4} value={project.constraints} onChange={(event) => updateProject("constraints", event.target.value)} /></Field>
    </div>
  </section>;

  const renderPresales = () => <>
    {renderProjectContext()}
    <section className="work-section">
      <div className="section-heading"><div><p>{t.meetingEyebrow}</p><h2>{locale === "zh" ? "客户沟通与文件响应" : "Customer communications and file responses"}</h2></div><button className="icon-command" type="button" onClick={() => updateProject("presalesRounds", [...project.presalesRounds, createPresalesRound(locale, project.presalesRounds.length + 1)])} title={locale === "zh" ? "新增沟通节点" : "Add communication node"} aria-label={locale === "zh" ? "新增沟通节点" : "Add communication node"}><Plus size={18}/></button></div>
      <div className="presales-rounds">
        <div className="presales-round-head"><span>{locale === "zh" ? "沟通节点" : "Communication"}</span><span>{locale === "zh" ? "客户信息及需求" : "Customer information and needs"}</span><span>{locale === "zh" ? "执行清单与生成要求" : "Actions and generation request"}</span><span>{locale === "zh" ? "生成文件列表" : "Generated files"}</span></div>
        {project.presalesRounds.map((round, roundIndex) => {
          const priorGeneratedIds = project.presalesRounds.slice(0, roundIndex + 1).flatMap((item) => item.generatedFiles.map((file) => file.sourceId));
          const candidateIds = [...new Set([...priorGeneratedIds, ...round.referenceSourceIds])];
          const referenceCandidates = candidateIds.map((id) => project.sources.find((source) => source.id === id)).filter(Boolean);
          const customerSources = round.requirementSourceIds.map((id) => project.sources.find((source) => source.id === id)).filter(Boolean);
          const selectedCustomerIds = selectedCustomerSourceIds(round);
          const templateSources = round.templateSourceIds.map((id) => project.sources.find((source) => source.id === id)).filter(Boolean);
          const participantDraft = participantDrafts[round.id] || { name: "", category: "customer" as const };
          return <article className="presales-round" id={`communication-${round.id}`} key={round.id}>
            <div className="round-node">
              <span className="round-cell-label">{locale === "zh" ? "沟通节点" : "Communication"}</span>
              <input aria-label={locale === "zh" ? "沟通节点名称" : "Communication name"} value={round.title} onChange={(event) => updatePresalesRound(round.id, { title: event.target.value })}/>
              <input aria-label={locale === "zh" ? "沟通时间" : "Communication time"} type="datetime-local" value={round.meetingAt} onChange={(event) => updatePresalesRound(round.id, { meetingAt: event.target.value })}/>
              <div className="participant-editor">
                <strong>{locale === "zh" ? "参与沟通人员" : "Participants"}</strong>
                <select aria-label={locale === "zh" ? "参会人员类别" : "Participant category"} value={participantDraft.category} onChange={(event) => setParticipantDrafts((current) => ({ ...current, [round.id]: { ...participantDraft, category: event.target.value as PresalesParticipant["category"] } }))}>{Object.entries(participantCategoryLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
                <div className="participant-input-row"><input aria-label={locale === "zh" ? "参会人员" : "Participant name"} placeholder={locale === "zh" ? "输入姓名或角色" : "Name or role"} value={participantDraft.name} onChange={(event) => setParticipantDrafts((current) => ({ ...current, [round.id]: { ...participantDraft, name: event.target.value } }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addRoundParticipant(round); } }}/><button className="icon-command" type="button" aria-label={locale === "zh" ? "新增参会人员" : "Add participant"} title={locale === "zh" ? "新增参会人员" : "Add participant"} onClick={() => addRoundParticipant(round)}><Plus size={16}/></button></div>
                {round.participants.length > 0 && <div className="participant-groups">{(["customer", "third-party", "internal"] as const).map((category) => {
                  const participants = round.participants.filter((participant) => participant.category === category);
                  return participants.length > 0 && <div key={category}><span>{participantCategoryLabels[locale][category]}</span><div>{participants.map((participant) => <span key={participant.id}>{participant.name}<button type="button" aria-label={locale === "zh" ? `删除参会人员 ${participant.name}` : `Delete participant ${participant.name}`} title={locale === "zh" ? "删除参会人员" : "Delete participant"} onClick={() => updatePresalesRound(round.id, { participants: round.participants.filter((item) => item.id !== participant.id) })}><X size={12}/></button></span>)}</div></div>;
                })}</div>}
              </div>
              <button className="row-delete" type="button" title={t.remove} aria-label={`${t.remove}: ${round.title}`} onClick={() => updateProject("presalesRounds", project.presalesRounds.filter((item) => item.id !== round.id))}><Trash2 size={17}/></button>
            </div>
            <div className="round-needs">
              <span className="round-cell-label">{locale === "zh" ? "客户信息及需求" : "Customer information and needs"}</span>
              <label className="file-command"><Upload size={16}/>{locale === "zh" ? "导入客户附件" : "Import customer attachments"}<input hidden multiple type="file" accept=".pdf,.docx,.xlsx,.pptx,.md,.txt,.csv,.json" onChange={(event) => { void importPresalesFiles(event.target.files, { kind: "requirements", roundId: round.id }); event.currentTarget.value = ""; }}/></label>
              {customerSources.length > 0 && <div className="customer-source-panel">
                <div className="analysis-panel-heading"><strong>{locale === "zh" ? "已导入客户附件" : "Imported customer attachments"}</strong><label className="compact-check"><input type="checkbox" aria-label={locale === "zh" ? "全选客户附件" : "Select all customer attachments"} checked={round.requirementSourceIds.every((id) => selectedCustomerIds.includes(id))} onChange={(event) => selectAllCustomerSources(round, event.target.checked)}/><span><Check size={13}/></span>{locale === "zh" ? "全选" : "Select all"}</label></div>
                <div className="customer-source-list">{customerSources.map((source) => source && <div key={source.id}>
                  <label><input type="checkbox" aria-label={locale === "zh" ? `选择客户附件 ${source.name}` : `Select customer attachment ${source.name}`} checked={selectedCustomerIds.includes(source.id)} onChange={(event) => toggleCustomerSource(round, source.id, event.target.checked)}/><span><Check size={13}/></span><FileText size={15}/><strong>{source.name}</strong></label>
                  <button className="row-delete" type="button" title={locale === "zh" ? "删除客户附件" : "Delete customer attachment"} aria-label={locale === "zh" ? `删除客户附件 ${source.name}` : `Delete customer attachment ${source.name}`} onClick={() => void removePresalesSource(round, source.id, "requirements")}><Trash2 size={15}/></button>
                </div>)}</div>
              </div>}
              <div className="analysis-config-block keyword-config">
                <strong>{locale === "zh" ? "关键词" : "Keywords"}</strong>
                <div className="keyword-input-row"><input aria-label={locale === "zh" ? "新增关键词" : "New keyword"} value={keywordDrafts[round.id] || ""} onChange={(event) => setKeywordDrafts((current) => ({ ...current, [round.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addAnalysisKeyword(round, keywordDrafts[round.id] || ""); } }}/><button className="icon-command" type="button" aria-label={locale === "zh" ? "添加关键词" : "Add keyword"} title={locale === "zh" ? "添加关键词" : "Add keyword"} onClick={() => addAnalysisKeyword(round, keywordDrafts[round.id] || "")}><Plus size={17}/></button></div>
                <div className="recommended-keywords"><span>{locale === "zh" ? "推荐关键词" : "Recommended"}</span><div>{recommendedAnalysisKeywords[locale].map((keyword) => <button type="button" key={keyword} disabled={round.keywords.includes(keyword)} onClick={() => addAnalysisKeyword(round, keyword)}>{keyword}</button>)}</div></div>
                {round.keywords.length > 0 && <div className="selected-keywords">{round.keywords.map((keyword) => <span key={keyword}>{keyword}<button type="button" aria-label={locale === "zh" ? `删除关键词 ${keyword}` : `Delete keyword ${keyword}`} title={locale === "zh" ? "删除关键词" : "Delete keyword"} onClick={() => updatePresalesRound(round.id, { keywords: round.keywords.filter((item) => item !== keyword) })}><X size={13}/></button></span>)}</div>}
              </div>
              <Field label={locale === "zh" ? "分析要求" : "Analysis requirements"}><textarea rows={5} aria-label={locale === "zh" ? "分析要求" : "Analysis requirements"} placeholder={locale === "zh" ? "输入模型分析时需要遵循的提示词、重点和输出要求" : "Enter the prompt, priorities, and output requirements for the model"} value={round.analysisRequirements} onChange={(event) => updatePresalesRound(round.id, { analysisRequirements: event.target.value })}/></Field>
              <div className="analysis-config-block template-config">
                <label className="file-command"><Upload size={16}/>{locale === "zh" ? "上传模板" : "Upload templates"}<input hidden multiple type="file" accept=".docx,.pptx,.md" onChange={(event) => { void importPresalesFiles(event.target.files, { kind: "templates", roundId: round.id }); event.currentTarget.value = ""; }}/></label>
                {templateSources.length > 0 && <div className="template-source-list">{templateSources.map((source) => source && <div className={round.selectedTemplateSourceIds.includes(source.id) ? "selected" : ""} key={source.id}><button type="button" aria-pressed={round.selectedTemplateSourceIds.includes(source.id)} onClick={() => toggleAnalysisTemplate(round, source.id)}><FileText size={15}/><span>{source.name}</span></button><button className="row-delete" type="button" aria-label={locale === "zh" ? `删除模板 ${source.name}` : `Delete template ${source.name}`} title={locale === "zh" ? "删除模板" : "Delete template"} onClick={() => void removePresalesSource(round, source.id, "templates")}><X size={14}/></button></div>)}</div>}
                <Field label={locale === "zh" ? "文件格式" : "Output format"}><select aria-label={locale === "zh" ? "分析结果文件格式" : "Analysis result output format"} value={round.analysisOutputFormat || ""} onChange={(event) => setAnalysisOutputFormat(round, event.target.value as ResponseFileFormat | "")}><option value="">{locale === "zh" ? "请选择" : "Select"}</option><option value="docx">Word</option><option value="pptx">PPT</option><option value="md">Markdown</option></select></Field>
              </div>
              <button className="generate-command analysis-command" type="button" disabled={busy || !round.requirementSourceIds.length} onClick={() => startCustomerAnalysis(round)}><Sparkles size={17}/>{analyzingRoundId === round.id ? (locale === "zh" ? "正在分析" : "Analyzing") : (locale === "zh" ? "需求分析" : "Analyze requirements")}</button>
              {round.analysisResults.length > 0 && <div className="analysis-result-list"><strong>{locale === "zh" ? "分析结果" : "Analysis results"}</strong>{round.analysisResults.map((result) => <article className={expandedAnalysisId === result.id ? "expanded" : ""} key={result.id}>
                <div><button type="button" onClick={() => { updatePresalesRound(round.id, { analysisRequirements: result.prompt }); setExpandedAnalysisId(expandedAnalysisId === result.id ? "" : result.id); }}><FileCheck2 size={16}/><span>{result.name}</span></button><button className="row-delete" type="button" aria-label={locale === "zh" ? `删除分析结果 ${result.name}` : `Delete analysis result ${result.name}`} title={locale === "zh" ? "删除分析结果" : "Delete analysis result"} onClick={() => void removeAnalysisResult(round, result)}><X size={14}/></button></div>
                {expandedAnalysisId === result.id && <button className="open-analysis-file" type="button" onClick={() => void openAnalysisResult(result)}><ExternalLink size={15}/>{locale === "zh" ? `打开文件 · ${result.fileName}` : `Open file · ${result.fileName}`}</button>}
              </article>)}</div>}
            </div>
            <div className="round-actions">
              <span className="round-cell-label">{locale === "zh" ? "执行清单与生成要求" : "Actions and generation request"}</span>
              <div className="round-reference-box">
                <strong>{locale === "zh" ? "本轮参考资料" : "References for this round"}</strong>
                {referenceCandidates.length > 0 && <div className="reference-checks">{referenceCandidates.map((source) => source && <label key={source.id}><input type="checkbox" checked={round.referenceSourceIds.includes(source.id)} onChange={(event) => updatePresalesRound(round.id, { referenceSourceIds: event.target.checked ? [...new Set([...round.referenceSourceIds, source.id])] : round.referenceSourceIds.filter((id) => id !== source.id) })}/><span><Check size={13}/></span>{source.name}</label>)}</div>}
                <label className="file-command"><Upload size={16}/>{locale === "zh" ? "导入其他参考文件" : "Import another reference"}<input hidden multiple type="file" accept=".pdf,.docx,.xlsx,.pptx,.md,.txt,.csv,.json" onChange={(event) => { void importPresalesFiles(event.target.files, { kind: "references", roundId: round.id }); event.currentTarget.value = ""; }}/></label>
              </div>
              <div className="round-action-list">{round.actions.map((action) => {
                const target = getActionResponseTarget(round, action);
                const actionTemplateSources = action.templateSourceIds.map((id) => project.sources.find((source) => source.id === id)).filter(Boolean);
                return <div className="round-action-row" id={`response-action-${action.id}`} key={action.id}>
                  <div className="action-response-fields">
                    <Field label={locale === "zh" ? "响应文件名称" : "Response file name"}><input aria-label={locale === "zh" ? "响应文件名称" : "Response file name"} value={target.name} onChange={(event) => updateRoundAction(round, action.id, { responseFileName: event.target.value })}/></Field>
                    <Field label={locale === "zh" ? "响应文件格式" : "Response file format"}><select aria-label={locale === "zh" ? "响应文件格式" : "Response file format"} value={target.format} onChange={(event) => setActionResponseFormat(round, action, event.target.value as ResponseFileFormat | "")}><option value="">{locale === "zh" ? "请选择" : "Select"}</option><option value="docx">Word</option><option value="pptx">PPT</option><option value="md">Markdown</option></select></Field>
                    <button className="row-delete" type="button" title={t.remove} aria-label={t.remove} onClick={() => { setActionSelected(action.id, false); updatePresalesRound(round.id, { actions: round.actions.filter((item) => item.id !== action.id) }); }}><Trash2 size={15}/></button>
                  </div>
                  <Field label={t.owner}><input aria-label={t.owner} placeholder={t.owner} value={action.owner} onChange={(event) => updateRoundAction(round, action.id, { owner: event.target.value })}/></Field>
                  <div className="action-meta-fields">
                    <Field label={locale === "zh" ? "截止时间" : "Deadline"}><input aria-label={locale === "zh" ? "截止时间" : "Deadline"} type="date" value={action.dueDate} onChange={(event) => updateRoundAction(round, action.id, { dueDate: event.target.value })}/></Field>
                    <Field label={locale === "zh" ? "文件状态" : "File status"}><select aria-label={locale === "zh" ? "文件状态" : "File status"} value={action.status} onChange={(event) => updateRoundAction(round, action.id, { status: event.target.value as PresalesRoundAction["status"] })}>{Object.entries(actionStatusLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
                  </div>
                  <Field label={locale === "zh" ? "文件要求" : "File requirements"}><textarea rows={5} aria-label={locale === "zh" ? "文件要求" : "File requirements"} placeholder={locale === "zh" ? "说明文件格式、内容、参考模板、需继承的信息及不得承诺的事项" : "Describe formatting, content, reference templates, inherited information, and prohibited commitments"} value={action.fileRequirements || ""} onChange={(event) => updateRoundAction(round, action.id, { fileRequirements: event.target.value })}/></Field>
                  <div className="analysis-config-block template-config action-template-config">
                    <strong>{locale === "zh" ? "响应文件模板" : "Response file templates"}</strong>
                    <label className="file-command"><Upload size={16}/>{locale === "zh" ? "上传模板" : "Upload templates"}<input hidden multiple type="file" accept=".docx,.pptx,.md" onChange={(event) => { void importPresalesFiles(event.target.files, { kind: "action-templates", roundId: round.id, actionId: action.id }); event.currentTarget.value = ""; }}/></label>
                    {actionTemplateSources.length > 0 && <div className="template-source-list">{actionTemplateSources.map((source) => source && <div className={action.selectedTemplateSourceIds.includes(source.id) ? "selected" : ""} key={source.id}><button type="button" aria-pressed={action.selectedTemplateSourceIds.includes(source.id)} onClick={() => toggleActionTemplate(round, action, source.id)}><FileText size={15}/><span>{source.name}</span></button><button className="row-delete" type="button" aria-label={locale === "zh" ? `删除响应文件模板 ${source.name}` : `Delete response file template ${source.name}`} title={locale === "zh" ? "删除模板" : "Delete template"} onClick={() => void removePresalesSource(round, source.id, "action-templates", action.id)}><X size={14}/></button></div>)}</div>}
                  </div>
                  <div className="action-command-row">
                    <label className="action-select" title={locale === "zh" ? "选择该项" : "Select this item"}><input type="checkbox" aria-label={locale === "zh" ? `选择响应文件 ${target.name || "未命名"}` : `Select response file ${target.name || "unnamed"}`} checked={selectedActionIds.has(action.id)} onChange={(event) => setActionSelected(action.id, event.target.checked)}/><span><Check size={16}/></span></label>
                    <button className="generate-command" type="button" disabled={busy} onClick={() => startPresalesFiles(round, [action])}><Sparkles size={17}/>{generatingActionId === `file-${action.id}` ? (locale === "zh" ? "处理中" : "Working") : (locale === "zh" ? "生成文件" : "Generate file")}</button>
                  </div>
                </div>;
              })}</div>
              <button className="inline-command" type="button" onClick={() => addRoundAction(round)}><Plus size={15}/>{locale === "zh" ? "新增执行项" : "Add action"}</button>
              <div className="bulk-action-row">
                <label className="action-select" title={locale === "zh" ? "选择本轮全部执行项" : "Select all actions in this round"}><input type="checkbox" aria-label={locale === "zh" ? "选择本轮全部执行项" : "Select all actions in this round"} disabled={!round.actions.length} checked={round.actions.length > 0 && round.actions.every((action) => selectedActionIds.has(action.id))} onChange={(event) => setRoundActionsSelected(round, event.target.checked)}/><span><Check size={16}/></span></label>
                <button className="generate-command" type="button" disabled={busy || !checkedActions(round).length} onClick={() => startPresalesFiles(round, checkedActions(round))}><Sparkles size={17}/>{generatingActionId === `batch-file-${round.id}` ? (locale === "zh" ? "处理中" : "Working") : (locale === "zh" ? "批量生成文件" : "Generate files")}</button>
              </div>
            </div>
            <div className="round-outputs">
              <span className="round-cell-label">{locale === "zh" ? "生成文件列表" : "Generated files"}</span>
              {round.generatedFiles.length ? round.generatedFiles.map((file) => { const sourceAction = round.actions.find((action) => action.id === file.actionId); const sourceName = sourceAction ? getActionResponseTarget(round, sourceAction).name : ""; return <button className="generated-file" type="button" key={file.id} onClick={() => void openGeneratedFile(file)}><FileCheck2 size={18}/><span><strong>{file.name}</strong><small>{sourceName || (locale === "zh" ? "历史响应文件" : "Legacy response file")} · {new Date(file.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")} · {file.provider} / {file.model}</small></span><ExternalLink size={15}/></button>; }) : <div className="round-empty"><FileOutput size={22}/><span>{locale === "zh" ? "本轮尚未生成文件" : "No files generated for this round"}</span></div>}
            </div>
          </article>;
        })}
        {!project.presalesRounds.length && <div className="empty-state"><FileInput size={24}/><p>{locale === "zh" ? "新增沟通节点后开始记录。" : "Add a communication node to begin."}</p></div>}
      </div>
    </section>
  </>;

  const renderTenderSourceList = (sourceIds: string[], selectedIds: string[], onToggle: (sourceId: string, checked: boolean) => void) => <div className="tender-source-list">{sourceIds.map((id) => project.sources.find((source) => source.id === id)).filter((source): source is SourceDocument => Boolean(source)).map((source) => {
    const expanded = expandedTenderSourceId === source.id;
    const progress = ocrProgress[source.id];
    return <article className={expanded ? "expanded" : ""} key={source.id}>
      <div className="tender-source-summary">
        <label className="compact-check"><input type="checkbox" aria-label={locale === "zh" ? `选择文件 ${source.name}` : `Select file ${source.name}`} checked={selectedIds.includes(source.id)} onChange={(event) => onToggle(source.id, event.target.checked)}/><span><Check size={13}/></span></label>
        <button type="button" onClick={() => setExpandedTenderSourceId(expanded ? "" : source.id)}><span className="source-kind-icon">{["png", "jpg", "jpeg", "webp"].includes(source.fileType) ? <FileImage size={18}/> : <FileText size={18}/>}</span><span><strong>{source.name}</strong><small className={source.preprocessStatus}>{preprocessStatusLabels[locale][source.preprocessStatus]}</small>{source.preprocessMessage && source.preprocessMessage !== preprocessStatusLabels[locale][source.preprocessStatus] && <small>{source.preprocessMessage}</small>}</span>{source.requiresOcr && <AlertTriangle size={16}/>}</button>
      </div>
      {progress !== undefined && <div className="ocr-progress" aria-label={locale === "zh" ? `${source.name} 识别进度` : `${source.name} recognition progress`}><span style={{ width: `${progress}%` }}></span></div>}
      {expanded && <div className="tender-source-actions"><button type="button" disabled={source.preprocessStatus === "ready" || source.preprocessStatus === "processing"} onClick={() => preprocessTenderSources([source.id])}><RefreshCw size={15}/>{locale === "zh" ? "预处理" : "Preprocess"}</button><button type="button" onClick={() => void openSourceFile(source)}><ExternalLink size={15}/>{locale === "zh" ? "打开文件" : "Open file"}</button><button type="button" onClick={() => void removeTenderSources([source.id])}><Trash2 size={15}/>{locale === "zh" ? "删除" : "Delete"}</button></div>}
    </article>;
  })}</div>;

  const renderTenderTemplates = (kind: "analysis" | "comparison") => {
    const config = kind === "analysis" ? project.tenderAnalysis : project.tenderComparison;
    const sources = config.templateSourceIds.map((id) => project.sources.find((source) => source.id === id)).filter((source): source is SourceDocument => Boolean(source));
    return <div className="analysis-config-block template-config">
      <label className="file-command"><Upload size={16}/>{locale === "zh" ? "上传模板" : "Upload templates"}<input hidden multiple type="file" accept={kind === "comparison" ? ".docx,.xlsx,.pptx,.md" : ".docx,.pptx,.md"} onChange={(event) => { void importTenderFiles(event.target.files, { kind: kind === "analysis" ? "analysis-template" : "comparison-template" }); event.currentTarget.value = ""; }}/></label>
      {sources.length > 0 && <div className="template-source-list">{sources.map((source) => <div className={config.selectedTemplateSourceIds.includes(source.id) ? "selected" : ""} key={source.id}><button type="button" aria-pressed={config.selectedTemplateSourceIds.includes(source.id)} onClick={() => toggleTenderTemplate(kind, source.id)}><FileText size={15}/><span>{source.name}</span></button><button className="row-delete" type="button" aria-label={locale === "zh" ? `删除模板 ${source.name}` : `Delete template ${source.name}`} onClick={() => void removeTenderSources([source.id])}><X size={14}/></button></div>)}</div>}
      <Field label={locale === "zh" ? "文件格式" : "Output format"}><select aria-label={kind === "analysis" ? (locale === "zh" ? "招标分析文件格式" : "Tender analysis format") : (locale === "zh" ? "对比结果文件格式" : "Comparison format")} value={config.outputFormat || ""} onChange={(event) => setTenderOutputFormat(kind, event.target.value as TenderOutputFormat | "")}><option value="">{locale === "zh" ? "请选择" : "Select"}</option><option value="docx">Word</option>{kind === "comparison" && <option value="xlsx">Excel</option>}<option value="pptx">PPT</option><option value="md">Markdown</option></select></Field>
    </div>;
  };

  const renderRequirements = () => {
    const tenderSources = project.tenderSourceIds.map((id) => project.sources.find((source) => source.id === id)).filter((source): source is SourceDocument => Boolean(source));
    const allTenderSelected = tenderSources.length > 0 && tenderSources.every((source) => project.selectedTenderSourceIds.includes(source.id));
    const presalesGroups = [
      { id: "attachments", label: locale === "zh" ? "已导入客户附件" : "Imported customer attachments", ids: [...new Set(project.presalesRounds.flatMap((round) => round.requirementSourceIds))] },
      { id: "summaries", label: locale === "zh" ? "生成的总结文件" : "Generated summaries", ids: [...new Set(project.presalesRounds.flatMap((round) => round.analysisResults.map((result) => result.sourceId)))] },
      { id: "generated", label: locale === "zh" ? "生成的文件" : "Generated files", ids: [...new Set(project.presalesRounds.flatMap((round) => round.generatedFiles.map((file) => file.sourceId)))] },
    ];
    const allPresalesIds = [...new Set(presalesGroups.flatMap((group) => group.ids))];
    const allPresalesSelected = allPresalesIds.length > 0 && allPresalesIds.every((id) => project.tenderComparison.selectedPresalesSourceIds.includes(id));
    const comparisonResults = project.tenderComparison.results;
    return <>
      <section className="work-section" id="tender-files">
        <div className="section-heading"><div><p>{locale === "zh" ? "招标输入 / 预处理" : "TENDER INPUT / PREPROCESSING"}</p><h2>{t.sourceLibrary}</h2><span className="section-description">{t.noSource}</span></div><button className="command-button" type="button" disabled={busy} onClick={() => sourceInput.current?.click()}><Upload size={17}/>{t.importSources}</button></div>
        <input ref={sourceInput} hidden multiple type="file" accept=".pdf,.docx,.xlsx,.pptx,.md,.txt,.csv,.png,.jpg,.jpeg,.webp" onChange={(event) => { void importTenderFiles(event.target.files, { kind: "tender" }); event.currentTarget.value = ""; }}/>
        {tenderSources.length ? <>
          <div className="tender-file-toolbar"><label className="compact-check"><input type="checkbox" aria-label={locale === "zh" ? "全选招标文件" : "Select all tender files"} checked={allTenderSelected} onChange={(event) => updateProject("selectedTenderSourceIds", event.target.checked ? [...project.tenderSourceIds] : [])}/><span><Check size={13}/></span>{locale === "zh" ? "全选" : "Select all"}</label><button type="button" disabled={!project.selectedTenderSourceIds.length || busy} onClick={() => preprocessTenderSources(project.selectedTenderSourceIds)}><RefreshCw size={16}/>{locale === "zh" ? "预处理" : "Preprocess"}</button><button type="button" className="danger-command" disabled={busy} onClick={() => void removeTenderSources(project.tenderSourceIds)}><Trash2 size={16}/>{locale === "zh" ? "删除全部导入文件" : "Delete all imported files"}</button></div>
          {renderTenderSourceList(project.tenderSourceIds, project.selectedTenderSourceIds, (sourceId, checked) => updateProject("selectedTenderSourceIds", checked ? [...new Set([...project.selectedTenderSourceIds, sourceId])] : project.selectedTenderSourceIds.filter((id) => id !== sourceId)))}
        </> : <div className="empty-state"><FileInput size={28}/><p>{t.noSource}</p></div>}
      </section>

      <section className="work-section tender-clarifications">
        <div className="section-heading"><div><p>{locale === "zh" ? "补遗 / 澄清" : "ADDENDA / CLARIFICATIONS"}</p><h2>{locale === "zh" ? "澄清及相关文件" : "Clarifications and related files"}</h2></div><button className="icon-command" type="button" aria-label={locale === "zh" ? "新增澄清节点" : "Add clarification node"} onClick={() => updateProject("tenderClarificationRounds", [...project.tenderClarificationRounds, { id: createId("clarification"), title: locale === "zh" ? `第 ${project.tenderClarificationRounds.length + 1} 次澄清` : `Clarification ${project.tenderClarificationRounds.length + 1}`, occurredAt: "", sourceIds: [], selectedSourceIds: [] }])}><Plus size={18}/></button></div>
        <div className="clarification-head"><span>{locale === "zh" ? "时间节点" : "Timeline"}</span><span>{locale === "zh" ? "澄清文件" : "Clarification files"}</span></div>
        {project.tenderClarificationRounds.map((round) => <article className="clarification-row" id={`clarification-${round.id}`} key={round.id}><div className="clarification-node"><input aria-label={locale === "zh" ? "澄清节点名称" : "Clarification name"} value={round.title} onChange={(event) => updateProject("tenderClarificationRounds", project.tenderClarificationRounds.map((item) => item.id === round.id ? { ...item, title: event.target.value } : item))}/><input aria-label={locale === "zh" ? "澄清时间" : "Clarification time"} type="datetime-local" value={round.occurredAt} onChange={(event) => updateProject("tenderClarificationRounds", project.tenderClarificationRounds.map((item) => item.id === round.id ? { ...item, occurredAt: event.target.value } : item))}/><button className="row-delete" type="button" aria-label={locale === "zh" ? `删除澄清节点 ${round.title}` : `Delete clarification ${round.title}`} onClick={() => updateProject("tenderClarificationRounds", project.tenderClarificationRounds.filter((item) => item.id !== round.id))}><Trash2 size={16}/></button></div><div className="clarification-files"><label className="file-command"><Upload size={16}/>{locale === "zh" ? "导入澄清文件" : "Import clarification files"}<input hidden multiple type="file" accept=".pdf,.docx,.xlsx,.pptx,.md,.txt,.csv,.png,.jpg,.jpeg,.webp" onChange={(event) => { void importTenderFiles(event.target.files, { kind: "clarification", roundId: round.id }); event.currentTarget.value = ""; }}/></label>{round.sourceIds.length > 0 && <label className="compact-check"><input type="checkbox" aria-label={locale === "zh" ? `全选 ${round.title} 文件` : `Select all files in ${round.title}`} checked={round.sourceIds.every((id) => round.selectedSourceIds.includes(id))} onChange={(event) => updateProject("tenderClarificationRounds", project.tenderClarificationRounds.map((item) => item.id === round.id ? { ...item, selectedSourceIds: event.target.checked ? [...item.sourceIds] : [] } : item))}/><span><Check size={13}/></span>{locale === "zh" ? "全选" : "Select all"}</label>}{renderTenderSourceList(round.sourceIds, round.selectedSourceIds, (sourceId, checked) => updateProject("tenderClarificationRounds", project.tenderClarificationRounds.map((item) => item.id === round.id ? { ...item, selectedSourceIds: checked ? [...new Set([...item.selectedSourceIds, sourceId])] : item.selectedSourceIds.filter((id) => id !== sourceId) } : item)))}</div></article>)}
        {!project.tenderClarificationRounds.length && <div className="empty-state"><FileSearch size={26}/><p>{locale === "zh" ? "有补遗或澄清时新增时间节点。" : "Add a timeline node when an addendum or clarification arrives."}</p></div>}
      </section>

      <section className="work-section" id="tender-analysis">
        <div className="section-heading"><div><p>{locale === "zh" ? "要求 / 基线" : "REQUIREMENTS / BASELINE"}</p><h2>{locale === "zh" ? "招标文件分析" : "Tender file analysis"}</h2></div></div>
        <div className="tender-analysis-grid">
          <div className="tender-analysis-pane"><div className="pane-title"><div><p>{locale === "zh" ? "要求提炼" : "REQUIREMENT EXTRACTION"}</p><h3>{locale === "zh" ? "招标要求分析" : "Tender requirement analysis"}</h3></div></div>
            <div className="analysis-config-block keyword-config"><strong>{locale === "zh" ? "关键词" : "Keywords"}</strong><div className="keyword-input-row"><input aria-label={locale === "zh" ? "新增招标分析关键词" : "New tender keyword"} value={tenderKeywordDraft} onChange={(event) => setTenderKeywordDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); const value = tenderKeywordDraft.trim(); if (value && !project.tenderAnalysis.keywords.includes(value)) updateProject("tenderAnalysis", { ...project.tenderAnalysis, keywords: [...project.tenderAnalysis.keywords, value] }); setTenderKeywordDraft(""); } }}/><button className="icon-command" type="button" aria-label={locale === "zh" ? "添加招标分析关键词" : "Add tender keyword"} onClick={() => { const value = tenderKeywordDraft.trim(); if (value && !project.tenderAnalysis.keywords.includes(value)) updateProject("tenderAnalysis", { ...project.tenderAnalysis, keywords: [...project.tenderAnalysis.keywords, value] }); setTenderKeywordDraft(""); }}><Plus size={17}/></button></div><div className="recommended-keywords"><span>{locale === "zh" ? "推荐关键词" : "Recommended"}</span><div>{recommendedAnalysisKeywords[locale].map((keyword) => <button type="button" key={keyword} disabled={project.tenderAnalysis.keywords.includes(keyword)} onClick={() => updateProject("tenderAnalysis", { ...project.tenderAnalysis, keywords: [...project.tenderAnalysis.keywords, keyword] })}>{keyword}</button>)}</div></div>{project.tenderAnalysis.keywords.length > 0 && <div className="selected-keywords">{project.tenderAnalysis.keywords.map((keyword) => <span key={keyword}>{keyword}<button type="button" aria-label={locale === "zh" ? `删除招标分析关键词 ${keyword}` : `Delete tender keyword ${keyword}`} onClick={() => updateProject("tenderAnalysis", { ...project.tenderAnalysis, keywords: project.tenderAnalysis.keywords.filter((item) => item !== keyword) })}><X size={13}/></button></span>)}</div>}</div>
            <Field label={locale === "zh" ? "分析要求" : "Analysis requirements"}><textarea rows={6} aria-label={locale === "zh" ? "招标分析要求" : "Tender analysis requirements"} value={project.tenderAnalysis.analysisRequirements} onChange={(event) => updateProject("tenderAnalysis", { ...project.tenderAnalysis, analysisRequirements: event.target.value })} placeholder={locale === "zh" ? "说明需要提炼的时间、参数、评标、资质、废标项和投标文件清单" : "Describe deadlines, parameters, scoring, qualifications, rejection rules, and the bid-file checklist to extract"}/></Field>
            {renderTenderTemplates("analysis")}
            <button className="generate-command analysis-command" type="button" disabled={busy || !project.selectedTenderSourceIds.length} onClick={() => startTenderAnalysis("analysis")}><Sparkles size={17}/>{generatingActionId === "tender-analysis" ? (locale === "zh" ? "正在分析" : "Analyzing") : (locale === "zh" ? "招标要求分析" : "Analyze tender requirements")}</button>
            {project.tenderAnalysis.results.length > 0 && <div className="analysis-result-list"><strong>{locale === "zh" ? "分析结果" : "Analysis results"}</strong>{project.tenderAnalysis.results.map((result) => <article className={expandedTenderResultId === result.id ? "expanded" : ""} key={result.id}><div><button type="button" onClick={() => { setExpandedTenderResultId(expandedTenderResultId === result.id ? "" : result.id); updateProject("tenderAnalysis", { ...project.tenderAnalysis, analysisRequirements: result.prompt }); }}><FileCheck2 size={16}/><span>{result.name}</span></button><button className="row-delete" type="button" aria-label={locale === "zh" ? `删除分析结果 ${result.name}` : `Delete analysis result ${result.name}`} onClick={() => void removeTenderResult(result)}><X size={14}/></button></div>{expandedTenderResultId === result.id && <button className="open-analysis-file" type="button" onClick={() => void openTenderResult(result)}><ExternalLink size={15}/>{locale === "zh" ? `打开文件 · ${result.fileName}` : `Open file · ${result.fileName}`}</button>}</article>)}</div>}
          </div>

          <div className="tender-analysis-pane"><div className="pane-title"><div><p>{locale === "zh" ? "阶段对比" : "STAGE COMPARISON"}</p><h3>{locale === "zh" ? "售前文件对比" : "Presales file comparison"}</h3></div></div>
            <div className="presales-source-selector"><div className="analysis-panel-heading"><strong>{locale === "zh" ? "售前阶段文件" : "Presales files"}</strong><label className="compact-check"><input type="checkbox" aria-label={locale === "zh" ? "全选售前文件" : "Select all presales files"} disabled={!allPresalesIds.length} checked={allPresalesSelected} onChange={(event) => updateProject("tenderComparison", { ...project.tenderComparison, selectedPresalesSourceIds: event.target.checked ? allPresalesIds : [] })}/><span><Check size={13}/></span>{locale === "zh" ? "全选" : "Select all"}</label></div>{presalesGroups.map((group) => <div className="presales-source-group" key={group.id}><strong>{group.label}</strong>{group.ids.map((id) => project.sources.find((source) => source.id === id)).filter((source): source is SourceDocument => Boolean(source)).map((source) => <label key={source.id}><input type="checkbox" checked={project.tenderComparison.selectedPresalesSourceIds.includes(source.id)} onChange={(event) => updateProject("tenderComparison", { ...project.tenderComparison, selectedPresalesSourceIds: event.target.checked ? [...new Set([...project.tenderComparison.selectedPresalesSourceIds, source.id])] : project.tenderComparison.selectedPresalesSourceIds.filter((id) => id !== source.id) })}/><span><Check size={13}/></span><FileText size={15}/>{source.name}</label>)}{!group.ids.length && <small>{locale === "zh" ? "暂无文件" : "No files"}</small>}</div>)}</div>
            {renderTenderTemplates("comparison")}
            <button className="generate-command analysis-command" type="button" disabled={busy || !project.selectedTenderSourceIds.length || !project.tenderComparison.selectedPresalesSourceIds.length} onClick={() => startTenderAnalysis("comparison")}><Sparkles size={17}/>{generatingActionId === "tender-comparison" ? (locale === "zh" ? "正在对比" : "Comparing") : (locale === "zh" ? "对比" : "Compare")}</button>
          </div>
        </div>
      </section>

      <section className="work-section"><div className="section-heading"><div><p>{t.baselineEyebrow}</p><h2>{t.baselineDiff}</h2></div><span>{comparisonResults.length}</span></div><div className="tender-difference-results">{comparisonResults.map((result) => <article key={result.id}><header><button type="button" onClick={() => void openTenderResult(result)}><FileSpreadsheet size={18}/><span><strong>{result.name}</strong><small>{result.fileName} · {new Date(result.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}</small></span><ExternalLink size={15}/></button><button className="row-delete" type="button" aria-label={locale === "zh" ? `删除对比结果 ${result.name}` : `Delete comparison ${result.name}`} onClick={() => void removeTenderResult(result)}><Trash2 size={16}/></button></header>{result.differences.map((difference, index) => <div className="diff-list" key={`${result.id}-${index}`}><div><span className={`relation ${difference.relation}`}>{diffRelationLabels[locale][difference.relation]}</span><p>{difference.presales || (locale === "zh" ? "未提供" : "Not provided")}</p><ChevronRight size={16}/><p>{difference.tender || (locale === "zh" ? "未提供" : "Not provided")}</p></div></div>)}</article>)}{!comparisonResults.length && <div className="empty-state"><FileSpreadsheet size={26}/><p>{locale === "zh" ? "完成售前文件对比后，结果会按分析批次显示在这里。" : "Comparison results will appear here by analysis run."}</p></div>}</div></section>

      <section className="work-section"><div className="section-heading"><div><p>{locale === "zh" ? "组包输入 / 清单" : "PACKAGE INPUT / CHECKLIST"}</p><h2>{locale === "zh" ? "投标文件清单" : "Bid file checklist"}</h2></div><span>{project.bidFileChecklist.length}</span></div><div className="bid-file-checklist">{project.bidFileChecklist.map((item) => <div key={item.id}><label className="compact-check"><input type="checkbox" aria-label={locale === "zh" ? `确认投标文件 ${item.title}` : `Confirm bid file ${item.title}`} checked={item.status === "confirmed"} onChange={(event) => updateProject("bidFileChecklist", project.bidFileChecklist.map((entry) => entry.id === item.id ? { ...entry, status: event.target.checked ? "confirmed" : "pending" } : entry))}/><span><Check size={13}/></span></label><select aria-label={locale === "zh" ? `文件类别 ${item.title}` : `File category ${item.title}`} value={item.category} onChange={(event) => updateProject("bidFileChecklist", project.bidFileChecklist.map((entry) => entry.id === item.id ? { ...entry, category: event.target.value as BidFileChecklistItem["category"] } : entry))}>{Object.entries(bidFileCategoryLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><input aria-label={locale === "zh" ? "投标文件名称" : "Bid file name"} value={item.title} onChange={(event) => updateProject("bidFileChecklist", project.bidFileChecklist.map((entry) => entry.id === item.id ? { ...entry, title: event.target.value } : entry))}/><input aria-label={locale === "zh" ? `投标文件说明 ${item.title}` : `Bid file notes ${item.title}`} placeholder={locale === "zh" ? "来源、责任人或待确认事项" : "Source, owner, or open questions"} value={item.notes} onChange={(event) => updateProject("bidFileChecklist", project.bidFileChecklist.map((entry) => entry.id === item.id ? { ...entry, notes: event.target.value } : entry))}/><button className="row-delete" type="button" aria-label={locale === "zh" ? `删除投标文件 ${item.title}` : `Delete bid file ${item.title}`} onClick={() => updateProject("bidFileChecklist", project.bidFileChecklist.filter((entry) => entry.id !== item.id))}><Trash2 size={16}/></button></div>)}</div>{!project.bidFileChecklist.length && <div className="empty-state"><FileOutput size={26}/><p>{locale === "zh" ? "招标要求分析后，识别到的投标文件会逐项加入清单。" : "Files identified by tender analysis will be added here."}</p></div>}</section>
    </>;
  };

  const renderBid = () => <section className="work-section" id="bid-output">
    <div className="section-heading"><div><p>{locale === "zh" ? "投标阶段 / 文件编制" : "BID / DOCUMENT PREPARATION"}</p><h2>{locale === "zh" ? "投标文件输出" : "Bid file output"}</h2></div><span>{project.bidFileChecklist.length}</span></div>
    {project.bidFileChecklist.length ? <div className="bid-output-list">{project.bidFileChecklist.map((item) => {
      const expanded = expandedBidFileId === item.id;
      const templates = item.templateSourceIds.map((id) => project.sources.find((source) => source.id === id)).filter((source): source is SourceDocument => Boolean(source));
      const references = item.referenceSourceIds.map((id) => project.sources.find((source) => source.id === id)).filter((source): source is SourceDocument => Boolean(source));
      const allReferencesSelected = references.length > 0 && references.every((source) => item.selectedReferenceSourceIds.includes(source.id));
      return <article className={expanded ? "expanded" : ""} id={`bid-output-${item.id}`} key={item.id}>
        <button className="bid-output-summary" type="button" aria-expanded={expanded} onClick={() => setExpandedBidFileId(expanded ? "" : item.id)}>
          <FileOutput size={21}/><span><strong>{item.title}</strong><small>{bidFileCategoryLabels[locale][item.category]}{item.notes ? ` · ${item.notes}` : ""}</small></span><span>{item.generatedFiles.length ? (locale === "zh" ? `已生成 ${item.generatedFiles.length}` : `${item.generatedFiles.length} generated`) : (locale === "zh" ? "待编制" : "Not generated")}</span><ChevronRight size={18}/>
        </button>
        {expanded && <div className="bid-output-editor">
          <div className="bid-material-grid">
            <section><div className="bid-editor-heading"><strong>{locale === "zh" ? "文件模板" : "File template"}</strong><label className="file-command"><Upload size={16}/>{locale === "zh" ? "上传模板" : "Upload template"}<input hidden type="file" accept=".docx,.xlsx,.pptx,.md" onChange={(event) => { void importBidFiles(item, event.target.files, "template"); event.currentTarget.value = ""; }}/></label></div>{templates.length ? <div className="template-source-list">{templates.map((source) => <div className={item.selectedTemplateSourceIds.includes(source.id) ? "selected" : ""} key={source.id}><button type="button" aria-pressed={item.selectedTemplateSourceIds.includes(source.id)} onClick={() => toggleBidTemplate(item, source.id)}><FileText size={15}/><span>{source.name}</span></button><button className="row-delete" type="button" aria-label={locale === "zh" ? `删除模板 ${source.name}` : `Delete template ${source.name}`} onClick={() => void removeBidSource(item, source.id, "template")}><X size={14}/></button></div>)}</div> : <div className="bid-material-empty">{locale === "zh" ? "未上传时使用通用模板" : "A general template will be used"}</div>}</section>
            <section><div className="bid-editor-heading"><strong>{locale === "zh" ? "参考资料" : "Reference materials"}</strong><label className="file-command"><Upload size={16}/>{locale === "zh" ? "上传参考资料" : "Upload references"}<input hidden multiple type="file" accept=".pdf,.docx,.xlsx,.pptx,.md,.txt,.csv,.png,.jpg,.jpeg,.webp" onChange={(event) => { void importBidFiles(item, event.target.files, "reference"); event.currentTarget.value = ""; }}/></label></div>{references.length ? <><label className="compact-check bid-select-all"><input type="checkbox" aria-label={locale === "zh" ? `全选 ${item.title} 参考资料` : `Select all references for ${item.title}`} checked={allReferencesSelected} onChange={(event) => updateBidFile(item.id, { selectedReferenceSourceIds: event.target.checked ? references.map((source) => source.id) : [] })}/><span><Check size={13}/></span>{locale === "zh" ? "全选" : "Select all"}</label><div className="customer-source-list">{references.map((source) => <div key={source.id}><label><input type="checkbox" aria-label={locale === "zh" ? `选择参考资料 ${source.name}` : `Select reference ${source.name}`} checked={item.selectedReferenceSourceIds.includes(source.id)} onChange={(event) => updateBidFile(item.id, { selectedReferenceSourceIds: event.target.checked ? [...new Set([...item.selectedReferenceSourceIds, source.id])] : item.selectedReferenceSourceIds.filter((id) => id !== source.id) })}/><span><Check size={12}/></span><FileText size={15}/><strong>{source.name}</strong></label><button className="row-delete" type="button" aria-label={locale === "zh" ? `删除参考资料 ${source.name}` : `Delete reference ${source.name}`} onClick={() => void removeBidSource(item, source.id, "reference")}><X size={14}/></button></div>)}</div></> : <div className="bid-material-empty">{locale === "zh" ? "尚未上传参考资料" : "No references uploaded"}</div>}</section>
          </div>
          <div className="bid-output-fields"><Field label={locale === "zh" ? "输出格式" : "Output format"}><select aria-label={locale === "zh" ? `输出格式 ${item.title}` : `Output format ${item.title}`} value={item.outputFormat || ""} onChange={(event) => setBidOutputFormat(item, event.target.value as TenderOutputFormat | "")}><option value="">{locale === "zh" ? "请选择" : "Select"}</option><option value="docx">Word</option><option value="xlsx">Excel</option><option value="pptx">PPT</option><option value="md">Markdown</option></select></Field><Field wide label={locale === "zh" ? "细节要求" : "Detailed requirements"}><textarea aria-label={locale === "zh" ? `细节要求 ${item.title}` : `Detailed requirements ${item.title}`} rows={7} placeholder={locale === "zh" ? "填写文件范围、重点内容、章节结构、语气、不得承诺事项及需继承的模板要求" : "Specify scope, emphasis, structure, tone, prohibited commitments, and template requirements"} value={item.detailRequirements} onChange={(event) => updateBidFile(item.id, { detailRequirements: event.target.value })}/></Field></div>
          <button className="generate-command bid-generate-command" type="button" disabled={busy} onClick={() => startBidFileGeneration(item)}><Sparkles size={18}/>{generatingActionId === `bid-output-${item.id}` ? (locale === "zh" ? "正在生成…" : "Generating…") : (locale === "zh" ? "生成文件" : "Generate file")}</button>
          {item.generatedFiles.length > 0 && <div className="bid-generated-list"><strong>{locale === "zh" ? "已生成文件" : "Generated files"}</strong>{item.generatedFiles.map((record) => <div key={record.id}><button type="button" onClick={() => void openBidGeneratedFile(record)}><FileCheck2 size={17}/><span><strong>{record.name}</strong><small>{record.provider} / {record.model} · {new Date(record.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}</small></span><ExternalLink size={15}/></button><button className="row-delete" type="button" aria-label={locale === "zh" ? `删除生成文件 ${record.name}` : `Delete generated file ${record.name}`} onClick={() => void removeBidGeneratedFile(item, record)}><Trash2 size={16}/></button></div>)}</div>}
        </div>}
      </article>;
    })}</div> : <div className="empty-state"><FileOutput size={26}/><p>{locale === "zh" ? "招标要求分析生成投标文件清单后，文件会同步显示在这里。" : "Files will appear here after tender analysis creates the bid file checklist."}</p></div>}
  </section>;

  const renderHandover = () => <>
    <section className="work-section"><div className="section-heading"><div><p>{t.commitmentEyebrow}</p><h2>{t.commitments}</h2></div><span>{coverage.approved}</span></div><div className="commitment-list">{project.requirements.filter((item) => item.reviewState === "approved").map((item) => <article key={item.id}><header><span>{responseLabels[locale][item.responseStatus]}</span><strong>{item.title}</strong></header><p>{item.formalResponse}</p><footer>{item.acceptanceCriteria || (locale === "zh" ? "验收标准待补充" : "Acceptance criteria missing")}</footer></article>)}</div></section>
    <section className="work-section"><div className="section-heading"><div><p>{t.handoverEyebrow}</p><h2>{t.handoverList}</h2></div><button className="icon-command" type="button" title={t.add} onClick={() => updateProject("actions", [...project.actions, { id: createId("action"), stage: "delivery", title: locale === "zh" ? "新增交底事项" : "New handover item", owner: "", dueDate: "", status: "open", sourceRequirementId: "", notes: "" }])}><Plus size={18}/></button></div><div className="handover-grid"><div className="action-list">{project.actions.filter((item) => item.stage === "delivery").map((item) => <div className="handover-row" key={item.id}><select value={item.status} onChange={(event) => updateProject("actions", project.actions.map((candidate) => candidate.id === item.id ? { ...candidate, status: event.target.value as typeof item.status } : candidate))}>{Object.entries(actionStatusLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><input value={item.title} onChange={(event) => updateProject("actions", project.actions.map((candidate) => candidate.id === item.id ? { ...candidate, title: event.target.value } : candidate))}/><input placeholder={t.owner} value={item.owner} onChange={(event) => updateProject("actions", project.actions.map((candidate) => candidate.id === item.id ? { ...candidate, owner: event.target.value } : candidate))}/><input type="date" value={item.dueDate} onChange={(event) => updateProject("actions", project.actions.map((candidate) => candidate.id === item.id ? { ...candidate, dueDate: event.target.value } : candidate))}/></div>)}</div><Field label={locale === "zh" ? "交底说明、变更和未决事项" : "Handover notes, changes, and open items"}><textarea rows={10} value={project.handoverNotes} onChange={(event) => updateProject("handoverNotes", event.target.value)}/></Field></div></section>
  </>;

  const renderOutputs = () => <>
    <section className="work-section"><div className="section-heading"><div><p>{t.localWorkspaceEyebrow}</p><h2>{locale === "zh" ? "本地项目目录" : "Local project folder"}</h2></div><span>{directoryHandle?.name || (supportsDirectoryAccess() ? t.ready : "ZIP")}</span></div><div className="output-actions"><button type="button" onClick={() => void chooseDirectory()}><FolderOpen size={18}/>{t.directory}</button><button type="button" disabled={!directoryHandle || busy} onClick={() => void syncDirectory()}><Save size={18}/>{t.sync}</button><button type="button" disabled={!directoryHandle || busy} onClick={() => void rescanDirectory()}><RefreshCw size={18}/>{t.rescan}</button><button type="button" onClick={() => archiveInput.current?.click()}><FileArchive size={18}/>{t.importZip}</button><input ref={archiveInput} hidden type="file" accept=".zip,application/zip" onChange={(event) => void importArchive(event.target.files?.[0])}/></div></section>
    <section className="work-section"><div className="section-heading"><div><p>{t.formalOutputsEyebrow}</p><h2>{locale === "zh" ? "正式文件导出" : "Formal file exports"}</h2></div></div><div className="format-grid"><button type="button" disabled={busy} onClick={() => void saveOutput(`${projectFileStem(project)}.md`, projectToMarkdown(project), "text/markdown;charset=utf-8")}><FileText/><strong>Markdown</strong><span>.md</span></button><button type="button" disabled={busy} onClick={() => void saveOutput(`${projectFileStem(project)}-requirements.csv`, projectToCsv(project), "text/csv;charset=utf-8")}><FileSpreadsheet/><strong>CSV</strong><span>UTF-8 BOM</span></button><button type="button" disabled={busy} onClick={() => void saveOutput(`${projectFileStem(project)}.docx`, projectToDocx(project), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}><FileText/><strong>Word</strong><span>.docx</span></button><button type="button" disabled={busy} onClick={() => void saveOutput(`${projectFileStem(project)}.xlsx`, projectToXlsx(project), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}><FileSpreadsheet/><strong>Excel</strong><span>.xlsx</span></button><button type="button" disabled={busy} onClick={() => void saveOutput(`${projectFileStem(project)}.pptx`, projectToPptx(project), "application/vnd.openxmlformats-officedocument.presentationml.presentation")}><Presentation/><strong>PowerPoint</strong><span>.pptx</span></button><button type="button" disabled={busy} onClick={() => void saveOutput("presentation.md", presentationMarkdown(project), "text/markdown;charset=utf-8")}><Presentation/><strong>{locale === "zh" ? "演示中间稿" : "Presentation source"}</strong><span>presentation.md</span></button></div><label className="include-sources"><input type="checkbox" checked={includeSources} onChange={(event) => setIncludeSources(event.target.checked)}/><span><Check size={14}/></span>{t.includeSources}</label><button className="primary-export" type="button" disabled={busy} onClick={() => void exportArchive()}><Archive size={19}/>{t.exportZip}</button></section>
    <section className="work-section task-section"><div><div className="section-heading"><div><p>{t.codexEyebrow}</p><h2>{t.taskPrompt}</h2></div></div><div className="segmented"><button type="button" className={taskKind === "workflow" ? "active" : ""} onClick={() => setTaskKind("workflow")}>solution-workflow</button><button type="button" className={taskKind === "extract" ? "active" : ""} onClick={() => setTaskKind("extract")}>tender-requirement-extraction</button><button type="button" className={taskKind === "bid" ? "active" : ""} onClick={() => setTaskKind("bid")}>technical-bid-package</button></div><textarea className="task-prompt" rows={8} readOnly value={taskPrompt}/><button className="command-button" type="button" onClick={() => void navigator.clipboard.writeText(taskPrompt).then(() => setNotice(locale === "zh" ? "任务已复制。" : "Task copied."))}><Copy size={17}/>{t.copyTask}</button><p className="skill-hint">{t.skillHint}</p></div><aside className="skill-downloads"><p>{t.downloadsEyebrow}</p><h2>{t.skillDownloads}</h2>{["solution-workflow", "tender-requirement-extraction", "technical-bid-package"].map((skill) => <a href={`${base}/downloads/skills/${skill}-1.0.0.zip`} download key={skill}><Download size={17}/><span>{skill}</span></a>)}</aside></section>
    <section className="work-section"><div className="section-heading"><div><p>{t.qualityEyebrow}</p><h2>{t.audit}</h2></div><span className={issues.some((item) => item.severity === "error") ? "issue-count error" : "issue-count"}>{issues.length}</span></div>{issues.length ? <div className="issue-list">{issues.map((issue) => <div className={issue.severity} key={issue.id}><AlertTriangle size={17}/><span>{issue.message}</span><small>{issueAreaLabels[locale][issue.area]}</small></div>)}</div> : <div className="clean-state"><ShieldCheck size={26}/><p>{t.noIssues}</p></div>}</section>
  </>;

  const content = view === "presales" ? renderPresales() : view === "requirements" ? renderRequirements() : view === "bid" ? renderBid() : view === "handover" ? renderHandover() : renderOutputs();

  return <div className="solution-app" data-ready={ready ? "true" : "false"}>
    <header className="project-header">
      <div><p>{t.workspaceEyebrow}</p><h1>{t.project}</h1><span>{project.name}</span></div>
      <div className="header-metrics"><div><strong>{coverage.total}</strong><span>{t.total}</span></div><div><strong>{coverage.evidenced}</strong><span>{t.evidenced}</span></div><div><strong>{coverage.approved}</strong><span>{t.approved}</span></div><div><strong>{coverage.pending}</strong><span>{t.pending}</span></div></div>
    </header>
    <div className="privacy-bar"><ShieldCheck size={17}/><span>{t.local}</span><span className="notice" aria-live="polite">{busy ? (locale === "zh" ? "处理中…" : "Working…") : notice}</span></div>
    <nav className="workspace-toolbar" aria-label={locale === "zh" ? "工作区操作" : "Workspace actions"}><button type="button" aria-label={t.reset} onClick={resetCurrentProject} title={t.reset}><RotateCcw size={17}/><span>{t.reset}</span></button><button className={`project-path-command${directoryHandle ? " active" : ""}`} type="button" disabled={busy} aria-label={`${t.projectPath}${directoryHandle ? `: ${directoryHandle.name}` : ""}`} onClick={() => void chooseDirectory()} title={`${t.projectPath}${directoryHandle ? `: ${directoryHandle.name}` : ""}`}><FolderOpen size={17}/><span>{directoryHandle?.name || t.projectPath}</span></button><button className="toolbar-settings-start" type="button" aria-label={theme === "light" ? t.darkMode : t.lightMode} onClick={switchTheme} title={theme === "light" ? t.darkMode : t.lightMode}>{theme === "light" ? <Moon size={17}/> : <Sun size={17}/>}</button><button type="button" aria-label={locale === "zh" ? "Switch to English" : "切换到中文"} onClick={switchLocale} title={locale === "zh" ? "English" : "中文"}><Languages size={17}/><span>{locale === "zh" ? "EN" : "中"}</span></button></nav>
    <div className="workspace-shell">
      <aside className="stage-rail" aria-label={locale === "zh" ? "解决方案流程" : "Solution lifecycle"}>{viewMeta.map((item) => { const Icon = item.icon; return <button type="button" aria-label={t[item.id]} title={t[item.id]} className={view === item.id ? "active" : ""} key={item.id} onClick={() => setView(item.id)}><span>{item.code}</span><Icon size={19}/><strong>{t[item.id]}</strong><ChevronRight size={16}/></button>; })}<div className="rail-status" data-stage={currentStage}><p>{locale === "zh" ? "当前阶段" : "Current stage"}</p><strong>{projectStageLabels[locale][currentStage]}</strong><span>{issues.filter((item) => item.severity === "error").length} {locale === "zh" ? "个阻断项" : "blocking issues"}</span></div></aside>
      <main className="workspace-content">{content}</main>
    </div>
    {ocrChoiceSourceIds && <div className="model-choice-backdrop">
      <section className="model-choice-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ocr-choice-title">
        <p>OCR / PREPROCESSING</p>
        <h2 id="ocr-choice-title">{locale === "zh" ? "导入文件存在无法识别项，是否通过 OCR 重新识别？" : "Some imported files could not be recognized. Run OCR?"}</h2>
        <span>{locale === "zh" ? "选择“否”会保留原文件并标记为仅上传、未处理。" : "Choosing No keeps the original files and marks them as uploaded only."}</span>
        <div><button ref={modelChoicePrimary} className="model-choice-primary" type="button" onClick={confirmTenderOcr}><RefreshCw size={18}/>{locale === "zh" ? "是" : "Yes"}</button><button type="button" onClick={skipTenderOcr}><X size={18}/>{locale === "zh" ? "否" : "No"}</button></div>
      </section>
    </div>}
    {pendingModelAction && <div className="model-choice-backdrop">
      <section className="model-choice-dialog" role="alertdialog" aria-modal="true" aria-labelledby="model-choice-title">
        <p>MODEL ACTION / EXECUTION PATH</p>
        <h2 id="model-choice-title">{pendingModelAction.kind === "tender-ocr" ? (locale === "zh" ? "模型未配置，请前往配置。" : "The model is not configured. Open configuration.") : (locale === "zh" ? "未配置大模型，请前往配置。" : "No model is configured. Open model configuration.")}</h2>
        <span>{locale === "zh" ? "可以前往配置可直接调用的模型，也可以输出当前操作对应的大模型任务文件。" : "Configure a directly callable model, or output a model task file for the current action."}</span>
        <div>
          <button ref={modelChoicePrimary} className="model-choice-primary" type="button" onClick={() => void rememberModelActionAndOpenSettings(pendingModelAction)}><Settings2 size={18}/>{locale === "zh" ? "是，前往配置" : "Yes, configure model"}</button>
          <button type="button" onClick={outputPendingModelTask}><FileText size={18}/>{locale === "zh" ? "否，输出任务" : "No, output task"}</button>
        </div>
      </section>
    </div>}
  </div>;
}
