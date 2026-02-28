// @ts-ignore
import { parse } from "https://deno.land/x/xml@2.1.3/mod.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { serveWithLogger, Logger } from "../_shared/logger.ts";

interface EmailSettings {
  provider: string; // 'gmail', 'office365', 'imap', 'exchange', 'unknown'
  type: 'oauth' | 'basic';
  imap?: {
    host: string;
    port: number;
    socketType: 'SSL' | 'STARTTLS' | 'PLAIN';
    username: string;
  };
  smtp?: {
    host: string;
    port: number;
    socketType: 'SSL' | 'STARTTLS' | 'PLAIN';
    username: string;
  };
  displayName?: string;
  documentation?: string;
}

const STATIC_PROVIDERS: Record<string, EmailSettings> = {
  'gmail.com': { provider: 'gmail', type: 'oauth' },
  'googlemail.com': { provider: 'gmail', type: 'oauth' },
  'outlook.com': { provider: 'office365', type: 'oauth' },
  'hotmail.com': { provider: 'office365', type: 'oauth' },
  'live.com': { provider: 'office365', type: 'oauth' },
  'msn.com': { provider: 'office365', type: 'oauth' },
  'office365.com': { provider: 'office365', type: 'oauth' },
  'icloud.com': {
    provider: 'imap',
    type: 'basic',
    imap: { host: 'imap.mail.me.com', port: 993, socketType: 'SSL', username: '%EMAIL%' },
    smtp: { host: 'smtp.mail.me.com', port: 587, socketType: 'STARTTLS', username: '%EMAIL%' }
  },
  'me.com': {
    provider: 'imap',
    type: 'basic',
    imap: { host: 'imap.mail.me.com', port: 993, socketType: 'SSL', username: '%EMAIL%' },
    smtp: { host: 'smtp.mail.me.com', port: 587, socketType: 'STARTTLS', username: '%EMAIL%' }
  },
  'yahoo.com': {
      provider: 'imap',
      type: 'basic',
      imap: { host: 'imap.mail.yahoo.com', port: 993, socketType: 'SSL', username: '%EMAIL%' },
      smtp: { host: 'smtp.mail.yahoo.com', port: 465, socketType: 'SSL', username: '%EMAIL%' }
  }
};

serveWithLogger(async (req, logger, _supabase) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  try {
    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      throw new Error("Invalid email address");
    }

    const domain = email.split('@')[1].toLowerCase();

    // 1. Check Static List
    if (STATIC_PROVIDERS[domain]) {
      const settings = { ...STATIC_PROVIDERS[domain] };
      // Replace username placeholder
      if (settings.imap) settings.imap.username = settings.imap.username.replace('%EMAIL%', email);
      if (settings.smtp) settings.smtp.username = settings.smtp.username.replace('%EMAIL%', email);
      
      return new Response(JSON.stringify(settings), {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    // 2. Try Autoconfig (Mozilla format)
    // Try both http://autoconfig.{domain} and https://{domain}/.well-known/autoconfig
    const urls = [
      `https://autoconfig.${domain}/mail/config-v1.1.xml`,
      `http://autoconfig.${domain}/mail/config-v1.1.xml`,
      `https://${domain}/.well-known/autoconfig/mail/config-v1.1.xml`
    ];

    for (const url of urls) {
      try {
        logger.info(`Fetching autoconfig from: ${url}`);
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 3000); // 3s timeout

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);

        if (res.ok) {
          const text = await res.text();
          const xmlData = parse(text);
          const settings = parseAutoconfigXml(xmlData, email, logger);
          
          if (settings) {
            return new Response(JSON.stringify(settings), {
              headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            });
          }
        }
      } catch (e: any) {
        logger.warn(`Failed to fetch/parse ${url}: ${e.message}`);
      }
    }

    // 3. Fallback: Unknown
    return new Response(JSON.stringify({ provider: 'unknown', type: 'basic' }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
}, "discover-email-settings");

function parseAutoconfigXml(xml: any, email: string, logger: Logger): EmailSettings | null {
  try {
    const config = xml?.clientConfig?.emailProvider;
    if (!config) return null;

    const servers = Array.isArray(config.incomingServer) 
      ? config.incomingServer 
      : [config.incomingServer];
      
    const outgoingServers = Array.isArray(config.outgoingServer) 
      ? config.outgoingServer 
      : [config.outgoingServer];

    const imap = servers.find((s: any) => s['@type'] === 'imap');
    const smtp = outgoingServers.find((s: any) => s['@type'] === 'smtp');

    if (!imap || !smtp) return null;

    return {
      provider: 'imap', // Generic IMAP
      type: 'basic',
      displayName: config.displayName || undefined,
      documentation: config.documentation?.url || undefined,
      imap: {
        host: imap.hostname,
        port: parseInt(imap.port),
        socketType: mapSocketType(imap.socketType),
        username: mapUsername(imap.username, email),
      },
      smtp: {
        host: smtp.hostname,
        port: parseInt(smtp.port),
        socketType: mapSocketType(smtp.socketType),
        username: mapUsername(smtp.username, email),
      }
    };
  } catch (e) {
    logger.error("Error parsing XML logic:", { error: e });
    return null;
  }
}

function mapSocketType(type: string): 'SSL' | 'STARTTLS' | 'PLAIN' {
  const t = type?.toUpperCase();
  if (t === 'SSL') return 'SSL';
  if (t === 'STARTTLS') return 'STARTTLS';
  return 'PLAIN';
}

function mapUsername(usernameFormat: string, email: string): string {
  if (!usernameFormat) return email;
  if (usernameFormat === '%EMAILADDRESS%') return email;
  if (usernameFormat === '%EMAILLOCALPART%') return email.split('@')[0];
  return usernameFormat; // Sometimes it's the literal username, but in autoconfig it's usually a variable.
  // Actually, standard autoconfig uses %EMAILADDRESS% or %EMAILLOCALPART%.
  // If it's something else, it might be static (unlikely) or we just default to email.
}
