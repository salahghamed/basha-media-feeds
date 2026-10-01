# Basha Media Live dashboard

Public Squarespace page: `https://bashamedia.me/live` (verify uppercase `/Live` resolves too). Keep it in **Not Linked**, not main navigation. Homepage and existing channel routes are untouched.

## Architecture and local files

Existing production stack: Squarespace custom code blocks; plain JavaScript/CSS, no framework or package dependencies. Backend: the existing read-only Cloudflare Worker and `ARCHIVE` Workers KV binding; scheduled GitHub Actions in `salahghamed/basha-media-feeds`. Only `/live/stats.json` is added to the Worker route registry. The three existing feed routes remain identical.

`stats-sync.mjs` owns the ordered five-channel configuration, Data API calls, independent OAuth refresh, Analytics requests, cache, date alignment and totals. `stats.test.mjs` checks the mathematical and failure contracts. `workflow.yml` is deployed as `.github/workflows/live-stats.yml`; `stats-sync.mjs` and `stats.test.mjs` go at the repository root. Its format test also requires `format.js` at the root.

Frontend sources: `page.css`, `page.js`, `format.js`, `build.mjs`; generated `index.html`, `squarespace-embed.html`, `squarespace-head.html`. Run `node live-stats/build.mjs`, `node --test live-stats/stats.test.mjs`, then `python -m http.server 8769 --directory live-stats`. Preview `http://localhost:8769/`. Local pages read the public production cache; no mock metrics ship in production. Until that cache exists, placeholders remain visible. No Google secrets or Google requests are in the browser.

## Secrets and activation

GitHub → repository Settings → Secrets and variables → Actions:

Existing secrets reused: `YOUTUBE_API_KEY`, `CLOUDFLARE_API_TOKEN`. Existing variables reused: `CLOUDFLARE_ACCOUNT_ID`, `ARCHIVE_NAMESPACE_ID`. The Cloudflare token needs read/write access to the existing KV namespace, never Worker-management or account-wide permissions beyond the existing grant.

Additional **secrets**, not variables:

* `GOOGLE_OAUTH_CLIENT_ID`
* `GOOGLE_OAUTH_CLIENT_SECRET`
* `ANDROID_BASHA_REFRESH_TOKEN`
* `CAMERA_BASHA_REFRESH_TOKEN`
* `BASHA_PODCAST_REFRESH_TOKEN`
* `HIFI_BASHA_REFRESH_TOKEN`
* `GAMING_BASHA_REFRESH_TOKEN`

Google Authenticator sign-in codes are not these OAuth credentials. Never paste a code or token into this README, the dashboard, or chat.

Enable **YouTube Data API v3** and **YouTube Analytics API** in the Google Cloud project. Set up the OAuth consent screen and create an OAuth client. Request only `https://www.googleapis.com/auth/yt-analytics.readonly` with offline access and owner consent. Authorize each intended channel identity independently, choosing its Brand Account when appropriate. Exchange the authorization code server-side with the OAuth client secret; save its long-lived refresh token in the matching GitHub secret. The service queries `channel==CHANNEL_ID`, so an unauthorized token cannot silently substitute another channel's metrics. A token may be reused only after confirming that it has access to each requested channel. Don't assume permission from sharing a Google login. A consent application left in testing can produce short-lived refresh tokens; configure its publication/verification status according to Google's rules. See [Google server-side OAuth](https://developers.google.com/identity/protocols/oauth2/web-server) and [YouTube Analytics authorization](https://developers.google.com/youtube/analytics/guides/authorization).

After adding secrets, run **Refresh Basha network statistics** manually from Actions. Each channel reports only a public channel ID and connection status in logs. Credentials are never printed. The initial run resolves official channel handles and pins IDs in KV. Subsequent public refreshes use one batched `channels.list` request for all five IDs. `channel-ids.json` records verified resolved IDs after deployment when available.

## Refresh, cache and reliability

GitHub scheduled refresh every 15 minutes (schedule can be delayed by GitHub). Analytics per channel every six hours, with 90 complete days cached to align slower channels. The UI reads the cached endpoint every ten minutes, only while visible. Worker cache lifetime is five minutes. No visitor request contacts Google.

