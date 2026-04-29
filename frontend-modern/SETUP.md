# 🚀 Modern Examination System - Frontend Setup Guide

This guide provides comprehensive instructions for setting up, developing, and deploying the modernized **Next.js 14+** frontend of the Online Examination System.

---

## 🛠 Tech Stack Overview
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **State Management**: Redux Toolkit (Auth) & React Query (Data Fetching)
- **UI Framework**: Ant Design 5.x
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React

---

## 📋 Prerequisites
Ensure you have the following installed:
- **Node.js**: v18.17.0 or higher
- **npm**: v9.x or higher
- **Backend**: Ensure the Express/Node backend is running (defaults to `http://localhost:5000`)

---

## ⚙️ Environment Configuration

Create a `.env.local` file in the `frontend-modern` root directory:

```env
# Backend API Base URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000

# Optional: Deployment Environment
NEXT_PUBLIC_ENV=development
```

---

## 🚀 Getting Started

### 1. Installation
Install all dependencies using npm:
```bash
cd frontend-modern
npm install
```

### 2. Development Mode
Run the development server with Hot Module Replacement (HMR):
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### 3. Production Build
Create an optimized production bundle:
```bash
npm run build
```

### 4. Start Production Server
```bash
npm run start
```

---

## ☁️ Deployment Strategies

### Option A: Vercel (Recommended)
1. Push your code to a GitHub repository.
2. Connect the repository to Vercel.
3. Set the `Root Directory` to `frontend-modern`.
4. Configure the Environment Variables in the Vercel dashboard.

### Option B: AWS Amplify
1. Connect your repository to AWS Amplify Console.
2. Use the following build settings in `amplify.yml`:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - cd frontend-modern
           - npm ci
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: frontend-modern/.next
       files:
         - '**/*'
     cache:
       paths:
         - frontend-modern/node_modules/**/*
   ```

---

## 🔒 Security & Performance Features
- **Anti-Cheat Monitoring**: Tab-switch detection and periodic webcam snapshots are enabled by default in the Exam Portal.
- **CSRF Protection**: The `apiClient` automatically fetches and attaches CSRF tokens for all state-mutating requests.
- **Image Optimization**: Powered by Next.js `<Image />` component for lightning-fast loads.
- **Type Safety**: Full TypeScript integration across all hooks and components.

---

## 📂 Project Structure
- `src/app`: App Router (Pages & Routing)
- `src/components`: Reusable UI Components (Layout, UI, Forms)
- `src/hooks`: Custom Hooks (API interactions, State logic)
- `src/services`: API Clients & Interceptors
- `src/store`: Redux Global State Management

---

**Note**: For backend configuration and database setup, please refer to the main `backend/README.md`.
