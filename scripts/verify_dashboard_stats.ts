
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyStats() {
  console.log('Verifying Dashboard Stats...');

  // 1. Call get_dashboard_stats
  const { data: dashboardStats, error: dsError } = await supabase.rpc('get_dashboard_stats');
  if (dsError) {
    console.error('get_dashboard_stats failed:', dsError);
  } else {
    console.log('Dashboard Stats:', dashboardStats);
  }

  // 2. Call get_daily_stats
  const { data: dailyStats, error: dailyError } = await supabase.rpc('get_daily_stats', { p_days: 30 });
  if (dailyError) {
    console.error('get_daily_stats failed:', dailyError);
  } else {
    console.log('Daily Stats Result Type:', typeof dailyStats);
    if (dailyStats) {
        // Inspect the structure
        console.log('Daily Stats Keys:', Object.keys(dailyStats));
        
        // Check shipments array
        if (dailyStats.shipments && Array.isArray(dailyStats.shipments)) {
            console.log(`Shipments Data Points: ${dailyStats.shipments.length}`);
            if (dailyStats.shipments.length > 0) {
                console.log('First Shipment Point:', dailyStats.shipments[0]);
            }
        } else {
            console.warn('Shipments data missing or invalid format');
        }

        // Check revenue
        if (dailyStats.revenue && Array.isArray(dailyStats.revenue)) {
            console.log(`Revenue Data Points: ${dailyStats.revenue.length}`);
             if (dailyStats.revenue.length > 0) {
                console.log('First Revenue Point:', dailyStats.revenue[0]);
            }
        }
    }
  }
}

verifyStats();
