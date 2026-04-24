# Deploy Judge AI to Google Cloud — No Docker Needed

This guide sets up auto-deployment via **GitHub Actions**. You never need to open Docker or install `gcloud` on your computer.

---

## Overview

| Step | Where | What you do |
|------|-------|-------------|
| 1 | Google Cloud Console (browser) | Create project, database, secrets |
| 2 | Google Cloud Console (browser) | Create a service account, download JSON key |
| 3 | GitHub (browser) | Push this repo, add secrets |
| 4 | GitHub (browser) | Click "Run workflow" — it builds & deploys automatically |

---

## Step 1: Create a GitHub Repo & Push Code

1. Go to https://github.com/new
2. Name it `judge-ai` (or anything)
3. **Do not** add a README or .gitignore
4. Copy the two commands under "…or push an existing repository"
5. Open PowerShell in this project folder and run:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/judge-ai.git
git branch -M main
git push -u origin main
```

> If Git asks for a password, use a **Personal Access Token** (Settings → Developer settings → Tokens).

---

## Step 2: Create Google Cloud Project

1. Go to https://console.cloud.google.com/projectcreate
2. Enter a project name (e.g., `judge-ai-prod`)
3. Click **Create**
4. Copy the **Project ID** (looks like `judge-ai-prod-123456`)
5. Enable billing (required, but we only use free-tier resources)

---

## Step 3: Enable APIs (One-Click)

Go to this link and click **Enable** for each:
- [Cloud Run API](https://console.cloud.google.com/apis/library/run.googleapis.com)
- [Cloud SQL Admin API](https://console.cloud.google.com/apis/library/sqladmin.googleapis.com)
- [Secret Manager API](https://console.cloud.google.com/apis/library/secretmanager.googleapis.com)
- [Cloud Storage API](https://console.cloud.google.com/apis/library/storage.googleapis.com)
- [Artifact Registry API](https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com)
- [Cloud Build API](https://console.cloud.google.com/apis/library/cloudbuild.googleapis.com)

---

## Step 4: Create Cloud SQL Database (Free Tier)

1. Go to https://console.cloud.google.com/sql/instancesCreate
2. Choose **MySQL 8.0**
3. Instance ID: `judge-ai-db`
4. Region: `us-central1` (must be this for free tier)
5. Machine type: **Shared core** → `db-f1-micro`
6. Storage: HDD, 10 GB
7. Set a root password (save it!)
8. Click **Create**
9. Wait ~5 minutes for it to finish

Once created:
1. Click the instance name
2. Go to **Databases** tab → Click **Create database**
3. Database name: `judge_ai`
4. Click **Create**
5. Go to **Overview** tab → copy the **Connection name** (looks like `your-project:us-central1:judge-ai-db`)

---

## Step 5: Create Secrets in Secret Manager

Go to https://console.cloud.google.com/security/secret-manager

Click **Create Secret** for each:

| Secret Name | Secret Value |
|-------------|--------------|
| `judge-ai-jwt-secret` | Any random string, **minimum 32 characters** |
| `judge-ai-db-url` | `mysql://root:YOUR_ROOT_PASSWORD@localhost/judge_ai?socket=/cloudsql/YOUR_CONNECTION_NAME` |
| `judge-ai-owner-id` | `desktop-local-user` |
| `judge-ai-deepseek-key` | Your DeepSeek API key (optional) |
| `judge-ai-kimi-key` | Your Kimi API key (optional) |

> Replace `YOUR_ROOT_PASSWORD` and `YOUR_CONNECTION_NAME` with your actual values.

---

## Step 6: Create Service Account & Download Key

1. Go to https://console.cloud.google.com/iam-admin/serviceaccounts
2. Click **Create Service Account**
3. Name: `judge-ai-deployer`
4. Click **Create and Continue**
5. Grant these roles:
   - **Cloud Run Admin**
   - **Cloud SQL Client**
   - **Secret Manager Secret Accessor**
   - **Storage Admin**
   - **Artifact Registry Writer**
   - **Cloud Build Editor**
6. Click **Continue** → **Done**
7. Click the new service account → **Keys** tab → **Add Key** → **Create new key**
8. Choose **JSON** → Click **Create**
9. A `.json` file downloads automatically — **keep it safe**

