import { EmailAccount, saveEmailToDb, SupabaseClient } from "../utils/db.ts";
import { ImapFlow } from "npm:imapflow";
import { parseEmail } from "../utils/parser.ts";

export class ImapService {
  private account: EmailAccount;
  private supabase: SupabaseClient;
  private adminSupabase?: SupabaseClient;

  constructor(account: EmailAccount, supabase: SupabaseClient, adminSupabase?: SupabaseClient) {
    this.account = account;
    this.supabase = supabase;
    this.adminSupabase = adminSupabase;
  }

  async syncEmails(forceFullSync: boolean = false): Promise<{ syncedCount: number, debug?: any }> {
    const client = new ImapFlow({
      host: this.account.imap_host,
      port: this.account.imap_port || 993,
      secure: this.account.imap_use_ssl ?? true,
      auth: {
        user: this.account.imap_username || this.account.email_address,
        pass: this.account.imap_password || this.account.password,
      },
      logger: false,
    });

    const debugInfo: any = {
        connected: false,
        mailboxLocked: false,
        searchCriteria: null,
        messagesFound: 0,
        errors: []
    };

    try {
      console.log(`Connecting to IMAP ${this.account.imap_host}:${this.account.imap_port || 993}...`);
      await client.connect();
      debugInfo.connected = true;
    } catch (err: any) {
      console.error("IMAP Connection Error:", err);
      throw new Error(`IMAP Connection Failed: ${err.message}`);
    }

    let lock;
    let count = 0;

    try {
      lock = await client.getMailboxLock('INBOX');
      debugInfo.mailboxLocked = true;
      
      // Default to fetching last 50 messages if not forcing full sync
      // This ensures we get recent emails even if they are already read (seen)
      let searchCriteria: any = '1:*';
      
      if (!forceFullSync) {
          const total = client.mailbox.exists || 0;
          if (total === 0) {
              searchCriteria = false; // No messages
          } else {
              const fetchCount = 50;
              const start = Math.max(1, total - fetchCount + 1);
              searchCriteria = `${start}:*`;
          }
      }

      debugInfo.searchCriteria = searchCriteria;
      
      console.log(`Fetching messages with criteria: ${JSON.stringify(searchCriteria)}`);
      
      if (searchCriteria) {
          const messageStream = client.fetch(searchCriteria, { source: true, uid: true });
          
          for await (const message of messageStream) {
            debugInfo.messagesFound++;
            try {
              const rawSource = message.source.toString();
              const parsedEmail = await parseEmail(rawSource);
              
              const saved = await saveEmailToDb(
                this.supabase, 
                this.account, 
                parsedEmail, 
                "inbox", 
                "inbound"
              );
              
              if (saved) count++;
              
              // Only mark as seen if we actually processed it? 
              // Actually, standard clients usually mark as seen when downloaded, but for a sync tool
              // we might want to preserve the state. 
              // But the previous code marked it as seen.
              // if (!forceFullSync) {
              //   await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
              // }
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              console.error(`Error processing message ${message.uid}:`, msg);
              debugInfo.errors.push(`Msg ${message.uid}: ${msg}`);
            }
          }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("IMAP Sync Error:", msg);
      debugInfo.errors.push(`Sync Error: ${msg}`);
      throw err;
    } finally {
      if (lock) lock.release();
      await client.logout();
    }

    return { syncedCount: count, debug: debugInfo };
  }
}
