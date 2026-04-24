# Deploy Judge AI to Render + PlanetScale (Free)

## Why Render + PlanetScale?

- **Render** hosts the app (free tier: sleeps after 15 min inactivity)
- **PlanetScale** provides the MySQL database (free tier: 5 GB, 1 billion rows/month)

> ⚠️ Render's free tier sleeps after 15 min. First request after sleep takes ~30 sec to wake up. File uploads are stored on ephemeral disk and will be lost on redeploy.

---

## Step 1: Create PlanetScale Database

1. Go to https://planetscale.com and sign up with GitHub
2. Click **New Database**
3. Name: `judge-ai`
4. Region: choose closest to your users (e.g., `us-east`)
5. Click **Create database**
6. Wait for it to show green "Deploy requested" → "Deployed"
7. Click the **Connect** button
8. Select **@planetscale/database** from the dropdown
9. Click **New password** → name it `render`
10. **Copy the connection string** (looks like):
    ```
    mysql://username:password@host.aws-region.psdb.cloud/database?sslaccept=strict
    ```
    Save this somewhere — you'll need it in Step 3.

---

## Step 2: Connect Repo on Render

You said you already connected GitHub. Now finish the service setup:

1. Go to https://dashboard.render.com
2. Click **New +** → **Web Service**
3. Select your `judgeAI` repo
4. Fill in:

| Setting | Value |
|---------|-------|
| Name | `judge-ai` |
| Region | Same as your PlanetScale region |
| Branch | `main` |
| Runtime | `Node` |
| Build Command | `corepack enable && pnpm install && pnpm build && pnpm drizzle-kit migrate` |
| Start Command | `pnpm start` |

5. Click **Create Web Service**

---

## Step 3: Add Environment Variables

In your Render service dashboard, go to **Environment** tab and add:

| Key | Value | Secret? |
|-----|-------|---------|
| `DATABASE_URL` | Your PlanetScale connection string from Step 1 | ✅ Yes |
| `JWT_SECRET` | Any random string, **minimum 32 characters** | ✅ Yes |
| `OWNER_OPEN_ID` | `desktop-local-user` | ❌ No |
| `NODE_ENV` | `production` | ❌ No |

> **How to generate JWT_SECRET:** Open PowerShell and run: `[System.Convert]::ToBase64String((1..24 | % { Get-Random -Max 256 } | % { [byte]$_ }))`

Click **Save Changes**.

---

## Step 4: Deploy

Render will automatically deploy after you save the env vars.

1. Watch the **Deploy** logs in the Render dashboard
2. Wait for the green checkmark (takes ~5 minutes first time)
3. Click the **URL** at the top (looks like `https://judge-ai.onrender.com`)

---

## Step 5: Fix Database Schema (One Time)

If you see this error in the Render logs:
```
Unknown column 'fallbackOrder' in 'SELECT'
```

Connect to PlanetScale and fix it:

1. Go to https://app.planetscale.com/your-org/judge-ai
2. Click **Console** tab
3. Run:
```sql
USE judge_ai;
ALTER TABLE ai_provider_settings ADD COLUMN fallbackOrder INT DEFAULT NULL;
```

---

## Updating the App

Every time you push to GitHub `main`, Render auto-deploys:

```powershell
git add .
git commit -m "your changes"
git push origin main
```

---

## Cost

| Service | Monthly Free | Typical Usage |
|---------|-------------|---------------|
| Render Web Service | 750 hours (sleeps after 15 min idle) | Light use |
| PlanetScale | 5 GB storage, 1B row reads | Small database |
| **Total** | | **$0** |

---

## Troubleshooting

### "Database connection refused"
- Make sure `DATABASE_URL` is correct
- Make sure PlanetScale password hasn't expired
- Check that PlanetScale region matches Render region

### "Could not prepare the local administrator account"
- Database migrations didn't run
- Check Render build logs for `drizzle-kit migrate` errors

### App sleeps too often
- Upgrade to Render's $7/month Starter plan (never sleeps)
- Or set up a free uptime ping service (e.g., UptimeRobot) to ping the URL every 14 minutes

### File uploads disappear
- This is expected on free Render (ephemeral disk)
- For persistent uploads, connect AWS S3 or Cloudflare R2
