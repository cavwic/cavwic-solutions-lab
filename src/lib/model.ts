import { z } from "zod";

export type Locale = "zh" | "en";
export type ToolKind = "ai" | "robot" | "hand";

export const criterionSchema = z.object({
  id: z.string(),
  score: z.number().min(0).max(100),
  weight: z.number().min(0).max(100),
  unknown: z.boolean(),
  note: z.string(),
});

export const toolStateSchema = z.object({
  version: z.literal(1),
  kind: z.enum(["ai", "robot", "hand"]),
  project: z.string(),
  owner: z.string(),
  objective: z.string(),
  constraints: z.string(),
  criteria: z.array(criterionSchema),
  risks: z.array(z.string()),
  acceptance: z.array(z.object({ metric: z.string(), target: z.string(), evidence: z.string() })),
  notes: z.string(),
  updatedAt: z.string(),
});

export type ToolState = z.infer<typeof toolStateSchema>;

export type ToolConfig = {
  kind: ToolKind;
  slug: string;
  code: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  criteria: Array<{ id: string; label: Record<Locale, string>; hint: Record<Locale, string>; weight: number }>;
  defaultRisks: Record<Locale, string[]>;
  sample: Omit<ToolState, "updatedAt">;
};

const now = () => new Date().toISOString();

