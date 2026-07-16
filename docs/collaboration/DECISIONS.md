# Lux Veritas Website Decision Log

Use this file only for durable website decisions that another machine or future session must know. Add decisions through the PR that implements them.

Do not place secrets, private financials, internal prompts, unreleased canon, or private legal advice here. The GitHub repository is public.

## Decisions

| Date | Decision | Owner | Implementation evidence |
| --- | --- | --- | --- |
| 2026-07-16 | GitHub is canonical for website code; Drive is for approved assets, release evidence, and private handoffs. | Node X | `docs/collaboration/README.md` |
| 2026-07-16 | Node X and Node Z use separate individual identities within shared organizations, not a shared login. | Node X | Collaborator invitation pending |
| 2026-07-16 | Node Z work uses `node-z/*` branches and opens a draft PR early. | Node X | First Node Z PR pending |
| 2026-07-16 | `main` protection waits until Arie's individual GitHub account is connected, then requires PR review. | Node X | Ruleset pending |

## New Decision Template

```text
Date:
Decision:
Reason:
Owner:
Routes/files affected:
Public/private boundary impact:
Implementation PR:
Revisit trigger:
```
