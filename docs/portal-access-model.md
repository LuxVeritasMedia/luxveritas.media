# Lux Veritas Portal Access Model

Status: Phase 5 prep. This defines the access contract before auth, roles, external routing, or internal LuxFlow bridge work.

## Portal Roles

- `visitor` - public visitor or general inquiry before approval.
- `member` - approved fan/member, early access, drops, events, and community.
- `artist` - approved artist path for releases, submissions, and collaboration review.
- `creator` - approved creator path for story, visual, Codex, and participation review.
- `press` - approved press and media contact path.
- `partner` - approved licensing, venue, studio, brand, or strategic partner path.
- `investor` - approved strategic/investor path.
- `operator` - internal operator path. Not available through public forms.
- `admin` - internal admin path. Not available through public forms.

## Public Access Paths

Public forms may collect these role-path labels only:

- `Member` -> `member` -> target portal role `member`
- `Artist` -> `artist` -> target portal role `artist`
- `Creator` -> `creator` -> target portal role `creator`
- `Press` -> `press` -> target portal role `press`
- `Partner` -> `partner` -> target portal role `partner`
- `Investor` -> `investor` -> target portal role `investor`
- `Event guest` -> `event_guest` -> target portal role `member`
- `General` -> `general` -> target portal role `visitor`

Operator and admin are intentionally absent from public forms.

## Inquiry Keys

Public inquiry labels map to stable keys:

- `Membership` -> `membership`
- `Submissions` -> `submissions`
- `Events` -> `events`
- `Press` -> `press`
- `Partnership` -> `partnership`
- `Licensing` -> `licensing`
- `Investor` -> `investor`
- `Portal` -> `portal`
- `General` -> `general`

## Access Request Interface

Every public form request should carry:

- `client_submission_id`
- `name`
- `email`
- `phone`
- `role_path`
- `access_path`
- `portal_role_target`
- `inquiry_type`
- `inquiry_key`
- `message`
- `formType`
- `tag`
- `source`
- `source_page`
- `consent_email`
- `consent_sms`
- `timestamp`

## Portal Surface Model

Phase 5 portal pages may show screened entry paths and protected pilot reporting only.

The noindex portal shell may describe these public-facing access doors:

- `member` - first access, private drops, events, community, presales, and selected merch.
- `artist` - submission review, release consideration, and artist-world fit.
- `creator` - story, visual, Codex, worldbuilding, and participation review.
- `press` - institutional contact and approved kit access.
- `partner` - licensing, venues, studios, brands, distribution, and strategic alignment.
- `investor` - screened investor, studio, and strategic partner access.
- `operator` - protected pilot reporting for approved operators only.

The portal shell must not imply that account access, memberships, community rooms, payments, creator tools, partner rooms, or operator permissions are live until auth and role gates are implemented.

## Bridge Rule

LuxVeritas.media may collect access requests and route approved requests later. It must not import internal LuxFlow app code, private prompts, secrets, dashboards, audit data, finance, rights operations, or unreleased slate material into the public website.
