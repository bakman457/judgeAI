# Deploy Judge AI to Google Cloud (Free Tier)

This guide deploys Judge AI to **Google Cloud Run** + **Cloud SQL (MySQL)** + **Cloud Storage** using only free-tier resources.

---

## What You Get (Free Tier Limits)

| Service | Free Tier | Suitability |
|---------|-----------|-------------|
| **Cloud Run** | 2M requests/month, 360K GB-seconds, 180K vCPU-seconds | ✅ More than enough for personal use |
| **Cloud SQL (MySQL)** | 1 db-f1-micro instance | ✅ Free in `us-central1`, `us-east1`, `us-west1` |
| **Cloud Storage** | 5 GB standard storage | ✅ Plenty for case documents |
| **Secret Manager** | 6 active secret versions | ✅ Covers DB, JWT, API keys |
| **Artifact Registry** | 500 MB storage + free egress to Cloud Run | ✅ Sufficient |

---

## Prerequisites

1. [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk/docs/install) installed
2. A Google Cloud project (new projects get $300 credit, but we only use free tier)
3. Docker installed (for local builds) OR use Cloud Build

Login and set your project:

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

Enable required APIs:

```bash
gcloud services enable run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

---

## Step 1: Create Cloud SQL MySQL Instance (Free Tier)

```bash
# Create a MySQL 8.0 instance (db-f1-micro is free)
gcloud sql instances create judge-ai-db \
  --database-version=MYSQL_8_0 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-type=HDD \
  --storage-size=10GB \
  --availability-type=ZONAL \
  --no-backup \
  --root-password=REPLACE_WITH_STRONG_ROOT_PASSWORD

# Create the application database
gcloud sql databases create judge_ai --instance=judge-ai-db

# Create a dedicated app user (recommended)
gcloud sql users create judgeai_app \
  --instance=judge-ai-db \
  --password=REPLACE_WITH_STRONG_APP_PASSWORD
```

Get the connection name (you will need it later):

```bash
gcloud sql instances describe judge-ai-db --format="value(connectionName)"
# Example output: your-project:us-central1:judge-ai-db
```

---

## Step 2: Create Cloud Storage Bucket (Uploads)

```bash
# Create a unique bucket name
export BUCKET_NAME="your-project-judge-ai-uploads"

gcloud storage buckets create gs://$BUCKET_NAME \
  --location=us-central1 \
  --uniform-bucket-level-access

# Allow public read for document previews (optional — restrict if needed)
gcloud storage buckets add-iam-policy-binding gs://$BUCKET_NAME \
  --member="allUsers" \
  --role="roles/storage.objectViewer"
```

> ⚠️ If you skip public access, documents won't have direct URLs. You can use signed URLs later for better security.

---

## Step 3: Store Secrets in Secret Manager

```bash
# 1. JWT Secret (min 32 chars)
echo -n "REPLACE_WITH_A_32_PLUS_CHARACTER_RANDOM_STRING" | \
  gcloud secrets create judge-ai-jwt-secret --data-file=-

# 2. Database URL
# Format: mysql://USER:PASS@localhost/DB?socket=/cloudsql/CONNECTION_NAME
echo -n "mysql://judgeai_app:REPLACE_APP_PASSWORD@localhost/judge_ai?socket=/cloudsql/YOUR_PROJECT:us-central1:judge-ai-db" | \
  gcloud secrets create judge-ai-db-url --data-file=-

# 3. Owner OpenID
echo -n "desktop-local-user" | \
  gcloud secrets create judge-ai-owner-id --data-file=-

# 4. DeepSeek API Key (optional — can also configure in-app)
echo -n "sk-REPLACE_WITH_YOUR_DEEPSEEK_KEY" | \
  gcloud secrets create judge-ai-deepseek-key --data-file=-

# 5. Kimi API Key (optional)
echo -n "sk-REPLACE_WITH_YOUR_KIMI_KEY" | \
  gcloud secrets create judge-ai-kimi-key --data-file=-
```

---

## Step 4: Build & Push the Docker Image

### Option A: Local Build (faster)

```bash
# Configure Docker to use Google Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build and push
export IMAGE_URL="us-central1-docker.pkg.dev/YOUR_PROJECT_ID/judge-ai/judge-ai:latest"

docker build -t $IMAGE_URL .
docker push $IMAGE_URL
```

### Option B: Cloud Build (no local Docker needed)

```bash
export IMAGE_URL="us-central1-docker.pkg.dev/YOUR_PROJECT_ID/judge-ai/judge-ai:latest"

gcloud builds submit --tag $IMAGE_URL
```

---

## Step 5: Deploy to Cloud Run

```bash
export PROJECT_ID=$(gcloud config get-value project)
export DB_CONN="YOUR_PROJECT:us-central1:judge-ai-db"
export IMAGE_URL="us-central1-docker.pkg.dev/$PROJECT_ID/judge-ai/judge-ai:latest"

gcloud run deploy judge-ai \
  --image=$IMAGE_URL \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=1Gi \
  --cpu=1 \
  --concurrency=80 \
  --max-instances=3 \
  --min-instances=0 \
  --port=3000 \
  --add-cloudsql-instances=$DB_CONN \
  --set-secrets="DATABASE_URL=judge-ai-db-url:latest" \
  --set-secrets="JWT_SECRET=judge-ai-jwt-secret:latest" \
  --set-secrets="OWNER_OPEN_ID=judge-ai-owner-id:latest" \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="GCS_BUCKET=$PROJECT_ID-judge-ai-uploads" \
  --set-env-vars="PORT=3000"
