// /// <reference types="https://esm.sh/@supabase/functions@1.3.1/types.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GmailHeader = { name: string; value: string };
type GmailMessagePart = {
  mimeType?: string;
  body?: { data?: string };
  headers?: GmailHeader[];
  parts?: GmailMessagePart[];
  filename?: string | null;
};
type GraphRecipient = { emailAddress?: { address?: string; name?: string } };

serve(async (req) => {
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

      console.log("Syncing via IMAP:", imapConfig);

      try {
        // Connect to IMAP server
        const conn = imapConfig.ssl
          ? await Deno.connectTls({ hostname: imapConfig.hostname, port: imapConfig.port })
          : await Deno.connect({ hostname: imapConfig.hostname, port: imapConfig.port });

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        // Helper to read server response
        const readResponse = async () => {
          const buffer = new Uint8Array(4096);
          const n = await conn.read(buffer);
          if (n === null) throw new Error("Connection closed");
          return decoder.decode(buffer.subarray(0, n));
        };

        // Helper to send command
        const sendCommand = async (tag: string, cmd: string) => {
          await conn.write(encoder.encode(`${tag} ${cmd}\r\n`));
          let response = "";
          while (true) {
            const chunk = await readResponse();
            response += chunk;
            if (response.includes(`${tag} OK`) || response.includes(`${tag} NO`) || response.includes(`${tag} BAD`)) {
              break;
            }
          }
          return response;
        };

        // IMAP conversation
        await readResponse(); // Read greeting
        
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
            
            if (!headerMatch) continue;

            const headers = headerMatch[1];
            const bodyText = bodyMatch?.[1] || "";

            // Extract header fields
            const subject = headers.match(/^Subject: (.+)$/mi)?.[1] || "(No Subject)";
            const from = headers.match(/^From: (.+)$/mi)?.[1] || "";
            const to = headers.match(/^To: (.+)$/mi)?.[1] || "";
            const date = headers.match(/^Date: (.+)$/mi)?.[1] || new Date().toISOString();
            const messageIdHeader = headers.match(/^Message-ID: <(.+)>$/mi)?.[1] || `imap-${msgId}-${Date.now()}`;

            // Check if email already exists
            const { data: existing } = await supabase
              .from("emails")
              .select("id")
              .eq("message_id", messageIdHeader)
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
              from_email: (from.match(/<(.+)>/)?.[1] || from).toLowerCase(),
              from_name: from.replace(/<.+>/, "").trim(),
              to_emails: [{ email: (to.match(/<(.+)>/)?.[1] || to).toLowerCase() }],
              body_text: bodyText,
              body_html: bodyText,
              snippet: bodyText.substring(0, 200),
              direction: "inbound",
              status: "received",
              is_read: fetchResp.includes("\\Seen"),
              folder: "inbox",
              received_at: new Date(date).toISOString(),
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

      // Fetch messages from Gmail API
      const gmailApiUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=INBOX";
      let listResponse = await fetch(gmailApiUrl, {
        headers: { Authorization: `Bearer ${account.access_token}` },
      });

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        console.error("Gmail API list error:", errorText);
        if (listResponse.status === 401) {
          // Try refresh once and retry
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
      console.log(`Found ${listData.messages?.length || 0} messages in Gmail inbox`);

      if (listData.messages && listData.messages.length > 0) {
        for (const msg of listData.messages) {
          try {
            // Fetch full message details
            const msgResponse = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
              {
                headers: {
                  Authorization: `Bearer ${account.access_token}`,
                },
              }
            );

            if (!msgResponse.ok) {
              console.error(`Failed to fetch message ${msg.id}`);
              continue;
            }

            const msgData = await msgResponse.json();
            
            // Parse email headers
            const headers = (msgData.payload.headers as GmailHeader[]).reduce((acc: Record<string, string>, h: GmailHeader) => {
              acc[h.name.toLowerCase()] = h.value;
              return acc;
            }, {} as Record<string, string>);

            const subject = headers.subject || "(No Subject)";
            const from = headers.from || "";
            const to = headers.to || "";
            const date = headers.date || new Date().toISOString();
            
            // Extract additional email metadata
            const priority = headers['x-priority'] || headers['priority'] || 'normal';
            const importance = headers['importance'] || 'normal';
            const inReplyTo = headers['in-reply-to'] || null;
            const references = headers['references'] ? headers['references'].split(/\s+/) : [];
            const messageId = headers['message-id'] || msgData.id;

            // Extract body and check for inline images
            let bodyText = "";
            let bodyHtml = "";
            let hasInlineImages = false;
            
            const getBody = (part: GmailMessagePart): void => {
              if (part.mimeType === "text/plain" && part.body?.data) {
                bodyText = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
              } else if (part.mimeType === "text/html" && part.body?.data) {
                bodyHtml = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
                // Check for inline images
                if (bodyHtml.includes('cid:') || bodyHtml.includes('data:image/')) {
                  hasInlineImages = true;
                }
              } else if (part.mimeType?.startsWith('image/') && part.headers?.find((h: GmailHeader) => h.name === 'Content-ID')) {
                hasInlineImages = true;
              } else if (part.parts) {
                part.parts.forEach(getBody);
              }
            };
            
            getBody(msgData.payload);

            // Check if email already exists
            const { data: existing } = await supabase
              .from("emails")
              .select("id")
              .eq("message_id", msgData.id)
              .single();

            if (existing) {
              console.log(`Email ${msgData.id} already exists, skipping`);
              continue;
            }

            // Insert email with enhanced fields
            const emailPayload = {
              account_id: account.id,
              tenant_id: account.tenant_id ?? null,
              franchise_id: account.franchise_id ?? null,
              message_id: msgData.id,
              thread_id: msgData.threadId,
              subject,
              from_email: (from.match(/<(.+)>/)?.[1] || from).toLowerCase(),
              from_name: from.replace(/<.+>/, "").trim(),
              to_emails: [{ email: (to.match(/<(.+)>/)?.[1] || to).toLowerCase() }],
              cc_emails: [],
              bcc_emails: [],
              reply_to: headers["reply-to"] || null,
              body_text: bodyText || bodyHtml.replace(/<[^>]*>/g, ""),
              body_html: bodyHtml || bodyText,
              snippet: msgData.snippet || "",
              has_attachments: (msgData.payload.parts as GmailMessagePart[] | undefined)?.some((p: GmailMessagePart) => !!p.filename) || false,
              attachments: [],
              direction: "inbound",
              status: "received",
              is_read: !msgData.labelIds?.includes("UNREAD"),
              is_starred: msgData.labelIds?.includes("STARRED") || false,
              is_archived: false,
              is_spam: msgData.labelIds?.includes("SPAM") || false,
              is_deleted: false,
              folder: "inbox",
              labels: msgData.labelIds || [],
              category: null,
              lead_id: null,
              contact_id: null,
              account_id_crm: null,
              opportunity_id: null,
              sent_at: null,
              received_at: new Date(date).toISOString(),
              // New enhanced fields
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
              // Log sync error to database
              await supabase.from("emails").upsert({
                ...emailPayload,
                sync_error: insertError.message,
              }, { onConflict: 'message_id' });
            } else {
              syncedCount++;
              console.log(`Synced email: ${subject}`);
            }
          } catch (msgError: unknown) {
            console.error(`Error processing message ${msg.id}:`, msgError instanceof Error ? msgError.message : String(msgError));
            // Attempt to log the error
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
      }
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

      // List messages from Inbox using Microsoft Graph API
      // Using lowerCamelCase field names as per Microsoft Graph API spec
      const baseUrl = "https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages";
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
        "$orderby": "receivedDateTime desc",
      }).toString();

      const listUrl = `${baseUrl}?${query}`;
      let listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${officeToken}` },
      });

      if (!listRes.ok) {
        const errTxt = await listRes.text();
        // If unauthorized, try to refresh once
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
          // Non-401 failure: return a structured error without re-reading body later
          if (!listRes.ok) {
            return new Response(
              JSON.stringify({ success: false, error: `Office365 API error: ${listRes.status} - ${errTxt}`, code: "PROVIDER_ERROR" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
          }
        }
      }

      // Successful response at this point
      const listJson = await listRes.json();
      const messages = listJson.value || [];
      console.log(`Found ${messages.length} Office365 messages`);

      // Debug: log structure of first message
      if (messages.length > 0) {
        console.log("First message keys:", Object.keys(messages[0]));
      }

      for (const m of messages) {
        try {
          // Use lowerCamelCase properties as returned by Microsoft Graph API
          const messageId = m.id || m.internetMessageId;
          
          // Skip if no valid message ID
          if (!messageId) {
            console.warn("Skipping message with no id or internetMessageId");
            continue;
          }

          const subject = m.subject || "(No Subject)";
          const fromAddr = m.from?.emailAddress?.address || m.sender?.emailAddress?.address || "";
          const fromName = m.from?.emailAddress?.name || m.sender?.emailAddress?.name || fromAddr;

          const toRecipients = (m.toRecipients || []).map((r: GraphRecipient) => ({ email: r.emailAddress?.address || "" }));
          const ccRecipients = (m.ccRecipients || []).map((r: GraphRecipient) => ({ email: r.emailAddress?.address || "" }));
          const bccRecipients = (m.bccRecipients || []).map((r: GraphRecipient) => ({ email: r.emailAddress?.address || "" }));

          const bodyContentType = m.body?.contentType || "text";
          const bodyContent = m.body?.content || "";
          const bodyText = bodyContentType.toLowerCase() === "html" ? bodyContent.replace(/<[^>]*>/g, "") : bodyContent;
          const bodyHtml = bodyContentType.toLowerCase() === "html" ? bodyContent : "";

          const receivedAt = m.receivedDateTime || new Date().toISOString();
          const sentAt = m.sentDateTime || null;
          
          // Extract Office 365 specific metadata
          const priority = m.importance?.toLowerCase() || 'normal';
          const hasInlineImages = bodyHtml?.includes('cid:') || bodyHtml?.includes('data:image/') || false;
          const internetMessageId = m.internetMessageId || m.id;

          // Check if exists
          const { data: existing } = await supabase
            .from("emails")
            .select("id")
            .eq("message_id", messageId)
            .eq("account_id", account.id)
            .single();

          if (existing) {
            console.log(`Email ${messageId} already exists, skipping`);
            continue;
          }

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
            attachments: [],
            direction: "inbound",
            status: "received",
            is_read: !!m.isRead,
            is_starred: m.flag?.flagStatus === "flagged" || false,
            is_archived: false,
            is_spam: false,
            is_deleted: false,
            folder: "inbox",
            labels: Array.isArray(m.categories) ? m.categories : [],
            category: null,
            lead_id: null,
            contact_id: null,
            account_id_crm: null,
            opportunity_id: null,
            sent_at: sentAt,
            received_at: receivedAt,
            // Enhanced Office 365 fields
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
