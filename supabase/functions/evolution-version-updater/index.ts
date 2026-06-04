// Evolution API - WhatsApp Web version auto-updater
// Actions: check, update, restart, test, run (full pipeline used by cron)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EASYPANEL_URL = (Deno.env.get("EASYPANEL_URL") || "").replace(/\/+$/, "");
const EASYPANEL_TOKEN = Deno.env.get("EASYPANEL_TOKEN") || "";
const EASYPANEL_PROJECT = Deno.env.get("EASYPANEL_PROJECT") || "";
const EASYPANEL_SERVICE = Deno.env.get("EASYPANEL_SERVICE") || "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const RESTART_COOLDOWN_MS = 15 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------- WhatsApp Web latest version ----------
async function fetchLatestWaWebVersion(): Promise<string | null> {
  try {
    const r = await fetch("https://wppconnect.io/whatsapp-versions/");
    const html = await r.text();
    // Match patterns like 2.3000.1027780619
    const m = html.match(/\b(2\.\d{3,4}\.\d{6,})\b/);
    return m ? m[1] : null;
  } catch (e) {
    console.error("fetchLatestWaWebVersion error:", e);
    return null;
  }
}

// ---------- EasyPanel API ----------
async function easyPanelCall(path: string, body: unknown) {
  const url = `${EASYPANEL_URL}/api/trpc/${path}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${EASYPANEL_TOKEN}`,
    },
    body: JSON.stringify({ json: body }),
  });
  const text = await r.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(`EasyPanel ${path} ${r.status}: ${text}`);
  return data;
}

async function getServiceEnv(): Promise<string> {
  const data = await easyPanelCall("services.app.inspectService", {
    projectName: EASYPANEL_PROJECT,
    serviceName: EASYPANEL_SERVICE,
  });
  return data?.result?.data?.json?.env || "";
}

