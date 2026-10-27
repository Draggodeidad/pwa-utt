/** W09-T05: browser talks only to Next; Supabase stays on the server. */
export function getSecurityHeaders({ production }) {
  const directives = {
    "default-src": "'self'",
    "base-uri": "'self'",
    "object-src": "'none'",
    "frame-ancestors": "'none'",
    "frame-src": "'none'",
    "form-action": "'self'",
    "connect-src": production ? "'self'" : "'self' ws: wss:",
    // Next 14 bootstrap/Flight and Radix styles require these inline exceptions.
    "script-src": production ? "'self' 'unsafe-inline'" : "'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src": "'self' 'unsafe-inline'",
    "img-src": "'self' data: blob:",
    "font-src": "'self'",
    "worker-src": "'self'",
    "manifest-src": "'self'",
  };
  return [
    { key: "Content-Security-Policy", value: Object.entries(directives).map(([key, value]) => `${key} ${value}`).join("; ") },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "no-referrer" },
  ];
}
