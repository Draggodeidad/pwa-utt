# Release local reproducible — W10 / #108

Consume el [contrato #107](w10-baseline.md#contrato-local-para-108-109-y-111).
Este proceso prepara y comprueba un artefacto local de la aplicación acumulada;
no publica una release, no despliega, no aplica migraciones ni envía Classroom.
El procedimiento de recuperación está en el [runbook](runbook.md).

## Contrato para Osbaldo (#111)

| Elemento | Contrato implementado |
| --- | --- |
| Versión | SHA Git completo de 40 hex del checkout limpio, no `latest` ni `package.json.version` (sigue `0.1.0`). |
| Imagen | `pwa-inspecciones:<SHA>`; registrar además su ID local `sha256:…`, plataforma y label `org.opencontainers.image.revision`. Las etiquetas son mutables. |
| Runtime | Node **22.22.3**, npm **10.9.8**, Debian bookworm-slim fijado por digest en las dos instrucciones `FROM`. Validación local: linux/amd64. |
| Arranque | `docker run --rm -p 127.0.0.1:3000:3000 pwa-inspecciones:<SHA>`; internamente `node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port 3000`, equivalente a `npm start -- --hostname 0.0.0.0 --port 3000`. No usa `next dev`. |
| Identidad | `COMMIT_SHA` obligatorio en Docker → `W10_BUILD_SHA` durante build → `W10_COMMIT_SHA` sustituido por Next en la ruta compilada. Variables de arranque de esos nombres no cambian el binario. No introducir secretos en `next.config.env`. |
| Health público | `GET /api/health` → 200 JSON exacto `{ "status": "ok", "commitSha": "<SHA>" }`, `Cache-Control: no-store`. Sin cookies, Auth o consulta a Supabase. Es liveness/identidad, no readiness de base de datos. |
| Identidad ausente/inválida | Build normal sin `W10_BUILD_SHA` → health 503 JSON genérico `{ "status": "unavailable" }`, también `no-store`. Docker rechaza un `COMMIT_SHA` ausente/inválido antes de compilar. No inventa versión. |
| PWA | Mantiene `.next/static`, `public/offline-assets.json` y `public/sw-build.js` generados por el `postbuild` existente. `BUILD_ID` es identidad de build Next y se registra separado del SHA Git. |
| Entradas de la comprobación HTTP | `W10_BASE_URL` (origen HTTP loopback), `W10_EXPECTED_SHA` (40 hex) y opcional `W10_EXPECTED_BUILD_ID`. Conexión inicial ≤30 s; cada petición ≤5 s. Error HTTP/JSON/SHA/assets/redirección devuelve exit no cero. |
| Recuperación | A bueno → B defectuoso → **mismo ID/digest A**, con el mismo origen y configuración compatible. No reconstruir A ni sólo reasignar su tag. No borrar IndexedDB. |

Sin configuración Supabase, el comando mínimo sirve health, `/login` y `/offline`.
Para comprobar además `/` → 307 `/login` y `/api/session` → 401 se necesita
configuración sintácticamente válida: los comandos de prueba de abajo usan valores
sintéticos, sin backend ni credenciales reales. No permiten iniciar sesión.
Para recorridos autenticados, #111 puede reutilizar `tests/e2e/fixtures/backend.cjs`
y el aislamiento de `tests/e2e/launch-app.cjs`; `127.0.0.1` dentro del contenedor
es el propio contenedor, no el fixture del host.

## Instalación y verificación acumulativa

Prerrequisitos: Git, Docker Engine con daemon accesible, Node 22.22.3/npm 10.9.8
y Make opcional. Usar un checkout dedicado limpio del SHA que se revisará. Desde
la raíz, con configuración de pruebas sintética y sin `.env` personal:

```bash
npm ci --no-audit --no-fund
npx playwright install chromium
npm run lint
npm run test:unit
npm run test:integration
make verify
npm run verify:w09
E2E_SKIP_BUILD=1 npm run test:e2e
```

`make verify` conserva typecheck, `npm test` (incluye fronteras de health),
build/postbuild, métricas HTTP y W06. `npm run verify` es su equivalente sin Make.
El verificador no es un reporte W10. Integración puede sustituir `.next`; por eso
debe ir antes del build productivo. `tsconfig.tsbuildinfo` está versionado y estos
comandos pueden modificarlo: registrar el árbol real del reporte, guardar los
resultados y restaurar únicamente ese archivo generado si estaba limpio antes;
no descartar trabajo ajeno ni editar reportes para aparentar árbol limpio.

## Construir y registrar la imagen

Ejecutar en un checkout limpio, con las fuentes ya comprometidas. `Dockerfile`
reutiliza `npm ci`, `npm run build`/postbuild y Next start. Separa dependencias
de producción, corre como `node` sin root y conserva los headers existentes.
`.dockerignore` permite sólo entradas de build; excluye `.env*`, `.git`, ZIP,
reportes, `node_modules`, `.next` y assets offline generados en el host.

```bash
set -eu
test -z "$(git status --porcelain)"
release_sha=$(git rev-parse HEAD)
image="pwa-inspecciones:$release_sha"
mkdir -p test-results/w10/release
docker build --platform linux/amd64 --build-arg COMMIT_SHA="$release_sha" \
  --tag "$image" --iidfile test-results/w10/release/image-id.txt .
image_id=$(docker image inspect --format '{{.Id}}' "$image")
test "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")" = "$release_sha"
docker image inspect --format '{{json .}}' "$image" > test-results/w10/release/image-inspect.json
docker run --rm "$image_id" node --version
docker run --rm "$image_id" npm --version
docker run --rm "$image_id" cat .next/BUILD_ID > test-results/w10/release/BUILD_ID
docker image save --output test-results/w10/release/image.tar "$image"
(cd test-results/w10/release && sha256sum image.tar > image.tar.sha256)
```

Se fija también el digest de la imagen base, no sólo su tag. Referencias:
[pinning de imágenes Docker](https://docs.docker.com/build/building/best-practices/#pin-base-image-versions)
y [ID de contenido e imagen por digest](https://docs.docker.com/reference/cli/docker/image/pull/).
Un build local puede tener `RepoDigests: []`: se registra el **ID de imagen local**
observado, sin fingir un digest de manifiesto de un registry. El tar permite
`docker image load --input …`; conservar su checksum y comprobar después el mismo
ID. No publicar ni subir ese tar como parte de este cambio.

Reproducible significa aquí fuentes comprometidas, lockfile, versión/base y
comandos fijados, con artefacto trazable y retenido. No se ha demostrado igualdad
bit a bit entre reconstrucciones: Next genera `BUILD_ID` y Docker registra
metadatos. Una reconstrucción que dé otro ID es otro artefacto; para rollback se
usa la copia retenida de A. Actualizar base o dependencias requiere otro PR.

## Comprobar el contrato HTTP de la imagen

Usar un puerto libre, sin servidor ajeno. Docker asigna un puerto loopback
efímero y el probe espera como máximo 30 segundos. La configuración siguiente
es exclusivamente sintética; health no depende de ella.

```bash
set -eu
release_sha=$(git rev-parse HEAD)
image_id=$(docker image inspect --format '{{.Id}}' "pwa-inspecciones:$release_sha")
container=$(docker run --detach --rm -p 127.0.0.1::3000 \
  -e SUPABASE_URL=http://127.0.0.1:54321 \
  -e SUPABASE_ANON_KEY=sb_publishable_synthetic_w10_fixture "$image_id")
trap 'docker stop "$container" >/dev/null' EXIT
port=$(docker inspect --format '{{(index (index .NetworkSettings.Ports "3000/tcp") 0).HostPort}}' "$container")
W10_BASE_URL="http://127.0.0.1:$port" W10_EXPECTED_SHA="$release_sha" \
  W10_EXPECTED_BUILD_ID="$(cat test-results/w10/release/BUILD_ID)" \
  node scripts/check-release-http.mjs > test-results/w10/release/http.json
test "$(docker inspect --format '{{.Image}}' "$container")" = "$image_id"
```

El probe comprueba health/identidad, HTML público, 307/401 anónimos, manifest
offline no vacío, cada asset JS/CSS, SW y BUILD_ID publicado. Falla ante 404,
503, JSON inválido o SHA distinto; no acepta un puerto abierto como PASS.
No es `tests/smoke.spec.ts` ni la suite S1–S4 completa; el registro de
`npm run test:smoke`, SW/browser, recuperación integral y reporte W10 pertenece
a #111/#109. El [runbook](runbook.md) añade el ensayo A→B→A y sus límites.

Para comprobar inmutabilidad, repetir el arranque añadiendo
`-e W10_BUILD_SHA=ffffffffffffffffffffffffffffffffffffffff`
y `-e W10_COMMIT_SHA=ffffffffffffffffffffffffffffffffffffffff`:
el probe sigue esperando el SHA original de A. Probar también health en otro
contenedor sin ninguna variable Supabase; debe dar el mismo 200/identidad.

## Evidencia y entrega

Guardar SHA de fuentes, limpieza del árbol, fecha/zona, comandos/exit codes,
ID/plataforma/label de imagen, BUILD_ID, resultados HTTP y A→B→A. Reportes y
artefactos locales están ignorados; enlazar el PR y sus runs reales al consolidar.
No reutilizar resultados de otro SHA como evidencia del head final. La
[validación de #108](runbook.md#validación-observada-de-108) distingue ejecución
de Codex, límites y pendientes. La evidencia personal y defensa humana del owner
siguen en #110: estos resultados no se atribuyen al estudiante ni a Osbaldo.