```

> **Note on `--memory=1Gi`**: Cloud Run free tier includes 360K GB-seconds/month. A 1Gi container running 24/7 costs ~$0 but eats into free limits. For purely free-tier usage, set `--memory=512Mi` and the container will still run fine.

After deployment, you will get a URL like:
`https://judge-ai-abc123-uc.a.run.app`

---

## Step 6: Run Database Migrations

The first deploy will auto-run migrations via the `CMD` in the Dockerfile. But if you ever need to run them manually (e.g., after schema changes):

```bash
# Create a one-off Cloud Run Job for migrations
gcloud run jobs create judge-ai-migrate \
  --image=$IMAGE_URL \
  --region=us-central1 \
  --set-secrets="DATABASE_URL=judge-ai-db-url:latest" \
  --set-env-vars="NODE_ENV=production" \
  --add-cloudsql-instances=$DB_CONN \
  --command=pnpm \
  --args=drizzle-kit,migrate

# Execute the job
gcloud run jobs execute judge-ai-migrate --region=us-central1
```

---

## Step 7: Fix Known Schema Issue

If you see this error in logs:

```
Unknown column 'fallbackOrder' in 'SELECT'
```

Connect to the database and add the missing column:

```bash
gcloud sql connect judge-ai-db --user=root --database=judge_ai

# Then in the MySQL prompt:
ALTER TABLE ai_provider_settings ADD COLUMN fallbackOrder INT DEFAULT NULL;
EXIT;
```

---

## Step 8: Configure File Uploads (GCS)

By default, uploads are stored in the container's ephemeral filesystem (lost on redeploy). To persist uploads in **Cloud Storage**, you have two options:

### Option A: Mount GCS as a FUSE Volume (Recommended)

Cloud Run supports mounting Cloud Storage buckets as local filesystems:

```bash
gcloud run services update judge-ai \
  --region=us-central1 \
  --execution-environment=gen2 \
  --set-env-vars="JUDGE_AI_UPLOADS_DIR=/mnt/uploads" \
  --update-volume-mounts="uploads=/mnt/uploads" \
  --update-volumes="uploads=cloud-storage,bucket=$PROJECT_ID-judge-ai-uploads"
```

### Option B: Use the Built-in S3 Client for GCS

Google Cloud Storage has an **S3-compatible API**. You can configure the existing `@aws-sdk/client-s3` dependency to talk directly to GCS by setting HMAC keys.

1. Go to [Google Cloud Console → Storage → Settings → Interoperability](https://console.cloud.google.com/storage/settings;tab=interoperability)
2. Create HMAC keys for your service account
3. Set these environment variables on Cloud Run:
   - `AWS_ACCESS_KEY_ID=<your-hmac-access-key>`
   - `AWS_SECRET_ACCESS_KEY=<your-hmac-secret>`
   - `AWS_ENDPOINT_URL=https://storage.googleapis.com`
   - `AWS_REGION=us-central1`

Then modify `server/storage.ts` to use S3 when these are present.

---

## Updating the App

After making code changes:

```bash
# Rebuild and push
gcloud builds submit --tag $IMAGE_URL

# Redeploy
gcloud run deploy judge-ai --image=$IMAGE_URL --region=us-central1
```

---

## Monitoring & Logs

```bash
# View live logs
gcloud logging tail --service=judge-ai --region=us-central1

# Open Cloud Run console
gcloud run services describe judge-ai --region=us-central1 --format="value(status.url)"
```

---

## Cost Summary (Free Tier Only)

| Resource | Monthly Free | Typical Usage | Cost |
|----------|-------------|---------------|------|
| Cloud Run | 2M requests + 360K GB-sec + 180K vCPU-sec | ~50K requests, light usage | **$0** |
| Cloud SQL | 1 db-f1-micro instance | 1 instance | **$0** |
| Cloud Storage | 5 GB + 1 GB egress | ~500 MB uploads | **$0** |
| Secret Manager | 6 active versions | 5 secrets | **$0** |
| Artifact Registry | 500 MB | ~200 MB image | **$0** |

**Total estimated cost: $0/month** within free tier.

---

## Troubleshooting

### Container fails to start
Check logs: `gcloud logging tail --service=judge-ai --region=us-central1`

Common causes:
- Missing `JWT_SECRET` (must be ≥32 chars)
- Invalid `DATABASE_URL` format
- Cloud SQL connection not configured (`--add-cloudsql-instances`)

### "Port 3000 is already in use"
This happens locally when restarting. For Cloud Run, each container gets its own network namespace — this error won't occur.

### Sharp module errors
The Dockerfile installs `python3`, `make`, and `g++` so native modules compile correctly on Linux. If sharp still fails, ensure `pnpm install --frozen-lockfile` runs during build.

### Database connection errors
Cloud Run connects to Cloud SQL via a Unix socket at `/cloudsql/PROJECT:REGION:INSTANCE`. The `DATABASE_URL` must include:
```
mysql://user:pass@localhost/db?socket=/cloudsql/PROJECT:REGION:INSTANCE
```

---

## Next Steps

1. **Custom domain**: `gcloud run domain-mappings create --service=judge-ai --region=us-central1 --domain=yourdomain.com`
2. **HTTPS only**: Already enforced by Cloud Run
3. **CI/CD**: Connect GitHub repo to Cloud Build triggers for automatic deploys
4. **Backups**: Enable Cloud SQL automated backups (small fee) or export manually
