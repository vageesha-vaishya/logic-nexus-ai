import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase URL or Key in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const COMPONENTS = ['AuthService', 'PaymentGateway', 'ReportGenerator', 'UserSync', 'InventoryManager'];
const LEVELS = ['INFO', 'WARNING', 'ERROR', 'DEBUG']; // Critical handled separately
const ENVIRONMENTS = ['production', 'staging', 'development'];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function generateLogs() {
  console.log('🚀 Starting Log Generation Simulation...');
  
  const logs = [];
  
  // 1. Generate Random Noise (50 logs)
  console.log('📝 Generating 50 random logs...');
  for (let i = 0; i < 50; i++) {
    logs.push({
      level: getRandomElement(LEVELS),
      message: `Simulated log message #${i}: ${Math.random().toString(36).substring(7)}`,
      component: getRandomElement(COMPONENTS),
      environment: getRandomElement(ENVIRONMENTS),
      metadata: { latency: Math.floor(Math.random() * 500), path: '/api/v1/test' },
      correlation_id: uuidv4()
    });
  }

  // 2. Generate a "Trace" (5 logs with same correlation_id)
  console.log('🔗 Generating a simulated distributed trace (5 logs)...');
  const traceId = uuidv4();
  const traceSteps = ['Request Received', 'Authenticating User', 'Processing Payment', 'Updating Inventory', 'Response Sent'];
  
  traceSteps.forEach((step, index) => {
    logs.push({
      level: 'INFO',
      message: `[Trace Step ${index + 1}] ${step}`,
      component: 'CheckoutFlow',
      environment: 'production',
      metadata: { step_index: index, trace_group: 'checkout_v1' },
      correlation_id: traceId
    });
  });

  // 3. Generate a CRITICAL log to trigger Alert (if configured)
  console.log('🚨 Generating a CRITICAL log to test Alerting...');
  logs.push({
    level: 'CRITICAL',
    message: 'TEST ALERT: Database connection pool exhaustion simulated.',
    component: 'DatabaseCluster',
    environment: 'production',
    metadata: { error_code: 'POOL_EXHAUSTED', active_connections: 1000 },
    correlation_id: uuidv4()
  });

  // Batch Insert
  const { error } = await supabase.from('system_logs').insert(logs);

  if (error) {
    console.error('❌ Error inserting logs:', error);
  } else {
    console.log(`✅ Successfully inserted ${logs.length} logs.`);
    console.log(`ℹ️  Trace ID for testing: ${traceId}`);
    console.log('👉 Go to the Dashboard -> System Logs -> Analytics to see the charts populate.');
    console.log('👉 Check your Slack/Email for the Critical Alert.');
  }
}

generateLogs();
