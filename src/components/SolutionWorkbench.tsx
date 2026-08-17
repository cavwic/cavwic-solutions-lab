import {
  AlertTriangle,
  Archive,
  BookOpenCheck,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  FileCheck2,
  FileInput,
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
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { parseSourceFile } from "../lib/parsers";
import {
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
  importProjectArchive,
  loadActiveProject,
  persistWorkspaceDirectory,
  readGeneratedFileFromDirectory,
  readWorkspaceFileFromRelativePath,
  removeWorkspaceFileFromRelativePath,
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
  compareBaselines,
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
  type Deliverable,
  type EvidenceRef,
  type Locale,
  type PresalesGeneratedFile,
  type PresalesAnalysisResult,
  type PresalesParticipant,
  type PresalesRound,
  type PresalesRoundAction,
  type ProjectManifest,
  type Requirement,
  type SourceSegment,
} from "../lib/workspace-schema";

type View = WorkspaceView;
type Props = { initialView?: View };

const copy = {
  zh: {
    local: "资料只在当前浏览器和您授权的本地目录中处理",
    project: "解决方案项目工作台",
    projectContext: "项目与边界",
    presales: "售前准备",
    requirements: "招标要求",
    bid: "技术标组包",
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
    sourceLibrary: "招标书与补遗文件",
    importSources: "导入来源文件",
    noSource: "先导入招标文件、售前纪要或 OCR 结果。",
    sourceSegments: "来源片段",
    addRequirement: "加入要求",
    requirementReview: "要求复核队列",
    baselineDiff: "售前与招标基线差异",
    evidenceLibrary: "产品与方案证据库",
    responseMatrix: "响应与偏离表",
    solutionSections: "技术方案章节",
    deliverables: "技术标文件包",
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
    materialsEyebrow: "已核验资料",
    complianceEyebrow: "响应 / 偏离",
    technicalEyebrow: "技术方案",
    packageEyebrow: "文件包登记",
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
    requirements: "Tender requirements",
    bid: "Technical bid pack",
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
    sourceLibrary: "Tender and amendment files",
    importSources: "Import source files",
    noSource: "Import a tender, meeting note, or OCR result first.",
    sourceSegments: "Source segments",
    addRequirement: "Add requirement",
    requirementReview: "Requirement review queue",
    baselineDiff: "Discovery and tender baseline diff",
    evidenceLibrary: "Product and solution evidence",
    responseMatrix: "Response and deviation matrix",
    solutionSections: "Technical solution sections",
    deliverables: "Technical bid deliverables",
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
    materialsEyebrow: "VERIFIED MATERIALS",
    complianceEyebrow: "COMPLIANCE / DEVIATION",
    technicalEyebrow: "TECHNICAL VOLUME",
    packageEyebrow: "PACKAGE REGISTER",
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
  { id: "handover", icon: ClipboardCheck, code: "04" },
  { id: "outputs", icon: FileOutput, code: "05" },
];

const responseLabels = {
  zh: { confirmed: "已证实满足", conditional: "条件满足", custom: "需定制", missing_evidence: "缺少证据", unsupported: "不满足" },
  en: { confirmed: "Confirmed", conditional: "Conditional", custom: "Customization required", missing_evidence: "Evidence missing", unsupported: "Unsupported" },
} as const;
const deviationLabels = {
  zh: { positive: "正偏离", none: "无偏离", negative: "负偏离", pending: "待确认" },
  en: { positive: "Positive", none: "None", negative: "Negative", pending: "Pending" },
} as const;
const reviewLabels = {
  zh: { draft: "草稿", reviewed: "已复核", approved: "已批准" },
  en: { draft: "Draft", reviewed: "Reviewed", approved: "Approved" },
} as const;
const categoryLabels = {
  zh: { technical: "技术", business: "业务", qualification: "资格", scoring: "评分", schedule: "工期", acceptance: "验收", delivery: "交付", commercial: "商务" },
  en: { technical: "Technical", business: "Business", qualification: "Qualification", scoring: "Scoring", schedule: "Schedule", acceptance: "Acceptance", delivery: "Delivery", commercial: "Commercial" },
} as const;
const baselineLabels = {
  zh: { discovery: "售前调研", tender: "正式招标" },
  en: { discovery: "Discovery", tender: "Tender" },
} as const;
const actionStatusLabels = {
  zh: { open: "待处理", working: "进行中", blocked: "受阻", done: "已完成" },
  en: { open: "Open", working: "Working", blocked: "Blocked", done: "Done" },
} as const;
const deliverableStatusLabels = {
  zh: { "not-started": "未开始", draft: "草稿", review: "审阅中", approved: "已批准" },
  en: { "not-started": "Not started", draft: "Draft", review: "In review", approved: "Approved" },
} as const;
const evidenceKindLabels = {
  zh: { "product-intro": "产品介绍", sow: "工作范围 SOW", manual: "产品手册", "historical-solution": "历史方案", certificate: "证书", drawing: "图纸", other: "其他" },
  en: { "product-intro": "Product introduction", sow: "SOW", manual: "Manual", "historical-solution": "Historical solution", certificate: "Certificate", drawing: "Drawing", other: "Other" },
} as const;
const projectStageLabels = {
  zh: { presales: "售前", tender: "投标", delivery: "交底" },
  en: { presales: "Presales", tender: "Tender", delivery: "Handover" },
} as const;
const diffRelationLabels = {
  zh: { added: "新增", changed: "已修改", unchanged: "未变化", removed: "已删除", conflict: "有冲突" },
  en: { added: "Added", changed: "Changed", unchanged: "Unchanged", removed: "Removed", conflict: "Conflict" },
} as const;
const deliverableKindLabels = {
  zh: { "technical-proposal": "技术方案", "response-matrix": "响应表", "deviation-table": "偏离表", "module-detail": "模块分项介绍", "drawing-register": "图纸清单", "deployment-manual": "部署手册", "acceptance-plan": "验收方案", "certificate-register": "证书清单" },
  en: { "technical-proposal": "Technical proposal", "response-matrix": "Response matrix", "deviation-table": "Deviation table", "module-detail": "Module details", "drawing-register": "Drawing register", "deployment-manual": "Deployment manual", "acceptance-plan": "Acceptance plan", "certificate-register": "Certificate register" },
} as const;
const issueAreaLabels = {
  zh: { project: "项目", source: "来源", requirement: "要求", evidence: "证据", action: "任务", deliverable: "交付物", section: "章节" },
  en: { project: "Project", source: "Source", requirement: "Requirement", evidence: "Evidence", action: "Action", deliverable: "Deliverable", section: "Section" },
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
    || project.requirements.some((item) => item.sourceRef?.documentId === sourceId)
    || project.evidence.some((item) => item.sourceRef?.documentId === sourceId)
    || project.presalesRounds.some((round) => round.requirementSourceIds.includes(sourceId)
      || round.referenceSourceIds.includes(sourceId)
      || round.templateSourceIds.includes(sourceId)
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
  const [participantDrafts, setParticipantDrafts] = useState<Record<string, { name: string; category: PresalesParticipant["category"] }>>({});
  const [returnState, setReturnState] = useState<ModelActionReturnState | null>(null);
  const sourceInput = useRef<HTMLInputElement>(null);
  const archiveInput = useRef<HTMLInputElement>(null);
  const t = copy[locale];
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const issues = useMemo(() => validateProject(project, locale), [project, locale]);
  const coverage = useMemo(() => requirementCoverage(project), [project]);
  const currentStage = useMemo(() => inferProjectStage(project), [project]);
  const diffs = useMemo(() => compareBaselines(project.requirements), [project.requirements]);
  const selectedSource = project.sources.find((item) => item.id === selectedSourceId) || project.sources[0];
  const selectedRequirement = project.requirements.find((item) => item.id === selectedRequirementId) || project.requirements[0];

  useEffect(() => {
    const storedLocale = localStorage.getItem("cavwic-lab-locale");
    const systemLocale: Locale = navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    const nextLocale = storedLocale === "zh" || storedLocale === "en" ? storedLocale : systemLocale;
    const storedTheme = localStorage.getItem("cavwic-lab-theme");
    const nextTheme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setLocale(nextLocale);
    setTheme(nextTheme);
    document.documentElement.dataset.locale = nextLocale;
    document.documentElement.lang = nextLocale === "zh" ? "zh-CN" : "en";
    document.documentElement.dataset.theme = nextTheme;
    const stored = localStorage.getItem("cavwic-solution-workspace");
    if (stored) {
      const parsed = projectManifestSchema.safeParse(JSON.parse(stored));
      if (parsed.success) setProject(syncProjectStage(localizeBuiltInProject(parsed.data, nextLocale)));
    } else setProject(syncProjectStage(createEmptyProject(nextLocale)));
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
    }
    void restoreWorkspaceDirectory().then((handle) => {
      if (handle) setDirectoryHandle(handle);
    }).catch(() => undefined);
    setReady(true);
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
      void saveProjectStateToDirectory(directoryHandle, project)
        .then(() => setNotice(t.projectPathSaved))
        .catch(() => setNotice(locale === "zh" ? "项目路径授权已失效，请重新选择。" : "Project folder access expired. Choose it again."));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [directoryHandle, locale, project, ready, t.projectPathSaved]);

  const updateProject = <K extends keyof ProjectManifest>(key: K, value: ProjectManifest[K]) => setProject((current) => syncProjectStage({ ...current, [key]: value, updatedAt: new Date().toISOString() }));
  const updateRequirement = (id: string, patch: Partial<Requirement>) => updateProject("requirements", project.requirements.map((item) => item.id === id ? { ...item, ...patch } : item));
  const updatePresalesRound = (id: string, patch: Partial<PresalesRound>) => updateProject("presalesRounds", project.presalesRounds.map((item) => item.id === id ? { ...item, ...patch } : item));

  const switchLocale = () => {
    const next = locale === "zh" ? "en" : "zh";
    setLocale(next);
    localStorage.setItem("cavwic-lab-locale", next);
    document.documentElement.dataset.locale = next;
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
    window.dispatchEvent(new CustomEvent("cavwic-locale-change", { detail: next }));
    setProject((current) => syncProjectStage(localizeBuiltInProject(current, next)));
  };
  const switchTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("cavwic-lab-theme", next);
    document.documentElement.dataset.theme = next;
  };

  const parseFiles = async (files: FileList | null) => {
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
      const nextProject = syncProjectStage({ ...project, sources: [...project.sources, ...parsed], updatedAt: new Date().toISOString() });
      setProject(nextProject);
      setSourceFiles(nextFiles);
      setSelectedSourceId(parsed[0]?.id || "");
      if (directoryHandle) await saveProjectStateToDirectory(directoryHandle, nextProject, nextFiles);
      const ocrCount = parsed.filter((item) => item.requiresOcr).length;
      setNotice(ocrCount ? t.ocr : `${parsed.length} ${locale === "zh" ? "个文件已解析" : "files parsed"}`);
    } catch {
      setNotice(t.invalid);
    } finally {
      setBusy(false);
      if (sourceInput.current) sourceInput.current.value = "";
    }
  };

  const importPresalesFiles = async (files: FileList | null, target: { kind: "requirements" | "references" | "templates"; roundId: string }) => {
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
          return {
            ...round,
            referenceSourceIds: [...new Set([...round.referenceSourceIds, ...sourceIds])],
          };
        }),
        updatedAt: new Date().toISOString(),
      } as ProjectManifest);
      setProject(nextProject);
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

  const removePresalesSource = async (round: PresalesRound, sourceId: string, kind: "requirements" | "templates") => {
    const source = project.sources.find((item) => item.id === sourceId);
    const nextRounds = project.presalesRounds.map((item) => {
      if (item.id !== round.id) return item;
      if (kind === "requirements") return {
        ...item,
        requirementSourceIds: item.requirementSourceIds.filter((id) => id !== sourceId),
        selectedRequirementSourceIds: selectedCustomerSourceIds(item).filter((id) => id !== sourceId),
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
    setProject(nextProject);
    setSourceFiles(nextFiles);
    if (directoryHandle && removeSource && source) {
      await removeWorkspaceFileFromRelativePath(directoryHandle, `projects/${project.id}/sources/${source.name}`).catch(() => undefined);
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

  const requireModel = (action: string, anchorId: string) => {
    const currentSettings = readModelSettings();
    const currentApiKey = readModelApiKey();
    if (hasBrowserCallableModel(currentSettings)) return { settings: currentSettings, apiKey: currentApiKey };

    try {
      localStorage.setItem("cavwic-solution-workspace", JSON.stringify({ ...project, updatedAt: new Date().toISOString() }));
    } catch {
      // The authorized project directory remains the source of truth when browser storage is full.
    }
    const returnPath = `${window.location.pathname}${window.location.search}`;
    saveModelActionReturnState({
      schemaVersion: "1.0.0",
      action,
      returnPath,
      view,
      anchorId,
      scrollY: Math.max(0, window.scrollY),
      selectedSourceId,
      selectedRequirementId,
      selectedActionIds: [...selectedActionIds],
      expandedAnalysisId,
      taskKind,
      savedAt: new Date().toISOString(),
    });
    window.alert(locale === "zh" ? "未配置大模型，请前往配置。" : "No model is configured. Open model configuration.");
    window.location.href = `${base}/model-settings?return=${encodeURIComponent(returnPath)}`;
    return null;
  };

  const analyzeCustomerSources = async (round: PresalesRound) => {
    if (!round.requirementSourceIds.length) return;
    const invocation = requireModel("customer-requirement-analysis", `communication-${round.id}`);
    if (!invocation) return;
    const sourceIds = selectedCustomerSourceIds(round);
    if (!sourceIds.length) {
      window.alert(locale === "zh" ? "请先选择需要分析的客户附件。" : "Select at least one customer attachment to analyze.");
      return;
    }
    if (!round.analysisOutputFormat) {
      window.alert(locale === "zh" ? "请先选择分析结果的文件格式。" : "Select an output format for the analysis result.");
      return;
    }
    const selectedTemplates = round.selectedTemplateSourceIds
      .map((id) => project.sources.find((source) => source.id === id))
      .filter((source): source is NonNullable<typeof source> => Boolean(source));
    const mismatch = selectedTemplates.find((source) => templateFileFormat(source.name) !== round.analysisOutputFormat);
    if (mismatch) {
      alertTemplateMismatch(mismatch.name, round.analysisOutputFormat);
      return;
    }
    const selectedSources = sourceIds
      .map((id) => project.sources.find((source) => source.id === id))
      .filter((source): source is NonNullable<typeof source> => Boolean(source));
    setAnalyzingRoundId(round.id);
    setBusy(true);
    try {
      const prompt = buildCustomerNeedsAnalysisPrompt(project, round, selectedSources, selectedTemplates, locale);
      const draft = await requestPresalesDraft(invocation.settings, invocation.apiKey, prompt);
      const baseName = analysisResultBaseName(round.keywords, locale);
      const resultName = uniqueAnalysisResultName(baseName, round.analysisResults);
      const generated = await createGeneratedFile(draft.content, resultName, round.analysisOutputFormat);
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
        format: round.analysisOutputFormat,
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
      setProject(nextProject);
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
    setProject(nextProject);
    setSourceFiles(nextFiles);
    setGeneratedBlobs(nextBlobs);
    if (expandedAnalysisId === result.id) setExpandedAnalysisId("");
    if (directoryHandle) {
      await removeWorkspaceFileFromRelativePath(directoryHandle, result.relativePath).catch(() => undefined);
      await saveProjectStateToDirectory(directoryHandle, nextProject, nextFiles).catch(() => undefined);
    }
  };

  const generatePresalesFiles = async (round: PresalesRound, actions: PresalesRoundAction[]) => {
    const anchorId = actions.length === 1 ? `response-action-${actions[0].id}` : `communication-${round.id}`;
    const invocation = requireModel(actions.length === 1 ? "generate-response-file" : "batch-generate-response-files", anchorId);
    if (!invocation) return;
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
      setProject(nextProject);
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

  const requirementFromSegment = (segment: SourceSegment) => {
    if (!selectedSource) return;
    const requirement = createRequirement(view === "presales" ? "discovery" : "tender", {
      title: segment.text.slice(0, 46) || (locale === "zh" ? "待复核要求" : "Requirement to review"),
      originalText: segment.text,
      normalizedText: segment.text,
      sourceRef: { documentId: selectedSource.id, segmentId: segment.id, locator: segment.locator, excerpt: segment.text.slice(0, 240) },
    }, locale);
    updateProject("requirements", [...project.requirements, requirement]);
    setSelectedRequirementId(requirement.id);
  };

  const addEvidence = () => {
    const evidence: EvidenceRef = { id: createId("evidence"), title: locale === "zh" ? "待核验资料" : "Evidence to verify", kind: "manual", fileName: "", version: "", verifiedAt: "", expiresAt: "", sourceRef: null, notes: "" };
    updateProject("evidence", [...project.evidence, evidence]);
  };

  const addDeliverable = (stage: "presales" | "tender" | "delivery") => {
    const deliverable: Deliverable = { id: createId("deliverable"), stage, kind: stage === "tender" ? "technical-proposal" : stage === "delivery" ? "handover-pack" : "preliminary-solution", title: locale === "zh" ? "新交付物" : "New deliverable", status: "not-started", owner: "", dueDate: "", sourceIds: [], notes: "" };
    updateProject("deliverables", [...project.deliverables, deliverable]);
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
      setProject(syncProjectStage(await loadActiveProject(directoryHandle)));
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
      setProject(nextProject);
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
      if (taskKind === "extract") return `使用 $tender-requirement-extraction 处理工作区 ${path} 中项目 ${project.id}。读取 sources 目录的招标书与补遗文件，逐条保留页码或段落来源，输出 requirements.csv、requirements.md 和更新后的 project.json。不得把缺少证据的要求写成满足。`;
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
              <button className="generate-command analysis-command" type="button" disabled={busy || !round.requirementSourceIds.length} onClick={() => void analyzeCustomerSources(round)}><Sparkles size={17}/>{analyzingRoundId === round.id ? (locale === "zh" ? "正在分析" : "Analyzing") : (locale === "zh" ? "需求分析" : "Analyze requirements")}</button>
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
                return <div className="round-action-row" id={`response-action-${action.id}`} key={action.id}>
                  <div className="action-response-fields">
                    <Field label={locale === "zh" ? "响应文件名称" : "Response file name"}><input aria-label={locale === "zh" ? "响应文件名称" : "Response file name"} value={target.name} onChange={(event) => updateRoundAction(round, action.id, { responseFileName: event.target.value })}/></Field>
                    <Field label={locale === "zh" ? "响应文件格式" : "Response file format"}><select aria-label={locale === "zh" ? "响应文件格式" : "Response file format"} value={target.format} onChange={(event) => updateRoundAction(round, action.id, { responseFileFormat: event.target.value ? event.target.value as NonNullable<PresalesRoundAction["responseFileFormat"]> : undefined })}><option value="">{locale === "zh" ? "请选择" : "Select"}</option><option value="docx">Word</option><option value="pptx">PPT</option><option value="md">Markdown</option></select></Field>
                    <button className="row-delete" type="button" title={t.remove} aria-label={t.remove} onClick={() => { setActionSelected(action.id, false); updatePresalesRound(round.id, { actions: round.actions.filter((item) => item.id !== action.id) }); }}><Trash2 size={15}/></button>
                  </div>
                  <Field label={t.owner}><input aria-label={t.owner} placeholder={t.owner} value={action.owner} onChange={(event) => updateRoundAction(round, action.id, { owner: event.target.value })}/></Field>
                  <div className="action-meta-fields">
                    <Field label={locale === "zh" ? "时间" : "Date"}><input aria-label={locale === "zh" ? "时间" : "Date"} type="date" value={action.dueDate} onChange={(event) => updateRoundAction(round, action.id, { dueDate: event.target.value })}/></Field>
                    <Field label={locale === "zh" ? "文件状态" : "File status"}><select aria-label={locale === "zh" ? "文件状态" : "File status"} value={action.status} onChange={(event) => updateRoundAction(round, action.id, { status: event.target.value as PresalesRoundAction["status"] })}>{Object.entries(actionStatusLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
                  </div>
                  <Field label={locale === "zh" ? "文件要求" : "File requirements"}><textarea rows={5} aria-label={locale === "zh" ? "文件要求" : "File requirements"} placeholder={locale === "zh" ? "说明文件格式、内容、参考模板、需继承的信息及不得承诺的事项" : "Describe formatting, content, reference templates, inherited information, and prohibited commitments"} value={action.fileRequirements || ""} onChange={(event) => updateRoundAction(round, action.id, { fileRequirements: event.target.value })}/></Field>
                  <div className="action-command-row">
                    <label className="action-select" title={locale === "zh" ? "选择该项" : "Select this item"}><input type="checkbox" aria-label={locale === "zh" ? `选择响应文件 ${target.name || "未命名"}` : `Select response file ${target.name || "unnamed"}`} checked={selectedActionIds.has(action.id)} onChange={(event) => setActionSelected(action.id, event.target.checked)}/><span><Check size={16}/></span></label>
                    <button className="generate-command" type="button" disabled={busy} onClick={() => void generatePresalesTasks(round, [action])}><FileText size={17}/>{generatingActionId === `task-${action.id}` ? (locale === "zh" ? "处理中" : "Working") : (locale === "zh" ? "生成任务" : "Generate task")}</button>
                    <button className="generate-command" type="button" disabled={busy} onClick={() => void generatePresalesFiles(round, [action])}><Sparkles size={17}/>{generatingActionId === `file-${action.id}` ? (locale === "zh" ? "处理中" : "Working") : (locale === "zh" ? "生成文件" : "Generate file")}</button>
                  </div>
                </div>;
              })}</div>
              <button className="inline-command" type="button" onClick={() => addRoundAction(round)}><Plus size={15}/>{locale === "zh" ? "新增执行项" : "Add action"}</button>
              <div className="bulk-action-row">
                <label className="action-select" title={locale === "zh" ? "选择本轮全部执行项" : "Select all actions in this round"}><input type="checkbox" aria-label={locale === "zh" ? "选择本轮全部执行项" : "Select all actions in this round"} disabled={!round.actions.length} checked={round.actions.length > 0 && round.actions.every((action) => selectedActionIds.has(action.id))} onChange={(event) => setRoundActionsSelected(round, event.target.checked)}/><span><Check size={16}/></span></label>
                <button className="generate-command" type="button" disabled={busy || !checkedActions(round).length} onClick={() => void generatePresalesTasks(round, checkedActions(round))}><FileText size={17}/>{generatingActionId === `batch-task-${round.id}` ? (locale === "zh" ? "处理中" : "Working") : (locale === "zh" ? "批量生成任务" : "Generate tasks")}</button>
                <button className="generate-command" type="button" disabled={busy || !checkedActions(round).length} onClick={() => void generatePresalesFiles(round, checkedActions(round))}><Sparkles size={17}/>{generatingActionId === `batch-file-${round.id}` ? (locale === "zh" ? "处理中" : "Working") : (locale === "zh" ? "批量生成文件" : "Generate files")}</button>
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

  const renderRequirements = () => <>
    <section className="work-section">
      <div className="section-heading"><div><p>{t.sourceEyebrow}</p><h2>{t.sourceLibrary}</h2></div><button className="command-button" type="button" disabled={busy} onClick={() => sourceInput.current?.click()}><Upload size={17}/>{t.importSources}</button></div>
      <input ref={sourceInput} hidden multiple type="file" accept=".pdf,.docx,.xlsx,.pptx,.md,.txt,.csv" onChange={(event) => void parseFiles(event.target.files)}/>
      {project.sources.length ? <div className="source-tabs">{project.sources.map((source) => <button type="button" className={source.id === selectedSource?.id ? "active" : ""} key={source.id} onClick={() => setSelectedSourceId(source.id)}><FileText size={16}/><span>{source.name}</span>{source.requiresOcr && <AlertTriangle size={15}/>}</button>)}</div> : <div className="empty-state"><FileInput size={28}/><p>{t.noSource}</p></div>}
    </section>
    <section className="work-section source-review-grid">
      <div className="source-pane"><div className="pane-title"><div><p>{t.sourceOnlyEyebrow}</p><h2>{t.sourceSegments}</h2></div>{selectedSource && <span>{selectedSource.segments.length}</span>}</div>
        <div className="segment-list">{selectedSource?.segments.map((segment) => <article key={segment.id}><header><span>{segment.locator}</span><button type="button" onClick={() => requirementFromSegment(segment)}><Plus size={15}/>{t.addRequirement}</button></header><p>{segment.text || (locale === "zh" ? "无可提取文本" : "No extractable text")}</p></article>)}</div>
      </div>
      <div className="requirements-pane"><div className="pane-title"><div><p>{t.reviewEyebrow}</p><h2>{t.requirementReview}</h2></div><button className="icon-command" type="button" title={t.add} onClick={() => { const item = createRequirement("tender", {}, locale); updateProject("requirements", [...project.requirements, item]); setSelectedRequirementId(item.id); }}><Plus size={18}/></button></div>
        <div className="requirement-index">{project.requirements.map((item) => <button type="button" className={item.id === selectedRequirement?.id ? "active" : ""} key={item.id} onClick={() => setSelectedRequirementId(item.id)}><span className={`review-dot ${item.reviewState}`}></span><strong>{item.title}</strong><small>{item.sourceRef?.locator || (locale === "zh" ? "缺少来源" : "Source missing")}</small></button>)}</div>
        {selectedRequirement ? <div className="requirement-editor">
          <div className="editor-toolbar"><span>{selectedRequirement.id}</span><button type="button" title={t.remove} aria-label={t.remove} onClick={() => updateProject("requirements", project.requirements.filter((item) => item.id !== selectedRequirement.id))}><Trash2 size={16}/></button></div>
          <Field label={locale === "zh" ? "要求标题" : "Requirement title"}><input value={selectedRequirement.title} onChange={(event) => updateRequirement(selectedRequirement.id, { title: event.target.value })}/></Field>
          <div className="field-grid compact"><Field label={locale === "zh" ? "基线" : "Baseline"}><select value={selectedRequirement.baseline} onChange={(event) => updateRequirement(selectedRequirement.id, { baseline: event.target.value as Requirement["baseline"] })}>{Object.entries(baselineLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field><Field label={locale === "zh" ? "分类" : "Category"}><select value={selectedRequirement.category} onChange={(event) => updateRequirement(selectedRequirement.id, { category: event.target.value as Requirement["category"] })}>{Object.entries(categoryLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field></div>
          <Field label={locale === "zh" ? "招标原文" : "Original clause"}><textarea rows={4} value={selectedRequirement.originalText} onChange={(event) => updateRequirement(selectedRequirement.id, { originalText: event.target.value })}/></Field>
          <Field label={locale === "zh" ? "结构化要求" : "Normalized requirement"}><textarea rows={3} value={selectedRequirement.normalizedText} onChange={(event) => updateRequirement(selectedRequirement.id, { normalizedText: event.target.value })}/></Field>
          <div className="inline-checks"><label><input type="checkbox" checked={selectedRequirement.mandatory} onChange={(event) => updateRequirement(selectedRequirement.id, { mandatory: event.target.checked })}/><span><Check size={14}/></span>{locale === "zh" ? "强制项" : "Mandatory"}</label><label><input type="checkbox" checked={selectedRequirement.scored} onChange={(event) => updateRequirement(selectedRequirement.id, { scored: event.target.checked })}/><span><Check size={14}/></span>{locale === "zh" ? "评分项" : "Scored"}</label></div>
          <div className="field-grid compact"><Field label={t.owner}><input value={selectedRequirement.owner} onChange={(event) => updateRequirement(selectedRequirement.id, { owner: event.target.value })}/></Field><Field label={locale === "zh" ? "审阅状态" : "Review state"}><select value={selectedRequirement.reviewState} onChange={(event) => updateRequirement(selectedRequirement.id, { reviewState: event.target.value as Requirement["reviewState"] })}>{Object.entries(reviewLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field></div>
          <Field label={locale === "zh" ? "关联售前需求" : "Linked discovery requirement"}><select value={selectedRequirement.linkedDiscoveryId} onChange={(event) => updateRequirement(selectedRequirement.id, { linkedDiscoveryId: event.target.value })}><option value="">{locale === "zh" ? "未关联" : "Not linked"}</option>{project.requirements.filter((item) => item.baseline === "discovery").map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></Field>
          <Field label={locale === "zh" ? "冲突或变更说明" : "Conflict or change note"}><textarea rows={2} value={selectedRequirement.conflictNote} onChange={(event) => updateRequirement(selectedRequirement.id, { conflictNote: event.target.value })}/></Field>
        </div> : <div className="empty-state"><BookOpenCheck size={26}/><p>{t.noRequirement}</p></div>}
      </div>
    </section>
    <section className="work-section"><div className="section-heading"><div><p>{t.baselineEyebrow}</p><h2>{t.baselineDiff}</h2></div><span>{diffs.length}</span></div><div className="diff-list">{diffs.map((item) => <div key={item.id}><span className={`relation ${item.relation}`}>{diffRelationLabels[locale][item.relation]}</span><p>{item.discovery?.normalizedText || (locale === "zh" ? "未提供" : "Not provided")}</p><ChevronRight size={16}/><p>{item.tender?.normalizedText || (locale === "zh" ? "未提供" : "Not provided")}</p></div>)}</div></section>
  </>;

  const renderBid = () => <>
    <section className="work-section"><div className="section-heading"><div><p>{t.materialsEyebrow}</p><h2>{t.evidenceLibrary}</h2></div><button className="icon-command" type="button" title={t.add} onClick={addEvidence}><Plus size={18}/></button></div>
      <div className="evidence-table"><div className="table-head"><span>{locale === "zh" ? "资料" : "Material"}</span><span>{locale === "zh" ? "类型" : "Type"}</span><span>{locale === "zh" ? "版本 / 文件" : "Version / file"}</span><span>{locale === "zh" ? "核验 / 复核" : "Verified / review"}</span><span></span></div>{project.evidence.map((item) => <div className="table-row" key={item.id}><input value={item.title} onChange={(event) => updateProject("evidence", project.evidence.map((candidate) => candidate.id === item.id ? { ...candidate, title: event.target.value } : candidate))}/><select value={item.kind} onChange={(event) => updateProject("evidence", project.evidence.map((candidate) => candidate.id === item.id ? { ...candidate, kind: event.target.value as EvidenceRef["kind"] } : candidate))}>{Object.entries(evidenceKindLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><div className="paired"><input placeholder="v1.0" value={item.version} onChange={(event) => updateProject("evidence", project.evidence.map((candidate) => candidate.id === item.id ? { ...candidate, version: event.target.value } : candidate))}/><input placeholder="file.pdf" value={item.fileName} onChange={(event) => updateProject("evidence", project.evidence.map((candidate) => candidate.id === item.id ? { ...candidate, fileName: event.target.value } : candidate))}/></div><div className="paired"><input type="date" value={item.verifiedAt} onChange={(event) => updateProject("evidence", project.evidence.map((candidate) => candidate.id === item.id ? { ...candidate, verifiedAt: event.target.value } : candidate))}/><input type="date" value={item.expiresAt} onChange={(event) => updateProject("evidence", project.evidence.map((candidate) => candidate.id === item.id ? { ...candidate, expiresAt: event.target.value } : candidate))}/></div><button className="row-delete" type="button" title={t.remove} aria-label={t.remove} onClick={() => updateProject("evidence", project.evidence.filter((candidate) => candidate.id !== item.id))}><Trash2 size={16}/></button></div>)}</div>
    </section>
    <section className="work-section"><div className="section-heading"><div><p>{t.complianceEyebrow}</p><h2>{t.responseMatrix}</h2></div><span>{coverage.total}</span></div><div className="response-table"><div className="response-head"><span>{locale === "zh" ? "要求" : "Requirement"}</span><span>{locale === "zh" ? "响应" : "Response"}</span><span>{locale === "zh" ? "偏离" : "Deviation"}</span><span>{locale === "zh" ? "证据" : "Evidence"}</span><span>{locale === "zh" ? "正式措辞" : "Formal wording"}</span></div>{project.requirements.filter((item) => item.baseline === "tender").map((item) => <div className="response-row" key={item.id}><div><strong>{item.title}</strong><small>{item.sourceRef?.locator || (locale === "zh" ? "缺少来源" : "Source missing")}</small></div><select value={item.responseStatus} onChange={(event) => updateRequirement(item.id, { responseStatus: event.target.value as Requirement["responseStatus"] })}>{Object.entries(responseLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><select value={item.deviationType} onChange={(event) => updateRequirement(item.id, { deviationType: event.target.value as Requirement["deviationType"] })}>{Object.entries(deviationLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><div className="evidence-checks">{project.evidence.map((evidence) => <label key={evidence.id} title={evidence.title}><input type="checkbox" checked={item.evidenceRefs.includes(evidence.id)} onChange={(event) => updateRequirement(item.id, { evidenceRefs: event.target.checked ? [...item.evidenceRefs, evidence.id] : item.evidenceRefs.filter((id) => id !== evidence.id) })}/><span>{evidence.title}</span></label>)}</div><textarea rows={3} value={item.formalResponse} onChange={(event) => updateRequirement(item.id, { formalResponse: event.target.value })}/></div>)}</div></section>
    <section className="work-section"><div className="section-heading"><div><p>{t.technicalEyebrow}</p><h2>{t.solutionSections}</h2></div><button className="icon-command" type="button" title={t.add} onClick={() => updateProject("sections", [...project.sections, { id: createId("section"), title: locale === "zh" ? "新技术章节" : "New technical section", purpose: "", requirementIds: [], evidenceIds: [], body: "", reviewState: "draft" }])}><Plus size={18}/></button></div><div className="section-builder">{project.sections.map((item, index) => <article key={item.id}><header><span>{String(index + 1).padStart(2, "0")}</span><input value={item.title} onChange={(event) => updateProject("sections", project.sections.map((candidate) => candidate.id === item.id ? { ...candidate, title: event.target.value } : candidate))}/><select value={item.reviewState} onChange={(event) => updateProject("sections", project.sections.map((candidate) => candidate.id === item.id ? { ...candidate, reviewState: event.target.value as typeof item.reviewState } : candidate))}>{Object.entries(reviewLabels[locale]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></header><input placeholder={locale === "zh" ? "本章节解决什么问题" : "Purpose of this section"} value={item.purpose} onChange={(event) => updateProject("sections", project.sections.map((candidate) => candidate.id === item.id ? { ...candidate, purpose: event.target.value } : candidate))}/><textarea rows={5} placeholder={locale === "zh" ? "仅根据已核验资料编制；缺少证据时保留待确认。" : "Draft only from verified materials; keep evidence gaps explicit."} value={item.body} onChange={(event) => updateProject("sections", project.sections.map((candidate) => candidate.id === item.id ? { ...candidate, body: event.target.value } : candidate))}/></article>)}</div></section>
    <section className="work-section"><div className="section-heading"><div><p>{t.packageEyebrow}</p><h2>{t.deliverables}</h2></div><button className="icon-command" type="button" title={t.add} onClick={() => addDeliverable("tender")}><Plus size={18}/></button></div><div className="package-register">{(Object.keys(deliverableKindLabels[locale]) as Array<keyof typeof deliverableKindLabels.zh>).map((kind) => { const existing = project.deliverables.find((item) => item.kind === kind); return <button type="button" className={existing?.status || "not-started"} key={kind} onClick={() => existing ? updateProject("deliverables", project.deliverables.map((item) => item.id === existing.id ? { ...item, status: item.status === "approved" ? "draft" : "approved" } : item)) : updateProject("deliverables", [...project.deliverables, { id: createId("deliverable"), stage: "tender", kind, title: deliverableKindLabels[locale][kind], status: "approved", owner: project.owner, dueDate: project.deadline, sourceIds: [], notes: "" }])}><span>{existing?.status === "approved" ? <Check size={17}/> : <FileCheck2 size={17}/>}</span><strong>{deliverableKindLabels[locale][kind]}</strong><small>{deliverableStatusLabels[locale][existing?.status || "not-started"]}</small></button>; })}</div></section>
  </>;

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
    <nav className="workspace-toolbar" aria-label={locale === "zh" ? "工作区操作" : "Workspace actions"}><button type="button" aria-label={t.reset} onClick={() => setProject(syncProjectStage(createEmptyProject(locale)))} title={t.reset}><RotateCcw size={17}/><span>{t.reset}</span></button><button className={`project-path-command${directoryHandle ? " active" : ""}`} type="button" disabled={busy} aria-label={`${t.projectPath}${directoryHandle ? `: ${directoryHandle.name}` : ""}`} onClick={() => void chooseDirectory()} title={`${t.projectPath}${directoryHandle ? `: ${directoryHandle.name}` : ""}`}><FolderOpen size={17}/><span>{directoryHandle?.name || t.projectPath}</span></button><button className="toolbar-settings-start" type="button" aria-label={theme === "light" ? t.darkMode : t.lightMode} onClick={switchTheme} title={theme === "light" ? t.darkMode : t.lightMode}>{theme === "light" ? <Moon size={17}/> : <Sun size={17}/>}</button><button type="button" aria-label={locale === "zh" ? "Switch to English" : "切换到中文"} onClick={switchLocale} title={locale === "zh" ? "English" : "中文"}><Languages size={17}/><span>{locale === "zh" ? "EN" : "中"}</span></button></nav>
    <div className="workspace-shell">
      <aside className="stage-rail" aria-label={locale === "zh" ? "解决方案流程" : "Solution lifecycle"}>{viewMeta.map((item) => { const Icon = item.icon; return <button type="button" aria-label={t[item.id]} title={t[item.id]} className={view === item.id ? "active" : ""} key={item.id} onClick={() => setView(item.id)}><span>{item.code}</span><Icon size={19}/><strong>{t[item.id]}</strong><ChevronRight size={16}/></button>; })}<div className="rail-status" data-stage={currentStage}><p>{locale === "zh" ? "当前阶段" : "Current stage"}</p><strong>{projectStageLabels[locale][currentStage]}</strong><span>{issues.filter((item) => item.severity === "error").length} {locale === "zh" ? "个阻断项" : "blocking issues"}</span></div></aside>
      <main className="workspace-content">{content}</main>
    </div>
  </div>;
}
