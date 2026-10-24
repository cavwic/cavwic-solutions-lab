import type { Locale } from "./workspace-schema";

const messages: Record<string, [string, string]> = {
  STORAGE_QUOTA: ["浏览器存储空间不足，请释放本站存储空间或使用桌面版。", "Browser storage is full. Free up space for this site or use the desktop app."],
  STORAGE_UNAVAILABLE: ["浏览器存储不可用，请允许本站存储后重试。", "Browser storage is unavailable. Allow storage for this site and retry."],
  STORAGE_FAILED: ["无法读取或保存 Skills，请刷新页面重试。", "Skills could not be read or saved. Reload the page and retry."],
  STORAGE_CAPACITY: ["已达到 64 个 Skills 的存储上限，原内容未被覆盖。", "The 64-Skill storage limit was reached. Existing content was preserved."],
  CONTENT_CHANGED: ["内容已改变或无法校验，已停止操作，请刷新列表检查。", "Content changed or could not be verified. Refresh the list and review it before retrying."],
  ALREADY_EXISTS: ["已存在同名 Skill，原内容未被覆盖。", "A Skill with this name already exists. Its content was not overwritten."],
  DUPLICATE_SKILL: ["已存在同名 Skill，原内容未被覆盖。", "A Skill with this name already exists. Its content was not overwritten."],
  LIMIT_EXCEEDED: ["文件数量或大小超出安全限制，请使用更小的单个 Skill。", "The Skill exceeds a file count or size limit. Use a smaller, single-Skill package."],
  INVALID_ARCHIVE: ["压缩包无效或不安全，请使用仅含一个 Skill 的 ZIP。", "The archive is invalid or unsafe. Use a ZIP containing one Skill."],
  INVALID_PATH: ["文件路径无效或不安全，未导入任何内容。", "A file path is invalid or unsafe. Nothing was imported."],
  INVALID_FRONTMATTER: ["SKILL.md 元数据格式无效，请检查名称和说明。", "SKILL.md metadata is invalid. Check its name and description."],
  INVALID_SKILL: ["未找到有效的 SKILL.md，请检查文件内容。", "No valid SKILL.md was found. Check the file contents."],
  INVALID_UTF8: ["文本编码不支持，请使用 UTF-8。", "The text encoding is unsupported. Use UTF-8."],
  INVALID_URL: ["地址不支持，请使用公开 GitHub 的 Skill 目录、文件或 ZIP 地址。", "Use a public GitHub Skill folder, file or ZIP URL."],
  NETWORK_BLOCKED: ["下载地址不在允许范围内，已停止请求。", "The download URL is not allowed. The request was stopped."],
  DOWNLOAD_TIMEOUT: ["下载超时，请检查网络后重试。", "The download timed out. Check your connection and retry."],
  DOWNLOAD_FAILED: ["下载失败，请检查公开访问权限、地址或网络。", "The download failed. Check the public URL, access and connection."],
  CRYPTO_UNAVAILABLE: ["浏览器无法校验文件，请通过 HTTPS 或本机地址访问。", "File verification is unavailable. Open this app over HTTPS or localhost."],
  NOT_FOUND: ["此 Skill 已不存在，请刷新列表。", "This Skill no longer exists. Refresh the list."],
};

export function skillErrorMessage(error: unknown, locale: Locale, fallback: string): string {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : error instanceof Error ? error.message : "";
  return messages[code]?.[locale === "zh" ? 0 : 1] || fallback;
}
