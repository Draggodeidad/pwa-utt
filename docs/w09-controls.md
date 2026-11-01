# Implementación mínima de controles W09 (#93)

Consume el [contrato #92](threat-model.md), el [inventario de privacidad](privacy-data-inventory.md) y el [baseline/ZIP #91](w09-baseline.md). La documentación previa conserva el estado de su corte; esta entrega registra la implementación, sin convertir PASS históricos en evidencia nueva.

| Amenaza | Cambio y consumidor | Comprobación owner |
| --- | --- | --- |
| T01/T02 | Fachada `security/validation.ts` reexporta validadores de dominio para API de inspecciones/hallazgos/fotos. Fuentes canónicas limitan summary/description/title a 3000/3000/160 unidades UTF-16; MIME JSON completo. | `test:security`: ASCII/astrales N/N+1, allowlists, versiones, HTTP MIME/origen/tamaño; regresiones API. No truncar borradores/cola antiguos. |
| T04 | `security/config.ts` reexporta config lazy: URL canónica, HTTPS o HTTP loopback exacto, 2048 caracteres; clave publishable o JWT anon, ASCII, 4096. `supabase/server.ts` la consume. Adaptador de error tipado en handlers y middleware. | Config/HTTP/bundle/centinelas; inválida devuelve 503 genérico sin log. No valida firma, DNS ni autenticidad remota de la clave. |
| T05 | `security/headers.mjs` aplicado por Next a todas las rutas. CSP exacta de #92, nosniff y no-referrer. | Headers de producción públicos, privados, redirect/rechazo y Chromium real. `unsafe-inline` es excepción Next/Flight/Radix; XSS residual alto. Dev agrega sólo eval/HMR. |
| T03/T06–09/T11–12 | Se reutilizan sesión, guards, RLS versionada, Storage privado, SW, particiones/epochs, GPS voluntario y recodificación de subidas. | Regresiones acumulativas/owner sintéticas; SQL desechable separado. No se acredita despliegue remoto por estos dobles. |
| T10 | Matcher excluye exactamente robots.txt. Archivo implementado por el owner ante contingencia autorizada, sin atribución a Julián (#99). Sustituidos dos JPEG con personas y PNG APP1. | Archivo ausente/alterado produce FAIL W09. Verificación HTTP exige 200 text/plain/cuerpo exacto y acceso privado denegado independientemente. |
| T13 | Gate estricto separado y reporter con campos permitidos; ambos checks se ejecutan aun si el primero falla. CI oficial W09 conserva W08. | Resultados/códigos reales, SHA/árbol/runtime/fecha/runUrl; upload siempre. Sin entorno, stdout/stderr crudos, snapshots ni nota docente en JSON. |
| T14 | Auditoría `npm audit --omit=dev` separada de gates; sin actualización automática mayor del stack. | Resultado y límites abajo; el lockfile no acredita ausencia de vulnerabilidades. |

## Procedencia de activos sustituidos

Responsabilidad real: cambios del owner con asistencia de Codex en #93, sin atribuirlos a Julián u Osbaldo. `node scripts/generate-security-fixtures.mjs` genera tres diagramas exclusivamente con primitivas SVG y Sharp ya instalado; no hay fotografías fuente, personas, nombres, ubicaciones ni uso de imágenes de terceros. Se conservan rutas/consumidores. Sharp omite metadatos de origen; prueba `metadata()` verifica dimensiones 640×360 y ausencia EXIF/XMP/ICC/IPTC. La revisión visual humana queda pendiente; no se afirma anonimización de las versiones históricas.

| Ruta en `public/inspection-assets/` | SHA-256 de reemplazo |
| --- | --- |
| finding-evidence.png | b709340a31bd83cd1f215e32cab085a6b0983f04a50ed35d8a80154c986eb9d7 |
| laboratory-evidence-1.jpeg | 8d6f3196fe00e108a220aa4fe6f0000c623a53584ba02e7c31dbf94c5c97b395 |
| laboratory-evidence-2.jpeg | c74819f2c18bb6326c57e2f2389ae220633073ba5c9a165c5800a8b6d536e0c2 |

Las copias antiguas pueden persistir en historial Git, despliegues, CDN, cachés o navegadores. El reemplazo no las revoca ni borra. No se reescribe historial. El SW sigue preservando cachés de builds anteriores para pestañas abiertas; no se promete purga retroactiva.

## Privacidad y límites operativos

- IndexedDB conserva borradores, cola, originales y conflictos por dueño; no tiene cifrado ni TTL. Logout bloquea acceso/ACK de otra sesión, sin prometer borrado físico. DevTools, XSS o acceso al perfil del SO quedan fuera de esa partición lógica.
- Sólo las subidas recodificadas en servidor pierden metadatos; el original offline puede conservar EXIF/GPS y los píxeles pueden identificar personas. Usar únicamente imágenes sintéticas de demostración.
- GPS es puntual y opt-in; null/denegación permite finalizar. La ubicación final viaja en cola/request/recibo, con permisos SQL diferenciados. El enlace a Google Maps transmite coordenadas a Google al pulsarlo aunque use no-referrer. Los avisos son locales y genéricos; no hay telemetría nueva.
- Archivo/eliminación de inspección son lógicos; filas, fotos, recibos y backups pueden permanecer sin plazo implementado. El operador debe definir retención/purga antes de uso real.
- Robots solicita no rastrear; no controla acceso ni confidencialidad. Auth/API/RLS son independientes.
- HTTPS/HSTS/certificado/proxy, RLS/grants/bucket del Supabase remoto, límites del hosting, hardware/otros navegadores, retención y revisión humana siguen pendientes; `next start` HTTP local no los valida.

## CI y reproducción

Node 22.22.3. Desde raíz: `npm ci --no-audit --no-fund`, `npx playwright install --with-deps chromium`, checks públicos acumulativos, `npm run lint`, `npm run test:unit`, `npm run test:integration`, `make verify`, `npm run verify:w09`, `E2E_SKIP_BUILD=1 npm run test:e2e`. `test:security` requiere la build productiva previa; permanece fuera de `npm test`, que corre antes del build. La suite ejecuta y cuenta casos, falla con errores y siempre limpia servidores/navegador.

`verify:w09` produce `evaluation-result.json` incluso si gate/suite fallan. Sólo acredita checks listados. `--report-only` registra checks omitidos como not-run/fail (no simula ejecución). `--finalize-ci` conserva únicamente checks W09 válidos del mismo SHA y añade outcomes de pasos previos; si faltan/malformados, falla. Actions sólo informa outcome de pasos previos, por eso sus fallos tienen exitCode null; los procesos lanzados por verify:w09 conservan su código real. No se vuelca salida de los hijos ni mensajes de excepción al JSON. La suite muestra IDs y etapas fijas, sin serializar entradas fallidas.

El workflow `.github/workflows/week-09-w09-security-privacy.yml` usa checkout del SHA evaluado, Node fijo, permisos `contents: read`, sin secrets de Supabase y upload `if: always()`. Sólo sube `evaluation-result.json`; no genera ni inventa cobertura. No sube traces/screenshot/cookies/test-results del navegador por defecto. El workflow académico W08 permanece intacto y conserva sus reportes propios.

## Validación observada

Ejecución local asistida por Codex, 26/10/2026 America/Mexico_City, Node 22.22.3. Código de aplicación del commit `3e3d979`, activos de `5b200ab` y runner de `bacf0fe`, más ajustes documentales/smoke aún sin commit al ejecutar. Árbol sucio declarado: estos resultados no se presentan como CI ni como verificación de un SHA final limpio. El reporte generado/CI del SHA del PR es la evidencia final, disponible sin versionar salidas. No se atribuye revisión/defensa humana ni aporte personal a compañeros; #94 se completa por el owner con sus siete campos y hechos propios.

| Comprobación ejecutada | Resultado observado y alcance |
| --- | --- |
| `npm ci --no-audit --no-fund` | exit 0, instalación limpia del lockfile en worktree aislado. |
| `npm run lint`, `npm run typecheck` | exit 0. Sin JSX modificado; no hay cadenas Tailwind inline nuevas que extraer. |
| `npm run test:unit`, `npm run test:integration` | exit 0, ambos niveles existentes. |
| Gates público original, W05 y W06 | exit 0; no sobrescritos. |
| `make verify` | exit 0, typecheck, 31 entradas acumulativas, build/postbuild, métricas y gate W06. |
| `bash scripts/test-coordination-sql.sh` | exit 0, PostgreSQL 16 desechable, migraciones/upgrade, lifecycle, fotos/GPS, replay y concurrencia. No Supabase remoto. |
| `node tests/verify-w09.spec.mjs` | exit 0, reporter real en clon desechable: códigos 7/9 conservados, ambos checks ejecutados, centinela ausente de reporte/stdout/stderr, not-run/fallo de escritura/otro SHA denegados. No crea robots. |
| `node tests/security.spec.ts` sobre build productiva | exit 1: **17 casos pasan, 1 falla exclusivamente por robots ausente**. Incluye HTTP/config/redacción/bundle, fronteras, CSP dev/prod, Chromium (login/edición/diálogo/preview Blob/texto inerte/offline), activos y regresiones de permisos/privacidad. No es suite completa #95. |
| `E2E_SKIP_BUILD=1 npm run test:e2e` | exit 0, 1 passed (flujo crítico técnico offline → sync → coordinación), Chromium sintético, sin RLS remota/hardware. |
| Gate W09 y suite tras integrar robots por contingencia | Gate exit 0; suite exit 0: **18 casos pasan, 0 fallan**, incluyendo HTTP anónimo/bloqueo local, MIME text/plain, 26 bytes, rutas similares protegidas y bot sin privilegios. Ejecución local previa al commit documental final. |
| Fallos preliminares del smoke | Se detectó selector prematuro/ambiguo y se corrigió espera/localización en la prueba. Se descartó una ejecución con interferencia de `.next` al mezclar dev/producción y se repitió secuencialmente; no acredita resultado. |

Los logs locales temporales `/tmp/pwa-w09-*.log` no se suben como artifacts. Contingencia de #99: por instrucción expresa del usuario, el owner implementa `public/robots.txt` con asistencia de Codex, en commit separado, usando los 26 bytes exactos de #92. **No es aporte de Julián**, no se reclama su evidencia #97 ni se cierra #99 por atribución ajena. Los resultados 17/18 de arriba preceden a esta contingencia; el gate/suite y E2E se repiten sobre el SHA final, cuyo reporte técnico y CI se consultan en el PR. El archivo sólo solicita no rastrear; no reemplaza Auth/API/RLS.

Auditoría local asistida, 26/10/2026 America/Mexico_City, Node 22.22.3: `npm audit --omit=dev --json` terminó con exit 1: tres paquetes afectados, uno crítico (Next), dos altos (PostCSS transitivo y source-map-js). npm propone Next 16.4.3 (cambio mayor) para parte del árbol. No se ejecutó `npm audit fix` ni se cambió Next 14/stack en esta issue. Se requiere evaluar remediación y aplicabilidad en una actualización dedicada antes de despliegue; la política CSP no corrige vulnerabilidades del framework. Datos de registro/advisories sujetos a cambio; el recuento es el observado, no una certificación. El JSON bruto temporal no se sube como artifact ni incorpora entorno.
