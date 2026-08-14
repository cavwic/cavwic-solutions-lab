# CAVWIC Solutions Lab

A browser-based workspace for practical solution engineering. It covers presales discovery, tender requirement review, technical bid preparation, POC planning, and post-award technical handover.

The application is static. It does not contain a server upload path or an embedded model key. Users can work in browser storage, authorize a local folder in compatible Chromium browsers, or exchange a project ZIP.

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

Software is licensed under MIT. Skill instructions, references, examples, and reusable document templates are licensed under CC BY 4.0.
