import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ALERT_EMAIL_TO = Deno.env.get("ALERT_EMAIL_TO");
const ENVIRONMENT = Deno.env.get("ENVIRONMENT") || "development";

// Basic in-memory rate limiting (per instance)
// Key: "component:message_hash", Value: Timestamp
const lastAlerts: Map<string, number> = new Map();
const THROTTLE_MS = 60 * 1000; // 1 minute throttle per identical error

serveWithLogger(async (req, logger, supabase) => {
  const headers = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // Auth: verify service role key or authenticated user (admin manually triggering)
  const authHeader = req.headers.get('Authorization');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!authHeader || !authHeader.includes(serviceKey)) {
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
  }

  const payload = await req.json();
  // Support direct call or DB Webhook (payload.record)
  const logEntry = payload.record || payload;

  if (!logEntry || !logEntry.level) {
    return new Response(JSON.stringify({ message: "Invalid payload" }), { status: 400 });
  }

  // Filter: Only CRITICAL (or ERROR if needed, but user asked for Critical)
  if (logEntry.level !== 'CRITICAL') {
    return new Response(JSON.stringify({ message: "Level ignored" }), { status: 200 });
  }

  const alertKey = `${logEntry.component}:${logEntry.message}`;
  const now = Date.now();
  if (lastAlerts.has(alertKey) && (now - lastAlerts.get(alertKey)!) < THROTTLE_MS) {
    logger.info(`Alert throttled for: ${alertKey}`);
    return new Response(JSON.stringify({ message: "Throttled" }), { status: 200 });
  }
  lastAlerts.set(alertKey, now);

  const results = { slack: false, email: false };

  // 1. Send Slack Alert
  if (SLACK_WEBHOOK_URL) {
    try {
      const slackMessage = {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🚨 System Critical Alert",
              emoji: true
            }
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Environment:*\n${ENVIRONMENT.toUpperCase()}` },
              { type: "mrkdwn", text: `*Component:*\n${logEntry.component || 'Unknown'}` },
              { type: "mrkdwn", text: `*Time:*\n${new Date().toISOString()}` },
              { type: "mrkdwn", text: `*Trace ID:*\n\`${logEntry.correlation_id || 'N/A'}\`` }
            ]
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Message:*\n${logEntry.message}`
            }
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "View logs in Dashboard for full details."
              }
            ]
          }
        ]
      };

      await fetch(SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackMessage)
      });
      results.slack = true;
    } catch (e) {
      logger.error("Failed to send Slack alert", { error: e });
    }
  }

  // 2. Send Email Alert (via Resend)
  if (RESEND_API_KEY && ALERT_EMAIL_TO) {
    try {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Alerts <alerts@soslogistics.pro>", // Update if needed
          to: [ALERT_EMAIL_TO],
          subject: `[CRITICAL] ${logEntry.component}: ${logEntry.message.slice(0, 50)}...`,
          html: `
            <h2>🚨 System Critical Alert</h2>
            <p><strong>Environment:</strong> ${ENVIRONMENT}</p>
            <p><strong>Component:</strong> ${logEntry.component}</p>
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
            <p><strong>Trace ID:</strong> <code>${logEntry.correlation_id || 'N/A'}</code></p>
            <hr />
            <h3>Message</h3>
            <pre style="background: #f4f4f4; padding: 10px;">${logEntry.message}</pre>
            <hr />
            <p>Metadata: <pre>${JSON.stringify(logEntry.metadata || {}, null, 2)}</pre></p>
          `
        }),
      });
      
      if (emailRes.ok) results.email = true;
      else logger.error("Resend API failed", { status: emailRes.status });
      
    } catch (e) {
      logger.error("Failed to send Email alert", { error: e });
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { "Content-Type": "application/json" },
  });
}, 'alert-notifier');
