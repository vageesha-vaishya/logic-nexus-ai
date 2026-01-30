const https = require('https');

const SUPABASE_URL = "https://gzhxgoigflftharcmdqj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aHhnb2lnZmxmdGhhcmNtZHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MTk2ODcsImV4cCI6MjA4NTA5NTY4N30.6xIZ3VYubUZ73pNPurzYuf-2RUpXj_9w-LpU-6d6kqU";

const payload = {
  action: 'generate_smart_quotes',
  payload: {
    mode: 'ocean',
    origin: 'Shanghai, China (CNSHA)',
    destination: 'Los Angeles, USA (USLAX)',
    commodity: 'Electronics',
    weight: 500,
    volume: 1,
    containerQty: 1
  }
};

const options = {
  hostname: 'gzhxgoigflftharcmdqj.supabase.co',
  path: '/functions/v1/ai-advisor',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  }
};

console.log("Invoking AI Advisor...");

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      if (response.market_analysis && response.market_analysis.includes("Configuration Missing")) {
        console.error("FAILURE: Configuration is still missing.");
      } else if (response.error) {
        console.error("Error from API:", response.error);
      } else {
        console.log("Success! AI Advisor returned valid response.");
        console.log("Market Analysis Preview:", response.market_analysis ? response.market_analysis.substring(0, 50) + "..." : "None");
        console.log("Options Count:", response.options ? response.options.length : 0);
      }
    } catch (e) {
      console.error("Error parsing response:", e.message);
      console.log("Raw Response:", data);
    }
  });
});

req.on('error', (error) => {
  console.error("Network Error:", error);
});

req.write(JSON.stringify(payload));
req.end();
