# Supabase Blueprint

Supabase should own relational content and operational ledgers. Firebase/Firestore should own auth profile tiering.

## Tables

- `profiles`
- `artists`
- `works`
- `releases`
- `events`
- `codex_entries`
- `portal_items`
- `release_drafts`
- `form_submissions`
- `ghl_webhook_logs`
- `analytics_events`
- `products`
- `campaign_links`
- `legal_versions`

## RLS Direction

- Public can read published public works, events, and Outer Codex entries.
- Authenticated artists can read their assigned portal/release rows.
- Admins can manage operational rows.
- Service-role access stays server-side only.

## Form Ledger

Every public form should write to `form_submissions` before relaying to GoHighLevel. Relay status should write to `ghl_webhook_logs`.

## Analytics

Consent-aware events should use names from the campaign SOP:

- `view_content`
- `lead`
- `listen_click`
- `youtube_click`
- `email_signup`
- `scroll_75`
- `purchase`
