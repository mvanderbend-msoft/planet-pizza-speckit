---
description: Convert existing tasks into actionable, dependency-ordered GitHub issues for the feature based on available design artifacts.
tools: ['execute', 'read', 'search', 'github/*']
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks (before tasks-to-issues conversion)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_taskstoissues` key
- If the YAML cannot be parsed or is invalid, skip hook checking silently and continue normally
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
  - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
  - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- For each executable hook, output the following based on its `optional` flag:
  - **Optional hook** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Pre-Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **Mandatory hook** (`optional: false`):
    ```
    ## Extension Hooks

    **Automatic Pre-Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}

    Wait for the result of the hook command before proceeding to the Outline.
    ```
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Outline

1. Run `.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").
1. From the executed script, extract the path to **tasks**.
1. Get the Git remote by running:

```bash
git config --get remote.origin.url
```

> [!CAUTION]
> ONLY PROCEED TO NEXT STEPS IF THE REMOTE IS A GITHUB URL

1. Create the issues **in dependency order** so the `assign-speckit-tasks` workflow can hand
   unblocked tasks to Copilot cloud agent. Use the `gh` CLI (`gh issue`, `gh api`) against the
   repository of the Git remote (`OWNER/REPO`). Follow these steps exactly:

   a. **Parse tasks.md.** Collect every task line `- [ ] Txxx [P?] [USx?] Description`.
      Skip tasks that are already checked (`- [X]`). Note each task's phase heading.

   b. **Work out blockers** for each task (only between tasks you are creating):
      - Explicit rules in the "Dependencies & Execution Order" section win
        (for example "T005 depends on T003 and T004", "T016 → T017", "has no dependencies").
      - Otherwise, a task is blocked by the tasks of the phase(s) its phase depends on.
      - Inside a phase, a task without `[P]` is blocked by the previous task in the same
        phase/story when they touch the same file.
      - Keep the list minimal: if A is blocked by B and B is blocked by C, don't also add C to A.

   c. **Ensure labels exist** (ignore "already exists" errors):
      `gh label create speckit --color 7057ff --description "Spec Kit task, picked up by the assign-speckit-tasks workflow"`
      `gh label create speckit-feature --color 0e8a16 --description "Spec Kit feature parent issue"`

   d. **Create the parent issue** with label `speckit-feature`, title `<feature-dir-name>: <spec title>`,
      and a body that links to `spec.md`, `plan.md` and `tasks.md` on the default branch.

   e. **Create one issue per task, without labels**, in task order. Title: `Txxx: <short summary>`.
      Body: the full task text, the phase/user story, `Feature: specs/<feature-dir>/`, and
      "Read `spec.md`, `plan.md` and `tasks.md` in that folder before you start. Only do this task."
      Record each issue's **number** and **id** (`gh api repos/OWNER/REPO/issues/N --jq .id`).

   f. **Add each task as a sub-issue** of the parent:
      `gh api -X POST repos/OWNER/REPO/issues/PARENT/sub_issues -F sub_issue_id=<task issue id>`

   g. **Add the blockers** from step b as native GitHub issue dependencies:
      `gh api -X POST repos/OWNER/REPO/issues/<blocked number>/dependencies/blocked_by -F issue_id=<blocker issue id>`

   h. **Only now add the `speckit` label** to every task issue, in task order
      (`gh issue edit N --add-label speckit`). This is what triggers the workflow, so it must
      happen after all blockers exist.

   i. Report a table: task ID, issue number, blocked by (issue numbers), and which tasks are
      ready to start now.

> [!CAUTION]
> UNDER NO CIRCUMSTANCES EVER CREATE ISSUES IN REPOSITORIES THAT DO NOT MATCH THE REMOTE URL

## Post-Execution Checks

**Check for extension hooks (after tasks-to-issues conversion)**:
Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.after_taskstoissues` key
- If the YAML cannot be parsed or is invalid, skip hook checking silently and continue normally
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
  - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
  - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- For each executable hook, output the following based on its `optional` flag:
  - **Optional hook** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **Mandatory hook** (`optional: false`):
    ```
    ## Extension Hooks

    **Automatic Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently
