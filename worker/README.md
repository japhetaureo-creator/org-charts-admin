# Monday.com Proxy — Cloudflare Worker

This Worker acts as a secure proxy between the OrgChart webapp and the Monday.com GraphQL API. Your API token is stored as a Worker secret and never exposed to the browser.

## Prerequisites

- [Node.js](https://nodejs.org/) installed
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- Your Monday.com API token (get it from **Monday.com → Profile → Developers → My Access Tokens**)

---

## Deploy in 4 Steps

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

This opens a browser window to authenticate.

### 3. Set your Monday.com API token as a secret

```bash
cd worker
wrangler secret put MONDAY_API_TOKEN
```

Paste your token when prompted. It's stored encrypted in Cloudflare — never in code.

### 4. Deploy

```bash
wrangler deploy
```

You'll see output like:
```
✅ Deployed monday-proxy to https://monday-proxy.<your-subdomain>.workers.dev
```

Copy that URL — you'll paste it into the Integrations page in the app.

---

## Local Development (Optional)

To test locally before deploying:

```bash
wrangler dev
```

The Worker runs at `http://localhost:8787`. Use this URL in the app for testing.

---

## Routes

| Method | Path       | Body                          | Description                        |
|--------|------------|-------------------------------|------------------------------------|
| GET    | `/boards`  | —                             | List all boards (validates token)  |
| POST   | `/columns` | `{ boardId }`                 | Get column names for field mapping |
| POST   | `/sync`    | `{ boardId, columnMap }`      | Fetch + map employees from board   |

---

## Updating the Token

If you need to rotate your Monday.com token:

```bash
wrangler secret put MONDAY_API_TOKEN
```

Then redeploy:

```bash
wrangler deploy
```

---

## Troubleshooting

| Error | Fix |
|---|---|
| `MONDAY_API_TOKEN secret not set` | Run `wrangler secret put MONDAY_API_TOKEN` |
| `Worker returned 401` | Token is invalid or expired — regenerate in Monday.com |
| `CORS error in browser` | Make sure you're calling the Worker URL (not Monday.com directly) |
| `boardId required` | Check that the Board ID is a number (visible in the Monday.com board URL) |