function upsertEnvVar(env: string, key: string, value: string): string {
  const lines = env ? env.split(/\r?\n/) : [];
  let found = false;
  const out = lines.map((ln) => {
    if (ln.trim().startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return ln;
  });
  if (!found) out.push(`${key}=${value}`);
  return out.filter((l, i) => !(l === "" && i === out.length - 1)).join("\n");
}

function readEnvVar(env: string, key: string): string | null {
  const lines = env.split(/\r?\n/);
  for (const ln of lines) {
    const t = ln.trim();
    if (t.startsWith(`${key}=`)) return t.slice(key.length + 1);
  }
  return null;
}

async function setServiceEnv(envText: string) {
  return easyPanelCall("services.app.updateEnv", {
    projectName: EASYPANEL_PROJECT,
    serviceName: EASYPANEL_SERVICE,
    env: envText,
  });
}

async function deployService() {
  return easyPanelCall("services.app.deployService", {
    projectName: EASYPANEL_PROJECT,
    serviceName: EASYPANEL_SERVICE,
  });
}

// ---------- Evolution API status ----------
async function getEvolutionInstanceStatus(): Promise<string> {
  try {
    const { data: conn } = await supabase
      .from("whatsapp_connections")
      .select("evolution_api_url, evolution_api_key, instance_name")
      .not("instance_name", "is", null)
      .limit(1)
      .maybeSingle();
    if (!conn?.evolution_api_url || !conn?.instance_name) return "unknown";
    const url = `${conn.evolution_api_url.replace(/\/+$/, "")}/instance/connectionState/${conn.instance_name}`;
    const r = await fetch(url, { headers: { apikey: conn.evolution_api_key || "" } });
    const data = await r.json();
    return (data?.instance?.state || data?.state || "unknown").toLowerCase();
  } catch (e) {
    console.error("getEvolutionInstanceStatus error:", e);
    return "error";
  }
}

// ---------- Notify super admins ----------
async function notifySuperAdmins(title: string, message: string) {
  try {
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");
    if (!admins?.length) return;
    const rows = admins.map((a: any) => ({
      user_id: a.user_id,
      titulo: title,
      mensagem: message,
      tipo: "system",
      lida: false,
    }));
    await supabase.from("notificacoes").insert(rows);
  } catch (e) {
    console.error("notifySuperAdmins error:", e);
  }
}

// ---------- State helpers ----------
async function loadState() {
  const { data } = await supabase
    .from("evolution_version_state")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
async function saveState(patch: Record<string, any>) {
  const cur = await loadState();
  if (cur?.id) {
    await supabase.from("evolution_version_state").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", cur.id);
  } else {
    await supabase.from("evolution_version_state").insert({ ...patch });
  }
}
async function logHistory(row: Record<string, any>) {
  await supabase.from("evolution_version_history").insert(row);
}

// ---------- Pipeline ----------
async function doCheck() {
  const latest = await fetchLatestWaWebVersion();
  let current: string | null = null;
  try {
    const env = await getServiceEnv();
    current = readEnvVar(env, "CONFIG_SESSION_PHONE_VERSION");
  } catch (e) {
    console.error("inspectService failed:", e);
  }
  await saveState({
    latest_available_version: latest,
    current_version: current,
    last_check_at: new Date().toISOString(),
  });
  return { latest, current, needsUpdate: !!(latest && current && latest !== current) };
}

async function doUpdate(trigger = "manual") {
  const statusBefore = await getEvolutionInstanceStatus();
  const latest = await fetchLatestWaWebVersion();
  if (!latest) {
    await logHistory({ trigger, success: false, error: "Não foi possível obter versão mais recente", status_before: statusBefore });
    return { success: false, error: "fetch_latest_failed" };
  }

  let env = await getServiceEnv();
  const current = readEnvVar(env, "CONFIG_SESSION_PHONE_VERSION");

  if (current === latest) {
    await saveState({ current_version: current, latest_available_version: latest, last_check_at: new Date().toISOString() });
    return { success: true, changed: false, current, latest };
  }

  // Cooldown
  const state = await loadState();
  if (state?.last_restart_at) {
    const ageMs = Date.now() - new Date(state.last_restart_at).getTime();
    if (ageMs < RESTART_COOLDOWN_MS) {
      const msg = `Cooldown ativo: restart há ${Math.round(ageMs / 60000)}min`;
      await logHistory({ trigger, success: false, error: msg, old_version: current, new_version: latest, status_before: statusBefore });
      await notifySuperAdmins("Evolution: update bloqueado por cooldown", msg);
      return { success: false, error: "cooldown_active", current, latest };
    }
  }

  env = upsertEnvVar(env, "CONFIG_SESSION_PHONE_VERSION", latest);
  env = upsertEnvVar(env, "CONFIG_SESSION_PHONE_NAME", "Chrome");
  env = upsertEnvVar(env, "CONFIG_SESSION_PHONE_CLIENT", "Evolution API");
  await setServiceEnv(env);
  await deployService();
  await saveState({
    current_version: latest,
    latest_available_version: latest,
    last_restart_at: new Date().toISOString(),
    last_status: "restarting",
    last_check_at: new Date().toISOString(),
  });

  // Wait & check
  await new Promise((r) => setTimeout(r, 25000));
  let statusAfter = await getEvolutionInstanceStatus();
  if (!["open", "connected"].includes(statusAfter)) {
    await new Promise((r) => setTimeout(r, 15000));
    statusAfter = await getEvolutionInstanceStatus();
  }

  const success = ["open", "connected"].includes(statusAfter);
  await saveState({ last_status: statusAfter });
  await logHistory({
    trigger,
    success,
    old_version: current,
    new_version: latest,
    status_before: statusBefore,
    status_after: statusAfter,
    error: success ? null : "instance_not_connected_after_restart",
  });

  if (!success) {
    await notifySuperAdmins(
      "Evolution API: falha após atualizar versão",
      `Versão atualizada para ${latest} mas instância ficou em "${statusAfter}". Verifique o painel.`
    );
  } else {
    await notifySuperAdmins(
      "Evolution API: versão atualizada",
      `WhatsApp Web atualizado: ${current || "?"} → ${latest}. Status: ${statusAfter}.`
    );
  }
  return { success, changed: true, old: current, new: latest, statusBefore, statusAfter };
}

async function doRestart() {
  const state = await loadState();
  if (state?.last_restart_at) {
    const ageMs = Date.now() - new Date(state.last_restart_at).getTime();
    if (ageMs < RESTART_COOLDOWN_MS) {
      return { success: false, error: "cooldown_active", minutesLeft: Math.round((RESTART_COOLDOWN_MS - ageMs) / 60000) };
    }
  }
  await deployService();
  await saveState({ last_restart_at: new Date().toISOString(), last_status: "restarting" });
  return { success: true };
}

async function doTest() {
  const status = await getEvolutionInstanceStatus();
  await saveState({ last_status: status, last_check_at: new Date().toISOString() });
  return { status, connected: ["open", "connected"].includes(status) };
}

// ---------- HTTP handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!EASYPANEL_URL || !EASYPANEL_TOKEN || !EASYPANEL_PROJECT || !EASYPANEL_SERVICE) {
    return json({ error: "EasyPanel env vars não configuradas" }, 500);
  }

  let body: any = {};
  try { body = await req.json(); } catch {}
  const action = body?.action || "check";

  try {
    if (action === "check") return json({ success: true, ...(await doCheck()) });
    if (action === "update") return json(await doUpdate(body?.trigger || "manual"));
    if (action === "restart") return json(await doRestart());
    if (action === "test") return json(await doTest());
    if (action === "run") {
      const c = await doCheck();
      if (!c.needsUpdate) return json({ success: true, ranUpdate: false, ...c });
      const u = await doUpdate("cron");
      return json({ success: u.success, ranUpdate: true, ...u });
    }
    return json({ error: "ação inválida" }, 400);
  } catch (e) {
    console.error("handler error:", e);
    await notifySuperAdmins("Evolution updater: erro", String(e));
    return json({ error: String(e) }, 500);
  }
});
