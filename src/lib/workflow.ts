import {
  createEmptyProject,
  createId,
  type Baseline,
  type ProjectManifest,
  type Requirement,
} from "./workspace-schema";

export type ValidationIssue = {
  id: string;
  severity: "error" | "warning";
  area: "project" | "source" | "requirement" | "evidence" | "action" | "deliverable" | "section";
  message: string;
  targetId?: string;
};

export type BaselineDiff = {
  id: string;
  relation: "added" | "changed" | "unchanged" | "removed" | "conflict";
  discovery?: Requirement;
  tender?: Requirement;
};

export function compareBaselines(requirements: Requirement[]): BaselineDiff[] {
  const discovery = requirements.filter((item) => item.baseline === "discovery");
  const tender = requirements.filter((item) => item.baseline === "tender");
  const linked = new Set(tender.map((item) => item.linkedDiscoveryId).filter(Boolean));
  const result: BaselineDiff[] = tender.map((item) => {
    const baseline = discovery.find((candidate) => candidate.id === item.linkedDiscoveryId);
    if (!baseline) return { id: item.id, relation: "added", tender: item };
    if (item.conflictNote.trim()) return { id: item.id, relation: "conflict", discovery: baseline, tender: item };
    const before = baseline.normalizedText.trim().replace(/\s+/g, " ");
    const after = item.normalizedText.trim().replace(/\s+/g, " ");
    return { id: item.id, relation: before === after ? "unchanged" : "changed", discovery: baseline, tender: item };
  });
  for (const item of discovery) {
    if (!linked.has(item.id)) result.push({ id: `removed-${item.id}`, relation: "removed", discovery: item });
  }
  return result;
}

export function validateProject(project: ProjectManifest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!project.owner.trim()) issues.push({ id: "project-owner", severity: "warning", area: "project", message: "项目责任人尚未填写。" });
  if (!project.objective.trim()) issues.push({ id: "project-objective", severity: "warning", area: "project", message: "项目业务目标尚未填写。" });

  for (const requirement of project.requirements) {
    if (!requirement.sourceRef) {
      issues.push({ id: `${requirement.id}-source`, severity: "error", area: "requirement", targetId: requirement.id, message: `“${requirement.title}”缺少原文来源。` });
    }
    if (!requirement.owner.trim()) {
      issues.push({ id: `${requirement.id}-owner`, severity: "warning", area: "requirement", targetId: requirement.id, message: `“${requirement.title}”尚未指定责任人。` });
    }
    if (requirement.reviewState === "approved" && !requirement.formalResponse.trim()) {
      issues.push({ id: `${requirement.id}-response`, severity: "error", area: "requirement", targetId: requirement.id, message: `“${requirement.title}”已批准，但正式响应为空。` });
    }
    if (requirement.reviewState === "approved" && requirement.responseStatus === "missing_evidence") {
      issues.push({ id: `${requirement.id}-approval`, severity: "error", area: "requirement", targetId: requirement.id, message: `“${requirement.title}”缺少证据，不能批准为正式响应。` });
    }
    if (requirement.responseStatus === "confirmed" && requirement.evidenceRefs.length === 0) {
      issues.push({ id: `${requirement.id}-evidence`, severity: "error", area: "requirement", targetId: requirement.id, message: `“${requirement.title}”标记为已证实满足，但没有绑定证据。` });
    }
    if (requirement.responseStatus === "unsupported" && requirement.deviationType !== "negative") {
      issues.push({ id: `${requirement.id}-negative`, severity: "error", area: "requirement", targetId: requirement.id, message: `“${requirement.title}”不满足时必须记录为负偏离。` });
    }
    if ((requirement.responseStatus === "custom" || requirement.responseStatus === "conditional") && requirement.deviationType === "none") {
      issues.push({ id: `${requirement.id}-conditional`, severity: "warning", area: "requirement", targetId: requirement.id, message: `“${requirement.title}”存在条件或定制工作，不应直接标记无偏离。` });
    }
  }

  for (const evidence of project.evidence) {
    if (!evidence.verifiedAt) issues.push({ id: `${evidence.id}-verified`, severity: "warning", area: "evidence", targetId: evidence.id, message: `证据“${evidence.title}”缺少核验日期。` });
    if (evidence.expiresAt && new Date(evidence.expiresAt).getTime() < Date.now()) {
      issues.push({ id: `${evidence.id}-expired`, severity: "warning", area: "evidence", targetId: evidence.id, message: `证据“${evidence.title}”已超过复核日期。` });
    }
  }

  for (const action of project.actions) {
    if (action.status !== "done" && !action.owner.trim()) issues.push({ id: `${action.id}-owner`, severity: "warning", area: "action", targetId: action.id, message: `任务“${action.title}”没有责任人。` });
  }
  for (const section of project.sections) {
    if (section.reviewState === "approved" && section.requirementIds.length === 0) issues.push({ id: `${section.id}-requirement`, severity: "warning", area: "section", targetId: section.id, message: `章节“${section.title}”已批准，但没有关联招标要求。` });
    if (section.reviewState === "approved" && section.evidenceIds.length === 0) issues.push({ id: `${section.id}-evidence`, severity: "warning", area: "section", targetId: section.id, message: `章节“${section.title}”已批准，但没有关联证据。` });
  }
  return issues;
}

