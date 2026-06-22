# pillowflow-us

Referral system files:

- `referral.html` — PillowFlow.us referral page.
- `pillowflow-com/referral.html` — PillowFlow.com referral page artifact.
- `assets/referral-form.js` — the single shared three-path form component.
- `schema.sql` — the single SQLite `referrals` table.
- `referral_server.py` — dependency-free static server and referral API.
- `admin/referrals.html` — manual review dashboard.
- `referral-program.schema.json` — shared API record contract.
- `.env.example` — production environment-variable template, including optional SMTP notifications.

All paths use the single public name **PillowFlow Founding Drivers**. The `.com` artifact is not published by this `.us` repository.

Run locally:

```powershell
$env:PILLOWFLOW_ADMIN_TOKEN = "replace-with-a-long-random-token"
python referral_server.py
```

Open `http://127.0.0.1:8000/referral.html` for the public form and `http://127.0.0.1:8000/admin/referrals.html` for manual review. The dashboard token is kept in memory only and is never persisted by the page.

For production, the service is container-ready and redirects `/` to the dedicated fleet referral page. See `DEPLOYMENT.md`. Production requires a persistent volume mounted at `/data`; SQLite must not be deployed on an ephemeral filesystem.

Until that API is hosted, public referral forms use an email handoff to `connect@pillowflow.com` with subject `REFERRAL`. The visitor must send the prepared message from their email application.

Public submissions are limited to 5 per IP per 10 minutes by default. Set `PILLOWFLOW_RATE_LIMIT_MAX` and `PILLOWFLOW_RATE_LIMIT_WINDOW` to adjust those values. When the server runs behind a trusted reverse proxy, set `PILLOWFLOW_TRUST_PROXY=1` so rate limiting uses the first `X-Forwarded-For` address. The dashboard CSV export uses the active referral type and status filters.

## English / Spanish translation

The language control links to crawlable English and Spanish URLs. Spanish pages live in
`es/`; both language versions include canonical and reciprocal `hreflang` metadata.
The referral web component contains a small Spanish string map because its Shadow DOM
content is not part of the page HTML.

Run `python build_spanish_pages.py` after changing English public-page copy. The build
translates the visible HTML and metadata, then regenerates `es/index.html` and
`es/referral.html`. Review machine-translated legal and marketing copy before publishing.
