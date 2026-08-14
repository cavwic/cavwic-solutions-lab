# Workspace contract

```text
solution-workspace/
  workspace.json
  library/
    library.json
    approved company materials
  projects/<project-id>/
    project.json
    sources/
    work/
      requirements.csv
      solution-draft.md
      presentation.md
    templates/
    outputs/
```

`workspace.json` identifies the active project. `project.json` is the canonical structured record. Working documents may be regenerated from it, but reviewed identifiers and source links must survive.

Each requirement contains at least: identifier, baseline, category, original wording, normalized wording, source reference, mandatory/scored flags, owner, response status, deviation type, formal response, evidence identifiers, review state, acceptance criteria, and notes.

Allowed response status values:

- `confirmed`: current evidence establishes the response.
- `conditional`: the response depends on an explicit condition or configuration.
- `custom`: development, integration, or non-standard work is required.
- `missing_evidence`: evidence is absent or stale.
- `unsupported`: the available solution cannot meet the requirement.

Only human review may set `reviewState` to `approved`. `confirmed` requires at least one evidence reference. `unsupported` requires a negative deviation. Conditional or custom responses must not be silently represented as no deviation.
