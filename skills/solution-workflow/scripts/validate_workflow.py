#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path


def load_project(workspace: Path) -> tuple[Path, dict]:
    manifest = json.loads((workspace / "workspace.json").read_text(encoding="utf-8"))
    project_path = workspace / "projects" / manifest["activeProjectId"] / "project.json"
    return project_path, json.loads(project_path.read_text(encoding="utf-8"))


def validate(project: dict) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    required = ["schemaVersion", "id", "name", "requirements", "evidence", "actions", "deliverables"]
    for key in required:
        if key not in project:
            errors.append(f"missing project field: {key}")
    evidence_ids = {item.get("id") for item in project.get("evidence", [])}
    for item in project.get("requirements", []):
        label = item.get("title") or item.get("id") or "unnamed requirement"
        if not item.get("sourceRef"):
            errors.append(f"requirement has no source: {label}")
        if item.get("reviewState") == "approved" and not item.get("formalResponse", "").strip():
            errors.append(f"approved requirement has no formal response: {label}")
        if item.get("reviewState") == "approved" and item.get("responseStatus") == "missing_evidence":
            errors.append(f"missing-evidence requirement cannot be approved: {label}")
        refs = item.get("evidenceRefs", [])
        unknown_refs = [ref for ref in refs if ref not in evidence_ids]
        if unknown_refs:
            errors.append(f"requirement references unknown evidence {unknown_refs}: {label}")
        if item.get("responseStatus") == "confirmed" and not refs:
            errors.append(f"confirmed requirement has no evidence: {label}")
        if item.get("responseStatus") == "unsupported" and item.get("deviationType") != "negative":
            errors.append(f"unsupported requirement is not a negative deviation: {label}")
        if not item.get("owner", "").strip():
            warnings.append(f"requirement has no owner: {label}")
    for action in project.get("actions", []):
        if action.get("status") != "done" and not action.get("owner", "").strip():
            warnings.append(f"open action has no owner: {action.get('title', action.get('id'))}")
    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("workspace", type=Path)
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()
    try:
        project_path, project = load_project(args.workspace.resolve())
        errors, warnings = validate(project)
    except Exception as exc:
        print(json.dumps({"ok": False, "errors": [str(exc)], "warnings": []}, ensure_ascii=False, indent=2))
        return 1
    result = {"ok": not errors and (not args.strict or not warnings), "project": str(project_path), "errors": errors, "warnings": warnings}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
