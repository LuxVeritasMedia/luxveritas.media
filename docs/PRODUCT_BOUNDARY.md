# Product Boundary

## LuxVeritas.media

`LuxVeritas.media` is the external public website and institutional front door.

Use this repo for:

- public home page
- music
- film
- events
- Codex
- about
- press/contact
- submissions
- public SEO
- audience capture
- public portal entry points

Primary path:

```text
/Users/frederickparent/Documents/Codex/LuxVeritas-website
```

## LuxFlow OS

`LuxFlow OS` is the internal authenticated production cockpit and should remain separate.

Use that repo for:

- LuxFlow OS internal shell
- LuxOS
- DAMON
- BlackGPT
- PromptPilot
- EffectLedger
- ImageReforge
- The Blackening
- AI Gateway
- Seed Vault
- AssetVault
- audit logs, events, approvals, finance, release ops, and internal workspace/project data

Primary path:

```text
/Users/frederickparent/Documents/Codex/LuxFlow-OS
```

## Rule

The public website may eventually link to a private portal/login, but it should not contain internal app logic, admin routes, secrets, private audit data, or module workflow state.

## Phase 7 Bridge Rule

The later LuxOS/LuxFlow connection must be a controlled bridge, not a repo merge.

Build order:

1. Keep `LuxVeritas.media` as the public front door and capture layer.
2. Keep `/portal` as a private-access shell until auth, roles, and intake routing are approved.
3. Define the role model and access request interface before any live service wiring.
4. Build internal app orchestration inside `LuxFlow-OS`.
5. Expose only approved server-side contracts back to the public site.

Never expose private prompts, internal dashboards, financials, rights ops, release ops, audit logs, canon-bible material, or private workflow state in public client markup.
