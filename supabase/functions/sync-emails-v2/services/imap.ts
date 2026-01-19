
import { EmailAccount, saveEmailToDb, SupabaseClient } from "../utils/db.ts";
import { parseEmail } from "../utils/parser.ts";

export class ImapService {
  private account: EmailAccount;
  private supabase: SupabaseClient;

  constructor(account: EmailAccount, supabase: SupabaseClient) {
    this.account = account;
    this.supabase = supabase;
  }

  async sync() {
    console.log(`Starting IMAP sync for ${this.account.email_address}`);
    const conn = await this.connect();
    
    try {
      await this.login(conn);
      const count = await this.selectInbox(conn);
      if (count > 0) {
          await this.fetchMessages(conn, count);
      } else {
          console.log("Inbox is empty");
      }
      await this.logout(conn);
    } catch (e) {
      console.error("IMAP Sync Error:", e);
      throw e;
    } finally {
      try { conn.close(); } catch {}
    }
  }

  private async connect(): Promise<Deno.Conn> {
    const { imap_host, imap_port, imap_use_ssl } = this.account;
    if (!imap_host || !imap_port) throw new Error("Missing IMAP config");

    console.log(`Connecting to ${imap_host}:${imap_port} (SSL: ${imap_use_ssl})`);

    try {
      if (imap_use_ssl) {
        return await Deno.connectTls({ hostname: imap_host, port: imap_port });
      } else {
        return await Deno.connect({ hostname: imap_host, port: imap_port });
      }
    } catch (e) {
      console.warn("Connection failed:", e);
      throw e;
    }
  }

  private async sendCommand(conn: Deno.Conn, tag: string, cmd: string): Promise<string> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    await conn.write(encoder.encode(`${tag} ${cmd}\r\n`));
    
    let response = "";
    const buf = new Uint8Array(8192);
    
    while (true) {
      const n = await conn.read(buf);
      if (n === null) throw new Error("Connection closed");
      
      const chunk = decoder.decode(buf.subarray(0, n));
      response += chunk;
      
      if (response.includes(`${tag} OK`) || response.includes(`${tag} NO`) || response.includes(`${tag} BAD`)) {
        break;
      }
    }
    return response;
  }

  private async login(conn: Deno.Conn) {
    // Read greeting
    const buf = new Uint8Array(2048);
    const n = await conn.read(buf);
    if (n) {
      console.log("Greeting:", new TextDecoder().decode(buf.subarray(0, n)).trim());
    }

    const resp = await this.sendCommand(conn, "A1", `LOGIN "${this.account.imap_username}" "${this.account.imap_password}"`);
    if (!resp.includes("A1 OK")) throw new Error(`Login failed: ${resp}`);
    console.log("Logged in successfully");
  }

  private async selectInbox(conn: Deno.Conn): Promise<number> {
    const resp = await this.sendCommand(conn, "A2", "SELECT INBOX");
    if (!resp.includes("A2 OK")) throw new Error(`Select INBOX failed: ${resp}`);
    
    // Parse EXISTS count: * 123 EXISTS
    const match = resp.match(/\*\s+(\d+)\s+EXISTS/i);
    if (match) {
        return parseInt(match[1], 10);
    }
    return 0;
  }

  private async fetchMessages(conn: Deno.Conn, total: number) {
    // Sync last 20 messages
    const start = Math.max(1, total - 19);
    const end = total;
    
    console.log(`Syncing messages ${start} to ${end} (Total: ${total})`);
    
    // We fetch one by one to better handle large bodies in our simple reader
    // Loop backwards to get newest first
    for (let seq = end; seq >= start; seq--) {
        try {
            // Check if already synced (optimization)
            // But we don't have message-id yet until we fetch headers.
            // FETCH (BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)]) first?
            // For now, let's fetch full body and rely on db.ts duplicate check.
            
            const fetchResp = await this.sendCommand(conn, `F${seq}`, `FETCH ${seq} (FLAGS BODY[])`);
            
            const sizeMatch = fetchResp.match(/BODY\[\] \{(\d+)\}/);
            if (!sizeMatch) {
                // It might be a simple fetch response without literal if empty?
                console.warn(`Could not find body size for ${seq}`);
                continue;
            }
            
            const size = parseInt(sizeMatch[1], 10);
            
            // Extract content
            // The literal follows "}\r\n"
            const startMarker = sizeMatch[0] + "\r\n";
            const startIdx = fetchResp.indexOf(startMarker);
            
            if (startIdx === -1) {
                console.warn(`Could not parse body start for ${seq}`);
                continue;
            }
            
            const contentStart = startIdx + startMarker.length;
            
            // Check if we have enough data
            if (fetchResp.length < contentStart + size) {
                // In a real client we would continue reading until we have 'size' bytes.
                // Our sendCommand reads until 'TAG OK', which *should* come after the literal.
                // So if sendCommand worked, we should have the data.
                console.warn(`Incomplete body data for ${seq}`);
                continue;
            }
            
            const rawContent = fetchResp.substring(contentStart, contentStart + size);
            const parsed = await parseEmail(rawContent, `imap-${seq}`);
            
            await saveEmailToDb(this.supabase, this.account, parsed);
            console.log(`Synced message ${seq}: ${parsed.subject}`);
            
        } catch (e) {
            console.error(`Error syncing message ${seq}:`, e);
        }
    }
  }

  private async logout(conn: Deno.Conn) {
    await this.sendCommand(conn, "A99", "LOGOUT");
  }
}