export const toolConfigs: Record<ToolKind, ToolConfig> = {
  ai: {
    kind: "ai",
    slug: "/ai-poc",
    code: "AI-POC",
    title: { zh: "企业 AI 方案与 POC 工作台", en: "Enterprise AI Solution & POC Workbench" },
    description: { zh: "把业务任务、数据、权限、RAG/Agent、接口、评测、成本和接管条件放进同一份资格记录。", en: "Qualify business tasks, data, access, RAG/agents, integrations, evaluation, cost, and takeover conditions in one record." },
    criteria: [
      { id: "business", label: { zh: "业务任务清晰度", en: "Business task clarity" }, hint: { zh: "对象、触发、动作、输出和价值", en: "Object, trigger, action, output, and value" }, weight: 20 },
      { id: "data", label: { zh: "数据与权限准备度", en: "Data and access readiness" }, hint: { zh: "来源、版本、质量、角色与驻留", en: "Sources, versions, quality, roles, residency" }, weight: 22 },
      { id: "architecture", label: { zh: "架构与接口可行性", en: "Architecture and integration" }, hint: { zh: "RAG/Agent、API、身份、日志和部署", en: "RAG/agent, APIs, identity, logs, deployment" }, weight: 20 },
      { id: "evaluation", label: { zh: "评测与验收准备度", en: "Evaluation and acceptance" }, hint: { zh: "样本、指标、基线、复测和退出条件", en: "Samples, metrics, baseline, reruns, exit rules" }, weight: 23 },
      { id: "operations", label: { zh: "风险与运营准备度", en: "Risk and operations" }, hint: { zh: "防护、成本、人工接管、回滚和所有者", en: "Guardrails, cost, takeover, rollback, ownership" }, weight: 15 },
    ],
    defaultRisks: {
      zh: ["知识权限无法映射现有组织", "黄金测试集缺少失败样本", "工具写入缺少审批与补偿", "模型或接口成本没有按任务估算"],
      en: ["Knowledge access cannot map to current roles", "Golden set lacks failure cases", "Write actions lack approval and compensation", "Model and integration costs are not estimated per task"],
    },
    sample: { version: 1, kind: "ai", project: "内部技术知识助手", owner: "售前 / 客户 IT / 业务负责人", objective: "让授权员工基于当前技术文档获得可引用答案，并把低置信度问题转人工。", constraints: "私有部署；角色权限隔离；答案必须引用；不允许自动对外发送。", criteria: [
      { id: "business", score: 82, weight: 20, unknown: false, note: "任务和用户角色已定义。" },
      { id: "data", score: 58, weight: 22, unknown: false, note: "文档可用，但版本与权限映射仍需整理。" },
      { id: "architecture", score: 70, weight: 20, unknown: false, note: "只读接口明确，身份集成待询证。" },
      { id: "evaluation", score: 64, weight: 23, unknown: false, note: "已设计测试集，缺少业务方确认的基线。" },
      { id: "operations", score: 46, weight: 15, unknown: true, note: "峰值并发与人工队列容量未确认。" },
    ], risks: ["知识权限无法映射现有组织", "黄金测试集缺少失败样本"], acceptance: [
      { metric: "关键事实准确率", target: ">= 90%", evidence: "业务方确认的 100 条黄金样本" },
      { metric: "引用覆盖率", target: ">= 95%", evidence: "关键断言到文档段落的映射" },
      { metric: "越权测试", target: "0 次泄露", evidence: "跨角色与提示注入测试记录" },
    ], notes: "决策辅助，不是行业标准。" },
  },
  robot: {
    kind: "robot", slug: "/robot-poc", code: "ROBOT-POC",
    title: { zh: "机器人场景资格与 POC Studio", en: "Robot Scenario Qualification & POC Studio" },
    description: { zh: "用现场条件、任务状态机、安全、失败恢复、系统依赖和服务能力判断场景是否值得进场。", en: "Use site conditions, task states, safety, recovery, dependencies, and service readiness to qualify a robot POC." },
    criteria: [
      { id: "scene", label: { zh: "现场与对象标准化", en: "Site and object readiness" }, hint: { zh: "地面、空间、人流、对象和节拍", en: "Floor, space, people, objects, takt" }, weight: 22 },
      { id: "task", label: { zh: "任务状态与失败定义", en: "Task and failure definition" }, hint: { zh: "状态、超时、重试、接管和恢复", en: "States, timeout, retry, takeover, recovery" }, weight: 23 },
      { id: "safety", label: { zh: "安全边界", en: "Safety boundary" }, hint: { zh: "危险源、停止、权限与现场责任", en: "Hazards, stops, permissions, ownership" }, weight: 22 },
      { id: "integration", label: { zh: "系统与资源依赖", en: "Systems and dependencies" }, hint: { zh: "网络、地图、接口、电力和上游", en: "Network, map, APIs, power, upstream" }, weight: 18 },
      { id: "service", label: { zh: "服务与验收准备度", en: "Service and acceptance" }, hint: { zh: "连续运行、备件、培训和签字", en: "Continuous run, spares, training, sign-off" }, weight: 15 },
    ],
    defaultRisks: { zh: ["场地版本在 POC 期间变化", "失败脚本未进入演示", "安全责任人与恢复权限未确认", "上游接口超时没有降级路径"], en: ["Site changes during POC", "Failure script is absent", "Safety ownership is unclear", "Upstream timeout has no fallback"] },
    sample: { version: 1, kind: "robot", project: "室内物料配送与取放", owner: "客户现场 / 集成 / 本体厂商", objective: "在限定楼层完成物料接单、取放、配送与回执，并记录所有人工干预。", constraints: "人机混行；需对接门禁；目标物重量与姿态存在变化。", criteria: [
      { id: "scene", score: 62, weight: 22, unknown: false, note: "路线可测量，对象姿态波动仍需统计。" },
      { id: "task", score: 72, weight: 23, unknown: false, note: "状态机和主要失败分支已定义。" },
      { id: "safety", score: 48, weight: 22, unknown: true, note: "现场风险评估和恢复权限未完成。" },
      { id: "integration", score: 55, weight: 18, unknown: false, note: "门禁接口有文档，测试环境未开放。" },
      { id: "service", score: 44, weight: 15, unknown: true, note: "备件和现场响应时限待厂商确认。" },
    ], risks: ["安全责任人与恢复权限未确认", "上游接口超时没有降级路径"], acceptance: [
      { metric: "任务完成率", target: ">= 95%", evidence: "100 次运行的状态机日志" },
      { metric: "人工干预", target: "<= 5 次", evidence: "干预原因、时间和恢复记录" },
      { metric: "保护停止", target: "100% 可追踪", evidence: "触发、停止和恢复权限日志" },
    ], notes: "需要合格人员完成现场风险评估。" },
  },
  hand: {
    kind: "hand", slug: "/dexterous-hand", code: "HAND-SELECT",
    title: { zh: "灵巧手选型与抓取测试设计器", en: "Dexterous Hand Selection & Grasp Test Designer" },
    description: { zh: "按任务对象筛选候选，透明显示权重、未知字段惩罚与敏感性范围，并生成抓取验证记录。", en: "Screen candidates by task objects with transparent weights, unknown-field penalties, sensitivity ranges, and grasp evidence." },
    criteria: [
      { id: "mechanism", label: { zh: "机构与驱动适配", en: "Mechanism and actuation" }, hint: { zh: "主动/耦合自由度、传动、回差和顺应", en: "Actuated/coupled DoF, drive, backlash, compliance" }, weight: 18 },
      { id: "tactile", label: { zh: "触觉可用性", en: "Tactile usability" }, hint: { zh: "覆盖、量程、采样、漂移、标定与数据", en: "Coverage, range, sample rate, drift, calibration" }, weight: 22 },
      { id: "control", label: { zh: "控制与接口", en: "Control and interface" }, hint: { zh: "协议、频率、反馈、时间同步和错误码", en: "Protocol, rate, feedback, time sync, errors" }, weight: 20 },
      { id: "task", label: { zh: "对象与抓取适配", en: "Object and grasp fit" }, hint: { zh: "对象集、接触、负载口径和成功记录", en: "Object set, contact, load definition, results" }, weight: 25 },
      { id: "durability", label: { zh: "耐久与维护", en: "Durability and service" }, hint: { zh: "温升、寿命、线缆、耗材和备件", en: "Thermal, life, cables, wear, spares" }, weight: 15 },
    ],
    defaultRisks: { zh: ["自由度与独立驱动数混用", "负载口径和测试姿态不一致", "未知触觉字段被默认补齐", "连续运行温升与寿命没有数据"], en: ["DoF and actuated DoF are conflated", "Load conditions are inconsistent", "Unknown tactile fields are imputed", "Thermal and cycle-life data are missing"] },
    sample: { version: 1, kind: "hand", project: "多形态日用品抓取候选 A", owner: "末端选型 / 控制 / 测试", objective: "完成瓶、盒、软袋、薄片和易碎对象的取放与短距离手内调整。", constraints: "机械臂接口已定；需原始触觉数据；连续运行两小时；对象不可损伤。", criteria: [
      { id: "mechanism", score: 74, weight: 18, unknown: false, note: "机构公开，耦合关系仍需图纸确认。" },
      { id: "tactile", score: 60, weight: 22, unknown: true, note: "覆盖可见，漂移和标定数据未公开。" },
      { id: "control", score: 68, weight: 20, unknown: false, note: "协议公开，闭环频率需样机实测。" },
      { id: "task", score: 76, weight: 25, unknown: false, note: "对象集和接触策略已定义。" },
      { id: "durability", score: 42, weight: 15, unknown: true, note: "温升、寿命和备件周期待询证。" },
    ], risks: ["未知触觉字段被默认补齐", "连续运行温升与寿命没有数据"], acceptance: [
      { metric: "对象级成功率", target: ">= 90%", evidence: "每类对象 30 次完整抓取记录" },
      { metric: "损伤率", target: "0", evidence: "对象外观与功能检查" },
      { metric: "热稳定", target: "2 小时无非计划降额", evidence: "温度、力和错误日志" },
    ], notes: "未使用真实样机前，不形成采购推荐。" },
  },
};

export function createInitialState(kind: ToolKind): ToolState {
  const config = toolConfigs[kind];
  return {
    version: 1,
    kind,
    project: "",
    owner: "",
    objective: "",
    constraints: "",
    criteria: config.criteria.map((item) => ({ id: item.id, score: 50, weight: item.weight, unknown: true, note: "" })),
    risks: [],
    acceptance: [{ metric: "", target: "", evidence: "" }],
    notes: "",
    updatedAt: now(),
  };
}

export function sampleState(kind: ToolKind): ToolState {
  return { ...structuredClone(toolConfigs[kind].sample), updatedAt: now() };
}
