// Pulls Google Tasks → CRM tasks for the authenticated user.
// Idempotent: matches by google_task_id; creates or updates as needed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getValidAccessToken } from "../_shared/google-calendar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TASKS_API = "https://tasks.googleapis.com/tasks/v1";

async function getDefaultTaskList(accessToken: string): Promise<string> {
  const res = await fetch(`${TASKS_API}/users/@me/lists`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`tasklists error: ${JSON.stringify(data)}`);
  const def = (data.items || []).find((l: any) => l.title === "My Tasks") || data.items?.[0];
  if (!def) throw new Error("No Google Tasks list found");
  return def.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) throw new Error("Not authenticated");
    const userId = userData.user.id;

    let access_token: string;
    try {
      const tok = await getValidAccessToken(supabase, userId);
      access_token = tok.access_token;
    } catch {
      return new Response(JSON.stringify({ skipped: true, reason: "no_google_integration" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve company_id for the user (required NOT NULL? it's nullable but use profile if exists)
    const { data: profile } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    const company_id = profile?.company_id ?? null;

    const listId = await getDefaultTaskList(access_token);

    // Fetch all tasks (including completed)
    const url = new URL(`${TASKS_API}/lists/${listId}/tasks`);
    url.searchParams.set("showCompleted", "true");
    url.searchParams.set("showHidden", "true");
    url.searchParams.set("maxResults", "100");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`tasks list: ${JSON.stringify(data)}`);

    const items: any[] = data.items || [];
    let created = 0, updated = 0, skipped = 0;

    for (const gt of items) {
      const gid = gt.id;
      const title = gt.title || "(sem título)";
      const description = gt.notes || null;
      const due_date = gt.due ? new Date(gt.due).toISOString() : null;
      const status = gt.status === "completed" ? "concluida" : "pendente";

      // Match by google_task_id
      const { data: existing } = await admin
        .from("tasks")
        .select("id, title, description, due_date, status")
        .eq("google_task_id", gid)
        .maybeSingle();

      if (existing) {
        const needs =
          existing.title !== title ||
          (existing.description ?? null) !== description ||
          (existing.due_date ?? null) !== due_date ||
          existing.status !== status;
        if (needs) {
          await admin.from("tasks").update({
            title, description, due_date, status,
            google_synced_at: new Date().toISOString(),
          }).eq("id", existing.id);
          updated++;
        } else {
          skipped++;
        }
      } else {
        const { error: insErr } = await admin.from("tasks").insert({
          title,
          description,
          due_date,
          status,
          priority: "media",
          owner_id: userId,
          assignee_id: userId,
          company_id,
          google_task_id: gid,
          google_synced_at: new Date().toISOString(),
          external_source: "google",
        });
        if (insErr) {
          console.error("[google-tasks-pull] insert error", insErr);
        } else {
          created++;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, created, updated, skipped, total: items.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[google-tasks-pull]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
