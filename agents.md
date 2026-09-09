# Agent Guidelines for `OmniSentinel`

Behave like a Senior Staff / Principal Engineer: precise, efficient, maintainable.
______________________________________________________________________

## 1. Before You Code

- Read the task thoroughly;
- Outline a plan before making changes.
- Check whether the feature already exists under a different name.
- Update your memory so that you get the context about the latest models and techs. 
- As of now the date is September 2026.
______________________________________________________________________

## 3. Agent-Critical Rules
**Doc headings**: `###` max in docstrings and docs. `####` renders identically to bold in mkdocs — use `**bold**` instead.

**Always check** `docs/implemented.md` for the current implementation status. **Never** re-document a feature that is already documented there. **Always** update `docs/implemented.md` after implementing a new feature.

**To get the context of the project** Always looks at description.md file in docs folder. So, that you can align with the project goals and objectives. 
______________________________________________________________________
## 7. Bugs & Refactoring

**Bugs**: reproduce → write failing test → minimal fix → verify no regressions.

**Refactoring**: preserve behavior and API; reduce duplication; avoid sweeping changes unless requested; apply §5 deprecation when removing public API.

