# Lux Veritas Node X / Node Z Collaboration

Status date: 2026-07-16

GitHub repository: `LuxVeritasMedia/luxveritas.media`

Shared Drive workspace: `LuxVeritas Website Collaboration - Node X + Node Z`, shared directly with approved collaborators. Its private URL is intentionally not committed to this public repository.

## One Source Of Truth Per Material Type

| Material | Canonical home | Rule |
| --- | --- | --- |
| Website code and generated routes | GitHub | Never edit or exchange the working repository through Drive |
| Tasks and progress | GitHub issues and draft pull requests | Open a draft PR early so work is visible before it is finished |
| Code review and QA evidence | GitHub pull request | Keep comments, screenshots, checks, and approval tied to the change |
| Approved Figma frames | Figma | Link the exact frame from the PR; do not use Figma as a second code source |
| Approved media and large source assets | Google Drive | Store source media in Drive; publish only reviewed exports or approved URLs |
| Private handoffs and internal material | Google Drive | Never commit secrets or private strategy to the public repository |
| Public release evidence | GitHub plus Drive archive | GitHub proves the commit and CI; Drive may retain approved screenshots and receipts |

## Identity Rule

Node X and Node Z should work in the same GitHub organization and shared Drive, but not through the same user login.

Use separate identities so commits, approvals, comments, and audit history remain attributable:

- Node X: Frederick's individual GitHub and Google identity
- Node Z: Arie's individual GitHub and Google identity
- Shared organization: `LuxVeritasMedia`
- Shared business Drive: `info@luxveritas.media`, with each person invited individually

Do not exchange passwords, browser profiles, personal access tokens, operator tokens, API keys, `.env` files, or service-account keys.

## Current Visibility

The initial collaboration inspection on 2026-07-16 found:

- `main@c9aa3e1`
- no remote `node-z/*` branch
- no open pull request
- no distinct Arie commit identity
- GitHub collaborator list contains only `LuxVeritasMedia`
- `main` is not branch-protected
- Hosting workflow `#322` passed for that starting baseline

Arie has reportedly begun work locally, but none of that work is reviewable from Node X until he pushes a branch or opens a draft PR.

See `docs/collaboration/STATUS.md` for the current work table.

## Branch Contract

Node X branches:

```text
node-x/<short-scope>
```

Node Z branches:

```text
node-z/<short-scope>
```

Examples:

```text
node-z/home-ui-pass
node-z/music-player-polish
node-z/app-marketplace-ux
node-x/release-evidence-refresh
```

Neither node should push working changes directly to `main` once Arie's individual account is connected.

## Start Of Session

For a new work package:

```bash
git switch main
git pull --ff-only origin main
git switch -c node-z/home-ui-pass
```

For an existing Node Z branch:

```bash
git fetch origin --prune
git switch node-z/home-ui-pass
git merge origin/main
```

Do not force-push shared branches.

## Publish Progress Early

Arie should push after the first coherent checkpoint, not only when the entire design is finished:

```bash
git push -u origin node-z/home-ui-pass
gh pr create --draft --base main --head node-z/home-ui-pass
```

The draft PR is the progress dashboard. Its description should contain:

- goal and user outcome
- routes and files in scope
- screenshots or Figma frame links
- completed work
- current work
- next work
- decisions needed from Node X
- tests run
- known risks

## End Of Session

Before stopping, each node should:

1. Commit a coherent checkpoint.
2. Push the branch.
3. Update the draft PR checklist.
4. Add a short comment with `Done / Next / Blocked / Decision needed`.
5. Place large approved assets in the matching Drive folder.
6. Record durable product decisions in `docs/collaboration/DECISIONS.md` through the same PR.

This makes work resumable from either location without relying on chat memory.

## Node X Review

Node X reviews a Node Z branch without merging it into the working directory blindly:

```bash
gh pr checkout <PR_NUMBER>
node tools/build-static.mjs
node tools/prepare-hosting.mjs
node tools/qa-buttons.mjs
node tools/qa-public-site.mjs
node tools/qa-mobile-layout.mjs
node tools/qa-accessibility.mjs
node tools/qa-media-contract.mjs
```

Node X records findings on the PR. Node Z resolves them on the same branch. After approval, Node X merges and watches the Firebase workflow.

## Progress Report Command

From either machine:

```bash
git fetch origin --prune
node tools/report-node-progress.mjs
```

The command reports the current checkout, Node X/Node Z remote branches, open PRs, and recent GitHub Actions without revealing secrets.

## Google Drive Layout

The shared workspace contains:

- `00 Current Status`
- `01 Approved UI UX`
- `02 Approved Media Assets`
- `03 Release Evidence`
- `04 Private Handoffs`

Drive is not a place for cloned repositories, `node_modules`, raw credentials, or competing copies of files already controlled by Git.

## Required Account Change

Before enabling branch protection, invite Arie's individual GitHub account as a repository collaborator. After the invitation is accepted:

1. Confirm Arie can create `node-z/*` branches.
2. Confirm commits show Arie's own identity.
3. Require pull requests for `main`.
4. Require one approving review.
5. Block force pushes and deletion of `main`.

Do not enable the one-review rule while both people still use the same GitHub login; GitHub cannot provide meaningful independent approval in that state.
