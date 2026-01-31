#!/usr/bin/env node

/**
 * Supabase Access Token Configuration Script
 * 
 * This script helps users generate a Supabase Access Token and saves it
 * permanently to the .env file for use with CI/CD and Edge Function deployments.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const TOKEN_URL = 'https://supabase.com/dashboard/account/tokens';

// ANSI colors
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    red: "\x1b[31m"
};

function log(msg, color = colors.reset) {
    console.log(`${color}${msg}${colors.reset}`);
}

function openUrl(url) {
    const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
    exec(`${start} ${url}`);
}

async function main() {
    log('\n🔒 Supabase Access Token Setup\n', colors.bright + colors.cyan);
    
    // 1. Check existing token
    let envContent = '';
    if (fs.existsSync(ENV_FILE)) {
        envContent = fs.readFileSync(ENV_FILE, 'utf8');
    } else {
        log(`Creating new .env file at ${ENV_FILE}`, colors.yellow);
    }

    if (envContent.includes('SUPABASE_ACCESS_TOKEN=') && !envContent.includes('SUPABASE_ACCESS_TOKEN=""')) {
        const existingToken = envContent.match(/SUPABASE_ACCESS_TOKEN=(.+)/)?.[1];
        if (existingToken && existingToken.trim().length > 10) {
            log('✅ SUPABASE_ACCESS_TOKEN is already set in .env', colors.green);
            log('Do you want to overwrite it? (y/N)');
            
            const answer = await new Promise(resolve => rl.question('> ', resolve));
            if (answer.toLowerCase() !== 'y') {
                log('Exiting...', colors.yellow);
                rl.close();
                return;
            }
        }
    }

    // 2. Guide User
    log('\nTo deploy Edge Functions and automate migrations, we need a Personal Access Token.', colors.yellow);
    log(`1. I will open the Supabase Tokens page: ${TOKEN_URL}`);
    log('2. Click "Generate new token".');
    log('3. Name it "Trae-Agent" (or similar).');
    log('4. Copy the token and paste it here.\n');

    log('Press ENTER to open the browser...', colors.bright);
    await new Promise(resolve => rl.question('', resolve));
    
    openUrl(TOKEN_URL);

    // 3. Get Token
    log('\nPaste your Access Token:', colors.cyan);
    const token = await new Promise(resolve => rl.question('> ', resolve));

    if (!token || token.trim().length < 20) {
        log('❌ Invalid token provided. Exiting.', colors.red);
        rl.close();
        return;
    }

    // 4. Update .env
    const tokenKey = 'SUPABASE_ACCESS_TOKEN';
    const cleanToken = token.trim();
    
    let newEnvContent;
    if (envContent.includes(tokenKey)) {
        // Replace existing
        newEnvContent = envContent.replace(
            new RegExp(`${tokenKey}=.*`, 'g'),
            `${tokenKey}=${cleanToken}`
        );
    } else {
        // Append
        newEnvContent = envContent + `\n${tokenKey}=${cleanToken}\n`;
    }

    fs.writeFileSync(ENV_FILE, newEnvContent);
    
    log(`\n✅ Successfully saved ${tokenKey} to .env`, colors.green);
    log('You can now run "npx supabase functions deploy" without login prompts.', colors.green);

    rl.close();
}

main().catch(err => {
    console.error(err);
    rl.close();
});
