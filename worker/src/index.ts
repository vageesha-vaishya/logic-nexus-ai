import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { supabase } from './lib/supabase';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

// 1. Define Queue
const emailQueue = new Queue('email-sequences', { connection });

// 2. Scheduler: Polls Supabase for due steps and adds to Queue
async function pollDueSteps() {
  console.log('[Scheduler] Checking for due steps...');
  try {
    const { data: dueSteps, error } = await supabase.rpc('get_due_sequence_steps', { p_batch_size: 50 });

    if (error) throw error;
    if (!dueSteps || dueSteps.length === 0) return;

    console.log(`[Scheduler] Found ${dueSteps.length} due steps.`);

    for (const step of dueSteps) {
      // Add to BullMQ
      await emailQueue.add('process-step', step, {
        jobId: `enrollment-${step.enrollment_id}-step-${step.step_order}`, // Deduplication
        removeOnComplete: true
      });
      console.log(`[Scheduler] Queued job for Enrollment ${step.enrollment_id}`);
    }
  } catch (err) {
    console.error('[Scheduler] Error polling steps:', err);
  }
}

// Run Scheduler every 60 seconds
setInterval(pollDueSteps, 60000);
// Initial run
pollDueSteps();


// 3. Worker: Processes the jobs
const worker = new Worker('email-sequences', async (job) => {
  const item = job.data;
  console.log(`[Worker] Processing Step ${item.step_order} for Enrollment ${item.enrollment_id}`);

  let success = false;

  try {
    // A. Execute Step
    if (item.step_type === 'email' && item.template_id) {
      // Fetch Template
      const { data: template, error: templateError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', item.template_id)
        .single();
      
      if (templateError || !template) throw new Error("Template not found");

      // Send Email via Edge Function
      const { error: sendError } = await supabase.functions.invoke('send-email', {
        body: {
          to: [item.recipient_email],
          subject: template.subject, 
          html: template.body, 
          tenant_id: item.tenant_id,
          tracking: true
        }
      });

      if (sendError) throw new Error("Failed to send email: " + JSON.stringify(sendError));
      success = true;

    } else if (item.step_type === 'task') {
      // Placeholder for Task creation
      console.log(`[Worker] Creating task for ${item.recipient_email}`);
      success = true;
    }

    // B. Update State (Move to next step)
    if (success) {
      const now = new Date();
      
      // Find Next Step Delay
      const { data: nextStep } = await supabase
        .from('email_sequence_steps')
        .select('delay_hours')
        .eq('sequence_id', item.sequence_id)
        .eq('step_order', item.step_order + 1)
        .single();

      const updates: any = {
        current_step_order: item.step_order,
        last_step_completed_at: now.toISOString(),
      };

      if (nextStep) {
        // Schedule next
        const nextRun = new Date(now.getTime() + (nextStep.delay_hours * 60 * 60 * 1000));
        updates.next_step_due_at = nextRun.toISOString();
      } else {
        // Complete
        updates.status = 'completed';
        updates.next_step_due_at = null;
      }

      const { error: updateError } = await supabase
        .from('email_sequence_enrollments')
        .update(updates)
        .eq('id', item.enrollment_id);

      if (updateError) throw updateError;

      // Log
      await supabase.from('email_sequence_logs').insert({
        enrollment_id: item.enrollment_id,
        step_order: item.step_order,
        action: 'sent',
        details: { template_id: item.template_id }
      });
      
      console.log(`[Worker] Completed Step ${item.step_order} for Enrollment ${item.enrollment_id}`);
    }

  } catch (err: any) {
    console.error(`[Worker] Failed Step ${item.step_order}:`, err.message);
    throw err; // BullMQ will retry
  }

}, { connection });

worker.on('completed', job => {
  console.log(`[Worker] Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.log(`[Worker] Job ${job?.id} has failed with ${err.message}`);
});

console.log('[System] Worker Service Started');
