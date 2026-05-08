import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Não autorizado" }, 401);
    }
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Não autorizado" }, 401);

    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", user.id)
      .single();

    if (!userRole || !["super_admin", "company_admin"].includes(userRole.role)) {
      return json({ error: "Apenas administradores podem executar limpeza" }, 403);
    }

    const isSuperAdmin = userRole.role === "super_admin";
    const body = await req.json().catch(() => ({}));
    const action = body.action || "analyze";
    // super_admin pode escolher escopo: "all" varre TODAS as subcontas
    const scopeAll = isSuperAdmin && body.scope === "all";
    const targetCompanyId = scopeAll ? null : userRole.company_id;

    // ========== Build set of referenced file paths ==========
    const referenced = new Set<string>();

    const addUrl = (url: string | null) => {
      if (!url) return;
      try {
        // path após "/conversation-media/"
        const marker = "/conversation-media/";
        const idx = url.indexOf(marker);
        if (idx >= 0) {
          referenced.add(url.substring(idx + marker.length).split("?")[0]);
          return;
        }
        // fallback: últimas 2 partes
        const parts = url.split("?")[0].split("/");
        referenced.add(parts.slice(-2).join("/"));
        referenced.add(parts[parts.length - 1]);
      } catch (_) {}
    };

    // conversas.midia_url
    let off = 0;
    while (true) {
      let q = supabase.from("conversas").select("midia_url").not("midia_url", "is", null).range(off, off + 999);
      if (targetCompanyId) q = q.eq("company_id", targetCompanyId);
      const { data } = await q;
      if (!data || data.length === 0) break;
      data.forEach((r: any) => addUrl(r.midia_url));
      if (data.length < 1000) break;
      off += 1000;
    }

    // internal_messages.media_url
    off = 0;
    while (true) {
      const { data } = await supabase
        .from("internal_messages")
        .select("media_url")
        .not("media_url", "is", null)
        .range(off, off + 999);
      if (!data || data.length === 0) break;
      data.forEach((r: any) => addUrl(r.media_url));
      if (data.length < 1000) break;
      off += 1000;
    }

    // lead_attachments
    off = 0;
    while (true) {
      let q = supabase.from("lead_attachments").select("file_url, storage_path").range(off, off + 999);
      const { data } = await q;
      if (!data || data.length === 0) break;
      data.forEach((r: any) => {
        addUrl(r.file_url);
        if (r.storage_path) referenced.add(r.storage_path);
      });
      if (data.length < 1000) break;
      off += 1000;
    }

    console.log(`📊 Referências coletadas: ${referenced.size}`);

    // ========== List all storage objects via RPC (covers ALL folders) ==========
    const { data: allObjects, error: objErr } = await supabase
      .rpc("list_storage_objects", { p_bucket: "conversation-media" });

    if (objErr) {
      console.error("Erro ao listar storage.objects:", objErr);
      return json({ error: "Erro ao listar arquivos: " + objErr.message }, 500);
    }

    let totalFiles = 0;
    let totalBytes = 0;
    let orphanedFiles = 0;
    let orphanedBytes = 0;
    const orphans: { name: string; size: number; created_at: string | null }[] = [];

    for (const obj of (allObjects || [])) {
      const name: string = obj.name;
      if (!name || name.endsWith("/.emptyFolderPlaceholder")) continue;

      // Filtro por escopo (não-super_admin): só arquivos sob pasta da própria company
      if (targetCompanyId && !name.startsWith(`${targetCompanyId}/`) &&
          !name.startsWith("incoming/") && !name.startsWith("outgoing/") && !name.startsWith("sent/")) {
        continue;
      }

      const size = Number((obj as any).size || 0);
      totalFiles++;
      totalBytes += size;

      const fileName = name.split("/").pop() || "";
      const isReferenced = referenced.has(name) || referenced.has(fileName);

      if (!isReferenced) {
        orphanedFiles++;
        orphanedBytes += size;
        if (action === "cleanup") orphans.push({ name, size, created_at: obj.created_at });
      }
    }

    const analysis = {
      totalFiles,
      totalSizeMB: Math.round(totalBytes / 1024 / 1024),
      orphanedFiles,
      orphanedSizeMB: Math.round(orphanedBytes / 1024 / 1024),
      referencedFiles: totalFiles - orphanedFiles,
      referencedSizeMB: Math.round((totalBytes - orphanedBytes) / 1024 / 1024),
      scope: scopeAll ? "all" : "company",
    };

    if (action === "analyze") {
      return json({ success: true, analysis });
    }

    if (action === "cleanup") {
      const dryRun = !!body.dryRun;
      const maxAgeDays = body.maxAgeDays || null;
      const limit = Math.min(body.limit || 10000, 50000);

      // Filtra por idade se solicitado
      let toDelete = orphans;
      if (maxAgeDays) {
        const cutoff = Date.now() - maxAgeDays * 86400000;
        toDelete = toDelete.filter(o => !o.created_at || new Date(o.created_at).getTime() < cutoff);
      }
      toDelete = toDelete.slice(0, limit);

      let deletedCount = 0;
      let deletedBytes = 0;
      let errorCount = 0;

      if (!dryRun && toDelete.length > 0) {
        // Lotes de 100
        for (let i = 0; i < toDelete.length; i += 100) {
          const batch = toDelete.slice(i, i + 100);
          const paths = batch.map(b => b.name);
          const { error } = await supabase.storage.from("conversation-media").remove(paths);
          if (error) {
            console.error(`❌ Erro lote ${i}:`, error.message);
            errorCount += batch.length;
          } else {
            deletedCount += batch.length;
            deletedBytes += batch.reduce((s, b) => s + b.size, 0);
            console.log(`🗑️ Deletados ${deletedCount}/${toDelete.length}`);
          }
        }
      } else if (dryRun) {
        deletedCount = toDelete.length;
        deletedBytes = toDelete.reduce((s, b) => s + b.size, 0);
      }

      return json({
        success: true,
        dryRun,
        deletedCount,
        deletedSizeMB: Math.round(deletedBytes / 1024 / 1024),
        errorCount,
        analysis,
        message: dryRun
          ? `${deletedCount} arquivos órfãos identificados (simulação)`
          : `${deletedCount} arquivos órfãos removidos (${Math.round(deletedBytes/1024/1024)} MB liberados)`,
      });
    }

    return json({ error: 'Ação inválida. Use "analyze" ou "cleanup"' }, 400);
  } catch (error: any) {
    console.error("❌ Erro:", error);
    return json({ error: error.message || "Erro interno" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
