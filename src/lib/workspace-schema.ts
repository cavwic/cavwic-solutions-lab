import { z } from "zod";

export const SCHEMA_VERSION = "1.0.0" as const;

export const localeSchema = z.enum(["zh", "en"]);
export const projectStageSchema = z.enum(["presales", "tender", "delivery"]);
export const baselineSchema = z.enum(["discovery", "tender"]);
export const requirementCategorySchema = z.enum([
  "technical",
  "business",
  "qualification",
  "scoring",
  "schedule",
  "acceptance",
  "delivery",
  "commercial",
]);
export const responseStatusSchema = z.enum([
  "confirmed",
  "conditional",
  "custom",
  "missing_evidence",
  "unsupported",
]);
export const deviationTypeSchema = z.enum(["positive", "none", "negative", "pending"]);
export const reviewStateSchema = z.enum(["draft", "reviewed", "approved"]);
export const sourceFileTypeSchema = z.enum(["pdf", "docx", "xlsx", "pptx", "md", "txt", "csv", "json", "ocr"]);

export const sourceSegmentSchema = z.object({
  id: z.string().min(1),
  locatorKind: z.enum(["page", "paragraph", "table-cell", "sheet-cell", "slide", "line"]),
  locator: z.string().min(1),
  text: z.string(),
});

export const sourceDocumentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  fileType: sourceFileTypeSchema,
  version: z.string().default("1.0"),
  size: z.number().nonnegative(),
  sha256: z.string().min(1),
  importedAt: z.string(),
  requiresOcr: z.boolean().default(false),
  segments: z.array(sourceSegmentSchema),
});

export const sourceRefSchema = z.object({
  documentId: z.string().min(1),
  segmentId: z.string().min(1),
  locator: z.string().min(1),
  excerpt: z.string(),
});

export const evidenceRefSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(["product-intro", "sow", "manual", "historical-solution", "certificate", "drawing", "other"]),
  fileName: z.string(),
  version: z.string(),
  verifiedAt: z.string(),
  expiresAt: z.string(),
  sourceRef: sourceRefSchema.nullable(),
  notes: z.string(),
});

export const requirementSchema = z.object({
  id: z.string().min(1),
  baseline: baselineSchema,
  category: requirementCategorySchema,
  title: z.string().min(1),
  originalText: z.string(),
  normalizedText: z.string(),
  mandatory: z.boolean(),
  scored: z.boolean(),
  scoreWeight: z.string(),
  dueDate: z.string(),
  sourceRef: sourceRefSchema.nullable(),
  owner: z.string(),
  responseStatus: responseStatusSchema,
  deviationType: deviationTypeSchema,
  formalResponse: z.string(),
  evidenceRefs: z.array(z.string()),
  reviewState: reviewStateSchema,
  linkedDiscoveryId: z.string(),
  conflictNote: z.string(),
  acceptanceCriteria: z.string(),
  notes: z.string(),
});

export const actionItemSchema = z.object({
  id: z.string().min(1),
  stage: projectStageSchema,
  title: z.string().min(1),
  owner: z.string(),
  dueDate: z.string(),
  status: z.enum(["open", "working", "blocked", "done"]),
  sourceRequirementId: z.string(),
  notes: z.string(),
});

export const deliverableSchema = z.object({
  id: z.string().min(1),
  stage: projectStageSchema,
  kind: z.enum([
    "product-intro",
    "preliminary-solution",
    "meeting-deck",
    "discovery-record",
    "poc-plan",
    "technical-proposal",
    "response-matrix",
    "deviation-table",
    "module-detail",
    "drawing-register",
    "deployment-manual",
    "acceptance-plan",
    "certificate-register",
    "handover-pack",
  ]),
  title: z.string().min(1),
  status: z.enum(["not-started", "draft", "review", "approved"]),
  owner: z.string(),
  dueDate: z.string(),
  sourceIds: z.array(z.string()),
  notes: z.string(),
});

export const solutionSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  purpose: z.string(),
  requirementIds: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  body: z.string(),
  reviewState: reviewStateSchema,
});

export const pocPlanSchema = z.object({
  objective: z.string(),
  demoScope: z.string(),
  acceptance: z.string(),
  failureAndFallback: z.string(),
});

export const enterpriseContextSchema = z.object({
  companyName: z.string().default(""),
  platform: z.string().default(""),
  importedAt: z.string().default(""),
  notes: z.string().default(""),
  sourceIds: z.array(z.string()).default([]),
});

export const presalesRoundActionSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  owner: z.string(),
  dueDate: z.string(),
  status: z.enum(["open", "working", "blocked", "done"]),
  responseFileName: z.string().optional(),
  responseFileFormat: z.enum(["md", "docx", "pptx"]).optional(),
});

export const presalesGeneratedFileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  format: z.enum(["md", "docx", "pptx"]),
  createdAt: z.string(),
  provider: z.enum(["codex", "local", "cloud"]),
  model: z.string(),
  sourceId: z.string(),
  relativePath: z.string(),
  actionId: z.string().default(""),
});

