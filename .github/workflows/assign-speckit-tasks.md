---
description: Hand unblocked Spec Kit task issues to Copilot cloud agent, with the right specialist custom agent
on:
  issues:
    types: [labeled, closed]
  workflow_dispatch:
  permissions:
    issues: read
  steps:
    - name: Find ready Spec Kit tasks
      id: ready
      uses: actions/github-script@v9
      env:
        MAX_PARALLEL: "2"
      with:
        script: |
          const max = Number(process.env.MAX_PARALLEL);
          const { eventName, payload } = context;
          let relevant = eventName === 'workflow_dispatch';
          if (eventName === 'issues') {
            const labels = (payload.issue.labels || []).map(l => l.name);
            if (payload.action === 'labeled') relevant = payload.label?.name === 'speckit';
            if (payload.action === 'closed') relevant = labels.includes('speckit');
          }
          if (!relevant) {
            core.info('Not a Spec Kit task event, nothing to do.');
            core.setOutput('ready', '');
            return;
          }
          const open = (await github.paginate(github.rest.issues.listForRepo, {
            ...context.repo, state: 'open', labels: 'speckit', per_page: 100,
          })).filter(i => !i.pull_request).sort((a, b) => a.number - b.number);
          const isCopilot = a => /copilot/i.test(a.login);
          const inProgress = open.filter(i => (i.assignees || []).some(isCopilot)).length;
          const slots = Math.max(0, max - inProgress);
          core.info(`Open tasks: ${open.length}, with Copilot: ${inProgress}, free slots: ${slots}`);
          const ready = [];
          for (const issue of open) {
            if (ready.length >= slots) break;
            if ((issue.assignees || []).length) continue;
            const { data: blockers } = await github.request(
              'GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by',
              { ...context.repo, issue_number: issue.number });
            const openBlockers = blockers.filter(b => b.state === 'open').map(b => `#${b.number}`);
            if (openBlockers.length) {
              core.info(`#${issue.number} blocked by ${openBlockers.join(', ')}`);
              continue;
            }
            ready.push(issue.number);
          }
          core.info(`Ready to assign: ${ready.map(n => `#${n}`).join(', ') || 'none'}`);
          core.setOutput('ready', ready.join(' '));
jobs:
  pre-activation:
    outputs:
      ready: ${{ steps.ready.outputs.ready }}
if: needs.pre_activation.outputs.ready != ''
concurrency:
  # Only events that can change what's ready share the queue; others (e.g. agent:* labels) get their own group
  # so they can't replace a pending scheduler run.
  group: ${{ (github.event_name == 'workflow_dispatch' || (github.event.action == 'labeled' && github.event.label.name == 'speckit') || (github.event.action == 'closed' && contains(github.event.issue.labels.*.name, 'speckit'))) && 'assign-speckit-tasks' || format('assign-speckit-tasks-ignored-{0}', github.run_id) }}
  cancel-in-progress: false
permissions:
  contents: read
  issues: read
runs-on: ubuntu-latest
engine: copilot
tools:
  github:
    toolsets: [issues, repos]
safe-outputs:
  add-labels:
    allowed:
      - agent:frontend-engineer
      - agent:backend-engineer
      - agent:design-assets
      - agent:tester
    target: "*"
    max: 2
  add-comment:
    target: "*"
    max: 2
  jobs:
    assign-specialist:
      description: "Assign one ready Spec Kit task issue to Copilot cloud agent using a specialist custom agent"
      runs-on: ubuntu-latest
      output: "Issue assigned to Copilot with the chosen specialist agent."
      max: 2
      permissions:
        contents: read
      inputs:
        issue_number:
          description: "Number of the ready task issue"
          required: true
          type: string
        agent:
          description: "Specialist custom agent: frontend-engineer, backend-engineer, design-assets or tester"
          required: true
          type: choice
          options: [frontend-engineer, backend-engineer, design-assets, tester]
      steps:
        - name: Assign Copilot with custom agent
          env:
            GH_TOKEN: ${{ secrets.GH_AW_AGENT_TOKEN }}
            REPO: ${{ github.repository }}
            MAX_PARALLEL: "2"
          run: |
            set -euo pipefail
            if [ -z "${GH_TOKEN}" ]; then echo "::error::GH_AW_AGENT_TOKEN secret is not set"; exit 1; fi
            ITEMS="$RUNNER_TEMP/assign-items.jsonl"
            jq -c '.items[] | select(.type == "assign_specialist")' "$GH_AW_AGENT_OUTPUT" > "$ITEMS"
            IN_PROGRESS=$(gh api "repos/$REPO/issues?state=open&labels=speckit&per_page=100" \
              --jq '[.[] | select(.pull_request == null) | select(any(.assignees[]?; .login | test("copilot"; "i")))] | length')
            while read -r ITEM; do
              N=$(jq -r '.issue_number | tostring' <<<"$ITEM")
              AGENT=$(jq -r '.agent' <<<"$ITEM")
              case "$AGENT" in
                frontend-engineer|backend-engineer|design-assets|tester) ;;
                *) echo "::warning::Skipping #$N: agent '$AGENT' is not allowed"; continue ;;
              esac
              if ! [[ "$N" =~ ^[0-9]+$ ]]; then echo "::warning::Skipping invalid issue number '$N'"; continue; fi
              if [ "$IN_PROGRESS" -ge "$MAX_PARALLEL" ]; then echo "Limit of $MAX_PARALLEL Copilot tasks reached, stopping."; break; fi
              OK=$(gh api "repos/$REPO/issues/$N" \
                --jq '.state == "open" and .pull_request == null and (.assignees | length == 0) and any(.labels[]; .name == "speckit")')
              if [ "$OK" != "true" ]; then echo "::warning::Skipping #$N: not an open, unassigned speckit task"; continue; fi
              OPEN_BLOCKERS=$(gh api "repos/$REPO/issues/$N/dependencies/blocked_by" --jq '[.[] | select(.state == "open")] | length')
              if [ "$OPEN_BLOCKERS" != "0" ]; then echo "::warning::Skipping #$N: still blocked"; continue; fi
              echo "Assigning #$N to Copilot with custom agent '$AGENT'"
              jq -n --arg repo "$REPO" --arg agent "$AGENT" \
                '{assignees: ["copilot-swe-agent[bot]"], agent_assignment: {target_repo: $repo, base_branch: "main", custom_agent: $agent}}' \
                | gh api --method POST "repos/$REPO/issues/$N/assignees" --input - --jq '.assignees[].login'
              IN_PROGRESS=$((IN_PROGRESS + 1))
            done < "$ITEMS"
