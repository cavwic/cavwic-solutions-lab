import type { Locale, PresalesRound, ProjectManifest, SourceDocument } from "./workspace-schema";

export type ModelProvider = "local" | "cloud";

export type ModelSettings = {
  provider: ModelProvider;
  localEndpoint: string;
  localModel: string;
  cloudEndpoint: string;
  cloudModel: string;
};

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  provider: "local",
  localEndpoint: "http://127.0.0.1:11434/v1/chat/completions",
  localModel: "",
  cloudEndpoint: "",
  cloudModel: "",
};

function sourceText(source: SourceDocument): string {
  const text = source.segments.map((segment) => `[${segment.locator}] ${segment.text}`).join("\n");
  return `## ${source.name}\n${text.slice(0, 16000) || "(no extractable text)"}`;
}

export function buildPresalesPrompt(project: ProjectManifest, round: PresalesRound, locale: Locale = project.locale): string {
  const roundIndex = project.presalesRounds.findIndex((item) => item.id === round.id);
  const selectedIds = new Set([
    ...round.requirementSourceIds,
    ...round.referenceSourceIds,
  ]);
  const selectedSources = project.sources.filter((source) => selectedIds.has(source.id));
  const priorRounds = project.presalesRounds.slice(0, Math.max(0, roundIndex));
  const actions = round.actions.map((item) => `- [${item.status}] ${item.title} / ${item.owner || "unassigned"} / ${item.dueDate || "unscheduled"}`).join("\n");
  const history = priorRounds.map((item) => [
    `### ${item.title} ${item.meetingAt}`,
    item.customerNeeds || "(no recorded customer need)",
    item.actions.map((action) => `- ${action.title} [${action.status}]`).join("\n"),
    item.generatedFiles.map((file) => `- generated: ${file.name}`).join("\n"),
  ].filter(Boolean).join("\n")).join("\n\n");
  const references = selectedSources.map(sourceText).join("\n\n").slice(0, 60000);

  if (locale === "zh") return [
    "你是企业解决方案售前负责人。只根据以下项目边界、沟通记录和已选资料编制本轮客户响应文件。",
    "不得虚构产品参数、案例、承诺、价格、资质或交付能力。资料缺失时明确写“待确认”，并列出需要谁确认。",
    "输出可直接进入人工审阅的 Markdown 正文，不解释你的推理过程，不使用营销口号。",
    `# 项目与边界\n项目：${project.name}\n客户：${project.customerAlias || "待确认"}\n行业：${project.industry || "待确认"}\n责任人：${project.owner || "待确认"}\n预算：${project.budget || "待确认"}\n截止日期：${project.deadline || "待确认"}\n业务目标：${project.objective || "待确认"}\n约束：${project.constraints || "待确认"}`,
    `# 本轮沟通\n节点：${round.title}\n时间：${round.meetingAt || "待确认"}\n客户信息及需求：\n${round.customerNeeds || "待确认"}`,
    `# 本轮执行清单\n${actions || "暂无"}`,
    `# 之前轮次\n${history || "无"}`,
    `# 已选企业资料、客户附件与模板内容\n${references || "未选择资料"}`,
    `# 文件生成要求\n${round.generationInstructions || "整理本轮需求、响应方案、边界、待确认项和后续行动。"}`,
  ].join("\n\n");

  return [
    "You are the presales solution owner. Draft this round's customer response using only the project boundary, communication history, and selected sources below.",
    "Do not invent product parameters, references, commitments, prices, qualifications, or delivery capability. Mark missing facts as 'To confirm' and name the responsible party.",
    "Return review-ready Markdown only. Do not explain your reasoning or use promotional language.",
    `# Project boundary\nProject: ${project.name}\nCustomer: ${project.customerAlias || "To confirm"}\nIndustry: ${project.industry || "To confirm"}\nOwner: ${project.owner || "To confirm"}\nBudget: ${project.budget || "To confirm"}\nDeadline: ${project.deadline || "To confirm"}\nObjective: ${project.objective || "To confirm"}\nConstraints: ${project.constraints || "To confirm"}`,
    `# Current communication\nNode: ${round.title}\nTime: ${round.meetingAt || "To confirm"}\nCustomer information and needs:\n${round.customerNeeds || "To confirm"}`,
    `# Current action list\n${actions || "None"}`,
    `# Previous rounds\n${history || "None"}`,
    `# Selected company materials, customer attachments, and template content\n${references || "No sources selected"}`,
    `# Generation instructions\n${round.generationInstructions || "Summarize the need, proposed response, boundaries, open questions, and next actions."}`,
  ].join("\n\n");
}

export async function requestPresalesDraft(
  settings: ModelSettings,
  apiKey: string,
  prompt: string,
  fetcher: typeof fetch = fetch,
): Promise<{ content: string; model: string; provider: ModelProvider }> {
  const endpoint = settings.provider === "local" ? settings.localEndpoint : settings.cloudEndpoint;
  const model = settings.provider === "local" ? settings.localModel : settings.cloudModel;
  if (!endpoint.trim()) throw new Error("MODEL_ENDPOINT_REQUIRED");
  if (!model.trim()) throw new Error("MODEL_NAME_REQUIRED");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
  const response = await fetcher(endpoint.trim(), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model.trim(),
      messages: [
        { role: "system", content: "Produce factual, source-bounded presales documents for human review." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      stream: false,
    }),
  });
  if (!response.ok) throw new Error(`MODEL_REQUEST_FAILED_${response.status}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("MODEL_RESPONSE_EMPTY");
  return { content, model: model.trim(), provider: settings.provider };
}

export function safeGeneratedFileName(name: string, format: PresalesRound["outputFormat"]): string {
  const stem = name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 72) || "presales-response";
  return `${stem}.${format}`;
}

function markdownLines(markdown: string): Array<{ kind: "heading" | "body" | "bullet"; text: string; level: number }> {
  return markdown.split(/\r?\n/).map((line) => {
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) return { kind: "heading" as const, text: heading[2], level: heading[1].length };
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) return { kind: "bullet" as const, text: bullet[1], level: 1 };
    return { kind: "body" as const, text: line, level: 0 };
  });
}

async function markdownToDocx(markdown: string): Promise<Blob> {
  const { Document, HeadingLevel, Packer, Paragraph } = await import("docx");
  const headingLevels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];
  const children = markdownLines(markdown).map((line) => line.kind === "heading"
    ? new Paragraph({ text: line.text, heading: headingLevels[Math.min(line.level, 4) - 1] })
    : line.kind === "bullet"
      ? new Paragraph({ text: line.text, bullet: { level: 0 } })
      : new Paragraph(line.text));
  const document = new Document({
    styles: { default: { document: { run: { font: "Microsoft YaHei", size: 21 }, paragraph: { spacing: { after: 120 } } } } },
    sections: [{ children }],
  });
  return Packer.toBlob(document);
}

async function markdownToPptx(markdown: string, title: string): Promise<Blob> {
  const { default: Pptx } = await import("pptxgenjs");
  const pptx = new Pptx();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "CAVWIC Solutions Lab";
  pptx.title = title;
  pptx.theme = { headFontFace: "Microsoft YaHei", bodyFontFace: "Microsoft YaHei" };
  const sections: Array<{ title: string; body: string[] }> = [];
  for (const line of markdownLines(markdown)) {
    if (line.kind === "heading" && line.level <= 2) sections.push({ title: line.text, body: [] });
    else {
      if (!sections.length) sections.push({ title, body: [] });
      if (line.text) sections.at(-1)?.body.push(line.kind === "bullet" ? `• ${line.text}` : line.text);
    }
  }
  for (const section of sections.slice(0, 20)) {
    const slide = pptx.addSlide();
    slide.background = { color: "F4F6F2" };
    slide.addText(section.title, { x: 0.7, y: 0.6, w: 11.8, h: 0.7, fontSize: 26, bold: true, color: "17211F", margin: 0 });
    slide.addShape(pptx.ShapeType.line, { x: 0.7, y: 1.5, w: 11.8, h: 0, line: { color: "B9C2BE", width: 1 } });
    slide.addText(section.body.join("\n\n").slice(0, 5000) || " ", { x: 0.7, y: 1.9, w: 11.8, h: 4.7, fontSize: 15, color: "36423F", valign: "top", margin: 0.04, breakLine: false });
  }
  const buffer = await pptx.write({ outputType: "arraybuffer" });
  return new Blob([buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

export async function createGeneratedFile(markdown: string, name: string, format: PresalesRound["outputFormat"]): Promise<{ name: string; blob: Blob }> {
  const fileName = safeGeneratedFileName(name, format);
  if (format === "md") return { name: fileName, blob: new Blob([markdown], { type: "text/markdown;charset=utf-8" }) };
  if (format === "docx") return { name: fileName, blob: await markdownToDocx(markdown) };
  return { name: fileName, blob: await markdownToPptx(markdown, name) };
}
