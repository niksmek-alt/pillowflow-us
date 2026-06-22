# Referral deployment

The referral service is prepared to run at `https://refer.pillowflow.us` as one container containing the public pages, referral API, SQLite database, and admin dashboard.

## Required production configuration

- Build from the repository `Dockerfile`.
- Attach a persistent volume at `/data`. Without this volume, referral records will be lost during a restart or redeploy.
- Set `PILLOWFLOW_ADMIN_TOKEN` to a long, randomly generated secret.
- Set `PILLOWFLOW_TRUST_PROXY=1` when the host supplies the client IP through `X-Forwarded-For`.
- Keep `PILLOWFLOW_REFERRALS_DB=/data/referrals.db`.
- Point `refer.pillowflow.us` to the hostname supplied by the deployment provider.
- Require HTTPS at the proxy or hosting layer.
- Configure the optional `PILLOWFLOW_SMTP_*` variables from `.env.example` to send a `REFERRAL` notification to `connect@pillowflow.com` after each database insert.

Optional rate-limit settings:

- `PILLOWFLOW_RATE_LIMIT_MAX=5`
- `PILLOWFLOW_RATE_LIMIT_WINDOW=600`

## Routes

- `/` redirects to the fleet referral page.
- `/referral.html` is the fleet referral page.
- `/pillowflow-com/referral.html` is the customer referral page artifact.
- `/admin/referrals.html` is the token-protected admin dashboard.
- `/api/referrals` is the shared referral API.
- `/healthz` is the unauthenticated container health check.

## Current email handoff

The static PillowFlow.com and PillowFlow.us pages currently set `delivery-mode="email"`. Submitting opens the visitor's email application with:

- Recipient: `connect@pillowflow.com`
- Subject: `REFERRAL`
- Body: the completed referral fields

This requires the visitor to review and send the prepared message. A static GitHub Pages site cannot send email directly without a backend or third-party form processor.

## Full API cutover

After this container is live at `https://refer.pillowflow.us`:

1. Set the SMTP and admin environment variables from `.env.example`.
2. Attach and verify the persistent `/data` volume.
3. Verify `https://refer.pillowflow.us/healthz` reports `database: ready`.
4. Remove `delivery-mode="email"` and `email-to="connect@pillowflow.com"` from each `<pillowflow-referral-form>`.
5. On PillowFlow.com, set `api-base="https://refer.pillowflow.us"`. The PillowFlow.us form can use that same explicit API base or be hosted on the referral subdomain with a relative API URL.
6. Submit one test referral and confirm it appears in `/admin/referrals.html`, the CSV export, and the `REFERRAL` notification inbox.

## Container smoke test

```powershell
docker build -t pillowflow-referrals .
docker run --rm -p 8000:8000 -v pillowflow-referrals:/data -e PILLOWFLOW_ADMIN_TOKEN="replace-with-a-long-random-token" pillowflow-referrals
```

Verify `http://127.0.0.1:8000/healthz`, then open `http://127.0.0.1:8000/`.

## Important limitation

This SQLite deployment requires a single running application instance with one persistent volume. Do not scale it horizontally. Move the unchanged `referrals` table to managed Postgres before adding multiple instances.
