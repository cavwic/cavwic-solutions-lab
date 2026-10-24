# Presales Solution Platform / 售前解决方案平台

A browser-based workspace for practical solution engineering. It covers presales discovery, tender requirement review, technical bid preparation, POC planning, and post-award technical handover.

The application is static. It does not contain a server upload path or an embedded model key. Users can work in browser storage, authorize a local folder in compatible Chromium browsers, or exchange a project ZIP.

This web edition follows the desktop V1.6.0 interface: blue-gray light/dark themes, a two-row header, inline model controls, project actions below the title, shared Skills and a sticky workspace header. It defaults to Simplified Chinese and follows the system theme until a preference is saved.

网页版采用桌面稳定版 V1.6.0 的布局和蓝灰色主题，中英文同步，模型设置直接在当前工作区展开。原有浏览器项目与目录授权保持兼容。

## Browser and desktop capabilities

- Local models: running Ollama, LM Studio and OpenAI-compatible services. Browser CORS/local-network permissions still apply; the web app does not bypass them.
- API and authorized plan endpoints: use your own provider-approved endpoint/key. The app sends selected material directly to that endpoint, not to a CAVWIC server. Web memberships and account cookies are not API access.
- Keys are used in the browser. Use a trusted device and endpoint, scoped keys and provider spending limits. Cloud keys stay in tab-session storage; local/plan keys are in page memory and must be re-entered after reload. Keys are not exported with projects.
- Native Codex sign-in, desktop runtime cache cleanup and the system Recycle Bin require the [desktop app](https://github.com/cavwic/presales-solution-tool/releases/latest). The web edition does not access desktop account credentials or launch local processes.
- Browser Skills are stored in IndexedDB for this origin. Upload one `SKILL.md` or a single-Skill ZIP, or install from a public GitHub Skill URL. Review imported content before enabling it. Scripts are inert; enabled guidance/reference context is bounded to 32,000 characters. GitHub rate limits and CORS can affect online installation.
- Browser cleanup removes eligible generated records only. Original project files and downloaded copies are preserved; there is no permanent-delete fallback.

本地模型和授权接口需允许本站跨域访问。网页版不能读取本机 Codex 账号，也不能使用系统回收站；文件清理仅处理本机生成记录，不删除项目原文件。Skills 保存在当前站点的浏览器存储中，导入后默认关闭，审阅后可启用，不执行附带脚本。

## Workbenches

- Solution project workflow: project boundary, presales pack, POC, actions, commitments, and handover.
- Tender requirement extraction and review: source segments, requirement rows, discovery/tender comparison, mandatory and scoring markers.
- Technical bid package: evidence register, response and deviation matrix, technical sections, package register, and formal exports.

The internal response states are confirmed, conditional, customization required, evidence missing, and unsupported. The application does not convert an unknown or evidence gap into a compliant response.

## Files and exports

Input parsing supports text-based PDF, DOCX, XLSX, PPTX, Markdown, TXT, and CSV. Image-only PDFs are flagged for OCR rather than guessed.

Projects can export Markdown, UTF-8 CSV, DOCX, XLSX, PPTX, and ZIP. Original source files are excluded from a ZIP unless the user selects the source option.

## Agent Skills

The repository adds three primary Skills:

- `solution-workflow`
- `tender-requirement-extraction`
- `technical-bid-package`

Versioned ZIP files and SHA-256 hashes are generated under `public/downloads/skills/`. Existing research and review Skills remain available under `skills/`.

## Development

```sh
npm ci
npm run dev
npm run verify
```

The stack is Astro, React, TypeScript, Zod, Vitest, Playwright, Lucide, PDF.js, Mammoth, ExcelJS, docx, PptxGenJS, and JSZip.

`npm run check`, `npm run test` and `npm run build` can be run independently. `verify` additionally launches the optional Playwright browser suite; interactive browser acceptance should use an isolated test origin so existing user projects are not cleared.

Software is licensed under MIT. Skill instructions, references, examples, and reusable document templates are licensed under CC BY 4.0.
