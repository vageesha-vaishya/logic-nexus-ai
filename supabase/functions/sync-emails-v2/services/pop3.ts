
import { EmailAccount, saveEmailToDb, SupabaseClient } from "../utils/db.ts";
import { parseEmail } from "../utils/parser.ts";

export class Pop3Service {
  private account: EmailAccount;
  private supabase: SupabaseClient;

  constructor(account: EmailAccount, supabase: SupabaseClient) {
    this.account = account;
    this.supabase = supabase;
  }

  static async testConnection(config: { host: string; port: number; username: string; password?: string; ssl: boolean }) {
    let conn: Deno.Conn | null = null;
    try {
        console.log(`Testing POP3 connection to ${config.host}:${config.port}`);
        if (config.ssl) {
            conn = await Deno.connectTls({ hostname: config.host, port: config.port });
        } else {
            conn = await Deno.connect({ hostname: config.host, port: config.port });
        }
        
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const buf = new Uint8Array(4096);
        
        const readResponse = async () => {
            const n = await conn!.read(buf);
            if (n === null) throw new Error("Connection closed");
            return decoder.decode(buf.subarray(0, n));
        };
        
        const send = async (cmd: string) => {
            await conn!.write(encoder.encode(`${cmd}\r\n`));
            return await readResponse();
        };

        const greet = await readResponse();
        if (!greet.startsWith("+OK")) throw new Error(`Greeting failed: ${greet.trim()}`);

        const userResp = await send(`USER ${config.username}`);
        if (!userResp.startsWith("+OK")) throw new Error(`USER failed: ${userResp.trim()}`);

        if (config.password) {
            const passResp = await send(`PASS ${config.password}`);
            if (!passResp.startsWith("+OK")) throw new Error(`PASS failed: ${passResp.trim()}`);
        }

        await send("QUIT");
        return { success: true };
    } catch (e) {
        console.error("POP3 Test Error:", e);
        return { success: false, error: e instanceof Error ? e.message : String(e) };
    } finally {
        try {
           if (conn) conn.close();
        } catch {}
    }
  }

  async sync() {
    console.log(`Starting POP3 sync for ${this.account.email_address}`);
    const conn = await this.connect();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readLine = async () => {
      const buf = new Uint8Array(8192);
      const n = await conn.read(buf);
      if (n === null) throw new Error("Connection closed");
      return decoder.decode(buf.subarray(0, n));
    };

    const send = async (cmd: string) => {
      await conn.write(encoder.encode(`${cmd}\r\n`));
      return await readLine();
    };

    try {
      const greet = await readLine();
      if (!greet.startsWith("+OK")) throw new Error(`Greeting failed: ${greet}`);

      const userResp = await send(`USER ${this.account.pop3_username}`);
      if (!userResp.startsWith("+OK")) throw new Error(`USER failed: ${userResp}`);

      const passResp = await send(`PASS ${this.account.pop3_password}`);
      if (!passResp.startsWith("+OK")) throw new Error(`PASS failed: ${passResp}`);

      const listResp = await send("LIST");
      const lines = listResp.split("\r\n");
      const ids = lines
        .map(l => l.match(/^(\d+)\s+/))
        .filter(Boolean)
        .map(m => Number(m![1]));

      console.log(`Found ${ids.length} messages`);

      // Sync last 20
      const idsToSync = ids.slice(-20); // Last 20 usually

      for (const id of idsToSync) {
        try {
          await conn.write(encoder.encode(`RETR ${id}\r\n`));
          
          let raw = "";
          while (true) {
            const chunk = await readLine();
            raw += chunk;
            if (raw.endsWith("\r\n.\r\n")) break;
            if (raw.length > 10 * 1024 * 1024) throw new Error("Message too large");
          }
          
          const messageRaw = raw.replace(/\r\n\.\r\n$/, "");
          const parsed = await parseEmail(messageRaw, `pop3-${id}`);
          
          await saveEmailToDb(this.supabase, this.account, parsed);
          console.log(`Synced message ${id}`);

          if (this.account.pop3_delete_policy === "delete_after_fetch") {
            await send(`DELE ${id}`);
          }
        } catch (e) {
          console.error(`Error syncing POP3 message ${id}:`, e);
        }
      }

      await send("QUIT");
    } finally {
      conn.close();
    }
  }

  private async connect(): Promise<Deno.Conn> {
    const { pop3_host, pop3_port, pop3_use_ssl } = this.account;
    if (!pop3_host || !pop3_port) throw new Error("Missing POP3 config");

    if (pop3_use_ssl) {
      return await Deno.connectTls({ hostname: pop3_host, port: pop3_port });
    } else {
      return await Deno.connect({ hostname: pop3_host, port: pop3_port });
    }
  }
}
