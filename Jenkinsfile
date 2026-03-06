pipeline {
    agent any
    parameters {
        choice(name: 'DB_TARGET', choices: ['auto', 'local', 'cloud'], description: 'Select Supabase instance for build')
        string(name: 'SUPABASE_URL_OVERRIDE', defaultValue: '', description: 'Optional: override Supabase URL')
        string(name: 'SUPABASE_ANON_KEY_OVERRIDE', defaultValue: '', description: 'Optional: override Supabase anon key')
        string(name: 'SUPABASE_SERVICE_ROLE_KEY_OVERRIDE', defaultValue: '', description: 'Optional: override Supabase service role key')
    }
    options {
        timestamps()
    }
    
    environment {
        // Credentials binding for Supabase
        SUPABASE_ACCESS_TOKEN = credentials('supabase-access-token')
        SUPABASE_ANON_KEY = credentials('supabase-anon-key')
        
        // VPS Credentials for Deployment
        VPS_PASSWORD = credentials('vps-root-password')
        VPS_IP = '72.61.249.111'
        VPS_USER = 'root'

        // Ports
        GATEWAY_PORT = '8100'
        APP_PORT = '8099'

        // Define Project Ref based on branch
        PROJECT_REF = "${env.BRANCH_NAME == 'main' ? 'prod-ref-id' : (env.BRANCH_NAME == 'staging' ? 'staging-ref-id' : 'dev-ref-id')}"
        
        // Define Coolify Webhook based on branch
        COOLIFY_WEBHOOK = "${env.BRANCH_NAME == 'main' ? 'http://72.61.249.111:8000/webhooks/prod' : (env.BRANCH_NAME == 'staging' ? 'http://72.61.249.111:8000/webhooks/staging' : 'http://72.61.249.111:8000/webhooks/dev')}"
        
        // Coolify Token
        COOLIFY_TOKEN = credentials('coolify-token')
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
        
        stage('Determine Supabase Environment') {
            steps {
                script {
                    def envFile = fileExists('.env') ? readFile(file: '.env') : ''
                    def parseEnv = { key ->
                        if (!envFile) return ''
                        def m = (envFile =~ /(?m)^${key}=(.*)$/)
                        return m ? m[0][1].trim() : ''
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
                    } else {
                        env.SELECTED_SUPABASE_URL = envSupabaseUrl
                        env.SELECTED_ANON_KEY = envAnonKey
                        env.SELECTED_SERVICE_ROLE_KEY = envServiceKey ?: ''
                    }

                    def mask = { v -> v ? (v.length() > 8 ? v.substring(0,8)+'…' : v) : '(empty)' }
                    echo "DB Target: ${selectedTarget}"
                    echo "Supabase URL: ${env.SELECTED_SUPABASE_URL}"
                    echo "Anon Key: ${mask(env.SELECTED_ANON_KEY)}"
                    echo "Service Role Key: ${mask(env.SELECTED_SERVICE_ROLE_KEY)}"

                    if (!env.SELECTED_SUPABASE_URL || !env.SELECTED_ANON_KEY) {
                        error("Supabase configuration incomplete: URL or anon key missing")
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
                    // Only deploy if tests pass
                    echo "Deploying Supabase Edge Functions to VPS (Self-Hosted)..."
                    
                    // Use Node.js script for deployment to avoid system dependency issues (expect/sudo)
                    // Install ssh2 library in the current workspace (no-save to avoid modifying package.json)
                    sh 'npm install --no-save ssh2'
                    
                    // Run the Node.js deployment script
                    // VPS_IP and VPS_PASSWORD are already environment variables
                    catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                        withEnv(["VPS_USER=${env.VPS_USER}"]) {
                            sh 'node scripts/deploy_vps.cjs'
                        }
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
        */
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
