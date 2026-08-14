# CAVWIC Solutions Lab

Browser-local presales workbenches for enterprise AI POCs, robot scenario qualification, and dexterous-hand selection and validation.

## Live tools

- [Enterprise AI Solution & POC Workbench](https://cavwic.github.io/cavwic-solutions-lab/ai-poc)
- [Robot Scenario Qualification & POC Studio](https://cavwic.github.io/cavwic-solutions-lab/robot-poc)
- [Dexterous Hand Selection & Grasp Test Designer](https://cavwic.github.io/cavwic-solutions-lab/dexterous-hand)

Inputs stay in the current browser. The tools use transparent scoring formulas and are decision aids, not industry standards.

## Agent Skills

The `skills/` directory contains five reusable skills with instructions, templates, examples, validation scripts, and operating boundaries.

## Development

```sh
npm ci
npm run dev
npm run verify
```

The site is built with Astro, React, TypeScript, Zod, Vitest, Playwright, and Lucide.
