// Pushes a CRM task to Google Tasks (create/update/delete).
// Uses the same OAuth tokens as Google Calendar (requires the 'tasks' scope).
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

function buildTaskBody(task: any) {
  const body: any = {
    title: task.title || "Tarefa",
    notes: task.description || undefined,
    status: task.status === "concluida" || task.completed ? "completed" : "needsAction",
  };
  if (task.due_date) {
    // Google Tasks "due" is RFC3339 but only the date is honored.
    body.due = new Date(task.due_date).toISOString();
  }
  return body;
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

    const body = await req.json();
    const action: "create" | "update" | "delete" = body.action || "create";
    const task_id: string | undefined = body.task_id;
    if (!task_id) throw new Error("task_id required");

    // Try to get OAuth tokens; if user has no Google integration, no-op.
    let access_token: string;
    try {
      const tok = await getValidAccessToken(supabase, userData.user.id);
      access_token = tok.access_token;
    } catch {
      return new Response(JSON.stringify({ skipped: true, reason: "no_google_integration" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client to fetch + update the task row.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: task } = await admin.from("tasks").select("*").eq("id", task_id).maybeSingle();
    if (!task && action !== "delete") throw new Error("task not found");

    const listId = await getDefaultTaskList(access_token);

    if (action === "delete") {
      const gid = body.google_task_id || task?.google_task_id;
      if (!gid) return new Response(JSON.stringify({ skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const res = await fetch(`${TASKS_API}/lists/${listId}/tasks/${gid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`tasks delete: ${JSON.stringify(err)}`);
      }
      return new Response(JSON.stringify({ ok: true, deleted: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = buildTaskBody(task);

    if (task.google_task_id && action !== "create") {
      const res = await fetch(`${TASKS_API}/lists/${listId}/tasks/${task.google_task_id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`tasks update: ${JSON.stringify(data)}`);
      await admin.from("tasks").update({ google_synced_at: new Date().toISOString() }).eq("id", task_id);
      return new Response(JSON.stringify({ ok: true, updated: true, google_task_id: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create
    const res = await fetch(`${TASKS_API}/lists/${listId}/tasks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`tasks create: ${JSON.stringify(data)}`);

    await admin.from("tasks").update({
      google_task_id: data.id,
      google_synced_at: new Date().toISOString(),
      external_source: task.external_source || "crm",
    }).eq("id", task_id);

    return new Response(JSON.stringify({ ok: true, created: true, google_task_id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[google-tasks-push]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
