
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load .env file
const envPath = path.resolve(__dirname, '.env');
let GOOGLE_API_KEY = '';
let OPENAI_API_KEY = '';

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            if (key === 'GOOGLE_API_KEY') GOOGLE_API_KEY = value;
            if (key === 'OPENAI_API_KEY') OPENAI_API_KEY = value;
        }
    });
}

console.log('Validating API Keys from .env...\n');

function testGemini() {
    return new Promise((resolve) => {
        if (!GOOGLE_API_KEY) {
            console.log('❌ GOOGLE_API_KEY is missing');
            resolve(false);
            return;
        }

        const data = JSON.stringify({
            contents: [{ parts: [{ text: "Hello" }] }]
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('✅ GOOGLE_API_KEY (Gemini) is VALID');
                    resolve(true);
                } else {
                    console.log(`❌ GOOGLE_API_KEY (Gemini) FAILED. Status: ${res.statusCode}`);
                    try {
                        const err = JSON.parse(body);
                        console.log('Error Message:', err.error?.message || body);
                    } catch (e) {
                        console.log('Response:', body);
                    }
                    resolve(false);
                }
            });
        });

        req.on('error', (error) => {
            console.error('❌ GOOGLE_API_KEY (Gemini) Error:', error.message);
            resolve(false);
        });

        req.write(data);
        req.end();
    });
}

function testOpenAI() {
    return new Promise((resolve) => {
        if (!OPENAI_API_KEY) {
            console.log('❌ OPENAI_API_KEY is missing');
            resolve(false);
            return;
        }

        const data = JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: "Hello" }],
            max_tokens: 5
        });

        const options = {
            hostname: 'api.openai.com',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('✅ OPENAI_API_KEY is VALID');
                    resolve(true);
                } else {
                    console.log(`❌ OPENAI_API_KEY FAILED. Status: ${res.statusCode}`);
                    try {
                        const err = JSON.parse(body);
                        console.log('Error Message:', err.error?.message || body);
                    } catch (e) {
                        console.log('Response:', body);
                    }
                    resolve(false);
                }
            });
        });

        req.on('error', (error) => {
            console.error('❌ OPENAI_API_KEY Error:', error.message);
            resolve(false);
        });

        req.write(data);
        req.end();
    });
}

async function run() {
    await testGemini();
    await testOpenAI();
}

run();