export const presalesRoundSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  meetingAt: z.string(),
  customerNeeds: z.string(),
  requirementSourceIds: z.array(z.string()),
  actions: z.array(presalesRoundActionSchema),
  referenceSourceIds: z.array(z.string()),
  generationInstructions: z.string(),
  outputName: z.string(),
  outputFormat: z.enum(["md", "docx", "pptx"]),
  generatedFiles: z.array(presalesGeneratedFileSchema),
});

export const projectManifestSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  name: z.string().min(1),
  customerAlias: z.string(),
  industry: z.string(),
  owner: z.string(),
  stage: projectStageSchema,
  locale: localeSchema,
  localPathHint: z.string(),
  budget: z.string(),
  deadline: z.string(),
  objective: z.string(),
  constraints: z.string(),
  updatedAt: z.string(),
  sources: z.array(sourceDocumentSchema),
  requirements: z.array(requirementSchema),
  evidence: z.array(evidenceRefSchema),
  actions: z.array(actionItemSchema),
  deliverables: z.array(deliverableSchema),
  sections: z.array(solutionSectionSchema),
  pocPlan: pocPlanSchema,
  enterpriseContext: enterpriseContextSchema.default({ companyName: "", platform: "", importedAt: "", notes: "", sourceIds: [] }),
  presalesRounds: z.array(presalesRoundSchema).default([]),
  handoverNotes: z.string(),
});

export const workspaceManifestSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  activeProjectId: z.string(),
  projects: z.array(z.object({ id: z.string(), name: z.string(), updatedAt: z.string() })),
});

export const outputManifestSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  projectId: z.string(),
  generatedAt: z.string(),
  includesSources: z.boolean(),
  files: z.array(z.object({ name: z.string(), sha256: z.string(), bytes: z.number().nonnegative() })),
});

export type Locale = z.infer<typeof localeSchema>;
export type ProjectStage = z.infer<typeof projectStageSchema>;
export type Baseline = z.infer<typeof baselineSchema>;
export type RequirementCategory = z.infer<typeof requirementCategorySchema>;
export type ResponseStatus = z.infer<typeof responseStatusSchema>;
export type DeviationType = z.infer<typeof deviationTypeSchema>;
export type ReviewState = z.infer<typeof reviewStateSchema>;
export type SourceSegment = z.infer<typeof sourceSegmentSchema>;
export type SourceDocument = z.infer<typeof sourceDocumentSchema>;
export type SourceRef = z.infer<typeof sourceRefSchema>;
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;
export type Requirement = z.infer<typeof requirementSchema>;
export type ActionItem = z.infer<typeof actionItemSchema>;
export type Deliverable = z.infer<typeof deliverableSchema>;
export type SolutionSection = z.infer<typeof solutionSectionSchema>;
export type EnterpriseContext = z.infer<typeof enterpriseContextSchema>;
export type PresalesRoundAction = z.infer<typeof presalesRoundActionSchema>;
export type PresalesGeneratedFile = z.infer<typeof presalesGeneratedFileSchema>;
export type PresalesRound = z.infer<typeof presalesRoundSchema>;
export type ProjectManifest = z.infer<typeof projectManifestSchema>;
export type WorkspaceManifest = z.infer<typeof workspaceManifestSchema>;
export type OutputManifest = z.infer<typeof outputManifestSchema>;

export function createId(prefix: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

export function createPresalesRound(locale: Locale = "zh", index = 1): PresalesRound {
  return {
    id: createId("round"),
    title: locale === "zh" ? `第 ${index} 次沟通` : `Communication ${index}`,
    meetingAt: "",
    customerNeeds: "",
    requirementSourceIds: [],
    actions: [],
    referenceSourceIds: [],
    generationInstructions: "",
    outputName: locale === "zh" ? `第${index}次沟通响应文件` : `communication-${index}-response`,
    outputFormat: "docx",
    generatedFiles: [],
  };
}

export function createEmptyProject(locale: Locale = "zh"): ProjectManifest {
  const updatedAt = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: `solution-${updatedAt.slice(0, 10)}`,
    name: locale === "zh" ? "新建解决方案项目" : "New solution project",
    customerAlias: "",
    industry: "",
    owner: "",
    stage: "presales",
    locale,
    localPathHint: "",
    budget: "",
    deadline: "",
    objective: "",
    constraints: "",
    updatedAt,
    sources: [],
    requirements: [],
    evidence: [],
    actions: [],
    deliverables: [
      { id: createId("deliverable"), stage: "presales", kind: "product-intro", title: locale === "zh" ? "产品介绍" : "Product introduction", status: "not-started", owner: "", dueDate: "", sourceIds: [], notes: "" },
      { id: createId("deliverable"), stage: "presales", kind: "preliminary-solution", title: locale === "zh" ? "初步方案" : "Preliminary solution", status: "not-started", owner: "", dueDate: "", sourceIds: [], notes: "" },
      { id: createId("deliverable"), stage: "presales", kind: "discovery-record", title: locale === "zh" ? "需求调研文件" : "Discovery record", status: "not-started", owner: "", dueDate: "", sourceIds: [], notes: "" },
    ],
    sections: [],
    pocPlan: { objective: "", demoScope: "", acceptance: "", failureAndFallback: "" },
    enterpriseContext: { companyName: "", platform: "", importedAt: "", notes: "", sourceIds: [] },
    presalesRounds: [createPresalesRound(locale, 1)],
    handoverNotes: "",
  };
}
