import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { accountId } = await req.json();

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
      // TODO: Implement actual IMAP syncing
      syncedCount = 0;
    } else if (account.provider === "gmail") {
      // Use Gmail API
      console.log("Syncing via Gmail API for account:", account.email_address);
      
      if (!account.access_token) {
        throw new Error("No access token available for Gmail account");
      }

      // Fetch messages from Gmail API
      const gmailApiUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=INBOX";
      const listResponse = await fetch(gmailApiUrl, {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
        },
      });

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        console.error("Gmail API list error:", errorText);
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
            const headers = msgData.payload.headers.reduce((acc: any, h: any) => {
              acc[h.name.toLowerCase()] = h.value;
              return acc;
            }, {});

            const subject = headers.subject || "(No Subject)";
            const from = headers.from || "";
            const to = headers.to || "";
            const date = headers.date || new Date().toISOString();

            // Extract body
            let bodyText = "";
            let bodyHtml = "";
            
            const getBody = (part: any): void => {
              if (part.mimeType === "text/plain" && part.body?.data) {
                bodyText = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
              } else if (part.mimeType === "text/html" && part.body?.data) {
                bodyHtml = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
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

            // Insert email
            const emailPayload = {
              account_id: account.id,
              tenant_id: account.tenant_id ?? null,
              franchise_id: account.franchise_id ?? null,
              message_id: msgData.id,
              thread_id: msgData.threadId,
              subject,
              from_email: from.match(/<(.+)>/)?.[1] || from,
              from_name: from.replace(/<.+>/, "").trim(),
              to_emails: [{ email: to.match(/<(.+)>/)?.[1] || to }],
              cc_emails: [],
              bcc_emails: [],
              reply_to: headers["reply-to"] || null,
              body_text: bodyText || bodyHtml.replace(/<[^>]*>/g, ""),
              body_html: bodyHtml || bodyText,
              snippet: msgData.snippet || "",
              has_attachments: msgData.payload.parts?.some((p: any) => p.filename) || false,
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
            };

            const { error: insertError } = await supabase
              .from("emails")
              .insert(emailPayload);

            if (insertError) {
              console.error(`Error inserting email ${msgData.id}:`, insertError);
            } else {
              syncedCount++;
              console.log(`Synced email: ${subject}`);
            }
          } catch (msgError: any) {
            console.error(`Error processing message ${msg.id}:`, msgError.message);
          }
        }
      }
    } else if (account.provider === "office365") {
      // Use Microsoft Graph API
      console.log("Syncing via Microsoft Graph API");
      // TODO: Implement Microsoft Graph API integration
      syncedCount = 0;
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
  } catch (error: any) {
    console.error("Error syncing emails:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
