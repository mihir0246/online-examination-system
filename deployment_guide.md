# Deployment Guide: Online Examination System

This guide covers deploying the Online Examination System on **Render** (Backend) and **AWS Amplify** (Frontend).

---

## 🏗️ Backend: Render (Web Service)

The backend is a Node.js/Express app deployed as a **Render Web Service**.

### 1. Create a Web Service on Render

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repository
3. Set the **Root Directory** to `backend`
4. Set **Build Command**: `npm install && npx prisma db push && npx prisma generate`
5. Set **Start Command**: `node app.js`
6. Set **Environment**: `Node`

### 2. Environment Variables

In the Render dashboard → your service → **Environment**, add:

| Key | Value | Description |
| :--- | :--- | :--- |
| `PORT` | *(auto-set)* | Automatically set by Render — do not configure manually |
| `DATABASE_URL` | `mongodb+srv://...` | MongoDB Atlas connection string |
| `JWT_SECRET` | `your_secure_secret` | Long random string for JWT signing |
| `CSRF_SECRET` | `your_csrf_secret` | Long random string for CSRF tokens |
| `NODE_ENV` | `production` | Enables production optimizations |
| `FRONTEND_URL` | `https://your-amplify-url.amplifyapp.com` | **Must match exactly** — used for CORS |
| `REDIS_HOST` | `your-redis-host` | Redis Cloud / Upstash host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | `your_redis_password` | Redis auth password |
| `SENTRY_DSN` | `https://...@sentry.io/...` | From Sentry → Project Settings |
| `AWS_REGION` | `eu-north-1` | S3 bucket region |
| `AWS_ACCESS_KEY_ID` | `...` | IAM user Access Key |
| `AWS_SECRET_ACCESS_KEY` | `...` | IAM user Secret Key |
| `S3_BUCKET_NAME` | `online-exam-storage-mihir` | Your S3 bucket name |
| `EMAIL_HOST` | `smtp.gmail.com` | SMTP host |
| `EMAIL_PORT` | `587` | SMTP port |
| `EMAIL_USER` | `your@gmail.com` | Gmail address |
| `EMAIL_PASS` | `app_password` | Gmail App Password (not your login password) |

> **Note:** Render automatically sets `PORT`. Do not hardcode it.

### 3. Redis

Use **Upstash** (free tier, no card required) or **Redis Cloud**:
1. Create a Redis database at [upstash.com](https://upstash.com)
2. Copy the **Host**, **Port**, and **Password** into Render env vars above
3. Render will connect on startup — the circuit breaker handles downtime gracefully

### 4. HTTPS

Render provides **HTTPS automatically** on all Web Services. Your backend URL will be `https://your-service-name.onrender.com`. No extra configuration needed.

---

## ⚡ Frontend: AWS Amplify

### 1. Connect Repository

1. Go to [Amplify Console](https://console.aws.amazon.com/amplify/)
2. **New App → Host web app → GitHub**
3. Select your repo and the branch (e.g., `main`)
4. Set **Root directory** to `frontend-modern`

### 2. Build Settings (`amplify.yml`)

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm install
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

### 3. Environment Variables

In Amplify → your app → **Environment variables**:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://your-service.onrender.com` | Your Render backend URL |
| `NEXT_PUBLIC_SENTRY_DSN` | `https://...@sentry.io/...` | Frontend Sentry DSN |

---

## 📦 Storage: AWS S3

S3 is used for question images and Excel report uploads.

### 1. Create an S3 Bucket

1. Go to **AWS Console → S3 → Create bucket**
2. **Bucket name**: e.g., `online-exam-storage-mihir`
3. **Region**: `eu-north-1`
4. **Object Ownership**: ACLs enabled
5. **Block Public Access**: *See Security Policy below before changing this.*

### 2. Bucket Security Policy

> **Security Warning (PII):** If you are storing Excel result reports containing student names and grades, do **not** make the entire bucket public.

**Option A: Public Assets Only (Images)**
If the bucket only stores question images and public resources:
1. Uncheck "Block all public access" and acknowledge.
2. Go to the **Permissions** tab → **Bucket policy** and paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

**Option B: Private Content (Reports + Images)**
If storing sensitive Excel reports, keep **Block all public access** enabled. You must configure the backend `s3.js` to generate **AWS S3 Presigned URLs** for short-lived, authenticated access to reports and images.

---

## ✅ Post-Deployment Checklist

- [ ] Render service shows **Live** (green) in the dashboard
- [ ] `GET https://your-service.onrender.com/health` returns `{"status":"UP"}`
- [ ] Frontend Amplify URL is reachable and loads the login page
- [ ] Log in with Admin account to confirm database connectivity
- [ ] Upload an image in a question — verify it appears in S3
- [ ] Redis connected (check Render logs for `🚀 Redis connected successfully`)
- [ ] Sentry receives a test event from both backend and frontend
