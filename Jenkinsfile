pipeline {
    agent any
    
    environment {
        // Credentials binding for Supabase
        SUPABASE_ACCESS_TOKEN = credentials('supabase-access-token')
        
        // VPS Credentials for Deployment
        VPS_PASSWORD = credentials('vps-root-password')
        VPS_IP = '72.61.249.111'

        // Define Project Ref based on branch
        PROJECT_REF = "${env.BRANCH_NAME == 'main' ? 'prod-ref-id' : (env.BRANCH_NAME == 'staging' ? 'staging-ref-id' : 'dev-ref-id')}"
        
        // Define Coolify Webhook based on branch
        COOLIFY_WEBHOOK = "${env.BRANCH_NAME == 'main' ? 'https://coolify.api/webhooks/prod' : (env.BRANCH_NAME == 'staging' ? 'https://coolify.api/webhooks/staging' : 'https://coolify.api/webhooks/dev')}"
        
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
                    
                    // Attempt to install 'expect' if missing (required for password-based SSH)
                    sh '''
                        if ! command -v expect &> /dev/null; then
                            echo "Installing expect..."
                            if command -v apk &> /dev/null; then
                                sudo apk add --no-cache expect || apk add --no-cache expect
                            elif command -v apt-get &> /dev/null; then
                                sudo apt-get update && sudo apt-get install -y expect || (apt-get update && apt-get install -y expect)
                            elif command -v yum &> /dev/null; then
                                sudo yum install -y expect || yum install -y expect
                            else
                                echo "Package manager not found. Please install 'expect' manually on the Jenkins agent."
                                exit 1
                            fi
                        fi
                    '''

                    // Make scripts executable
                    sh "chmod +x ./scripts/deploy_functions_vps.sh"
                    sh "chmod +x ./scripts/remote_scp.expect"
                    sh "chmod +x ./scripts/remote_exec.expect"
                    
                    // Deploy to VPS using credentials
                    // Usage: ./deploy_functions_vps.sh <vps_ip> <vps_user> <vps_password>
                    sh './scripts/deploy_functions_vps.sh "$VPS_IP" "root" "$VPS_PASSWORD"'
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
