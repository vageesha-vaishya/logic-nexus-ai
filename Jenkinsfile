pipeline {
    agent any
    parameters {
        choice(name: 'DB_TARGET', choices: ['auto', 'local', 'cloud'], description: 'Select Supabase instance for build')
        string(name: 'SUPABASE_URL_OVERRIDE', defaultValue: '', description: 'Optional: override Supabase URL')
        string(name: 'SUPABASE_ANON_KEY_OVERRIDE', defaultValue: '', description: 'Optional: override Supabase anon key')
        string(name: 'SUPABASE_SERVICE_ROLE_KEY_OVERRIDE', defaultValue: '', description: 'Optional: override Supabase service role key')
        string(name: 'PROJECT_REF_OVERRIDE', defaultValue: '', description: 'Optional: override Supabase project ref for cloud deployments')
    }
    options {
        timestamps()
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
                checkout scm
                echo "Workspace: ${env.WORKSPACE}"
                sh 'pwd'
                sh 'ls -la'
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
                    def parseEnv = { key ->
                        if (!envFile) return ''
                        def m = (envFile =~ /(?m)^${key}=(.*)$/)
                        if (!m) return ''
                        def raw = m[0][1].trim()
                        return raw.replaceAll(/^['"`]|['"`]$/, '')
                    }
                    def envSupabaseUrl = params.SUPABASE_URL_OVERRIDE ? params.SUPABASE_URL_OVERRIDE : parseEnv('VITE_SUPABASE_URL')
                    def envAnonKey = params.SUPABASE_ANON_KEY_OVERRIDE ? params.SUPABASE_ANON_KEY_OVERRIDE : (parseEnv('VITE_SUPABASE_PUBLISHABLE_KEY') ?: parseEnv('VITE_SUPABASE_ANON_KEY'))
                    def envServiceKey = params.SUPABASE_SERVICE_ROLE_KEY_OVERRIDE ? params.SUPABASE_SERVICE_ROLE_KEY_OVERRIDE : parseEnv('SUPABASE_SERVICE_ROLE_KEY')

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
                        def projectRefOverride = params.PROJECT_REF_OVERRIDE?.trim()
                        if (projectRefOverride) {
                            env.SELECTED_PROJECT_REF = projectRefOverride
                        } else {
                            def matcher = (env.SELECTED_SUPABASE_URL =~ /^https?:\/\/([^.]+)\.supabase\.co(?:\/|$)/)
                            env.SELECTED_PROJECT_REF = matcher ? matcher[0][1] : ''
                        }
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
        */
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
                        "TARGET_SUPABASE_URL=${env.SELECTED_SUPABASE_URL}",
                        "TARGET_SUPABASE_ANON_KEY=${env.SELECTED_ANON_KEY}",
                        "TARGET_SUPABASE_SERVICE_ROLE_KEY=${env.SELECTED_SERVICE_ROLE_KEY}"
                    ]) {
                        sh '''
set -e
if [ -z "$TARGET_SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Missing service role key for edge secret sync"
  exit 1
fi
npm exec --yes -- supabase secrets set --project-ref "$TARGET_PROJECT_REF" \
  SUPABASE_URL="$TARGET_SUPABASE_URL" \
  SUPABASE_ANON_KEY="$TARGET_SUPABASE_ANON_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$TARGET_SUPABASE_SERVICE_ROLE_KEY"
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
SECRETS="$(npm exec --yes -- supabase secrets list --project-ref "$PROJECT_REF" || true)"
echo "$SECRETS"
for REQUIRED in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
  echo "$SECRETS" | grep -q "$REQUIRED" || { echo "Missing required Edge Function secret: $REQUIRED"; exit 1; }
done
'''
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
                        "PDF_SERVICE_ROLE_KEY=${env.SELECTED_SERVICE_ROLE_KEY}"
                    ]) {
                        sh '''
set -e
if [ -z "$PDF_SERVICE_ROLE_KEY" ]; then
  echo "Missing PDF service role key for smoke test"
  exit 1
fi
HTTP_CODE=$(curl -sS -o /tmp/pdf_auth_smoke.json -w "%{http_code}" \
  "$PDF_BASE_URL/functions/v1/generate-quote-pdf" \
  -H "Content-Type: application/json" \
  -H "apikey: $PDF_ANON_KEY" \
  -H "Authorization: Bearer $PDF_SERVICE_ROLE_KEY" \
  -d '{"engine_v2":true,"source":"jenkins-auth-smoke","action":"auth-smoke"}')
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
                            "SUPABASE_ANON_KEY=${env.SELECTED_ANON_KEY}"
                        ]) {
                            echo "App Port: ${env.APP_PORT}, Using Supabase: ${env.SELECTED_SUPABASE_URL}"
                            sh 'node scripts/deploy_web_app_vps.cjs'
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
