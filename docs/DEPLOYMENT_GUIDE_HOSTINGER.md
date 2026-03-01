# Deployment Guide: Logic Nexus AI on Hostinger VPS with Coolify & Jenkins

This comprehensive guide details the step-by-step process for deploying the **Logic Nexus AI** application on a Hostinger VPS using **Coolify** for container orchestration and **Jenkins** for CI/CD. The setup supports three distinct environments: **Development**, **Staging**, and **Production**.

## Table of Contents
1. [Infrastructure Setup (Hostinger VPS)](#1-infrastructure-setup-hostinger-vps)
2. [Coolify Installation & Configuration](#2-coolify-installation--configuration)
3. [Jenkins Installation & Management](#3-jenkins-installation--management)
4. [Jenkins Pipeline Scripts](#4-jenkins-pipeline-scripts)
5. [Environment Configuration](#5-environment-configuration)
6. [Docker Containerization](#6-docker-containerization)
7. [Database & Edge Functions Management](#7-database--edge-functions-management)
8. [SSL & Domain Configuration](#8-ssl--domain-configuration)
9. [Monitoring & Logging](#9-monitoring--logging)
10. [Backup & Disaster Recovery](#10-backup--disaster-recovery)
11. [Security Hardening](#11-security-hardening)
12. [Git Branching Strategy](#12-git-branching-strategy)
13. [Automated Testing](#13-automated-testing)
14. [Rollback & Versioning](#14-rollback--versioning)
15. [Performance Optimization](#15-performance-optimization)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Infrastructure Setup (Hostinger VPS)

### Prerequisites
*   **Hostinger VPS**: KVM 2 or higher recommended (4GB+ RAM, 2 vCPU).
*   **Operating System**: Ubuntu 22.04 LTS or 24.04 LTS.
*   **Domain Name**: Managed via Cloudflare (recommended) or Hostinger DNS.

### Step-by-Step VPS Configuration
1.  **Access VPS via SSH**:
    ```bash
    ssh root@<your-vps-ip>
    ```

2.  **Update System Packages**:
    ```bash
    apt update && apt upgrade -y
    ```

3.  **Create a Deploy User (Optional but Recommended)**:
    ```bash
    adduser deploy
    usermod -aG sudo deploy
    # Setup SSH keys for passwordless login
    mkdir -p /home/deploy/.ssh
    cp /root/.ssh/authorized_keys /home/deploy/.ssh/
    chown -R deploy:deploy /home/deploy/.ssh
    chmod 700 /home/deploy/.ssh
    chmod 600 /home/deploy/.ssh/authorized_keys
    ```

4.  **Configure Firewall (UFW)**:
    Open ports for SSH, HTTP, HTTPS, and Coolify's dashboard.
    ```bash
    ufw allow OpenSSH
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 8000/tcp # Coolify Dashboard
    ufw enable
    ```

---

## 2. Coolify Installation & Configuration

Coolify acts as a self-hosted PaaS (like Vercel/Heroku) to manage your Docker containers and deployments.

### Installation
Run the official installation script on your VPS:
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```
*   Wait for the installation to complete (5-10 minutes).
*   Access the dashboard at `http://<your-vps-ip>:8000`.

### Configuration
1.  **Sign Up**: Create the first admin user.
2.  **Source Control**: Connect your GitHub/GitLab account to allow Coolify to pull code.
3.  **Destinations**: The "Local Docker" destination is created by default. This is where apps will run.

---

## 3. Jenkins Installation & Management

We will run Jenkins as a Docker container managed by Coolify. This provides isolation and easy updates.

### Method A: One-Click Installation via Coolify (Recommended)
1.  Login to Coolify.
2.  Go to **Services** > **Add New Service**.
3.  Search for **Jenkins** in the service library.
4.  Click **Continue**.
5.  **Configuration**:
    *   **Name**: Jenkins
    *   **Destination**: Local Docker
6.  **Network Settings**:
    *   Click on the Jenkins service card.
    *   **Port Mapping**: Coolify defaults to exposing `8080`.
    *   **Domains**: Set your domain (e.g., `https://jenkins.yourdomain.com`).
    *   Coolify automatically handles the Nginx Reverse Proxy and SSL.
7.  **Storage**:
    *   Verify a persistent volume is mounted to `/var/jenkins_home`. This ensures your jobs and plugins survive restarts.
8.  **Deploy**: Click **Deploy** at the top right.

### Method B: Manual Docker Installation (If customized control is needed)
If you prefer not to use Coolify's template, you can run Jenkins manually on the VPS, but using Coolify is simpler.
```bash
# Create volume
docker volume create jenkins_home

# Run Jenkins (DIND - Docker in Docker support)
docker run -d \
  --name jenkins \
  --restart always \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkins/jenkins:lts-jdk17
```

### Initial Jenkins Configuration
1.  **Unlock Jenkins**:
    *   In Coolify, go to the Jenkins service > **Logs**.
    *   Find the line: `Please use the following password to proceed to installation:`
    *   Copy the alphanumeric password.
    *   Go to `https://jenkins.yourdomain.com` and paste the password.
2.  **Install Plugins**:
    *   Choose **"Install suggested plugins"**.
    *   Wait for installation to complete.
3.  **Create Admin User**:
    *   Set up your username and secure password.

### Jenkins Management Operations

#### 1. Plugin Management
To support our Node.js and Docker workflow, we need specific plugins.
*   Go to **Manage Jenkins** > **Plugins** > **Available Plugins**.
*   Search for and install:
    *   **NodeJS Plugin**: Essential for building the React app.
    *   **Docker Pipeline**: Allows running docker commands inside pipeline.
    *   **Generic Webhook Trigger**: To trigger builds from GitHub.
    *   **Pipeline: Stage View**: For better visualization.
*   Click **Install without restart**.

#### 2. Tool Configuration (Node.js)
*   Go to **Manage Jenkins** > **Tools**.
*   Scroll to **NodeJS**.
*   Click **Add NodeJS**.
*   **Name**: `node-20` (Reference this name in your Jenkinsfile).
*   **Version**: Select NodeJS 20.x from the dropdown.
*   **Global npm packages**: `typescript supabase` (optional, can be installed locally).
*   Click **Save**.

#### 3. Credential Management
Securely store secrets like Supabase keys.
*   Go to **Manage Jenkins** > **Credentials** > **System** > **Global credentials (unrestricted)**.
*   **Add Credentials**:
    *   **Kind**: Secret text.
    *   **Scope**: Global.
    *   **Secret**: `<your-supabase-access-token>` (Get this from Supabase Dashboard > Account > Access Tokens).
    *   **ID**: `supabase-access-token` (This ID is used in Jenkinsfile).
*   Repeat for other secrets if needed (e.g., `OPENAI_API_KEY`).

#### 4. Creating the Pipeline Job
*   Go to **Dashboard** > **New Item**.
*   Enter name: `LogicNexus-Pipeline`.
*   Select **Pipeline** (Multibranch Pipeline is better if supporting multiple branches dynamically).
*   Click **OK**.
*   **Pipeline Definition**:
    *   Select **Pipeline script from SCM**.
    *   **SCM**: Git.
    *   **Repository URL**: `https://github.com/your-org/logic-nexus-ai.git`.
    *   **Credentials**: Add your GitHub username/token if repo is private.
    *   **Branch Specifier**: `*/main` (or leave empty for Multibranch).
    *   **Script Path**: `Jenkinsfile`.
*   Click **Save**.

---

## 4. Jenkins Pipeline Scripts

This section contains the actual code required to run your DevOps pipeline.

### A. The Jenkinsfile
Create a file named `Jenkinsfile` in the root of your repository.

```groovy
pipeline {
    agent any
    
    // Define tools configured in Jenkins > Manage Jenkins > Tools
    tools {
        nodejs 'node-20'
    }
    
    environment {
        // Retrieve secrets from Jenkins Credentials
        SUPABASE_ACCESS_TOKEN = credentials('supabase-access-token')
        
        // Define environment-specific variables based on branch
        // Logic: If branch is main -> Prod, staging -> Staging, else -> Dev
        PROJECT_REF = "${env.BRANCH_NAME == 'main' ? 'prod-ref-id' : (env.BRANCH_NAME == 'staging' ? 'staging-ref-id' : 'dev-ref-id')}"
        
        // Coolify Webhook URLs (Trigger deployment on Coolify side after CI passes)
        COOLIFY_WEBHOOK = "${env.BRANCH_NAME == 'main' ? 'https://coolify.api/webhooks/prod' : (env.BRANCH_NAME == 'staging' ? 'https://coolify.api/webhooks/staging' : 'https://coolify.api/webhooks/dev')}"
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }
        
        stage('Code Quality Checks') {
            parallel {
                stage('Lint') {
                    steps {
                        sh 'npm run lint'
                    }
                }
                stage('Type Check') {
                    steps {
                        sh 'npm run typecheck'
                    }
                }
            }
        }
        
        stage('Unit Tests') {
            steps {
                // Run tests using Vitest
                sh 'npm run test'
            }
        }
        
        stage('Deploy Edge Functions') {
            steps {
                script {
                    // Only deploy if tests pass
                    echo "Deploying Supabase Edge Functions to ${env.BRANCH_NAME} environment..."
                    sh "chmod +x ./scripts/deploy_functions_ci.sh"
                    sh "./scripts/deploy_functions_ci.sh ${PROJECT_REF} ${SUPABASE_ACCESS_TOKEN}"
                }
            }
        }
        
        stage('Trigger App Deployment') {
            steps {
                script {
                    echo "Triggering Coolify Deployment..."
                    // Webhook tells Coolify to pull the latest image/code and redeploy the frontend container
                    sh "curl -X POST ${COOLIFY_WEBHOOK} -H 'Authorization: Bearer ${COOLIFY_TOKEN}'"
                }
            }
        }
    }
    
    post {
        always {
            // Clean up workspace to save disk space
            cleanWs()
        }
        success {
            echo 'Pipeline Succeeded!'
        }
        failure {
            echo 'Pipeline Failed!'
        }
    }
}
```

### B. Helper Script: `deploy_functions_ci.sh`
Create this script in `scripts/deploy_functions_ci.sh` and ensure it is executable (`chmod +x`).

```bash
#!/bin/bash
# Usage: ./deploy_functions_ci.sh <project_ref> <access_token>

PROJECT_REF=$1
ACCESS_TOKEN=$2

if [ -z "$PROJECT_REF" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo "Error: Missing arguments."
  echo "Usage: ./deploy_functions_ci.sh <project_ref> <access_token>"
  exit 1
fi

echo "Linking to Supabase project: $PROJECT_REF"
# Link project non-interactively
npx supabase link --project-ref "$PROJECT_REF" --password "$ACCESS_TOKEN"

echo "Deploying Edge Functions..."
# Deploy all functions without verifying JWT (assuming functions handle auth internally)
npx supabase functions deploy --project-ref "$PROJECT_REF" --password "$ACCESS_TOKEN" --no-verify-jwt

echo "Deployment Complete."
```

---

## 5. Environment Configuration

We will support 3 environments. Create 3 separate Projects in **Coolify** and 3 separate Projects in **Supabase**.

| Environment | Branch | URL | Supabase Project |
| :--- | :--- | :--- | :--- |
| **Development** | `dev` | `dev.app.com` | `logic-nexus-dev` |
| **Staging** | `staging` | `staging.app.com` | `logic-nexus-staging` |
| **Production** | `main` | `app.com` | `logic-nexus-prod` |

### Supabase Setup
For each environment (Dev, Staging, Prod):
1.  Create a new Supabase project.
2.  Retrieve `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
3.  Retrieve `PROJECT_REF` (e.g., `gzhxgoigflftharcmdqj`).

### Coolify Application Setup
For each environment:
1.  **New Resource** > **Application (Public Repository)**.
2.  **Repo URL**: `https://github.com/your-org/logic-nexus-ai`.
3.  **Branch**: Select corresponding branch (`dev`, `staging`, or `main`).
4.  **Build Pack**: **Docker** (using the repository's `Dockerfile`).
5.  **Environment Variables**:
    *   `VITE_SUPABASE_URL`: (From Supabase)
    *   `VITE_SUPABASE_ANON_KEY`: (From Supabase)
    *   `VITE_OPENAI_API_KEY`: (If using client-side fallback)
6.  **Domains**: Set the custom domain (e.g., `dev.app.com`).
7.  **Webhooks**: Go to **Webhooks** settings in the Coolify app > copy the "Deploy" webhook URL. Add this to your Jenkinsfile `COOLIFY_WEBHOOK` variable.

---

## 6. Docker Containerization

The application uses a multi-stage Docker build to optimize image size.

**File:** `Dockerfile` (already present in repo)
```dockerfile
# Stage 1: Build
FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Environment variables must be passed as build args or available at build time
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Note**: Since Vite bakes environment variables into the static bundle at **build time**, you must configure Coolify to pass these variables during the build phase.

---

## 7. Database & Edge Functions Management

Supabase manages the PostgreSQL database, but we must sync schema and functions via CI/CD.

### Supabase CLI in CI/CD
The Jenkins pipeline handles this via the `deploy_functions_ci.sh` script shown above.

---

## 8. SSL & Domain Configuration

### Coolify
Coolify automatically manages SSL certificates using Let's Encrypt.
1.  In your Application settings, set the **Domains** field (e.g., `https://app.com`).
2.  Ensure your DNS (Cloudflare/Namecheap) points an **A Record** for `@` and `www` (or subdomains) to your VPS IP.
3.  **Proxy**: Ensure Cloudflare proxy (orange cloud) is **ON** (for DDoS protection) or **OFF** (for simple Let's Encrypt setup). Coolify works best with "Full (Strict)" SSL mode in Cloudflare if proxy is ON.

---

## 9. Monitoring & Logging

### Application Logs
*   **Coolify**: Click on the application > **Logs** tab to see Nginx access/error logs.
*   **Supabase**: View Edge Function logs and Database logs in the Supabase Dashboard.

### Infrastructure Monitoring
1.  **Uptime Kuma**: Deploy via Coolify (Service > Uptime Kuma).
    *   Monitor `https://app.com`, `https://dev.app.com`.
    *   Set up alerts (Email/Telegram) for downtime.
2.  **Glances**: Install on VPS (`apt install glances`) for real-time resource monitoring (CPU/RAM).

---

## 10. Backup & Disaster Recovery

### Database (Supabase)
*   **Point-in-Time Recovery (PITR)**: Enable in Supabase Pro plan.
*   **Scheduled Dumps**: Use a GitHub Action or Cron job to run `supabase db dump` and save to S3/Storage.

### Application Config (Coolify)
*   **Coolify Backup**: Configure in Settings > Backup to save Coolify's database (configuration) to an S3-compatible bucket (AWS, MinIO, or Hostinger Object Storage).

### Recovery Procedure
1.  **VPS Failure**: Re-provision VPS -> Install Coolify -> Restore Coolify Backup -> Coolify redeploys all apps.
2.  **Data Loss**: Restore Supabase PITR or import latest SQL dump.

---

## 11. Security Hardening

1.  **SSH**: Disable password authentication (`PasswordAuthentication no` in `/etc/ssh/sshd_config`). Use Keys only.
2.  **Firewall**: Only allow necessary ports (80, 443, 22).
3.  **Coolify**: Enable 2FA for the admin account.
4.  **Supabase**: Enable Row Level Security (RLS) on ALL tables.

---

## 12. Git Branching Strategy

We follow a standard **Git Flow** variant:

*   **`main`**: Production-ready code. Deploys to `app.com`. Protected branch (requires PR review).
*   **`staging`**: Pre-production testing. Deploys to `staging.app.com`. PRs from `dev` go here first.
*   **`dev`**: Active development. Deploys to `dev.app.com`.
*   **`feature/*`**: Short-lived feature branches.

---

## 13. Automated Testing

Integrated into the Jenkins Pipeline.

**Tests to Run**:
1.  **Linting**: `npm run lint`
2.  **Type Check**: `npm run typecheck`
3.  **Unit/Component Tests**: `npm run test` (Vitest)
4.  **E2E Tests**: `npx playwright test` (Run against the Staging URL).

---

## 14. Rollback & Versioning

### Application Rollback (Coolify)
1.  Go to Application > **Deployments**.
2.  Find a previous successful deployment.
3.  Click **Rollback** (Redeploys the previous Docker image).

### Database Rollback
*   Manual SQL migration required to revert schema changes.
*   `supabase db reset` (Dev only).

---

## 15. Performance Optimization

1.  **Nginx Gzip/Brotli**: Configured in `nginx.conf`.
2.  **Caching**:
    *   Static assets (`/assets`) cached for 1 year (`Cache-Control: public, max-age=31536000, immutable`).
3.  **Docker Layer Caching**:
    *   The `Dockerfile` copies `package.json` first to cache `npm ci` step.

---

## 16. Troubleshooting

**Issue: Deployment fails at Build Step**
*   **Check**: Memory usage on VPS (`htop`). Node builds are RAM hungry.
*   **Fix**: Enable Swap on VPS.
    ```bash
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
    ```

**Issue: "502 Bad Gateway"**
*   **Check**: Is the container running? (`docker ps`).
*   **Check**: Logs (`docker logs <container_id>`).
*   **Fix**: Ensure Nginx is listening on port 80 inside the container.

**Issue: CORS Errors**
*   **Fix**: Check Supabase Edge Function `cors.ts` headers. Ensure `OPTIONS` requests are handled.
