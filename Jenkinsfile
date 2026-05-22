pipeline {
    agent any
    parameters {
        string(name: 'DEPLOY_BRANCH', defaultValue: 'main', description: 'Git branch to checkout and deploy')
        string(name: 'GIT_CREDENTIALS_ID', defaultValue: 'logic-nexus-git', description: 'Jenkins credentialsId for GitHub access (PAT or app credential)')
        booleanParam(name: 'ENABLE_COOLIFY_TRIGGER', defaultValue: false, description: 'Trigger Coolify webhook after VPS deploy (can overwrite VPS container config)')
        booleanParam(name: 'ENABLE_ANDROID_RELEASE', defaultValue: false, description: 'Build a signed Android Release AAB (requires JDK 17 + Android SDK + Jenkins credentials android-keystore-file / android-keystore-password / android-key-alias / android-key-password)')
        string(name: 'AMRO_API_UPSTREAM', defaultValue: 'host.docker.internal:8031', description: 'AMRO API upstream for logicpro-web container')
        choice(name: 'DB_TARGET', choices: ['auto', 'local', 'cloud'], description: 'Select Supabase instance for build')
        string(name: 'SUPABASE_URL_OVERRIDE', defaultValue: 'https://gzhxgoigflftharcmdqj.supabase.co', description: 'Optional: override Supabase URL')
        string(name: 'SUPABASE_ANON_KEY_OVERRIDE', defaultValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aHhnb2lnZmxmdGhhcmNtZHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MTk2ODcsImV4cCI6MjA4NTA5NTY4N30.6xIZ3VYubUZ73pNPurzYuf-2RUpXj_9w-LpU-6d6kqU', description: 'Optional: override Supabase anon key')
        string(name: 'SUPABASE_SERVICE_ROLE_KEY_OVERRIDE', defaultValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aHhnb2lnZmxmdGhhcmNtZHFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUxOTY4NywiZXhwIjoyMDg1MDk1Njg3fQ.MImJoQhZUG2lSQ9PpN0z1QwDI1nvA2AsYPOeVfDGMos', description: 'Optional: override Supabase service role key')
        string(name: 'PROJECT_REF_OVERRIDE', defaultValue: '', description: 'Optional: override Supabase project ref for cloud deployments')
    }
    options {
        timestamps()
        skipDefaultCheckout(true)
    }
    
    environment {
        // Credentials binding for Supabase
        SUPABASE_ACCESS_TOKEN = credentials('supabase-access-token')
        SUPABASE_ANON_KEY = credentials('supabase-anon-key')
        SUPABASE_SERVICE_ROLE_KEY = ''
        
        // VPS Credentials for Deployment
        VPS_PASSWORD = credentials('vps-root-password')
        VPS_IP = '72.61.249.111'
        VPS_USER = 'root'

        // Ports
        GATEWAY_PORT = '8100'
        APP_PORT = '8099'

        // Define Coolify Webhook based on branch
        COOLIFY_WEBHOOK = "${env.BRANCH_NAME == 'main' ? 'http://72.61.249.111:8000/webhooks/prod' : (env.BRANCH_NAME == 'staging' ? 'http://72.61.249.111:8000/webhooks/staging' : 'http://72.61.249.111:8000/webhooks/dev')}"
        
        // Coolify Token
        COOLIFY_TOKEN = credentials('coolify-token')
    }
    
    stages {
        stage('Checkout') {
            steps {
                script {
                    def targetBranch = 'main'
                    def remoteConfig = [url: 'https://github.com/vageesha-vaishya/logic-nexus-ai.git', credentialsId: 'logic-nexus-git']
                    def credentialsId = (params.GIT_CREDENTIALS_ID ?: '').trim()
                    if (credentialsId) {
                        remoteConfig.credentialsId = credentialsId
                    }
                    checkout([
                        $class: 'GitSCM',
                        branches: [[name: "*/${targetBranch}"]],
                        userRemoteConfigs: [remoteConfig]
                    ])
                    env.BRANCH_NAME = targetBranch
                    echo "Checked out branch: ${targetBranch}"
                }
                echo "Workspace: ${env.WORKSPACE}"
                sh 'pwd'
                sh 'ls -la'
            }
        }

        stage('Setup Node') {
            steps {
                script {
                    env.NODE_VERSION = '22.22.1'
                    def nodeDist = 'linux-x64'
                    def nodeRoot = "${env.WORKSPACE}/.jenkins/node-v${env.NODE_VERSION}-${nodeDist}"
                    // Shell-scoped vars (\$NODE_TGZ / \$NODE_URL) must be backslash-escaped:
                    // sh """ … """ uses Groovy GString interpolation, so any bare \$VAR
                    // is resolved as a Groovy property and crashes the pipeline with
                    // MissingPropertyException before the shell ever runs.
                    sh """
set -euo pipefail
mkdir -p "${env.WORKSPACE}/.jenkins"
if [ ! -x "${nodeRoot}/bin/node" ]; then
  NODE_TGZ="${env.WORKSPACE}/.jenkins/node-v${env.NODE_VERSION}-${nodeDist}.tar.gz"
  NODE_URL="https://nodejs.org/dist/v${env.NODE_VERSION}/node-v${env.NODE_VERSION}-${nodeDist}.tar.gz"
  rm -f "\$NODE_TGZ"
  if command -v curl >/dev/null 2>&1; then
    curl -fL --retry 5 --retry-all-errors --connect-timeout 10 --max-time 300 -o "\$NODE_TGZ" "\$NODE_URL"
  elif command -v wget >/dev/null 2>&1; then
    wget -O "\$NODE_TGZ" "\$NODE_URL"
  else
    echo "Neither curl nor wget is available on this Jenkins agent."
    exit 2
  fi
  tar -xzf "\$NODE_TGZ" -C "${env.WORKSPACE}/.jenkins"
fi
"${nodeRoot}/bin/node" -v
"${nodeRoot}/bin/npm" -v
"""
                    env.PATH = "${nodeRoot}/bin:${env.PATH}"
                }
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
        
        stage('Determine Supabase Environment') {
            steps {
                script {
                    def envFile = fileExists('.env') ? readFile(file: '.env') : ''
                    def sanitizeValue = { raw ->
                        if (!raw) return ''
                        def cleaned = raw.toString().trim()
                        cleaned = cleaned.replaceAll(/^['"`]+|['"`]+$/, '')
                        return cleaned.trim()
                    }
                    echo "sanitizeValue value: ${sanitizeValue}"
                    def parseEnv = { key ->
                        if (!envFile) return ''
                        def m = (envFile =~ /(?m)^${key}=(.*)$/)
                        if (!m) return ''
                        return sanitizeValue(m[0][1])
                    }
                    echo "parseEnv value: ${parseEnv}"
                    def envSupabaseUrl = sanitizeValue(params.SUPABASE_URL_OVERRIDE ? params.SUPABASE_URL_OVERRIDE : parseEnv('VITE_SUPABASE_URL'))
                    def envAnonKey = sanitizeValue(params.SUPABASE_ANON_KEY_OVERRIDE ? params.SUPABASE_ANON_KEY_OVERRIDE : (parseEnv('VITE_SUPABASE_PUBLISHABLE_KEY') ?: parseEnv('VITE_SUPABASE_ANON_KEY')))
                    def envServiceKey = sanitizeValue(params.SUPABASE_SERVICE_ROLE_KEY_OVERRIDE ? params.SUPABASE_SERVICE_ROLE_KEY_OVERRIDE : parseEnv('SUPABASE_SERVICE_ROLE_KEY'))
                    echo "envSupabaseUrl: ${envSupabaseUrl}"
                    echo "envAnonKey: ${envAnonKey}"
                    echo "envServiceKey: ${envServiceKey}"

                    def selectedTarget = params.DB_TARGET
                    if (selectedTarget == 'auto') {
                        if (envSupabaseUrl && envSupabaseUrl.contains('supabase.co')) {
                            selectedTarget = 'cloud'
                        } else {
                            selectedTarget = 'local'
                        }
                    }

                    if (selectedTarget == 'local') {
                        env.SELECTED_SUPABASE_URL = "http://${env.VPS_IP}:${env.GATEWAY_PORT}"
                        env.SELECTED_ANON_KEY = env.SUPABASE_ANON_KEY
                        env.SELECTED_SERVICE_ROLE_KEY = envServiceKey ?: ''
                        env.SELECTED_PROJECT_REF = ''
                    } else {
                        env.SELECTED_SUPABASE_URL = envSupabaseUrl
                        env.SELECTED_ANON_KEY = envAnonKey
                        env.SELECTED_SERVICE_ROLE_KEY = envServiceKey ?: ''
                        def projectRefOverride = sanitizeValue(params.PROJECT_REF_OVERRIDE)
                        if (projectRefOverride) {
                            env.SELECTED_PROJECT_REF = projectRefOverride
                        } else {
                            def matcher = (env.SELECTED_SUPABASE_URL =~ /^https?:\/\/([^.]+)\.supabase\.co(?:\/|$)/)
                            env.SELECTED_PROJECT_REF = matcher ? matcher[0][1] : ''
                        }
                    }

                    if (selectedTarget == 'cloud' && !sanitizeValue(env.TEST_BYPASS_KEY)) {
                        env.TEST_BYPASS_KEY = "jenkins-${env.JOB_BASE_NAME ?: 'job'}-${env.BUILD_NUMBER}-${java.util.UUID.randomUUID().toString().replace('-', '')}"
                    }

                    def mask = { v -> v ? (v.length() > 8 ? v.substring(0,8)+'…' : v) : '(empty)' }
                    echo "DB Target: ${selectedTarget}"
                    echo "Supabase URL: ${env.SELECTED_SUPABASE_URL}"
                    echo "Anon Key: ${mask(env.SELECTED_ANON_KEY)}"
                    echo "Service Role Key: ${mask(env.SELECTED_SERVICE_ROLE_KEY)}"
                    echo "Project Ref: ${env.SELECTED_PROJECT_REF ?: '(n/a-local)'}"

                    if (!env.SELECTED_SUPABASE_URL || !env.SELECTED_ANON_KEY) {
                        error("Supabase configuration incomplete: URL or anon key missing")
                    }
                    if (selectedTarget == 'cloud') {
                        if (!env.SELECTED_PROJECT_REF) {
                            error("Supabase cloud configuration incomplete: project ref missing or could not be inferred from URL")
                        }
                        if (!env.SELECTED_SERVICE_ROLE_KEY) {
                            error("Supabase cloud configuration incomplete: service role key missing")
                        }
                    }
                }
            }
        }

        stage('Validate Supabase Connectivity') {
            steps {
                script {
                    def isLocal = env.SELECTED_SUPABASE_URL?.startsWith("http://${env.VPS_IP}")
                    try {
                        if (isLocal) {
                            sh 'npm install --no-save ssh2'
                            withEnv([
                                "VPS_IP=${env.VPS_IP}",
                                "VPS_PASSWORD=${env.VPS_PASSWORD}",
                                "CHECK_URL=${env.SELECTED_SUPABASE_URL}",
                                "ANON=${env.SELECTED_ANON_KEY}"
                            ]) {
                                sh '''
node -e "
const {Client}=require('ssh2');
const conn=new Client();
conn.on('ready',()=>{conn.exec(`curl -sI ${process.env.CHECK_URL}/rest/v1/ -H \\\"apikey: ${process.env.ANON}\\\" -m 8 || exit 2`,(e,s)=>{if(e){console.error(e);process.exit(2);}let out='';s.on('data',d=>out+=d.toString());s.on('close',c=>{console.log(out);process.exit(c)});});}).connect({host:process.env.VPS_IP,username:'root',password:process.env.VPS_PASSWORD});
"
'''
                            }
                        } else {
                            sh """
curl -sI ${env.SELECTED_SUPABASE_URL}/rest/v1/ -H "apikey: ${env.SELECTED_ANON_KEY}" -m 8 | grep -E "HTTP/1.1 200|HTTP/2 200|HTTP/1.1 401|HTTP/2 401"
"""
                        }
                        echo "Connectivity to ${env.SELECTED_SUPABASE_URL} confirmed"
                    } catch (err) {
                        error("Supabase connectivity validation failed: ${err}")
                    }
                }
            }
        }
        /* sarvesh temporry disabled unit tests
        stage('Unit Tests') {
            steps {
                script {
                    echo "Running unit tests (Vitest CI mode with bail and timeout)..."
                    timeout(time: 10, unit: 'MINUTES') {
                        sh 'npm run test:ci'
                    }
                }
            }
        }
        
      
        stage('Deploy Edge Functions') {
            steps {
                script {
                    def isCloud = env.SELECTED_SUPABASE_URL && env.SELECTED_SUPABASE_URL.contains('supabase.co')
                    if (isCloud) {
                        echo "Deploying Supabase Edge Functions to Cloud project: ${env.SELECTED_PROJECT_REF}"
                        sh 'npm install --no-save supabase'
                        sh 'chmod +x ./deploy_edge_functions.sh'
                        withEnv([
                            "SUPABASE_ACCESS_TOKEN=${env.SUPABASE_ACCESS_TOKEN}",
                            "PROJECT_REF=${env.SELECTED_PROJECT_REF}"
                        ]) {
                            sh './deploy_edge_functions.sh'
                        }
                    } else {
                        echo "Deploying Supabase Edge Functions to VPS (Self-Hosted)..."
                        sh 'npm install --no-save ssh2'
                        catchError(buildResult: "SUCCESS", stageResult: "FAILURE") {
                            withEnv(["VPS_USER=${env.VPS_USER}"]) {
                                sh "node scripts/deploy_vps.cjs"
                            }
                        }
                    }
                }
            }
        }
        */
        stage('Sync Edge Function Secrets') {
            when {
                expression { return env.SELECTED_SUPABASE_URL && env.SELECTED_SUPABASE_URL.contains('supabase.co') }
            }
            steps {
                script {
                    sh 'npm install --no-save supabase'
                    withEnv([
                        "SUPABASE_ACCESS_TOKEN=${env.SUPABASE_ACCESS_TOKEN}",
                        "TARGET_PROJECT_REF=${env.SELECTED_PROJECT_REF}",
                        "EDGE_TEST_BYPASS_KEY=${env.TEST_BYPASS_KEY ?: ''}"
                    ]) {
                        sh '''
set -e
SUPABASE_CLI="./node_modules/.bin/supabase"
if [ ! -x "$SUPABASE_CLI" ]; then
  echo "Supabase CLI binary not found at $SUPABASE_CLI"
  exit 1
fi
if [ -z "$TARGET_PROJECT_REF" ]; then
  echo "Missing project ref for edge secret sync"
  exit 1
fi
trap 'rm -f .supabase-edge.env' EXIT
> .supabase-edge.env
# Only set non-reserved keys. Example: TEST_BYPASS_KEY used by functions for controlled bypass in tests.
if [ -n "$EDGE_TEST_BYPASS_KEY" ]; then
  echo "TEST_BYPASS_KEY=$EDGE_TEST_BYPASS_KEY" >> .supabase-edge.env
fi
LINES=$(wc -l < .supabase-edge.env | tr -d ' ')
if [ "$LINES" = "0" ]; then
  echo "No non-reserved Edge Function secrets to set. Skipping."
  exit 0
fi
"$SUPABASE_CLI" secrets set --project-ref "$TARGET_PROJECT_REF" --env-file .supabase-edge.env
'''
                    }
                }
            }
        }

        stage('Verify Edge Function Secrets') {
            when {
                expression { return env.SELECTED_SUPABASE_URL && env.SELECTED_SUPABASE_URL.contains('supabase.co') }
            }
            steps {
                script {
                    sh 'npm install --no-save supabase'
                    withEnv([
                        "SUPABASE_ACCESS_TOKEN=${env.SUPABASE_ACCESS_TOKEN}",
                        "PROJECT_REF=${env.SELECTED_PROJECT_REF}"
                    ]) {
                        sh '''
set -e
SUPABASE_CLI="./node_modules/.bin/supabase"
if [ ! -x "$SUPABASE_CLI" ]; then
  echo "Supabase CLI binary not found at $SUPABASE_CLI"
  exit 1
fi
if [ -z "$PROJECT_REF" ]; then
  echo "Missing project ref while verifying edge secrets"
  exit 1
fi
SECRETS="$("$SUPABASE_CLI" secrets list --project-ref "$PROJECT_REF" || true)"
echo "$SECRETS"
# Verify presence of non-reserved keys only
for REQUIRED in TEST_BYPASS_KEY; do
  echo "$SECRETS" | grep -q "$REQUIRED" || { echo "Missing expected Edge Function secret: $REQUIRED"; exit 1; }
done
'''
                    }
                }
            }
        }

        stage('Deploy Changed Edge Functions') {
            steps {
                script {
                    // Diffs HEAD~1..HEAD against supabase/functions/ and
                    // deploys only what changed. _shared/ changes trigger
                    // a full redeploy. First build (no HEAD~1) is a no-op.
                    withEnv([
                        "PROJECT_REF=${env.SELECTED_PROJECT_REF}",
                        "SUPABASE_ACCESS_TOKEN=${env.SUPABASE_ACCESS_TOKEN}"
                    ]) {
                        timeout(time: 15, unit: 'MINUTES') {
                            sh 'bash scripts/deploy_changed_edge_functions.sh'
                        }
                    }
                }
            }
        }

        stage('PDF Auth Smoke Test') {
            steps {
                script {
                    withEnv([
                        "PDF_BASE_URL=${env.SELECTED_SUPABASE_URL}",
                        "PDF_ANON_KEY=${env.SELECTED_ANON_KEY}",
                        "PDF_SERVICE_ROLE_KEY=${env.SELECTED_SERVICE_ROLE_KEY}",
                        "PDF_BYPASS_KEY=${env.TEST_BYPASS_KEY ?: ''}"
                    ]) {
                        sh '''
set -e
if [ -z "$PDF_BASE_URL" ] || [ -z "$PDF_ANON_KEY" ]; then
  echo "Missing PDF base URL or anon key for smoke test"
  exit 1
fi
if [ -z "$PDF_BYPASS_KEY" ] && [ -z "$PDF_SERVICE_ROLE_KEY" ]; then
  echo "Missing both PDF_BYPASS_KEY and PDF_SERVICE_ROLE_KEY for smoke test"
  exit 1
fi

set +x
if [ -n "$PDF_BYPASS_KEY" ]; then
  HTTP_CODE=$(curl -sS -o /tmp/pdf_auth_smoke.json -w "%{http_code}" \
    "$PDF_BASE_URL/functions/v1/generate-quote-pdf" \
    -H "Content-Type: application/json" \
    -H "apikey: $PDF_ANON_KEY" \
    -H "x-bypass-key: $PDF_BYPASS_KEY" \
    -d '{"engine_v2":true,"source":"jenkins-auth-smoke","action":"auth-smoke"}')
else
  HTTP_CODE=$(curl -sS -o /tmp/pdf_auth_smoke.json -w "%{http_code}" \
    "$PDF_BASE_URL/functions/v1/generate-quote-pdf" \
    -H "Content-Type: application/json" \
    -H "apikey: $PDF_ANON_KEY" \
    -H "Authorization: Bearer $PDF_SERVICE_ROLE_KEY" \
    -d '{"engine_v2":true,"source":"jenkins-auth-smoke","action":"auth-smoke"}')
fi
set -x
echo "PDF auth smoke status: $HTTP_CODE"
cat /tmp/pdf_auth_smoke.json || true
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo "PDF auth smoke failed: unauthorized"
  exit 1
fi
'''
                    }
                }
            }
        }

        stage('Setup Supabase Gateway') {
            steps {
                script {
                    echo "Setting up Supabase gateway reverse proxy on VPS..."
                    sh 'npm install --no-save ssh2'
                    timeout(time: 20, unit: 'MINUTES') {
                        echo "Gateway Port: ${env.GATEWAY_PORT}, VPS: ${env.VPS_IP}"
                        sh 'node scripts/setup_supabase_gateway_vps.cjs'
                    }
                }
            }
        }

        stage('Deploy LogicPro Web to VPS') {
            steps {
                script {
                    echo "Building and running LogicPro web on VPS..."
                    timeout(time: 15, unit: 'MINUTES') {
                        sh 'npm install --no-save ssh2'
                        withEnv([
                            "SUPABASE_URL=${env.SELECTED_SUPABASE_URL}",
                            "SUPABASE_ANON_KEY=${env.SELECTED_ANON_KEY}",
                            "VITE_SUPABASE_URL=${env.SELECTED_SUPABASE_URL}",
                            "VITE_SUPABASE_ANON_KEY=${env.SELECTED_ANON_KEY}",
                            "VITE_SUPABASE_PUBLISHABLE_KEY=${env.SELECTED_ANON_KEY}",
                            "VITE_MARKETS_WORKER_URL=/api/markets",
                            "MARKETS_API_UPSTREAM=host.docker.internal:8001",
                            "AMRO_API_UPSTREAM=${params.AMRO_API_UPSTREAM ?: 'host.docker.internal:8031'}",
                            "DEPLOY_BRANCH=main"
                        ]) {
                            echo "App Port: ${env.APP_PORT}, Using Supabase: ${env.SELECTED_SUPABASE_URL}"
                            sh 'node scripts/deploy_web_app_vps.cjs'
                        }
                    }
                }
            }
        }
        stage('Setup TLS (markets.sosservices.online)') {
            steps {
                script {
                    echo "Configuring host nginx + Let's Encrypt cert..."
                    sh 'npm install --no-save ssh2'
                    timeout(time: 10, unit: 'MINUTES') {
                        withEnv([
                            "TLS_DOMAIN=markets.sosservices.online",
                            "TLS_EMAIL=bahuguna.vimal@gmail.com"
                        ]) {
                            sh 'node scripts/setup_tls_vps.cjs'
                        }
                    }
                }
            }
        }

        stage('Deploy Markets Worker to VPS') {
            steps {
                script {
                    echo "Installing/restarting markets-worker (FastAPI) on VPS host..."
                    sh 'npm install --no-save ssh2'
                    // First run is slow because python3.12 needs to be installed
                    // via deadsnakes; subsequent runs are fast (pip install -e is
                    // a no-op when nothing changed).
                    timeout(time: 20, unit: 'MINUTES') {
                        withEnv([
                            "SUPABASE_URL=${env.SELECTED_SUPABASE_URL}",
                            "SUPABASE_SERVICE_ROLE_KEY=${env.SELECTED_SERVICE_ROLE_KEY}",
                            "MARKETS_WORKER_PORT=8001"
                        ]) {
                            sh 'node scripts/deploy_markets_worker_vps.cjs'
                        }
                    }
                }
            }
        }
        stage('Build Android Release') {
            when {
                expression { return params.ENABLE_ANDROID_RELEASE == true }
            }
            steps {
                script {
                    echo "Building signed Android release (T24e)…"
                    // The Jenkins agent needs JDK 17 + Android SDK Platform 34
                    // + Build-Tools 34 installed. We log up front so the
                    // failure mode is obvious if those aren't present.
                    sh '''
set -e
echo "▶ Toolchain summary"
java -version 2>&1 | head -2 || { echo "JDK not on PATH — install JDK 17 on this Jenkins agent"; exit 1; }
echo "ANDROID_HOME=${ANDROID_HOME:-(unset)}"
if [ -z "$ANDROID_HOME" ] || [ ! -d "$ANDROID_HOME" ]; then
  echo "ANDROID_HOME is not set or does not exist — install the Android SDK on this Jenkins agent and export ANDROID_HOME"
  exit 1
fi
'''
                    timeout(time: 30, unit: 'MINUTES') {
                        // Web build + cap sync. Reuses VPS deploy's Supabase
                        // env so the bundled assets point at the same backend.
                        withEnv([
                            "VITE_SUPABASE_URL=${env.SELECTED_SUPABASE_URL}",
                            "VITE_SUPABASE_ANON_KEY=${env.SELECTED_ANON_KEY}",
                            "VITE_SUPABASE_PUBLISHABLE_KEY=${env.SELECTED_ANON_KEY}",
                            "VITE_MARKETS_WORKER_URL=/api/markets",
                        ]) {
                            sh 'npm run mobile:build'
                        }

                        // T23 perf gate — same check that runs on PRs. Catches
                        // bundle regressions before an APK rolls to the Play
                        // Store; thresholds are in perf-budget.json.
                        sh 'npm run bundle:check'

                        // Gradle bundleRelease with credentials injected as
                        // env vars. The Gradle file (android/app/build.gradle)
                        // reads them via resolveProp().
                        withCredentials([
                            file(   credentialsId: 'android-keystore-file',     variable: 'LN_KEYSTORE_PATH'),
                            string( credentialsId: 'android-keystore-password', variable: 'LN_KEYSTORE_PASSWORD'),
                            string( credentialsId: 'android-key-alias',         variable: 'LN_KEY_ALIAS'),
                            string( credentialsId: 'android-key-password',      variable: 'LN_KEY_PASSWORD'),
                        ]) {
                            sh '''
set -e
cd android
chmod +x ./gradlew
./gradlew bundleRelease --no-daemon --console=plain
echo
echo "▶ Built artifacts:"
ls -lh app/build/outputs/bundle/release/ 2>/dev/null || true
ls -lh app/build/outputs/apk/release/    2>/dev/null || true
'''
                        }

                        archiveArtifacts(
                            artifacts: 'android/app/build/outputs/bundle/release/*.aab,android/app/build/outputs/apk/release/*.apk',
                            fingerprint: true,
                            allowEmptyArchive: false,
                        )
                    }
                }
            }
        }

        stage('Validate AMRO Proxy Post Deploy') {
            steps {
                script {
                    echo "Validating AMRO proxy target and health from VPS..."
                    sh 'npm install --no-save ssh2'
                    timeout(time: 2, unit: 'MINUTES') {
                        withEnv([
                            "VPS_IP=${env.VPS_IP}",
                            "VPS_USER=${env.VPS_USER}",
                            "VPS_PASSWORD=${env.VPS_PASSWORD}",
                            "APP_PORT=${env.APP_PORT}"
                        ]) {
                            sh 'node scripts/validate_amro_proxy_vps.cjs'
                        }
                    }
                }
            }
        }
        /* sarvesh temporry disabled unit tests
        stage('Verify Containers') {
            steps {
                script {
                    echo "Verifying supabase-gateway and logicpro-web containers on VPS..."
                    sh 'npm install --no-save ssh2'
                    timeout(time: 5, unit: 'MINUTES') {
                        sh 'node scripts/verify_vps_containers.cjs'
                    }
                }
            }
        }
        
        stage('Verify Supabase Stack') {
            steps {
                script {
                    echo "Verifying Supabase core services on VPS (db, auth, rest, realtime, storage, kong)..."
                    sh 'npm install --no-save ssh2'
                    timeout(time: 5, unit: 'MINUTES') {
                        sh 'node scripts/verify_supabase_stack_vps.cjs'
                    }
                }
            }
        }
        */
        stage('Trigger App Deployment') {
            when {
                expression { return params.ENABLE_COOLIFY_TRIGGER == true }
            }
            steps {
                script {
                    echo "Triggering Coolify Deployment..."
                    // Webhook tells Coolify to pull the latest image/code and redeploy the frontend container
                    // Use single quotes for the command and double quotes for variables to prevent Groovy interpolation of the secret
                    sh 'curl -X POST "$COOLIFY_WEBHOOK" -H "Authorization: Bearer $COOLIFY_TOKEN"'
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
