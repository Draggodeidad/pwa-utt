const assert = require("node:assert/strict");
const {
  getSupabaseServerConfig,
  SUPABASE_URL_ENV,
  SUPABASE_ANON_KEY_ENV,
} = require("../src/lib/supabase/config.ts");

const valid = {
  [SUPABASE_URL_ENV]: "https://project-ref.supabase.co",
  [SUPABASE_ANON_KEY_ENV]: "eyJhbGciOiJIUzI1NiJ9.anon-key",
};

{
  const config = getSupabaseServerConfig(valid);
  assert.equal(config.url, valid[SUPABASE_URL_ENV]);
  assert.equal(config.anonKey, valid[SUPABASE_ANON_KEY_ENV]);
  console.log("[ok] entorno válido devuelve la configuración");
}

{
  assert.throws(
    () => getSupabaseServerConfig({}),
    (err) =>
      err instanceof Error &&
      err.message.includes(`${SUPABASE_URL_ENV} no está definida`) &&
      err.message.includes(`${SUPABASE_ANON_KEY_ENV} no está definida`),
    "Sin variables debe fallar indicando ambas variables, sin fallback sintético"
  );
  console.log("[ok] entorno vacío falla de forma clara sin fallback");
}

{
  assert.throws(
    () =>
      getSupabaseServerConfig({
        [SUPABASE_URL_ENV]: "not-a-url",
        [SUPABASE_ANON_KEY_ENV]: "k",
      }),
    (err) =>
      err instanceof Error &&
      err.message.includes(`${SUPABASE_URL_ENV} debe ser una URL http(s)`),
    "Una URL no http(s) debe fallar con mensaje claro"
  );
  console.log("[ok] URL inválida falla con mensaje claro");
}

{
  assert.throws(
    () => getSupabaseServerConfig({ [SUPABASE_URL_ENV]: valid[SUPABASE_URL_ENV] }),
    (err) => err instanceof Error && err.message.includes(`${SUPABASE_ANON_KEY_ENV} no está definida`),
    "Falta de anon key debe fallar con mensaje claro"
  );
  console.log("[ok] falta de anon key falla con mensaje claro");
}

{
  const config = getSupabaseServerConfig({
    [SUPABASE_URL_ENV]: "  https://project-ref.supabase.co  ",
    [SUPABASE_ANON_KEY_ENV]: "  key  ",
  });
  assert.equal(config.url, "https://project-ref.supabase.co");
  assert.equal(config.anonKey, "key");
  console.log("[ok] valores con espacios se normalizan");
}

console.log("supabase-config.spec.ts: PASS");