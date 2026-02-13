import { serveWithLogger } from "../_shared/logger.ts";
import { createServiceClient } from "../_shared/auth.ts";
import { pickEmbeddingModel } from "../_shared/model-router.ts";

type Table = "knowledge_base" | "master_hts";

interface Payload {
  table: Table;
  id?: string;
  text?: string;
  batch?: boolean;
  limit?: number;
}

async function generate(text: string) {
  const { url, headers, model } = pickEmbeddingModel();
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return json.data[0].embedding as number[];
}

serveWithLogger(async (req, logger, supabase) => {
  if (req.method === "OPTIONS") return new Response(null);
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });

  const payload = (await req.json()) as Payload;
  const admin = createServiceClient();

  if (payload.table === "knowledge_base") {
    if (payload.batch) {
      const { data } = await admin
        .from("knowledge_base")
        .select("id,title,content")
        .is("embedding", null)
        .limit(payload.limit ?? 500);
      for (const row of data ?? []) {
        const emb = await generate(`${row.title}\n\n${row.content}`.slice(0, 8000));
        await admin.from("knowledge_base").update({ embedding: emb }).eq("id", row.id);
      }
      return new Response(JSON.stringify({ processed: data?.length ?? 0 }));
    } else if (payload.id) {
      const { data, error } = await admin
        .from("knowledge_base")
        .select("id,title,content")
        .eq("id", payload.id)
        .single();
      if (error || !data)
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      const emb = await generate(`${data.title}\n\n${data.content}`.slice(0, 8000));
      await admin.from("knowledge_base").update({ embedding: emb }).eq("id", data.id);
      return new Response(JSON.stringify({ updated: 1 }));
    } else if (payload.text) {
      const emb = await generate(payload.text.slice(0, 8000));
      return new Response(JSON.stringify({ embedding: emb }));
    }
  }

  if (payload.table === "master_hts") {
    if (payload.batch) {
      const { data } = await admin
        .from("master_hts")
        .select("id,hts_code,description")
        .is("embedding", null)
        .limit(payload.limit ?? 2000);
      for (const row of data ?? []) {
        const emb = await generate(`${row.hts_code} ${row.description}`.slice(0, 8000));
        await admin.from("master_hts").update({ embedding: emb }).eq("id", row.id);
      }
      return new Response(JSON.stringify({ processed: data?.length ?? 0 }));
    } else if (payload.id) {
      const { data, error } = await admin
        .from("master_hts")
        .select("id,hts_code,description")
        .eq("id", payload.id)
        .single();
      if (error || !data)
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      const emb = await generate(`${data.hts_code} ${data.description}`.slice(0, 8000));
      await admin.from("master_hts").update({ embedding: emb }).eq("id", data.id);
      return new Response(JSON.stringify({ updated: 1 }));
    }
  }

  return new Response(JSON.stringify({ error: "Invalid payload" }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}, "generate-embedding");