---

# Assign ready Spec Kit tasks to a specialist

You hand Spec Kit task issues for this repository to the right specialist.
Planet Pizza: `backend/` = Express + SQLite API, `frontend/` = React + Vite web shop. The order is already decided: only work on the issues listed below. They are open,
unassigned and have no open blockers.

Ready issues in ${{ github.repository }}: ${{ needs.pre_activation.outputs.ready }}

## Steps

For **each** ready issue:

1. Read the issue title and body. The body points to `specs/<feature>/` — read the
   matching task in `tasks.md` and the `plan.md` if you need more context.
2. Pick the **one** specialist from `.github/agents/` that should do the work. Ignore the
   `speckit.*` agents.
   - `frontend-engineer`: UI, pages, components, API client code in `frontend/`.
   - `backend-engineer`: API routes, validation, database and business logic in `backend/`.
   - `design-assets`: styling, theme, layout polish, SVG images.
   - `tester`: verification-only tasks (run the build, run quickstart checks, review for leaks).
3. Add the label `agent:<specialist>` to that issue.
4. Call `assign_specialist` with the `issue_number` and the specialist name
   (for example `backend-engineer`). This starts Copilot cloud agent as that custom agent.
5. Add one short comment (1–2 sentences) to that issue: which specialist you picked and why.

Do not touch any other issue. Do not call `assign_specialist` for an issue that isn't in the
ready list.
