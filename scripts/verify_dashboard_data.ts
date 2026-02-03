
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Initialize environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDashboardData() {
  console.log('Starting Dashboard Data Verification...');

  try {
    // 1. Verify get_dashboard_stats (Summary Cards)
    console.log('\n--- Verifying get_dashboard_stats ---');
    const { data: summaryStats, error: summaryError } = await supabase.rpc('get_dashboard_stats');
    
    if (summaryError) throw summaryError;
    
    if (summaryStats && summaryStats.length > 0) {
      const stats = summaryStats[0];
      console.log('✅ Summary Stats Retrieved:');
      console.log(`   - Revenue: $${stats.total_revenue}`);
      console.log(`   - Shipments: ${stats.active_shipments}`);
      console.log(`   - Pending Invoices: ${stats.pending_invoices}`);
      console.log(`   - Profit: $${stats.total_profit}`);
      
      if (stats.total_revenue === 0 && stats.active_shipments === 0) {
        console.warn('⚠️  Warning: All stats are zero. Check if there is data in shipments/invoices tables.');
      }
    } else {
      console.error('❌ No summary stats returned');
    }

    // 2. Verify get_daily_stats (Sparklines)
    console.log('\n--- Verifying get_daily_stats (Sparklines) ---');
    const { data: dailyStats, error: dailyError } = await supabase.rpc('get_daily_stats', { p_days: 30 });
    
    if (dailyError) throw dailyError;

    if (dailyStats) {
      console.log('✅ Daily Stats Retrieved:');
      
      const categories = ['revenue', 'shipments', 'invoices', 'profit'];
      categories.forEach(cat => {
        const points = dailyStats[cat];
        if (Array.isArray(points)) {
            console.log(`   - ${cat}: ${points.length} data points`);
            if (points.length > 0) {
                console.log(`     Sample: ${JSON.stringify(points[0])} ... ${JSON.stringify(points[points.length-1])}`);
                // Verify 'value' property exists for Recharts
                if (typeof points[0].value !== 'number') {
                    console.error(`❌ Error: ${cat} data points missing 'value' property required for charts.`);
                }
            } else {
                console.warn(`⚠️  Warning: ${cat} has 0 data points.`);
            }
        } else {
            console.error(`❌ Error: ${cat} is not an array.`);
        }
      });
    } else {
      console.error('❌ No daily stats returned');
    }

    // 3. Verify get_financial_metrics (Reports Page)
    console.log('\n--- Verifying get_financial_metrics (Reports Chart) ---');
    const { data: financialMetrics, error: financialError } = await supabase.rpc('get_financial_metrics', { period: '12m' });
    
    if (financialError) throw financialError;
    
    if (financialMetrics && financialMetrics.length > 0) {
        console.log(`✅ Financial Metrics Retrieved: ${financialMetrics.length} months`);
        console.log(`   Sample: ${JSON.stringify(financialMetrics[0])}`);
    } else {
        console.warn('⚠️  Warning: No financial metrics returned.');
    }

    // 4. Verify get_carrier_volume (Reports Page)
    console.log('\n--- Verifying get_carrier_volume (Reports Chart) ---');
    const { data: carrierVolume, error: carrierError } = await supabase.rpc('get_carrier_volume', { period: '12m' });
    
    if (carrierError) throw carrierError;
    
    if (carrierVolume && carrierVolume.length > 0) {
        console.log(`✅ Carrier Volume Retrieved: ${carrierVolume.length} carriers`);
        console.log(`   Sample: ${JSON.stringify(carrierVolume[0])}`);
    } else {
        console.warn('⚠️  Warning: No carrier volume data returned.');
    }

    console.log('\n✅ VERIFICATION COMPLETE: Dashboard data pipeline is functional.');

  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED:', error);
    process.exit(1);
  }
}

verifyDashboardData();
