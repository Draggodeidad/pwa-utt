# Evaluación técnica W10 — #109

Consume la [baseline #107](w10-baseline.md) integrada en PR #116 y el
[contrato de release #108](release-process.md) integrado en PR #117.
Base de implementación revisada: `ab8f23e7cda84bffd6b4e3d6a2701e391c671f92`.
Tras fetch y consulta remota, #117 está integrado, no hay PR abiertos y las
refs W10 accesibles son baseline y reproducible-release. Dockerfile, health,
release-process y runbook existen; `tests/smoke.spec.ts` sigue pendiente de
#111. Esto actualiza el corte histórico, sin afirmar ausencia global futura.

## Rutas, comandos y orden

`.github/workflows/academic-evaluation.yml` conserva íntegro el job W08 y llama
al workflow reutilizable `.github/workflows/week-10-w10-release-rollback.yml`.
Este último también admite ejecución manual; su ruta coincide con
`evaluation.json` del kit. No se modifica el workflow W09 ni ningún check previo.
El checkout usa el head del PR, no el merge sintético. Ambos jobs son
independientes: un fallo W10 no elimina la evidencia W08.

En un checkout del SHA que se desea evaluar, con **Node 22.22.3/npm 10.9.8**,
Make y dependencias del sistema para Chromium:

```bash
npm run verify:w10
```

Equivale a `node scripts/verify-w10.mjs`; el script no necesita dependencias
npm para arrancar. Ejecuta `npm ci --no-audit --no-fund` y fija configuración
Supabase sintética de loopback, telemetría desactivada y `W10_BUILD_SHA` al
`git rev-parse HEAD` real. No lee ni imprime entornos personales. `npm ci` sin
`--ignore-scripts` sigue el setup oficial y conserva los scripts del stack.
Las opciones omitidas de audit/fund no son una auditoría de dependencias.

| Gate | Ejecución real / prerrequisito |
| --- | --- |
| runtime | Rechaza Node/npm distintos de los fijados para CI/contenedor. |
| install | `npm ci --no-audit --no-fund`. |
| browser | `npx --no-install playwright install chromium`; requiere install. CI añade `--with-deps` mediante `--with-browser-deps` en ambas invocaciones del runner. Local requiere bibliotecas del SO ya instaladas. |
| public / w05 / w06 | Checks existentes, cada uno con su propio exit code. |
| w10-artifacts | `bash public-tests/check-w10.sh --artifacts`: archivos obligatorios no vacíos y registro exacto de test:smoke. |
| w10-documents | `bash public-tests/check-w10.sh --documents`: README, evidencia individual y este contrato no vacíos; no certifica su calidad ni autoría. |
| lint / unit / integration | Scripts existentes, después de install. |
| w10-negatives | `npm run test:w10-gates`; regresiones del gate/reporte en clones desechables y datos sintéticos. |
| verify | `make verify`: typecheck, suite acumulativa, `npm run build`/postbuild, métricas HTTP y W06; después de install. |
| w09 | `npm run verify:w09`; requiere verify y browser. Conserva su reporte W09 separado. |
| e2e | `E2E_SKIP_BUILD=1 npm run test:e2e`; requiere verify y browser. |
| smoke | `node scripts/run-w10-smoke.mjs`; requiere verify y browser. Arranque productivo, probe #108 y `npm run test:smoke` en ese orden. |

El gate W10 es separado de `public-tests/check.sh`: no reemplaza los controles
acumulativos ni copia los defectos del check del kit. No considera búsquedas de
palabras como prueba de ausencia de secretos. Rechaza archivos ausentes/vacíos;
su PASS estructural no acredita comportamiento. No usa `--if-present`.

## Frontera de smoke con #111

`test:smoke` queda registrado exactamente como **`node tests/smoke.spec.ts`**.
No se añade una suite ficticia para completar #111. Ausencia o archivo vacío
produce fallo no cero del gate y una explicación; no es skip exitoso.

El arnés requiere build previa y levanta su propio `next start` productivo en
un puerto loopback libre, sin reutilizar servidores. Exporta `W10_BASE_URL`,
`W10_EXPECTED_SHA` y `W10_EXPECTED_BUILD_ID` observados; comprueba health, HTTP,
assets y BUILD_ID con el probe de #108 antes de ejecutar la suite. El probe
limita arranque a 30 s y peticiones a 5 s. El proceso de smoke tiene presupuesto
de 10 minutos; termina y el servidor se retira incluso con fallo. El check HTTP
previo no se presenta como sustituto de S1–S4 o del ensayo de imágenes.

Se precisa el contrato documental de salida de #107 para que un comando vacío
con exit 0 tampoco pase. #111 debe escribir **`test-results/w10/smoke-result.json`**
durante esa ejecución (el arnés elimina la copia anterior):

```json
{
  "assignmentId": "w10-release-rollback",
  "commitSha": "<SHA completo recibido en W10_EXPECTED_SHA>",
  "buildId": "<BUILD_ID recibido en W10_EXPECTED_BUILD_ID>",
  "checks": [
    { "id": "W10-S1", "status": "pass", "exitCode": 0 },
    { "id": "W10-S2", "status": "pass", "exitCode": 0 },
    { "id": "W10-S3", "status": "pass", "exitCode": 0, "detectedExitCode": 1 },
    { "id": "W10-S4", "status": "pass", "exitCode": 0 }
  ]
}
```

Es **un esquema de interfaz, no evidencia de ejecución**. Los campos sólo se
escriben tras assertions reales. `detectedExitCode` es el código positivo real
observado al detectar B defectuoso, no un valor fijo ni el código global de la
suite. S1–S4 conservan el significado de la matriz #107; S4 debe demostrar
recuperación y conservación de trabajo, no sólo health o un harness SW aislado.
Un caso pendiente debe fallar o quedar sin completar; no se convierte a pass.
El arnés rechaza reporte ausente, malformado, SHA/BUILD_ID distintos, duplicados,
casos omitidos, not-run/fail y una prueba negativa sin fallo observado. Sólo
proyecta campos permitidos a `reports/w10/smoke.json`. Este contrato no ejecuta
por sí mismo rollback ni certifica las assertions de una futura suite; su
implementación y revisión siguen en #111.

## Reporte y AC-01–04

`evaluation-result.json` usa **schemaVersion local 1** y
`assignmentId: w10-release-rollback`. Incluye SHA real, limpieza al inicio y al
final, fecha UTC, Node/npm reales, URL/ID/intento de Actions o null, cada comando,
`pass`/`fail`/`not-run`, exitCode observado o null, señal/error de ejecución por
código, artefactos vinculados al SHA y límites. No serializa stdout/stderr ni
variables de entorno. Un fallo o una omisión impide PASS técnico global.

Un prerrequisito fallido deja su dependiente `not-run`, con exitCode null y
motivo; el resto de gates independientes continúa. Un proceso fallido conserva
su código real; timeout/señal sin código queda `fail` con null y señal/error.
El resultado global del verificador es 0 sólo con todos los gates en pass; en
otro caso es 1. Un árbol sucio se declara sin reetiquetarlo como limpio: el SHA
identifica el commit, pero cambios locales requieren considerar también esa
bandera. El archivo incremental versionado `tsconfig.tsbuildinfo` puede cambiar
durante typecheck/build. El verificador no lo restaura ni oculta diferencias.

| Criterio | Evidencia automatizada | Límite de aceptación |
| --- | --- | --- |
| AC-01 | install + verify; `reports/verification.json` desglosa typecheck/tests/build. | No prueba igualdad bit a bit de dos imágenes. |
| AC-02 | w10-artifacts + smoke/HTTP y SHA/BUILD_ID observados. | Existencia por sí sola no prueba release/rollback ni publica artefacto. |
| AC-03 | negativos del gate, unit/integration, verify, W09, E2E y smoke. | Fixtures del reporter no son smoke; S1–S4 requieren #111. |
| AC-04 | w10-documents + reporte con límites, SHA y URL real del run. | Revisión de decisiones, evidencia personal W10 y defensa humana pendientes; ninguna puntuación automática. |

El reporte W09 se conserva en `reports/w10/w09-evaluation-result.json`, con su
assignmentId original. Nunca se recicla como W10. Los reportes acumulativos sólo
se indexan como artefactos si el comando se ejecutó en este intento y su SHA
coincide. Se registran BUILD_ID cuando se observa y rutas exactas; no se inventan
digest de imagen, cobertura, calificación ni evidencia personal. El CI #109
prueba build productiva Next; la imagen/ensayo Docker sigue el contrato #108 y
la implementación de S4 en #111.

Cada gate guarda un checkpoint en `reports/w10/evaluation-result.json`. El paso
final `--report-only`, ejecutado con `always()`, sólo recupera un checkpoint W10
del mismo SHA, run, URL e intento CI y de la misma lista de comandos. No ejecuta
pruebas ni acepta reportes locales/W09/antiguos; ante ausencia o inconsistencia
escribe not-run y falla. Cancelación dura o pérdida del runner puede impedir
cualquier paso posterior; no se promete artefacto en ese caso.

El upload usa `always()`, nombre **`w10-release-rollback-<SHA>`** y error si no
hay archivos. Lista explícita: reporte W10, verification, rendering-metrics,
W09 separado y resúmenes HTTP/smoke si se produjeron. No sube coverage inventada,
todo test-results, traces, capturas, entornos ni payloads de sesión. Un build
fallido no recupera artefactos antiguos: se limpian antes de ejecutar.

## Evidencia observada

Los resultados de ejecución y SHA se registrarán después de validar los commits
funcionales de esta issue. Hasta entonces son pendientes, incluidas Actions,
S1–S4 y revisión personal. Las ejecuciones de Codex se identificarán como tales;
no sustituyen `evidence/individual.md`, la defensa del owner ni la entrega LMS.
