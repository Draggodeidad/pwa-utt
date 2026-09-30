export const SUPABASE_URL_ENV = "SUPABASE_URL";
export const SUPABASE_ANON_KEY_ENV = "SUPABASE_ANON_KEY";

export type SupabaseServerConfig = {
  url: string;
  anonKey: string;
};

export function getSupabaseServerConfig(
  env: NodeJS.ProcessEnv = process.env
): SupabaseServerConfig {
  const url = (env[SUPABASE_URL_ENV] ?? "").trim();
  const anonKey = (env[SUPABASE_ANON_KEY_ENV] ?? "").trim();
  const problems: string[] = [];

  if (url === "") {
    problems.push(`${SUPABASE_URL_ENV} no está definida`);
  } else if (!/^https?:\/\//.test(url)) {
    problems.push(`${SUPABASE_URL_ENV} debe ser una URL http(s)`);
  }

  if (anonKey === "") {
    problems.push(`${SUPABASE_ANON_KEY_ENV} no está definida`);
  }

  if (problems.length > 0) {
    throw new Error(
      `Configuración de Supabase incompleta: ${problems.join("; ")}. Defínelas en el entorno del servidor; no se usa fallback sintético.`
    );
  }

  return { url, anonKey };
}