KV entries: `stats:public:gzip`, `stats:analytics:gzip`, `stats:dashboard:gzip`. Only the last normalized snapshot is exposed by the public Worker. OAuth tokens never enter KV; the Analytics cache contains only daily views, dates and update timestamps. Public-safe fields are explicitly allowlisted. Worker streams precompressed gzip using `encodeBody: 'manual'` to avoid double compression.

Google failures retain each channel's last successful cache. Cache-read failure aborts publishing, preserving the whole previous snapshot. A public refresh with no success doesn't overwrite the dashboard. Failed individual Analytics authorization leaves its channel visible and its existing Analytics cache intact. Missing metrics remain null, never fabricated zero values. Network totals are unavailable if any of the required five inputs are missing. Partial Analytics series can still be explored, clearly labeled as connected channels only.

Staleness: public older than 45 minutes or Analytics older than 12 hours is indicated subtly. Network/update timestamps derive from successful backend refreshes, not page visits. Display timezone is Asia/Amman, matching the current project environment. Analytics day boundaries are Pacific time as defined by YouTube; these are not relabeled as Amman days.

GitHub can disable public-repository schedules after 60 days without activity. Re-enable the workflow if disabled. Standard public GitHub Actions jobs and Cloudflare Free KV remain subject to each platform's usage limits; no paid subscription is required by this architecture. This adds about 288 KV writes/day and roughly 300 reads/day from scheduled jobs, plus visitor reads. Cache reduces repeated visitor requests.

## Calculation and dates

Exact integer API values are used internally. `network = sum(five channels)` for subscribers/lifetime/current30/previous30. Network change is `(sumCurrent - sumPrevious) / sumPrevious * 100`, never a mean of percentages. A zero previous period returns null; UI says “No prior views” (or “No change” when both are zero), never Infinity/NaN.

The Analytics request ends yesterday in `America/Los_Angeles`, excluding today's incomplete data. Returned daily rows determine the last available date conservatively. Each successful response yields 90 dates with absent report days counted as zero only within the queried complete interval. The dashboard aligns all connected channels to the minimum available cutoff, then uses exactly 60 consecutive dates: last 30 vs adjacent previous 30. The chart uses these same aligned days. The latest Analytics response date may lag yesterday. No current-day estimates are used. The Data API subscriber count is rounded to three significant figures by YouTube; this dashboard preserves that supplied number and explains the limitation, rather than claiming exact private subscriber counts.

## Design and accessibility

Actual existing `rebuild/basha-media-logo.png` reused, plus approved channel avatar fallback assets. Official API avatars replace them when available. Exact verified English fonts: Impact / Arial Narrow / Arial for headings; Arial / Helvetica for body. Arabic: existing Noto Kufi Arabic, loaded through the site's existing font setup. Brand accent: `#9dff25`. No duplicate fonts bundled.

Dependency-free SVG viewership graph, actual daily data only; hover/tap date details, persistent mobile selection, explicit dismiss, keyboard date selector and full accessible daily table. Channel selection and 30/60 controls are native buttons with pressed states. Gaming Basha remains fifth in config, cards, legend and graph. Mobile cards reflow into two metric columns and a full-width sparkline. High contrast, visible focus, non-color directional arrows, reduced-motion support. No flashing counters or chart transitions.

## Squarespace deployment

1. Add a blank page under **Not Linked**, title Live, URL slug `live`.
2. Insert a Code block, HTML mode, Display Source disabled. Paste generated `squarespace-embed.html`; save.
3. Set page SEO title/description to the values in `squarespace-head.html`, and canonical route `/live`. Don't replace global Code Injection or navigation.
4. Deploy the existing Worker with the extra `/live/stats.json` mapping and keep ARCHIVE binding. Don't add a paid Cron trigger.
5. Publish the stats code, format utility, tests and dedicated workflow to the existing feeds repository. Run workflow, verify its success, and inspect the public page.
6. Verify `/Live` resolves. Use an explicit `/Live -> /live` redirect only if Squarespace doesn't handle casing, leaving all prior URL mappings intact.

Full Analytics activation remains pending until the owner supplies the five OAuth authorizations. Production uses no mock data. Test-only numeric fixtures exist in `stats.test.mjs`, which is never embedded in the site.
