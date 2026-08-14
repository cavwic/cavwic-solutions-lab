# PPTX template mapping

The renderer opens a standard `.pptx` and adds slides using its existing layouts and masters. Logos and design elements placed on the master normally remain. The renderer fills title and body placeholders; it does not reproduce arbitrary existing content slides.

Use this sequence:

```powershell
python scripts/render_pptx.py --inspect-template templates/company-template.pptx
python scripts/render_pptx.py --template templates/company-template.pptx --plan work/presentation-plan.json --map templates/template-map.json --output outputs/customer-presentation.pptx
```

`template-map.json` maps semantic roles to layout names and optional placeholder indexes. Use layout names reported by `--inspect-template`.

The renderer supports title, section, content, comparison, and closing roles. If a mapped layout or placeholder is absent, it falls back to available title/body placeholders and reports a warning.

Unsupported fidelity includes VBA macros, complex animations, linked OLE objects, custom add-ins, unsupported media, and fonts that are not installed on the rendering machine.
