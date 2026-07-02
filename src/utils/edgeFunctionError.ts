/** Extrai mensagem legível quando supabase.functions.invoke retorna non-2xx */
export async function parseEdgeFunctionError(error: unknown, fallback = "Erro na edge function"): Promise<string> {
  if (!error || typeof error !== "object") return fallback;
  const err = error as { message?: string; context?: Response | { body?: unknown; json?: () => Promise<unknown> } };
  if (err.message && !/non-2xx/i.test(err.message)) return err.message;
  try {
    const ctx = err.context;
    if (ctx && typeof (ctx as Response).json === "function") {
      const body = await (ctx as Response).json() as { error?: string; message?: string };
      return body?.error || body?.message || err.message || fallback;
    }
  } catch {
    // ignore parse errors
  }
  return err.message || fallback;
}