---

## Step 7: Add GitHub Secrets

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** for each:

| Secret Name | Value |
|-------------|-------|
| `GCP_PROJECT_ID` | Your Google Cloud project ID |
| `GCP_SA_KEY` | Copy-paste the **entire contents** of the downloaded JSON key file |
| `GCP_DB_CONNECTION_NAME` | Your Cloud SQL connection name |

---

## Step 8: Create the Migration Job (One Time)

Before the first deploy, create a Cloud Run job for database migrations:

1. Go to https://console.cloud.google.com/run/jobsCreate
2. Job name: `judge-ai-migrate`
3. Region: `us-central1`
4. Container image: use any placeholder for now (we'll update it after first build)
5. Click **Container, Variables & Secrets, Connections, Security**
6. Under **Secrets**:
   - Add `DATABASE_URL` → Reference secret `judge-ai-db-url`
7. Under **Cloud SQL connections**:
   - Add your `judge-ai-db` instance
8. Command: `pnpm`
9. Arguments: `drizzle-kit`, `migrate`
10. Click **Create**

> After your first GitHub Actions deployment, update this job's image to the same one deployed to Cloud Run.

---

## Step 9: Deploy!

1. Go to your GitHub repo → **Actions** tab
2. Click **Deploy to Google Cloud**
3. Click **Run workflow** → **Run workflow**
4. Wait ~5 minutes
5. When it turns green, click the completed run → scroll to the bottom
6. You'll see your live URL: `https://judge-ai-xxx-uc.a.run.app`

---

## Step 10: Fix Database Schema (One Time)

After first deploy, you may see this error in logs:
```
Unknown column 'fallbackOrder' in 'SELECT'
```

Fix it:
1. Go to https://console.cloud.google.com/sql/instances
2. Click `judge-ai-db` → **Open Cloud Shell** (button in top right)
3. In the shell that opens, run:
```sql
mysql -u root -p
USE judge_ai;
ALTER TABLE ai_provider_settings ADD COLUMN fallbackOrder INT DEFAULT NULL;
EXIT;
```
4. Enter your root password when prompted

---

## Step 11: Configure File Uploads (Optional)

By default, uploads are stored in the container's temporary disk (lost on redeploy). For persistent storage:

### Option A: Cloud Storage (Recommended)
1. Go to https://console.cloud.google.com/storage/browser
2. Click **Create bucket**
3. Name: `your-project-id-judge-ai-uploads`
4. Region: `us-central1`
5. Click **Create**
6. Go to https://console.cloud.google.com/run/detail/us-central1/judge-ai/revisions
7. Click **Edit & Deploy New Revision**
8. Add environment variable: `GCS_BUCKET` = `your-project-id-judge-ai-uploads`
9. Under **Volumes** → **Add volume** → **Cloud Storage bucket**
10. Volume name: `uploads`, Bucket: your bucket
11. Mount path: `/mnt/uploads`
12. Add environment variable: `JUDGE_AI_UPLOADS_DIR` = `/mnt/uploads`
13. Click **Deploy**

---

## Updating the App

After you make code changes:
```powershell
git add .
git commit -m "your changes"
git push origin main
```

GitHub Actions automatically rebuilds and redeploys.

---

## Troubleshooting

### Workflow fails at "Build and push Docker image"
- Make sure **Cloud Build API** is enabled
- Check that the service account has **Cloud Build Editor** role

### Workflow fails at "Deploy to Cloud Run"
- Make sure **Cloud Run API** is enabled
- Check that `GCP_DB_CONNECTION_NAME` secret is correct

### App shows "Could not prepare the local administrator account"
- Cloud SQL connection is failing
- Check the `DATABASE_URL` secret format: must include `?socket=/cloudsql/...`
- Make sure the service account has **Cloud SQL Client** role

### "The requested matter could not be loaded"
- Database migrations didn't run
- Go to Cloud Run jobs and manually execute `judge-ai-migrate`

---

## Cost (Free Tier Only)

Everything in this guide uses **$0/month** Google Cloud free tier resources. You only pay if you exceed:
- 2 million Cloud Run requests
- 360,000 GB-seconds of memory
- 1 Cloud SQL db-f1-micro instance
- 5 GB Cloud Storage
