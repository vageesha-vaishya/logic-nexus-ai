const https = require('https');
const fs = require('fs');
const path = require('path');

// Load .env manually since we are in a CJS script and might not have dotenv
try {
    const envPath = path.resolve(__dirname, '.env');
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
                process.env[key] = value;
            }
        });
    }
} catch (e) {
    console.error('Error loading .env:', e);
}

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
    console.error('❌ GOOGLE_API_KEY is missing in .env');
    process.exit(1);
}



const models = [
    'gemini-2.5-flash',
    'gemini-flash-latest'
];

function testModel(model) {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            contents: [{ parts: [{ text: "Hello" }] }]
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`,
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
                console.log(`\nTesting ${model}:`);
                console.log(`Status: ${res.statusCode}`);
                if (res.statusCode === 200) {
                    console.log(`✅ Success`);
                    resolve({ model, success: true });
                } else {
                    console.log(`❌ Failed`);
                    try {
                        const err = JSON.parse(body);
                        console.log('Error:', err.error?.message || body);
                    } catch (e) {
                        console.log('Response:', body);
                    }
                    resolve({ model, success: false, status: res.statusCode });
                }
            });
        });

        req.on('error', (error) => {
            console.error(`❌ Error testing ${model}:`, error.message);
            resolve({ model, success: false, error: error.message });
        });

        req.write(data);
        req.end();
    });
}

async function runTests() {
    console.log('Validating Gemini Models with current API Key...');
    for (const model of models) {
        await testModel(model);
    }
}

runTests();
