# Repository package

The complete source is in sync-package.b64 (a base64 ZIP). The workflow extracts it before running; no credentials are included. To review locally, decode and unzip it.

# Basha public feed updates

GitHub Actions performs YouTube/RSS ingestion every six hours. Cloudflare Workers Free streams precompressed published feeds from the existing ARCHIVE KV binding. No YouTube API call or graph construction happens during a visitor request. This repository contains public channel code and editorial overrides, never credentials.

## Account setup

Add GitHub repository Actions secrets `YOUTUBE_API_KEY` and `CLOUDFLARE_API_TOKEN`. The Cloudflare token needs Workers KV Storage Edit permission on the account containing the archive; create it yourself in Cloudflare and paste it directly into GitHub's encrypted secret field. Do not commit it. The existing YouTube secret in Cloudflare is not readable and must be entered separately in GitHub.

Add repository Actions variables `CLOUDFLARE_ACCOUNT_ID` and `ARCHIVE_NAMESPACE_ID` (the IDs shown by Cloudflare for your account and android-basha-archive namespace). Optionally add `YOUTUBE_FULL_EPISODES_PLAYLIST_ID` for Basha Podcast's dedicated full-episode playlist. Without it, Podcast refreshes RSS audio plus existing explicitly verified links; new video episodes are not inferred from the whole channel.

Replace the Android API Worker's code with `worker.js`, preserving its existing `ARCHIVE` binding. Remove the old Cloudflare cron: scheduling now belongs to GitHub. The old Cloudflare YouTube secret is no longer used by this read-only Worker. No Workers Paid subscription is needed for this architecture while within Cloudflare Free quotas.

In GitHub Actions, manually run "Update public Basha channel feeds" once. Require all channel jobs to succeed before connecting page URLs. Feed routes are `/graph.json`, `/camera/catalog.json` and `/podcast/episodes.json` on your Worker hostname. Android and Camera frontend endpoint settings must point to their respective route; Podcast additionally needs its existing static rendering adapted to consume the feed. Publishing these feeds alone does not connect any website automatically.

## Reliability and limits

Only nonempty successful syncs are published. Failures leave the previous feed intact. Each channel publishes independently. Secrets are never printed; publishing credentials are sent only to the official Cloudflare API in the Authorization header. Public reads permit GET/HEAD, enforce the production site's CORS origin, and do not expose write operations.

The default six-hour schedule limits full-channel YouTube API quota consumption. GitHub schedules can be delayed and public-repository scheduled workflows can be disabled after 60 days without repository activity; re-enable them when needed. GitHub's public standard runners are free, but Cloudflare and Google usage limits still apply. This is not a guarantee of unlimited free traffic.

Tests: `node --test tests.mjs`. No npm dependencies are required. Workflow runners must provide Node 22+ and Python 3. Node 24 is configured explicitly in the workflow.
