pipeline {
    agent any
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
                    echo "Deploying Supabase Edge Functions to VPS (Self-Hosted)..."
                    
                    // Use Node.js script for deployment to avoid system dependency issues (expect/sudo)
                    // Install ssh2 library in the current workspace (no-save to avoid modifying package.json)
                    sh 'npm install --no-save ssh2'
                    
                    // Run the Node.js deployment script
                    // VPS_IP and VPS_PASSWORD are already environment variables
                    withEnv(["VPS_USER=${env.VPS_USER}"]) {
                        sh 'node scripts/deploy_vps.cjs'
                    }
                }
            }
        }

        stage('Setup Supabase Gateway') {
            steps {
                script {
                    echo "Setting up Supabase gateway reverse proxy on VPS..."
                    sh 'npm install --no-save ssh2'
                    timeout(time: 10, unit: 'MINUTES') {
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
                        echo "App Port: ${env.APP_PORT}, Supabase URL will be http://${env.VPS_IP}:${env.GATEWAY_PORT}"
                        sh 'node scripts/deploy_web_app_vps.cjs'
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
