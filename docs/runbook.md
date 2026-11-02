# Runbook local de recuperación — W10 / #108

Contrato y preparación: [release-process](release-process.md). Responsable de
decidir compatibilidad: owner; consumidor de smoke: Osbaldo (#111). Estos pasos
son un ensayo local sobre datos sintéticos. No autorizan despliegue, publicación,
migraciones, cambios en Supabase remoto ni eliminación de datos del navegador.

## Cuándo detener un candidato

Bloquear B si health no responde en 30 s, responde 404/503/otro estado, su SHA no
coincide, devuelve HTML/JSON inválido, falla un asset offline o cambia la frontera
307/401 anónima. Cada petición tiene límite de 5 s. Conservar el fallo y su exit
code antes de retirar B. Health 200 sólo confirma proceso/identidad: no demuestra
sesión funcional, readiness de Supabase, integridad de cola o compatibilidad SW.

No sustituir el SHA esperado por el que responda el servidor para obtener PASS.
No reconstruir A ni usar `latest` para recuperar. La referencia de recuperación
es el ID/digest **registrado cuando A pasó**, acompañado de SHA, BUILD_ID,
plataforma y configuración. Retener la imagen local o su tar/checksum; no ejecutar
`docker image prune` sobre esas copias durante el ensayo.

## Compatibilidad y trabajo pendiente

Antes de cambiar de versión, registrar en el mismo perfil/origen de navegador el
dueño, IDs/revisiones de borradores, operaciones pendientes, sus `operationId`,
estado e intentos y las fotos locales. Sólo datos sintéticos en logs. Confirmar
autosave en todas las pestañas; mantener el dispositivo sin conexión si el
servidor candidato no es confiable. No forzar sincronización ni activación SW
mientras haya guardados pendientes o errores.

| Frontera | Condición para volver a A |
| --- | --- |
| IndexedDB | Base `pwa-utt-local`, versión **3**; A debe entender todos los stores/campos/estados que B pudo escribir. #108 no cambia el esquema. Un incremento incompatible que cause `VersionError` impide un downgrade directo. |
| Cola/fotos/borradores | Conservar `inspection_local`, `finding_local`, `sync_queue`, `photo_local`, conflictos, catálogo y metadata por dueño. Mantener UUIDs, claves de idempotencia y `baseVersion`; no recrear operaciones ni reasignarlas a otro usuario. |
| API/BD | A debe seguir admitiendo los payloads/estados de B y el esquema remoto actual. #108 no modifica API de negocio ni SQL; rollback de imagen no revierte transacciones ni migraciones de Supabase. |
| Origen/sesión | Mantener protocolo, hostname y puerto externos: cambiar de origen aparenta pérdida de IndexedDB/SW. Conservar configuración autorizada, cookies y perfil; no confundir logout o navegador nuevo con recuperación. |
| SW/assets | A retiene sus archivos de postbuild y assets. Una pestaña con JS/SW de B puede seguir ejecutando B después de recuperar el servidor A. Confirmar autosave/cola, usar la actualización segura existente y verificar BUILD_ID/controlador antes de reabrir el trabajo. |

Está prohibido usar `indexedDB.deleteDatabase`, borrar datos del sitio,
`Clear-Site-Data`, vaciar Cache Storage globalmente, un perfil nuevo o desregistrar
el SW como sustituto de rollback. No forzar `SKIP_WAITING` ni revertir migraciones
para ocultar un fallo. Con incompatibilidad, mantener los datos, aislar el
candidato y preparar una corrección compatible; detener la recuperación a A
hasta tener un contrato de lectura/migración seguro.

El SW existente excluye `/api`, incluido health, de su caché. No obstante,
comprobar servidor con el probe Node (sin SW) y cliente por separado. Un health
correcto no prueba que las pestañas hayan vuelto a A. La suite
`tests/safe-pwa-update.spec.ts` comprueba rechazo de precache defectuoso y autosave
fallido con conservación de trabajo local; no sustituye el ensayo de imágenes.

## Ensayo reproducible A → B defectuoso → mismo A

Primero construir, registrar y comprobar A según release-process. Ejecutar el
siguiente bloque en Bash desde la raíz, conservando un archivo de log de la
terminal. El probe pertenece a #108 y está disponible desde el commit que lo
añade; para evaluar imágenes anteriores usar ese probe sin cambiar el SHA
esperado de la imagen. No hay un comando `npm run test:smoke` en #108.

La falla sintética de B es **quitar sólo la ruta health compilada de una imagen
derivada de A**. B conserva la misma revisión de fuentes, pero tiene otro digest;
su tag `pwa-inspecciones-fault:<SHA>` indica la inyección. No representa un commit
de producto nuevo ni una segunda release válida. En una recuperación real,
registrar el SHA y digest propios de la release B defectuosa.

```bash
set -eu
release_sha=$(git rev-parse HEAD)
a_tag="pwa-inspecciones:$release_sha"
a_id=$(docker image inspect --format '{{.Id}}' "$a_tag")
mkdir -p test-results/w10/rollback
printf '%s\n' "$a_id" > test-results/w10/rollback/a-id.txt
docker run --rm "$a_id" cat .next/BUILD_ID > test-results/w10/rollback/a-build-id.txt
expected_build_id=$(cat test-results/w10/rollback/a-build-id.txt)

container=''
cleanup() {
  if [ -n "$container" ]; then docker stop "$container" >/dev/null; fi
}
trap cleanup EXIT
start_image() {
  container=$(docker run --detach --rm -p "127.0.0.1:$port:3000" \
    -e SUPABASE_URL=http://127.0.0.1:54321 \
    -e SUPABASE_ANON_KEY=sb_publishable_synthetic_w10_fixture "$1")
}
probe() {
  W10_BASE_URL="http://127.0.0.1:$port" W10_EXPECTED_SHA="$release_sha" \
    W10_EXPECTED_BUILD_ID="$expected_build_id" node scripts/check-release-http.mjs
}

# Docker elige el puerto libre de A; se conserva para B y la recuperación.
port=''
start_image "$a_id"
port=$(docker inspect --format '{{(index (index .NetworkSettings.Ports "3000/tcp") 0).HostPort}}' "$container")
probe > test-results/w10/rollback/a-http.json
# Punto de observación cliente: guardar y fotografiar/snapshotear el trabajo
# sintético pendiente en ESTE origen/perfil antes de retirar A.
docker logs "$container" > test-results/w10/rollback/a-server.log 2>&1
cleanup
container=''

# Mantener la referencia de A y construir B sin modificar A.
test "$(docker image inspect --format '{{.Id}}' "$a_tag")" = "$a_id"
docker build --tag "pwa-inspecciones-fault:$release_sha" - <<EOF
FROM $a_tag
USER root
RUN rm /app/.next/server/app/api/health/route.js
USER node
EOF
b_id=$(docker image inspect --format '{{.Id}}' "pwa-inspecciones-fault:$release_sha")
test "$b_id" != "$a_id"
printf '%s\n' "$b_id" > test-results/w10/rollback/b-id.txt
start_image "$b_id"
if probe > test-results/w10/rollback/b-http.log 2>&1; then
  printf 'ERROR: B defectuoso pasó la comprobación\n' >&2
  exit 1
else
  b_exit=$?
  printf '%s\n' "$b_exit" > test-results/w10/rollback/b-exit-code.txt
fi
docker logs "$container" > test-results/w10/rollback/b-server.log 2>&1
cleanup
container=''

# Referencia guardada de A: no build, retag, cambio de SHA ni de origen.
start_image "$a_id"
test "$(docker inspect --format '{{.Image}}' "$container")" = "$a_id"
probe > test-results/w10/rollback/recovered-http.json
docker logs "$container" > test-results/w10/rollback/recovered-server.log 2>&1
# Punto de observación cliente: comparar mismos borradores/cola/fotos/owner.
# Repetir lectura offline y reconectar sólo con compatibilidad confirmada.
```

Si A no está cargada, desde la carpeta del archivo verificar
`sha256sum -c image.tar.sha256`, cargar el tar
retenido con `docker image load --input image.tar` y exigir que su ID sea el
registrado. No aceptar como sustituto un build nuevo del mismo SHA. Un fallo al
recuperar A debe quedar como fallo del ensayo, nunca como skip o PASS.

El bloque valida A/B/A del servidor; los comentarios de observación requieren
pausar el recorrido y comprobar el cliente. No producen evidencia automática de
conservación de datos. Para completar ese caso, #111 debe mantener el mismo
contexto Chromium/origen, crear un borrador offline y operación real mediante el
fixture sintético existente, comparar antes/después el contenido, revisión,
owner y `operationId`, y comprobar lectura offline/ausencia de duplicados al
reconectar. Conservar la assertion fallida de B, no sólo el resultado global.

## Registro de un incidente

Anotar fecha/zona, operador real, SHA/ID/BUILD_ID esperados y observados de A/B,
comando de arranque/configuración por nombres (sin valores privados), ruta que
falló, status/exit codes, compatibilidad decidida y resultado de recuperación.
Separar HTTP, cliente, BD remota y revisión humana. Guardar logs sintéticos
revisados en `test-results/w10/`; no subir cookies, `.env`, sesiones o payloads
personales. Comunicar pendientes en el PR, sin inventar resultado del evaluador
privado ni nota académica.

## Validación observada de #108

Ejecuciones locales de **Codex**, 02/11/2026, America/Mexico_City; no son ejecución
personal, revisión o defensa humana de Draggodeidad ni de Osbaldo. Base revisada:
`410c5b706503a77d42f46dfdb50a2b34704755a6` (PR #116 integrado). Consulta remota
de PR recientes/ramas W10 confirmó #116 cerrado/integrado y la rama baseline;
no había implementación W10 competidora en esos resultados. Se conservó el
inventario histórico completo de #107 sin declarar ausencia global futura.

La imagen A se construyó desde las fuentes comprometidas en
[`369f7f2e82c39c148117d5337da43898a1bafe81`](https://github.com/Draggodeidad/pwa-utt/commit/369f7f2e82c39c148117d5337da43898a1bafe81).
El probe del host corresponde a
[`03eb030f1d6588b563957dceda0df2ffd7d1fa7f`](https://github.com/Draggodeidad/pwa-utt/commit/03eb030f1d6588b563957dceda0df2ffd7d1fa7f),
que sólo añade ese script y no cambia las fuentes de aplicación/Docker de A.
Los commits documentales posteriores no se presentan como nuevos builds de imagen.

| Identidad observada | Valor |
| --- | --- |
| Tag A / plataforma | `pwa-inspecciones:369f7f2e82c39c148117d5337da43898a1bafe81`, linux/amd64 |
| ID local y RepoDigest A | `sha256:800b289f00f8242c13e54a5e66794344359ef4cc996d7f5505cafc7ed22e5d52`; Docker también expuso `pwa-inspecciones@sha256:800b289f00f8242c13e54a5e66794344359ef4cc996d7f5505cafc7ed22e5d52` localmente, sin push |
| BUILD_ID A | `Apx3bry-UT6KAz5DIF04X` |
| ID B derivado con ruta health eliminada | `sha256:e851c3fd5a68152d4190b9c9cbefb8e86b72138ab9a37f91a296192f0c9d9acf` |
| Archivo A retenido | 231862272 bytes; SHA-256 `b4bc7ed5fb6a3c21b8ac52a3c01c116e34cc11e192960abecfb23d63d0002527` |

| Comprobación ejecutada | Resultado real / alcance |
| --- | --- |
| `npm ci --no-audit --no-fund`, Chromium | exit 0; Node 22.22.3/npm 10.9.8; sin auditoría de dependencias. Playwright usó su build fallback Ubuntu 24.04 por el SO del host. |
| Lint, typecheck y unitarias iniciales | exit 0; health cubre dos identidades válidas y seis fronteras inválidas/ausentes con JSON/no-store. |
| Checks públicos W01–W04/W05/W06, lint, unit/integration | exit 0 cada comando; unitarias descubre tres entradas. No es el check W10 defectuoso del kit. |
| `make verify` | exit 0: typecheck, 32 entradas de `npm test`, build/postbuild (47 assets), métricas HTTP y W06; incluye la suite existente de actualización segura/cola. |
| `npm run verify:w09` | exit 0; reporte `assignmentId: w09-security-privacy`, no W10. |
| `E2E_SKIP_BUILD=1 npm run test:e2e` | exit 0, `1 passed` Chromium: flujo acumulativo sintético; no conservación de datos entre dos imágenes distintas. |
| Build Docker A / runtime | exit 0; Node v22.22.3/npm 10.9.8 dentro de la imagen, usuario `node`, puerto interno 3000. |
| A + dos variables de identidad falsas al arrancar | Docker health `healthy`; probe exit 0, conservó SHA A. 200 health/HTML, 307 raíz, 401 sesión, 47 assets JS/CSS válidos y SW/BUILD_ID correcto. |
| A sin configuración Supabase | health 200 con SHA A, sin credenciales ni backend. |
| B defectuoso | Probe **exit 1** ante health **500**; se guardaron assertion y logs. Es el fallo esperado, no un PASS de B. |
| Recuperación de A | Arranque por el ID retenido en el mismo puerto `32768`; ID del contenedor idéntico a A y probe exit 0 con mismo SHA/BUILD_ID/47 assets. |
| Docker sin SHA / SHA malformado | Ambos builds exit 1 antes de compilar; no se etiquetaron como releases válidas. |
| Probe sin entradas / SHA esperado distinto | Ambos exit 1; los fallos no se contaron como omitidos exitosos. |
| Build normal sin identidad + identidad falsa al arrancar | Health 503 genérico/no-store; el arranque tampoco inventó identidad donde la build no la tenía. |
| Guardar/cargar archivo A | `docker image save` y `docker image load` exit 0; checksum registrado e ID A idéntico tras cargarlo. Se cargó con la imagen ya presente, sin simular pérdida del daemon. |

Las verificaciones acumulativas corresponden a `03eb030…` con documentos en
edición y `tsconfig.tsbuildinfo` generado: ambos reportes registran
**workingTreeClean=false** y conservan ese valor. Se guardó el archivo incremental
original antes de las pruebas y se repusieron sólo esos bytes después. No se
maquillaron reportes ni se modificó JSX/`className`; no aplica extracción Tailwind.

Resultados/logs originales conservados localmente en
`test-results/w10/release-108/` (ignorados), incluidos `container-results.json`,
`checks.json`, `missing-identity-result.json`, `archive-result.json`, logs A/B/A y
copias de los reportes acumulativos. La imagen se retiene en Docker y su copia
`image-a.tar`/`image-a.tar.sha256` está en ese mismo directorio local ignorado,
sin publicarla ni incluir sus bytes en los commits.

**Pendientes declarados:** smoke S1–S4 integral y comparación de borradores/cola
en el mismo navegador a través de A→B→A (#111), reporte/CI W10 (#109), evidencia
personal/defensa humana (#110) y consolidación final (#114). El ensayo anterior
acredita rollback HTTP del artefacto y las suites existentes modelan conservación
offline; no se afirma haber ejecutado todavía ese caso integrado de navegador.
No se probaron Supabase remoto, hardware, downgrade de un esquema incompatible,
igualdad bit a bit de rebuilds ni el evaluador privado. Sin despliegue,
publicación de release, merge o envío LMS.
