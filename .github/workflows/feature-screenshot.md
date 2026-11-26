---
description: When every task of a Spec Kit feature is done, run the app and post a screenshot on the feature issue
on:
  issues:
    types: [closed]
  workflow_dispatch:
    inputs:
      parent:
        description: "Feature (parent) issue number"
        required: true
        type: string
  permissions:
    issues: read
  steps:
    - name: Find a finished Spec Kit feature
      id: feature
      uses: actions/github-script@v9
      with:
        script: |
          const { eventName, payload } = context;
          core.setOutput('parent', '');
          let parent;
          if (eventName === 'workflow_dispatch') {
            parent = Number(payload.inputs.parent);
          } else {
            const labels = (payload.issue.labels || []).map(l => l.name);
            if (!labels.includes('speckit')) { core.info('Not a Spec Kit task.'); return; }
            try {
              const { data } = await github.request('GET /repos/{owner}/{repo}/issues/{issue_number}/parent',
                { ...context.repo, issue_number: payload.issue.number });
              parent = data.number;
            } catch (e) { core.info(`#${payload.issue.number} has no parent issue.`); return; }
          }
          const { data: feature } = await github.rest.issues.get({ ...context.repo, issue_number: parent });
          if (feature.state !== 'open') { core.info(`#${parent} is already closed.`); return; }
          const subs = await github.paginate('GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues',
            { ...context.repo, issue_number: parent, per_page: 100 });
          const open = subs.filter(s => s.state === 'open').map(s => `#${s.number}`);
          if (!subs.length || open.length) { core.info(`#${parent} still has open tasks: ${open.join(', ') || 'none linked'}`); return; }
          core.info(`All ${subs.length} tasks of #${parent} are done.`);
          core.setOutput('parent', String(parent));
jobs:
  pre-activation:
    outputs:
      parent: ${{ steps.feature.outputs.parent }}
if: needs.pre_activation.outputs.parent != ''
concurrency:
  group: feature-screenshot
  cancel-in-progress: false
permissions:
  contents: read
  issues: read
runs-on: ubuntu-latest
engine: copilot
steps:
  - uses: actions/setup-node@v5
    with:
      node-version: "22"
  - name: Install dependencies
    run: npm run install:all
tools:
  playwright:
  bash: [":*"]
  github:
    toolsets: [issues]
network:
  allowed:
    - defaults
    - playwright
safe-outputs:
  upload-asset:
    max: 1
  add-comment:
    target: "*"
    max: 1
  close-issue:
    target: "*"
    max: 1
---

# Show the finished feature

All task issues of Spec Kit feature #${{ needs.pre_activation.outputs.parent }} in
${{ github.repository }} are closed, and their pull requests are merged into `main`.
Dependencies are already installed from `main`.
Do not install anything.

1. Read issue #${{ needs.pre_activation.outputs.parent }}. It links to `specs/<feature>/`. Read
   `spec.md` in this checkout to learn what the feature should show, and which page it is on.
2. Start the app in this sandbox and wait until it answers:

   ```bash
   nohup npm --prefix backend run dev > /tmp/gh-aw/agent/backend.log 2>&1 &
   nohup npm --prefix frontend run dev -- --host 127.0.0.1 > /tmp/gh-aw/agent/frontend.log 2>&1 &
   for i in $(seq 1 60); do curl -sf http://127.0.0.1:5173/ >/dev/null && curl -sf http://127.0.0.1:3001/api/products >/dev/null && break; sleep 2; done
   ```

   If it does not come up, read both logs and report the error.
3. Open the page and take one desktop screenshot:

   ```bash
   playwright-cli open "http://127.0.0.1:5173/"
   playwright-cli resize 1440 900
   playwright-cli screenshot --filename /tmp/gh-aw/agent/feature.png
   ```

   Use `playwright-cli snapshot` to check that the new UI from the spec is really on the page.
   If it is below the fold, scroll it into view or use `--full-page`.
4. Call `upload_asset` with `/tmp/gh-aw/agent/feature.png`. It returns the image URL.
5. Call `add_comment` with `item_number` ${{ needs.pre_activation.outputs.parent }}. Keep it short:
   - Heading: `🛸 Feature delivered`
   - The screenshot as a Markdown image: `![<feature name>](<url>)`
   - One line per acceptance scenario from `spec.md`: ✅ if you saw it, ❌ if not.
   - One line listing the closed task issues.
6. If every scenario is ✅, call `close_issue` for #${{ needs.pre_activation.outputs.parent }}
   with a one-line comment. If anything is ❌, leave it open and say what is missing.
