// /// <reference types="https://esm.sh/@supabase/functions@1.3.1/types.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { simpleParser } from "https://esm.sh/mailparser@3.6.4";
import { Logger } from '../_shared/logger.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GmailHeader = { name: string; value: string };
type GmailMessagePart = {
  mimeType?: string;
  body?: { 
    data?: string;
    attachmentId?: string;
    size?: number;
  };
  headers?: GmailHeader[];
  parts?: GmailMessagePart[];
  filename?: string | null;
};
type GraphRecipient = { emailAddress?: { address?: string; name?: string } };

serve(async (req: any) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requireEnv = (name: string) => {
      const v = Deno.env.get(name);
      if (!v) throw new Error(`Missing environment variable: ${name}`);
      return v;
    };
    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    let payload: { accountId: string } | null;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { accountId } = (payload || {}) as { accountId: string };

    if (!accountId) {
      throw new Error("Missing required field: accountId");
    }

    // Fetch email account details
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    if (accountError || !account) {
      throw new Error("Email account not found");
    }

    // Helper to upload attachment to storage
    const uploadAttachment = async (contentBase64: string, filename: string, messageId: string) => {
      try {
        const path = `${messageId}/${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        // Convert base64 to Uint8Array
        const binaryString = atob(contentBase64.replace(/-/g, "+").replace(/_/g, "/"));
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const { error } = await supabase.storage
          .from('email-attachments')
          .upload(path, bytes, {
            contentType: 'application/octet-stream',
            upsert: true
          });
          
        if (error) {
          console.error(`Failed to upload attachment ${path}:`, error);
          return null;
        }
        return path;
      } catch (e) {
        console.error("Error uploading attachment:", e);
        return null;
      }
    };

    let syncedCount = 0;

    // Sync emails based on provider
    if (account.provider === "smtp_imap") {
      // Use IMAP to fetch emails
      const imapConfig = {
        hostname: account.imap_host,
        port: account.imap_port,
        username: account.imap_username,
        password: account.imap_password,
        ssl: account.imap_use_ssl,
      };

      console.log(`Syncing via IMAP for ${account.email_address}:`, imapConfig);

      try {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let conn: Deno.Conn;
        let greetingConsumed = false;

        // Connect with improved error handling and STARTTLS fallback
        const connectImap = async (): Promise<Deno.Conn> => {
          try {
            console.log(`Attempting connection to ${imapConfig.hostname}:${imapConfig.port} (SSL: ${imapConfig.ssl})`);
            if (imapConfig.ssl) {
              return await Deno.connectTls({ hostname: imapConfig.hostname, port: imapConfig.port });
            } else {
              return await Deno.connect({ hostname: imapConfig.hostname, port: imapConfig.port });
            }
          } catch (connError: any) {
             const errMsg = String(connError?.message || connError).toLowerCase();
             console.error("Connection error:", errMsg);
             
             // Check for InvalidContentType (SSL on plain port) or handshake failure
             if (imapConfig.ssl && (errMsg.includes("invalidcontenttype") || errMsg.includes("handshake") || errMsg.includes("record overflow"))) {
               console.warn("SSL handshake failed. Attempting automatic fallback to STARTTLS on plain connection...");
               
               try {
                 // 1. Connect Plain
                 const plainConn = await Deno.connect({ hostname: imapConfig.hostname, port: imapConfig.port });
                 const buf = new Uint8Array(2048);
                 
                 // 2. Read Greeting
                 const n = await plainConn.read(buf);
                 if (!n) throw new Error("Connection closed immediately");
                 const greeting = new TextDecoder().decode(buf.subarray(0, n));
                 console.log("Fallback Greeting:", greeting.trim());
                 
                 // 3. Send STARTTLS
                 await plainConn.write(new TextEncoder().encode("A00 STARTTLS\r\n"));
                 
                 // 4. Read Response
                 const n2 = await plainConn.read(buf);
                 if (!n2) throw new Error("Connection closed during STARTTLS");
                 const resp = new TextDecoder().decode(buf.subarray(0, n2));
                 if (!resp.toUpperCase().includes("OK")) throw new Error("STARTTLS rejected: " + resp);
                 
                 console.log("STARTTLS accepted, upgrading connection...");
                 
                 // 5. Upgrade
                 const secureConn = await Deno.startTls(plainConn, { hostname: imapConfig.hostname });
                 greetingConsumed = true; // We already consumed the greeting
                 return secureConn;
               } catch (fallbackErr: any) {
                 console.error("Fallback failed:", fallbackErr);
                 throw new Error(`SSL/TLS Handshake Failed and STARTTLS Fallback failed. Please check your ports. SSL Error: ${errMsg}. Fallback Error: ${fallbackErr.message}`);
               }
             }
             
             throw connError;
          }
        };

        conn = await connectImap();

        // Helper to read server response with better buffering
        const readResponse = async () => {
          const buffer = new Uint8Array(8192);
          const n = await conn.read(buffer);
          if (n === null) throw new Error("Connection closed");
          return { data: buffer.subarray(0, n), text: decoder.decode(buffer.subarray(0, n)) };
        };

        // Helper to send command and read until completion
        const sendCommand = async (tag: string, cmd: string) => {
          await conn.write(encoder.encode(`${tag} ${cmd}\r\n`));
          let responseText = "";
          let chunks: Uint8Array[] = [];
          
          while (true) {
            const { data, text } = await readResponse();
            chunks.push(data);
            responseText += text;
            
            // Check for completion tags
            if (responseText.includes(`${tag} OK`) || responseText.includes(`${tag} NO`) || responseText.includes(`${tag} BAD`)) {
              break;
            }
            // Safety break for extremely large responses to prevent OOM in Edge Function (limit ~10MB)
            let totalSize = chunks.reduce((acc, c) => acc + c.length, 0);
            if (totalSize > 10 * 1024 * 1024) {
               throw new Error("Response too large (>10MB)");
            }
          }
          return responseText;
        };

        // IMAP conversation
        if (!greetingConsumed) {
          const { text: greeting } = await readResponse(); // Read greeting
          console.log("IMAP Greeting:", greeting.trim());
        } else {
          console.log("IMAP Greeting: (Consumed during STARTTLS handshake)");
        }
        
        // Login
        const loginResp = await sendCommand("A1", `LOGIN ${imapConfig.username} ${imapConfig.password}`);
        if (!loginResp.includes("A1 OK")) {
          throw new Error(`IMAP login failed: ${loginResp}`);
        }

        // Select INBOX
        await sendCommand("A2", "SELECT INBOX");

        // Search for recent messages (last 20)
        const searchResp = await sendCommand("A3", "SEARCH 1:20");
        const messageIds = searchResp.match(/\* SEARCH (.+)/)?.[1]?.split(" ").filter(id => id && id !== "A3") || [];

        console.log(`Found ${messageIds.length} messages in IMAP inbox`);

        // Fetch each message
        for (const msgId of messageIds.slice(0, 20)) {
          try {
            const fetchResp = await sendCommand("A4", `FETCH ${msgId} (FLAGS BODY[HEADER] BODY[TEXT])`);
            
            // Parse email headers and body (basic parsing)
            const headerMatch = fetchResp.match(/BODY\[HEADER\] \{[\d]+\}\r\n([\s\S]+?)\r\n\r\n/);
            const bodyMatch = fetchResp.match(/BODY\[TEXT\] \{[\d]+\}\r\n([\s\S]+?)\r\n\)/);
            
            if (!headerMatch) {
                console.warn(`Could not parse headers for message ${msgId}. Response snippet: ${fetchResp.substring(0, 100)}...`);
                continue;
            }

            const headers = headerMatch[1];
            const bodyText = bodyMatch?.[1] || "";

            const normalizeEmail = (v: string) => String(v || "").trim().toLowerCase();
            const encodeBase64 = (bytes: Uint8Array) => {
              const chunkSize = 0x8000;
              let binary = "";
              for (let i = 0; i < bytes.length; i += chunkSize) {
                binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
              }
              return btoa(binary);
            };

            const rawMessage = `${headers}\r\n\r\n${bodyText}`;
            let parsed: any = null;
            try {
              parsed = await simpleParser(rawMessage);
            } catch (e) {
              console.error(`IMAP mailparser error for message ${msgId}:`, e);
              // Fallback: continue with regex-extracted data if simpleParser fails
            }

            const messageIdHeader = parsed?.messageId
              ? String(parsed.messageId).replace(/[<>]/g, "")
              : (headers.match(/^Message-ID:\s*<(.+)>$/mi)?.[1] || `imap-${msgId}-${Date.now()}`);

            const subject = parsed?.subject || headers.match(/^Subject:\s*(.+)$/mi)?.[1] || "(No Subject)";
            const parsedFrom = parsed?.from?.value?.[0];
            const fromEmail = normalizeEmail(parsedFrom?.address || (headers.match(/^From:\s*(.+)$/mi)?.[1] || ""));
            const fromName = (parsedFrom?.name || "").trim() || (headers.match(/^From:\s*(.+)$/mi)?.[1] || "").replace(/<.+>/, "").trim();

            const toEmails = (parsed?.to?.value || [])
              .map((v: any) => ({ email: normalizeEmail(v.address || ""), name: (v.name || "").trim() || undefined }))
              .filter((v: any) => v.email);
            const ccEmails = (parsed?.cc?.value || [])
              .map((v: any) => ({ email: normalizeEmail(v.address || ""), name: (v.name || "").trim() || undefined }))
              .filter((v: any) => v.email);
            const bccEmails = (parsed?.bcc?.value || [])
              .map((v: any) => ({ email: normalizeEmail(v.address || ""), name: (v.name || "").trim() || undefined }))
              .filter((v: any) => v.email);

            const parsedDate = parsed?.date ? new Date(parsed.date).toISOString() : null;
            const headerDate = headers.match(/^Date:\s*(.+)$/mi)?.[1] || "";
            const receivedAt = parsedDate || (headerDate ? new Date(headerDate).toISOString() : new Date().toISOString());

            const parsedText = (parsed?.text || "").trim();
            const parsedHtml = typeof parsed?.html === "string" ? parsed.html : "";
            const finalText = parsedText || bodyText;
            const finalHtml = parsedHtml || finalText;

            const attachmentsList: any[] = [];
            const parsedAttachments = Array.isArray(parsed?.attachments) ? parsed.attachments : [];
            for (const att of parsedAttachments) {
              try {
                const filename = String(att?.filename || "attachment");
                const content = att?.content instanceof Uint8Array ? att.content : null;
                if (!content) continue;
                const uploadedPath = await uploadAttachment(encodeBase64(content), filename, messageIdHeader);
                if (uploadedPath) {
                  attachmentsList.push({
                    filename,
                    path: uploadedPath,
                    size: content.length,
                    type: String(att?.contentType || "application/octet-stream"),
                    content_id: att?.cid || null,
                  });
                }
              } catch (e) {
                console.error("IMAP attachment processing failed:", e);
              }
            }

            const { data: existing } = await supabase
              .from("emails")
              .select("id")
              .eq("message_id", messageIdHeader)
              .eq("account_id", account.id)
              .single();

            if (existing) {
              console.log(`Email ${messageIdHeader} already exists, skipping`);
              continue;
            }

            // Insert email
            const { error: insertError } = await supabase.from("emails").insert({
              account_id: account.id,
              tenant_id: account.tenant_id ?? null,
              franchise_id: account.franchise_id ?? null,
              message_id: messageIdHeader,
              subject,
              from_email: fromEmail,
              from_name: fromName || null,
              to_emails: toEmails.length ? toEmails : [],
              cc_emails: ccEmails,
              bcc_emails: bccEmails,
              body_text: finalText,
              body_html: finalHtml,
              snippet: String(finalText || "").substring(0, 200),
              has_attachments: attachmentsList.length > 0,
              attachments: attachmentsList,
              direction: "inbound",
              status: "received",
              is_read: fetchResp.includes("\\Seen"),
              folder: "inbox",
              received_at: receivedAt,
            });

            if (insertError) {
              console.error(`Error inserting email ${messageIdHeader}:`, insertError);
            } else {
              syncedCount++;
              console.log(`Synced email: ${subject}`);
            }
          } catch (msgError: unknown) {
            console.error(`Error processing IMAP message ${msgId}:`, msgError instanceof Error ? msgError.message : String(msgError));
          }
        }

        // Logout
        await sendCommand("A99", "LOGOUT");
        conn.close();

        console.log(`IMAP sync completed: ${syncedCount} emails synced`);
      } catch (imapError: unknown) {
        console.error("IMAP error:", imapError);
        const msg = imapError instanceof Error ? imapError.message : String(imapError);
        throw new Error(`Failed to sync via IMAP: ${msg}`);
      }
    } else if (account.provider === "gmail") {
      // Use Gmail API
      console.log("Syncing via Gmail API for account:", account.email_address);
      
      // Helper to refresh Gmail access token using stored refresh_token and oauth config
      const refreshGmailToken = async (): Promise<boolean> => {
        try {
          if (!account.refresh_token) {
            console.warn("No refresh token available for Gmail account");
            return false;
          }

          const { data: oauthCfg, error: oauthErr } = await supabase
            .from("oauth_configurations")
            .select("client_id, client_secret")
            .eq("provider", "gmail")
            .eq("user_id", account.user_id)
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (oauthErr || !oauthCfg) {
            console.error("OAuth configuration not found for Gmail refresh:", oauthErr);
            return false;
          }

          const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: oauthCfg.client_id,
              client_secret: oauthCfg.client_secret,
              grant_type: "refresh_token",
              refresh_token: account.refresh_token!,
            }),
          });

          if (!tokenResp.ok) {
            const t = await tokenResp.text();
            console.error("Failed to refresh Gmail access token:", t);
            return false;
          }

          const tokenJson = await tokenResp.json();
          const newAccess = tokenJson.access_token as string | undefined;
          const expiresIn = (tokenJson.expires_in as number | undefined) ?? 3600;
          if (!newAccess) {
            console.error("Token refresh response missing access_token:", tokenJson);
            return false;
          }

          const expiryIso = new Date(Date.now() + expiresIn * 1000).toISOString();
          await supabase
            .from("email_accounts")
            .update({ access_token: newAccess, token_expires_at: expiryIso })
            .eq("id", account.id);

          account.access_token = newAccess;
          account.token_expires_at = expiryIso;
          console.log("Gmail access token refreshed");
          return true;
        } catch (e) {
          console.error("Exception while refreshing Gmail token:", e instanceof Error ? e.message : String(e));
          return false;
        }
      };

      // Ensure we have a valid token (refresh if expired/missing)
      if (!account.access_token || (account.token_expires_at && new Date(account.token_expires_at) < new Date())) {
        const ok = await refreshGmailToken();
        if (!ok && !account.access_token) {
          throw new Error("No access token available for Gmail account");
        }
      }

      const normalizeEmail = (v: string) => String(v || "").trim().toLowerCase();
      const parseEmailList = (value?: string): { email: string; name?: string }[] => {
        if (!value) return [];
        return value
          .split(",")
          .map(part => part.trim())
          .map(part => {
            const m = part.match(/^(.*)<([^>]+)>$/);
            const email = normalizeEmail(m ? m[2] : part);
            const nameRaw = m ? m[1].trim() : "";
            const name = nameRaw ? nameRaw.replace(/^"|"$/g, "") : undefined;
            return email ? { email, name } : null;
          })
          .filter(Boolean) as { email: string; name?: string }[];
      };

      const syncGmailLabel = async (labelId: string, folder: string, direction: "inbound" | "outbound") => {
        const gmailApiUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=${encodeURIComponent(labelId)}`;
        let listResponse = await fetch(gmailApiUrl, {
          headers: { Authorization: `Bearer ${account.access_token}` },
        });

        if (!listResponse.ok) {
          const errorText = await listResponse.text();
          console.error("Gmail API list error:", errorText);
          if (listResponse.status === 401) {
            const refreshed = await refreshGmailToken();
            if (refreshed) {
              listResponse = await fetch(gmailApiUrl, {
                headers: { Authorization: `Bearer ${account.access_token}` },
              });
            }
          }
        }

        if (!listResponse.ok) {
          const errorText = await listResponse.text();
          console.error("Gmail API list error (after refresh if attempted):", errorText);
          throw new Error(`Gmail API error: ${listResponse.status} - ${errorText}`);
        }

        const listData = await listResponse.json();
        console.log(`Found ${listData.messages?.length || 0} Gmail messages in ${folder}`);

        if (!listData.messages || listData.messages.length === 0) return;

        for (const msg of listData.messages) {
          try {
            const msgResponse = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
              { headers: { Authorization: `Bearer ${account.access_token}` } }
            );

            if (!msgResponse.ok) {
              console.error(`Failed to fetch message ${msg.id}`);
              continue;
            }

            const msgData = await msgResponse.json();

            const headers = (msgData.payload.headers as GmailHeader[]).reduce((acc: Record<string, string>, h: GmailHeader) => {
              acc[h.name.toLowerCase()] = h.value;
              return acc;
            }, {} as Record<string, string>);

            const subject = headers.subject || "(No Subject)";
            const from = headers.from || "";
            const to = headers.to || "";
            const ccHeader = headers.cc || "";
            const bccHeader = headers.bcc || "";
            const date = headers.date || new Date().toISOString();

            const priority = headers["x-priority"] || headers["priority"] || "normal";
            const importance = headers["importance"] || "normal";
            const inReplyTo = headers["in-reply-to"] || null;
            const references = headers["references"] ? headers["references"].split(/\s+/) : [];
            const messageId = headers["message-id"] || msgData.id;

            let bodyText = "";
            let bodyHtml = "";
            let hasInlineImages = false;
            const attachmentsList: any[] = [];

            const processMessageParts = async (part: GmailMessagePart) => {
              if (part.mimeType === "text/plain" && part.body?.data) {
                bodyText = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
              } else if (part.mimeType === "text/html" && part.body?.data) {
                bodyHtml = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
                if (bodyHtml.includes("cid:") || bodyHtml.includes("data:image/")) {
                  hasInlineImages = true;
                }
              } else if (part.filename && part.body?.attachmentId) {
                try {
                  const attResp = await fetch(
                    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgData.id}/attachments/${part.body.attachmentId}`,
                    { headers: { Authorization: `Bearer ${account.access_token}` } }
                  );

                  if (attResp.ok) {
                    const attData = await attResp.json();
                    if (attData.data) {
                      const uploadedPath = await uploadAttachment(attData.data, part.filename, msgData.id);
                      if (uploadedPath) {
                        attachmentsList.push({
                          filename: part.filename,
                          path: uploadedPath,
                          size: attData.size || part.body.size,
                          type: part.mimeType,
                          content_id: part.headers?.find((h: GmailHeader) => h.name === "Content-ID")?.value
                        });
                      }
                    }
                  }
                } catch (e) {
                  console.error(`Failed to process attachment ${part.filename}:`, e);
                }
              }

              if (part.mimeType?.startsWith("image/") && part.headers?.find((h: GmailHeader) => h.name === "Content-ID")) {
                hasInlineImages = true;
              }

              if (part.parts) {
                for (const subPart of part.parts) {
                  await processMessageParts(subPart);
                }
              }
            };

            await processMessageParts(msgData.payload);

            const { data: existing } = await supabase
              .from("emails")
              .select("id")
              .eq("message_id", msgData.id)
              .eq("account_id", account.id)
              .single();

            if (existing) {
              console.log(`Email ${msgData.id} already exists, skipping`);
              continue;
            }

            const emailPayload = {
              account_id: account.id,
              tenant_id: account.tenant_id ?? null,
              franchise_id: account.franchise_id ?? null,
              message_id: msgData.id,
              thread_id: msgData.threadId,
              subject,
              from_email: normalizeEmail((from.match(/<(.+)>/)?.[1] || from)),
              from_name: from.replace(/<.+>/, "").trim(),
              to_emails: parseEmailList(to),
              cc_emails: parseEmailList(ccHeader),
              bcc_emails: parseEmailList(bccHeader),
              reply_to: headers["reply-to"] || null,
              body_text: bodyText || bodyHtml.replace(/<[^>]*>/g, ""),
              body_html: bodyHtml || bodyText,
              snippet: msgData.snippet || "",
              has_attachments: attachmentsList.length > 0,
              attachments: attachmentsList,
              direction,
              status: direction === "outbound" ? "sent" : "received",
              is_read: direction === "outbound" ? true : !msgData.labelIds?.includes("UNREAD"),
              is_starred: msgData.labelIds?.includes("STARRED") || false,
              is_archived: false,
              is_spam: msgData.labelIds?.includes("SPAM") || false,
              is_deleted: false,
              folder,
              labels: msgData.labelIds || [],
              category: null,
              lead_id: null,
              contact_id: null,
              account_id_crm: null,
              opportunity_id: null,
              sent_at: direction === "outbound" ? new Date(date).toISOString() : null,
              received_at: new Date(date).toISOString(),
              priority,
              importance,
              in_reply_to: inReplyTo,
              email_references: references,
              size_bytes: msgData.sizeEstimate || null,
              raw_headers: headers,
              conversation_id: msgData.threadId,
              internet_message_id: messageId,
              has_inline_images: hasInlineImages,
              last_sync_attempt: new Date().toISOString(),
            };

            const { error: insertError } = await supabase
              .from("emails")
              .insert(emailPayload);

            if (insertError) {
              console.error(`Error inserting email ${msgData.id}:`, insertError);
              await supabase.from("emails").upsert({
                ...emailPayload,
                sync_error: insertError.message,
              }, { onConflict: "message_id" });
            } else {
              syncedCount++;
              console.log(`Synced email: ${subject}`);
            }
          } catch (msgError: unknown) {
            console.error(`Error processing message ${msg.id}:`, msgError instanceof Error ? msgError.message : String(msgError));
            try {
              await supabase.from("emails").insert({
                account_id: account.id,
                tenant_id: account.tenant_id ?? null,
                franchise_id: account.franchise_id ?? null,
                message_id: msg.id,
                subject: "(Error Processing)",
                from_email: "error@sync.local",
                from_name: "Sync Error",
                to_emails: [],
                direction: "inbound",
                status: "error",
                sync_error: msgError instanceof Error ? msgError.message : String(msgError),
                last_sync_attempt: new Date().toISOString(),
              });
            } catch { void 0; }
          }
        }
      };

      await syncGmailLabel("INBOX", "inbox", "inbound");
      await syncGmailLabel("SENT", "sent", "outbound");
    } else if (account.provider === "office365") {
      // Use Microsoft Outlook REST API (v2.0) with OAuth v2 tokens
      console.log("Syncing via Office365 (Outlook API) for:", account.email_address);

      const refreshOfficeToken = async (): Promise<{ accessToken?: string }> => {
        try {
          if (!account.refresh_token) {
            console.warn("No refresh token available for Office365 account");
            return {};
          }

          const { data: oauthCfg, error: oauthErr } = await supabase
            .from("oauth_configurations")
            .select("client_id, client_secret, tenant_id_provider")
            .eq("provider", "office365")
            .eq("user_id", account.user_id)
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (oauthErr || !oauthCfg) {
            console.error("OAuth configuration not found for Office365 refresh:", oauthErr);
            return {};
          }

          // Detect Microsoft personal accounts (MSA) and use "consumers" tenant
          const lowerEmail = String(account.email_address || "").toLowerCase();
          const isMSA = /@(hotmail|outlook|live|msn)\.com$/.test(lowerEmail);
          const tenant = isMSA ? "consumers" : (oauthCfg.tenant_id_provider || "common");
          
          console.log(`Refreshing token for ${account.email_address} using tenant: ${tenant}`);
          
          const tokenResp = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: oauthCfg.client_id,
              client_secret: oauthCfg.client_secret,
              grant_type: "refresh_token",
              refresh_token: account.refresh_token!,
              scope: [
                "https://graph.microsoft.com/Mail.Read",
                "https://graph.microsoft.com/Mail.Send",
                "https://graph.microsoft.com/Mail.ReadWrite",
                "offline_access",
                "openid",
                "profile",
                "email",
              ].join(" "),
            }),
          });

          if (!tokenResp.ok) {
            const t = await tokenResp.text();
            console.error("Failed to refresh Office365 access token:", t);
            return {};
          }

          const tData = await tokenResp.json();
          const accessToken = tData.access_token as string;

          // Persist updated token and expiry
          await supabase
            .from("email_accounts")
            .update({
              access_token: accessToken,
              token_expires_at: new Date(Date.now() + (tData.expires_in ?? 3600) * 1000).toISOString(),
            })
            .eq("id", account.id);

          return { accessToken };
        } catch (e) {
          console.error("Office365 token refresh error", e);
          return {};
        }
      };

      // Ensure we have a valid token (refresh if expired/missing)
      let officeToken = account.access_token as string | undefined;
      if (!officeToken || (account.token_expires_at && new Date(account.token_expires_at) < new Date())) {
        const { accessToken } = await refreshOfficeToken();
        officeToken = accessToken || officeToken;
        if (!officeToken) {
          return new Response(
            JSON.stringify({ success: false, error: "Authorization required. Please re-authorize your Office 365 account.", code: "AUTH_REQUIRED" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
      }

      const syncOfficeFolder = async (folder: string, folderId: string, direction: "inbound" | "outbound") => {
        const baseUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/${folderId}/messages`;
        const orderBy = direction === "outbound" ? "sentDateTime desc" : "receivedDateTime desc";
        const query = new URLSearchParams({
          "$top": "20",
          "$select": [
            "id",
            "subject",
            "from",
            "sender",
            "toRecipients",
            "ccRecipients",
            "bccRecipients",
            "bodyPreview",
            "body",
            "hasAttachments",
            "isRead",
            "categories",
            "conversationId",
            "receivedDateTime",
            "sentDateTime",
            "importance",
            "flag",
            "internetMessageId",
          ].join(","),
          "$orderby": orderBy,
        }).toString();

        const listUrl = `${baseUrl}?${query}`;
        let listRes = await fetch(listUrl, {
          headers: { Authorization: `Bearer ${officeToken}` },
        });

        if (!listRes.ok) {
          const errTxt = await listRes.text();
          if (listRes.status === 401) {
            const { accessToken } = await refreshOfficeToken();
            if (accessToken) {
              officeToken = accessToken;
              listRes = await fetch(listUrl, {
                headers: { Authorization: `Bearer ${officeToken}` },
              });
            } else {
              return new Response(
                JSON.stringify({ success: false, error: "Authorization required. Please re-authorize your Office 365 account.", code: "AUTH_REQUIRED" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
              );
            }
          } else {
            return new Response(
              JSON.stringify({ success: false, error: `Office365 API error: ${listRes.status} - ${errTxt}`, code: "PROVIDER_ERROR" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
          }
        }

        const listJson = await listRes.json();
        const messages = listJson.value || [];
        console.log(`Found ${messages.length} Office365 messages in ${folder}`);

        for (const m of messages) {
          try {
            const messageId = m.id || m.internetMessageId;
            if (!messageId) continue;

            const subject = m.subject || "(No Subject)";
            const fromAddr = (m.from?.emailAddress?.address || m.sender?.emailAddress?.address || "").toLowerCase();
            const fromName = m.from?.emailAddress?.name || m.sender?.emailAddress?.name || fromAddr;

            const toRecipients = (m.toRecipients || []).map((r: GraphRecipient) => ({ email: (r.emailAddress?.address || "").toLowerCase(), name: r.emailAddress?.name || undefined }));
            const ccRecipients = (m.ccRecipients || []).map((r: GraphRecipient) => ({ email: (r.emailAddress?.address || "").toLowerCase(), name: r.emailAddress?.name || undefined }));
            const bccRecipients = (m.bccRecipients || []).map((r: GraphRecipient) => ({ email: (r.emailAddress?.address || "").toLowerCase(), name: r.emailAddress?.name || undefined }));

            const bodyContentType = m.body?.contentType || "text";
            const bodyContent = m.body?.content || "";
            const bodyText = bodyContentType.toLowerCase() === "html" ? bodyContent.replace(/<[^>]*>/g, "") : bodyContent;
            const bodyHtml = bodyContentType.toLowerCase() === "html" ? bodyContent : "";

            const receivedAt = m.receivedDateTime || null;
            const sentAt = m.sentDateTime || null;
            const messageTs = direction === "outbound" ? (sentAt || receivedAt || new Date().toISOString()) : (receivedAt || new Date().toISOString());

            const priority = m.importance?.toLowerCase() || "normal";
            const hasInlineImages = bodyHtml?.includes("cid:") || bodyHtml?.includes("data:image/") || false;
            const internetMessageId = m.internetMessageId || m.id;

            const attachmentsList: any[] = [];
            if (m.hasAttachments) {
              try {
                const attRes = await fetch(
                  `https://graph.microsoft.com/v1.0/me/messages/${m.id}/attachments`,
                  { headers: { Authorization: `Bearer ${officeToken}` } }
                );
                if (attRes.ok) {
                  const attJson = await attRes.json();
                  const attachments = attJson.value || [];
                  for (const att of attachments) {
                    if (att["@odata.type"] === "#microsoft.graph.fileAttachment" && att.contentBytes) {
                      const uploadedPath = await uploadAttachment(att.contentBytes, att.name, m.id);
                      if (uploadedPath) {
                        attachmentsList.push({
                          filename: att.name,
                          path: uploadedPath,
                          size: att.size,
                          type: att.contentType,
                          content_id: att.contentId
                        });
                      }
                    }
                  }
                }
              } catch (e) {
                console.error(`Failed to fetch Office365 attachments for ${m.id}`, e);
              }
            }

            const { data: existing } = await supabase
              .from("emails")
              .select("id")
              .eq("message_id", messageId)
              .eq("account_id", account.id)
              .single();

            if (existing) continue;

            const emailPayload = {
              account_id: account.id,
              tenant_id: account.tenant_id ?? null,
              franchise_id: account.franchise_id ?? null,
              message_id: messageId,
              thread_id: m.conversationId ?? null,
              subject,
              from_email: fromAddr,
              from_name: fromName,
              to_emails: toRecipients,
              cc_emails: ccRecipients,
              bcc_emails: bccRecipients,
              reply_to: null,
              body_text: bodyText,
              body_html: bodyHtml,
              snippet: m.bodyPreview || "",
              has_attachments: !!m.hasAttachments,
              attachments: attachmentsList,
              direction,
              status: direction === "outbound" ? "sent" : "received",
              is_read: direction === "outbound" ? true : !!m.isRead,
              is_starred: m.flag?.flagStatus === "flagged" || false,
              is_archived: false,
              is_spam: false,
              is_deleted: false,
              folder,
              labels: Array.isArray(m.categories) ? m.categories : [],
              category: null,
              lead_id: null,
              contact_id: null,
              account_id_crm: null,
              opportunity_id: null,
              sent_at: direction === "outbound" ? (sentAt || messageTs) : null,
              received_at: messageTs,
              priority,
              importance: priority,
              in_reply_to: null,
              email_references: [],
              size_bytes: null,
              raw_headers: {
                subject: m.subject,
                from: fromAddr,
                importance: m.importance,
                conversationId: m.conversationId,
              },
              conversation_id: m.conversationId,
              internet_message_id: internetMessageId,
              has_inline_images: hasInlineImages,
              last_sync_attempt: new Date().toISOString(),
            };

            const { error: insertErr } = await supabase.from("emails").insert(emailPayload);
            if (insertErr) {
              console.error("Error inserting Office365 email:", insertErr);
            } else {
              syncedCount++;
              console.log(`Successfully synced email: ${subject}`);
            }
          } catch (msgErr: unknown) {
            const msg = msgErr instanceof Error ? msgErr.message : String(msgErr);
            console.error("Error processing Office365 message:", msg);
          }
        }
      };

      const inboxRes = await syncOfficeFolder("inbox", "Inbox", "inbound");
      if (inboxRes instanceof Response) return inboxRes;
      const sentRes = await syncOfficeFolder("sent", "SentItems", "outbound");
      if (sentRes instanceof Response) return sentRes;
    }

    console.log(`Total emails synced: ${syncedCount}`);
    const { error: updateError } = await supabase
      .from("email_accounts")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", accountId);

    if (updateError) {
      console.error("Error updating last sync time:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncedCount,
        message: `Synced ${syncedCount} emails successfully`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Error syncing emails:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error instanceof Error) ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