export function requirementCoverage(project: ProjectManifest) {
  const tender = project.requirements.filter((item) => item.baseline === "tender");
  const approved = tender.filter((item) => item.reviewState === "approved").length;
  const evidenced = tender.filter((item) => item.evidenceRefs.length > 0).length;
  return { total: tender.length, approved, evidenced, pending: tender.length - approved };
}

export function createRequirement(baseline: Baseline, patch: Partial<Requirement> = {}): Requirement {
  return {
    id: createId("req"),
    baseline,
    category: "technical",
    title: baseline === "tender" ? "待复核的招标要求" : "待确认的客户需求",
    originalText: "",
    normalizedText: "",
    mandatory: false,
    scored: false,
    scoreWeight: "",
    dueDate: "",
    sourceRef: null,
    owner: "",
    responseStatus: "missing_evidence",
    deviationType: "pending",
    formalResponse: "",
    evidenceRefs: [],
    reviewState: "draft",
    linkedDiscoveryId: "",
    conflictNote: "",
    acceptanceCriteria: "",
    notes: "",
    ...patch,
  };
}

export function createSampleProject(kind: "ai" | "robot" | "electromechanical" = "ai"): ProjectManifest {
  const project = createEmptyProject("zh");
  const samples = {
    ai: {
      id: "enterprise-ai-knowledge-assistant",
      name: "企业知识助手售前与技术投标",
      customerAlias: "某装备制造企业",
      industry: "企业 AI",
      objective: "在权限边界内检索当前技术资料，为一线人员提供带来源的回答，并将低置信度问题转交人工。",
      constraints: "客户资料不得进入公开服务；答案必须引用原文；系统不得自动对外发送内容。",
    },
    robot: {
      id: "robot-material-handling",
      name: "室内物料配送机器人方案",
      customerAlias: "某制造园区",
      industry: "具身智能机器人",
      objective: "完成物料接单、取放、配送和回执，并记录失败恢复及人工干预。",
      constraints: "人机混行；门禁接口待确认；现场风险评估由具备资质的责任方完成。",
    },
    electromechanical: {
      id: "electromechanical-security-system",
      name: "复杂机电安全系统技术方案",
      customerAlias: "某公共设施项目",
      industry: "复杂机电系统",
      objective: "完成现场设备、控制系统、第三方接口和验收边界的技术方案与交底。",
      constraints: "正式结构图由专业设计单位出具；第三方接口版本以书面确认为准。",
    },
  } as const;
  const sample = samples[kind];
  Object.assign(project, sample, { owner: "解决方案负责人", stage: "tender" as const, budget: "待商务确认", deadline: "2026-09-30", localPathHint: `D:\\Solutions\\${sample.id}` });

  const discovery = createRequirement("discovery", {
    id: `${sample.id}-discovery-1`,
    title: "关键业务流程需要形成可追溯记录",
    originalText: "沟通确认：关键任务的输入、处理结果、失败原因和人工处理过程需要留痕。",
    normalizedText: "关键任务输入、输出、失败和人工处理过程需要留痕。",
    owner: "客户业务负责人 / 解决方案",
    reviewState: "reviewed",
    sourceRef: { documentId: "meeting-notes", segmentId: "meeting-notes-line-1", locator: "沟通纪要 / 第 1 条", excerpt: "关键任务需要保留完整处理记录。" },
  });
  const tender = createRequirement("tender", {
    id: `${sample.id}-tender-1`,
    title: "系统运行日志保存不少于 180 天",
    originalText: "系统应记录关键操作、接口调用、异常和人工处理过程，日志保存时间不少于 180 天。",
    normalizedText: "记录关键操作、接口调用、异常和人工处理过程，日志保存不少于 180 天。",
    mandatory: true,
    scored: true,
    scoreWeight: "技术评分 4 分",
    owner: "产品 / 平台 / 解决方案",
    responseStatus: "conditional",
    deviationType: "pending",
    reviewState: "reviewed",
    linkedDiscoveryId: discovery.id,
    sourceRef: { documentId: "tender-v1", segmentId: "tender-v1-page-18", locator: "招标文件第 18 页 / 4.3.2", excerpt: "日志保存时间不少于 180 天。" },
    formalResponse: "可通过日志策略配置实现，具体存储容量需结合并发量和日志粒度确认。",
    acceptanceCriteria: "现场连续运行并抽查日志完整性、检索权限和 180 天保留策略。",
  });
  project.sources = [
    { id: "meeting-notes", name: "售前沟通纪要.md", fileType: "md", version: "1.0", size: 240, sha256: "sample-meeting-notes", importedAt: project.updatedAt, requiresOcr: false, segments: [{ id: "meeting-notes-line-1", locatorKind: "line", locator: "第 1 行", text: "关键任务需要保留完整处理记录。" }] },
    { id: "tender-v1", name: "招标文件-示例.pdf", fileType: "pdf", version: "1.0", size: 1024, sha256: "sample-tender-v1", importedAt: project.updatedAt, requiresOcr: false, segments: [{ id: "tender-v1-page-18", locatorKind: "page", locator: "第 18 页 / 4.3.2", text: tender.originalText }] },
  ];
  project.requirements = [discovery, tender];
  project.evidence = [{ id: "evidence-log-manual", title: "日志与审计功能手册", kind: "manual", fileName: "logging-manual.pdf", version: "3.2", verifiedAt: "2026-08-14", expiresAt: "2026-11-12", sourceRef: null, notes: "仅证明可配置留存策略，容量仍需核算。" }];
  project.actions = [
    { id: createId("action"), stage: "presales", title: "确认用户规模、并发量和日志粒度", owner: "客户 IT / 解决方案", dueDate: "2026-08-28", status: "working", sourceRequirementId: tender.id, notes: "用于计算存储容量。" },
    { id: createId("action"), stage: "delivery", title: "按中标版本完成技术交底", owner: "解决方案 / 项目经理", dueDate: "", status: "open", sourceRequirementId: tender.id, notes: "交付前冻结承诺基线。" },
  ];
  project.sections = [{ id: createId("section"), title: "日志、审计与权限控制", purpose: "说明日志范围、访问权限、容量估算和验收方法。", requirementIds: [tender.id], evidenceIds: [], body: tender.formalResponse, reviewState: "reviewed" }];
  project.pocPlan = { objective: "验证关键流程、失败处理和来源追溯。", demoScope: "使用脱敏样本完成主流程与两个失败场景。", acceptance: "所有结果可复核，失败进入人工处理。", failureAndFallback: "接口超时、资料缺失和权限不足时停止自动处理并记录原因。" };
  project.handoverNotes = "交底前核对最终投标文件、澄清函、合同技术附件和现场条件。";
  return project;
}
