export const SUPABASE_URL_ENV = "SUPABASE_URL";
export const SUPABASE_ANON_KEY_ENV = "SUPABASE_ANON_KEY";

export type SupabaseServerConfig = { url: string; anonKey: string };

/** Messages contain fixed reasons and variable names, never supplied values. */
export class SupabaseConfigurationError extends Error {
  constructor(problems: string[]) {
    super(`Configuración de Supabase incompleta: ${problems.join("; ")}. Defínelas en el entorno del servidor; no se usa fallback sintético.`);
    this.name = "SupabaseConfigurationError";
  }
}

function canonicalUrl(value: string): string | null {
  if (value.length > 2048 || /[\s\u0000-\u001f\u007f]/.test(value)) return null;
  // Check the raw authority as well: WHATWG normalizes backslashes, numeric
  // loopback aliases, case and trailing dots. Do not accept hidden credentials.
  const raw = /^(https?):\/\/([^/?#\\]+)(\/?)$/.exec(value);
  if (!raw) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || !url.hostname || url.hostname.endsWith(".")) return null;
    const authority = /^(\[[^\]]+\]|[^:]+)(?::([0-9]+))?$/.exec(raw[2]);
    if (!authority || authority[1] !== url.hostname) return null;
    if (authority[2] !== undefined) {
      const port = authority[2];
      const canonicalPort = url.port || (url.protocol === "https:" ? "443" : "80");
      if (port !== canonicalPort) return null;
    }
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) return null;
    return url.origin;
  } catch { return null; }
}

function isPublicApplicationKey(value: string): boolean {
  if (value.length > 4096 || /[^\x21-\x7e]/.test(value)) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true;
  const segments = value.split(".");
  if (segments.length !== 3 || !segments.every(segment => /^[A-Za-z0-9_-]+$/.test(segment))) return false;
  try {
    const decode = (segment: string) => {
      const binary = atob(segment.replace(/-/g, "+").replace(/_/g, "/"));
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    };
    const header = decode(segments[0]);
    const payload = decode(segments[1]);
    const object = (item: unknown): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item);
    return object(header) && object(payload) && payload.role === "anon";
  } catch { return false; }
}

export function getSupabaseServerConfig(env: NodeJS.ProcessEnv = process.env): SupabaseServerConfig {
  const rawUrl = (env[SUPABASE_URL_ENV] ?? "").trim();
  const anonKey = (env[SUPABASE_ANON_KEY_ENV] ?? "").trim();
  const url = canonicalUrl(rawUrl);
  const problems: string[] = [];
  if (!rawUrl) problems.push(`${SUPABASE_URL_ENV} no está definida`);
  else if (!url) problems.push(`${SUPABASE_URL_ENV} debe ser una URL HTTPS canónica o HTTP loopback exacto, máximo 2048 caracteres`);
  if (!anonKey) problems.push(`${SUPABASE_ANON_KEY_ENV} no está definida`);
  else if (!isPublicApplicationKey(anonKey)) problems.push(`${SUPABASE_ANON_KEY_ENV} debe ser una clave pública de aplicación permitida, máximo 4096 caracteres`);
  if (problems.length || !url) throw new SupabaseConfigurationError(problems);
  return { url, anonKey };
}
