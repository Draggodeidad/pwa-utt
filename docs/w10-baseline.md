# Baseline W10 — kit, contratos y estado (#107)

Corte revisado: **02/11/2026, America/Mexico_City**, `origin/main` en
`6856df01d64d587c5e7fb5a94078c33a142762bc`. Este documento habilita las
issues #108–#115 mediante contratos documentales. Su alcance es #107; la release,
el contenedor, la suite smoke y el CI W10 siguen pendientes de sus propias issues.

## Fuente e inventario del ZIP

Fuente de verdad: `PWA-w10-kit-estudiante.zip`, suministrado en el checkout e
ignorado por `*.zip`. Se conservó el original y se copió, extrajo y leyó completo
fuera del repo en `/home/dragodeidad/Documents/PWA/w10-kit-review-967537971e30/`.
SHA-256: `967537971e30e0b04dcd861a18ebd2eade3617f348a94d799a16a9b4b9521890`.
La comprobación CRC no detectó errores. El hash identifica los bytes revisados;
no autentica por sí solo la procedencia docente ni confirma una copia de Drive.

Los **13 miembros** son ocho archivos UTF-8 y cinco directorios: `evidence/`,
`tests/`, `.github/`, `.github/workflows/` y `public-tests/`. No hay binarios,
symlinks, dependencias, aplicación ni evaluador privado dentro del ZIP.
Tamaños y hashes completos: [inventario del kit](w10-kit-inventory.tsv).

| Archivo leído íntegramente | Bytes | Contenido y conclusión |
| --- | ---: | --- |
| `ASSIGNMENT.md` | 6742 | Actividad, prerrequisitos, requisitos, rúbrica, reproducibilidad, entrega, evidencia, IA y límites del evaluador. |
| `README.md` | 417 | Continuar el repo acumulado, ejecutar check público y conservar SHA/reporte. No es un starter. |
| `evaluation.json` | 3913 | Esquema de contrato v2, AC-01–04, setup, comandos, rutas y puntos. No es un reporte de ejecución. |
| `evidence/individual.md` | 288 | Plantilla de siete campos, sin evidencia personal completada. |
| `tests/README.md` | 205 | Pruebas deterministas, sintéticas, que fallen ante regresiones. No incluye `smoke.spec.ts`. |
| `.github/workflows/week-10-w10-release-rollback.yml` | 1677 | Feedback formativo: setup, build, existencia, suite y upload. Leído completo antes de decidir integración. |
| `public-tests/README.md` | 184 | Ejecución del check desde la raíz de entrega. |
| `public-tests/check.sh` | 330 | Check estructural y búsqueda léxica; defectos de propagación de fallos reproducidos abajo. |

## Requisito oficial y entrega

Objetivo: release reproducible de la aplicación acumulada con versión
identificable, smoke test, actualización segura y recuperación. Sólo datos
sintéticos, sin secretos ni PII; build reproducible, health check y evidencia de
versión. Competencia primaria C07, acumulativas C09/C15. No cambiar de stack ni
descargar otro starter.

Entregables obligatorios: `Dockerfile`, `docs/release-process.md`,
`docs/runbook.md`, `tests/smoke.spec.ts`,
`.github/workflows/academic-evaluation.yml`, `README.md` con ejecución/supuestos/
evidencia, reporte generado y `evidence/individual.md`. El workflow nombrado por
`evaluation.json` es **`.github/workflows/week-10-w10-release-rollback.yml`**:
son dos rutas distintas que #109 debe atender sin borrar gates anteriores.

La rúbrica suma **8 puntos**: AC-01 instalación/build 2; AC-02 artefactos y
comportamiento 3; AC-03 pruebas 2; AC-04 reporte/decisiones/límites 1. Los puntos
del reparto de issues no cambian la rúbrica. El objetivo narrativo de
automatización ≥90% no es una medición ni un umbral de cobertura de código.

Setup oficial: `npm ci`, seguido de `make verify` o equivalente exacto
documentado. `evaluation.json` declara arranque `npm run dev`; el workflow usa
`npm ci --ignore-scripts --no-audit --no-fund`. El kit no trae Makefile,
package.json, Dockerfile, comandos de contenedor ni formato de reporte de
resultados. Su `schemaVersion: 2` corresponde a `evaluation.json`, no obliga a
inventar un esquema del evaluador privado.

Ventana: lunes a domingo de W10, máximo siete días; contexto Classroom:
02–08/11/2026. El ZIP no fija hora ni URL LMS ni SHA de entrega. Se entrega PR
o commit indicado por LMS junto con reporte y evidencia individual. Esta tarea
prepara un PR; no publica release, fusiona ni envía Classroom. La publicación
identificable sigue siendo un requisito de la actividad completa y queda
pendiente de autorización/ejecución fuera de #107.

`private-evaluator/w10-release-rollback/check.sh` y su contrato no están en el
ZIP. No se conocen sus casos. Los workflows editables son feedback, no autoridad
única de calificación; no asignar nota por existencia de archivos o PASS técnico.

## Comparación antes de integrar

Se hizo `git fetch origin`, inventario por blob del corte base y lectura de los
ocho scripts, ocho workflows y checks públicos existentes. Se revisaron las
entradas/runners de pruebas y, para este contrato, la suite E2E, backend sintético,
reporters W08/W09, smoke de seguridad y actualización segura del SW. El inventario
de 51 archivos bajo `tests/` incluye helpers/documentación; no significa 51 tests
independientes ejecutados. El código de aplicación se consultó en las fronteras
de arranque, autenticación, configuración, offline y versión.

- [Inventario del repo](w10-repository-inventory.tsv): **322 blobs**, 311 textos y
  11 binarios; modo Git, blob, tamaño y SHA-256 de cada archivo del corte base.
  No incluye estos documentos nuevos ni salidas ignoradas ni valores de `.env`.
- [Referencias inspeccionadas](w10-refs.tsv): **132 referencias**, 78 commits
  distintos, incluidas ramas locales y `origin/*` presentes tras fetch. Se
  consultó el árbol de cada punta; `git log --all -- <rutas W10>` tampoco encontró
  historial de esos entregables. Las refs históricas conservan sus nombres.
- [PR inspeccionados](w10-pr-inventory.tsv): **68 PR**, metadatos y árbol del
  SHA head de cada uno, incluidos PR cerrados con ramas eliminadas. No había PR
  abierto en el momento del inventario. El conector no devolvió una lista
  completa en la consulta inicial; se contrastó con `gh pr list --state all
  --limit 200`, que devolvió 68. Ningún head contiene las cinco rutas W10
  buscadas: Dockerfile, release-process, runbook, smoke y workflow week-10.
  Esto describe referencias/PR accesibles en ese corte, no objetos inaccesibles
  ni ramas futuras. No se afirma haber revisado todos los diffs históricos.

Los PR acumulativos relevantes son [#58](https://github.com/Draggodeidad/pwa-utt/pull/58)
(actualización segura), [#85](https://github.com/Draggodeidad/pwa-utt/pull/85)
(niveles/CI), [#88](https://github.com/Draggodeidad/pwa-utt/pull/88)
(fotos/cola), [#103](https://github.com/Draggodeidad/pwa-utt/pull/103)
(controles/CI W09), [#104](https://github.com/Draggodeidad/pwa-utt/pull/104)
(seguridad/evidencia), [#105](https://github.com/Draggodeidad/pwa-utt/pull/105)
(documentación/evidencia) y [#106](https://github.com/Draggodeidad/pwa-utt/pull/106)
(ignorar ZIP). Se conserva su autoría y trabajo; un run histórico no acredita W10.

Los 11 binarios públicos se decodificaron e inspeccionaron visualmente: seis
iconos, dos capturas del login y tres diagramas de inspección de 640×360. Los
diagramas actuales se generan con `scripts/generate-security-fixtures.mjs`;
ya no corresponden a las fotografías antiguas descritas en el baseline W09.
No se detectaron etiquetas EXIF; cinco PNG de iconos conservan campo `Software`
y el diagrama PNG tiene `dpi`. Los cinco SVG son texto: dos iconos con PNG
embebidos y tres shortcuts. La inspección no certifica ausencia absoluta de PII
ni procedencia de todos los activos. No se modifica ningún recurso.

| Superficie existente | Comportamiento por lectura | Decisión W10 |
| --- | --- | --- |
| Node/lockfile/stack | `engines: 22.x`, lockfile v3; Next 14.2.35/React 18.3.1. CI fija Node 22.22.3. | Reutilizar; no actualizar dependencias en #107. |
| `Makefile`, `scripts/verify.mjs` | `make verify` = `npm run verify`: estructura, typecheck, `npm test`, build/postbuild, métricas HTTP y gate W06; genera `reports/verification.json`. | Mantener. No ejecuta lint, niveles, E2E ni W09/W10 por sí solo. |
| Ocho scripts | verify, niveles unit/integration, medición, postbuild, fixtures, SQL Docker y reporters W08/W09. | No ejecutar generador de fixtures ni SQL remoto como efecto de inventariar. SQL desechable es una comprobación adicional separada. |
| Pruebas | `npm test` encadena 31 entradas; niveles unit/integration descubren hijos `.spec.ts`; E2E sólo descubre `critical-flow.spec.ts` bajo `tests/e2e`. | Crear `tests/smoke.spec.ts` por sí solo no lo registra en ninguno de estos comandos. #111/#109 deben registrarlo explícitamente. |
| E2E | `npm run test:e2e` compila, inicia Next productivo + backend sintético y Chromium; `E2E_SKIP_BUILD=1` exige build previa. | Reutilizar fixture y aislamiento; no llamar E2E “rollback W10”. |
| Reportes/CI | Académico W08 y workflow W09 conservan SHA/outcomes; `evaluation-result.json` actual lleva `assignmentId: w09-security-privacy`. | Reporte W10 explícito, no renombrar evidencia W09 como W10. |
| Build/PWA | `.next/BUILD_ID`, `.next/static`; postbuild genera `public/offline-assets.json` y `public/sw-build.js`; SW usa `phase-25-<build-id>`. | Preservar ambos archivos en el artefacto/contenedor. BUILD_ID no equivale al SHA Git. |
| Actualización | PREPARE_AND_ACTIVATE espera autosave y cola en todas las pestañas; falla/cancela sin activar; conserva cachés públicas compatibles. | Reutilizar `tests/safe-pwa-update.spec.ts`; no prometer rollback de servidor ni downgrade de IndexedDB por esa prueba. |
| Artefactos W10 | Dockerfile, release-process, runbook, smoke, week-10 y health específico ausentes en el corte. `academic-evaluation.yml` sí existe como W08. | Pendientes #108/#109/#111; no crear placeholders para pasar AC-02. |

## Defectos comprobados del feedback del kit

El YAML del kit no fija Node, usa `--if-present` para build/test, no ejecuta smoke
ni rollback por su nombre y no implementa AC-04. Sube, si existen,
`evaluation-result.json`, `coverage/`, `test-results/`, pero no los genera.
`if-no-files-found: ignore` puede ocultar ausencia de evidencia. #109 debe
propagar fallos/omisiones, cubrir AC-04 y conservar los gates previos.

El check original tampoco garantiza lo que anuncia. Con Bash, los fallos de
la lista `test ... && ...` y la negación `! rg ...` no hacen abortar `set -e`.
Se ejecutaron sus **bytes originales** en cuatro directorios temporales externos:

| Fixture sintético | exitCode observado | Salida | Interpretación |
| --- | ---: | --- | --- |
| Sólo README, faltan los cinco artefactos | 0 | `PUBLIC_OK` | Falso verde estructural. |
| Cinco archivos y README con `token password secret api_key` | 0 | Coincidencia de rg y `PUBLIC_OK` | La búsqueda tampoco bloquea; además es léxica, no detección de secretos. |
| Archivos mínimos + README inocuo | 0 | `PUBLIC_OK` | No acredita comportamiento ni calidad. |
| Cinco archivos sin README | 1 | Sin `PUBLIC_OK` | Este fallo sí se propaga. |

Reproducción mínima del primer caso, con el kit extraído fuera del repo:

```bash
probe=$(mktemp -d)
printf 'Fixture sintético\n' > "$probe/README.md"
(cd "$probe" && bash /home/dragodeidad/Documents/PWA/w10-kit-review-967537971e30/extracted/public-tests/check.sh)
# Observado: PUBLIC_OK, exit 0, aunque no existe Dockerfile.
rm -r "$probe"
```

No copiar el check sobre `public-tests/check.sh` acumulativo. #109 adaptará un
gate W10 separado con fallos explícitos, archivos no vacíos y registro real de
suite; sin eliminar vocabulario legítimo de auth para satisfacer un grep. La
adaptación debe documentarse y probar sus negativos. El original permanece
fuera del repo con su hash. Estos probes prueban el defecto del check, no W10.

## Contrato local para #108, #109 y #111

Las siguientes decisiones concretan lo que el kit deja abierto. **Son contratos
del proyecto, todavía por implementar**, no comandos o rutas ya suministrados
por el docente. #111 puede preparar sus casos desde aquí sin esperar el cierre
de #108. Un cambio de contrato requiere actualizar este documento y los consumidores.

| Frontera | Contrato acordado en esta baseline |
| --- | --- |
| Arranque actual confirmado | `npm run dev` para desarrollo; `npm run build` y después `npm start -- --hostname 127.0.0.1 --port 3000` para producción local. No ejecutar smoke contra dev. |
| Artefacto #108 | Imagen local `pwa-inspecciones:<SHA completo>` y digest observado, Node 22.22.3, puerto interno 3000 y Next escuchando en `0.0.0.0`. Arranque previsto: `docker run --rm -p 127.0.0.1:3000:3000 pwa-inspecciones:<SHA>`. Es plantilla contractual pendiente de Dockerfile/validación, no ejecución realizada. |
| Identidad #108 | SHA Git completo de 40 hex fijado en metadatos del artefacto durante build; no inferirlo de BUILD_ID ni aceptar que una variable mutable de arranque cambie la identidad del binario. Documentar relación SHA → imagen/digest → BUILD_ID. Sin tag `latest` como evidencia única. |
| Health #108 | Nueva ruta pública propuesta `GET /api/health`, sin sesión ni consulta a Supabase. HTTP 200 JSON `{ "status": "ok", "commitSha": "<40 hex>" }`, `Cache-Control: no-store`; SHA faltante/inválido → 503 genérico, sin inventar versión. Es liveness/identidad, no readiness de BD. Actualmente no existe. |
| HTTP acumulativo | GET anónimo `/login` y `/offline` → 200 HTML; `/` → 307 con pathname de Location `/login`; `/api/session` → 401 JSON sin redirección. Para probar fronteras privadas usar la configuración sintética válida del harness; una config ausente puede producir 503 y no es una regresión de permisos. |
| Runner #111/#109 | Entrada obligatoria `tests/smoke.spec.ts`, futuro comando `npm run test:smoke`, equivalente acordado `node tests/smoke.spec.ts`. Node/fixtures sintéticos; reutilizar Chromium instalado para casos SW cuando corresponda, sin servicios privados. No existe aún el script. |
| Entradas de smoke | `W10_BASE_URL` (origen HTTP loopback del servidor productivo bajo prueba), `W10_EXPECTED_SHA` (40 hex). Ausentes/inválidas → error no cero. El harness reserva puerto libre, no reutiliza servidor ajeno y hace teardown. #108/#111 documentarán cómo orquestar imagen y fixture desde una instalación limpia. |
| Tiempo/error | Espera de arranque máxima 30 s, petición máxima 5 s; timeout, 404, 503, redirección inesperada, JSON malformado o SHA distinto deben fallar, no reintentarse indefinidamente ni contarse como skip exitoso. |
| Fallo y recuperación | Dos artefactos locales identificados A (bueno) y B (defectuoso) sobre datos sintéticos. Comprobar A, detectar B con assertion real, retirar B y arrancar el mismo digest A; repetir health/SHA/HTTP y validar datos/cola conservados. Documentar estímulo defectuoso y restauración. No recrear A cambiando sólo su etiqueta. |
| SW/almacenamiento | Fallo de precache no activa worker defectuoso; autosave fallido bloquea activación y libera pestañas; recuperación preserva borrador y operaciones pendientes del dueño. No borrar IndexedDB/Cache Storage globalmente como “rollback”, ni revertir migraciones sin contrato de compatibilidad. `safe-pwa-update.spec.ts` aporta parte del comportamiento, no evidencia completa A→B→A. |

Matriz mínima para la suite propuesta:

| ID | Caso | Resultado exigido / límite |
| --- | --- | --- |
| W10-S1 | Arranque productivo + health + SHA esperado + rutas públicas | 200 y contenido/tipo correctos, SHA idéntico al artefacto. No basta que el puerto escuche. |
| W10-S2 | Frontera sin sesión y SHA/entrada inválidos | 307/401 privados según tabla; runner rechaza identidad inválida. Sin credenciales reales. |
| W10-S3 | Imagen/worker B defectuoso, timeout o respuesta inválida | Assertion falla y comando devuelve no cero; el arnés de prueba negativa sólo pasa si observa ese fallo. Conservar el resultado fallido de B. |
| W10-S4 | Recuperación A→B→A y trabajo local pendiente | SHA/digest A recuperado, HTTP válido y datos/cola preservados. Registrar esperado/observado; si sólo se probó harness SW, declarar ese límite. |

### Reporte por SHA

#109 generará `evaluation-result.json` con `assignmentId: w10-release-rollback`,
`schemaVersion` local declarado, `commitSha`, `workingTreeClean`, `generatedAt`,
`runtime` (Node/npm), `runUrl` o null, `status`, `checks[]` (id, comando, estado,
exitCode observado o null), `artifacts` (SHA/digest/BUILD_ID realmente observados)
y `limits`. Estados: `pass`, `fail`, `not-run`; timeout/error/omisión impiden PASS
global. Una prueba negativa esperada puede pasar como caso, conservando el fallo
real del proceso B. No fabricar cobertura, puntajes ni resultados privados.

Smoke expondrá sus casos y resultado a ese reporte; si genera salida separada,
usar `test-results/w10/` con el mismo SHA. CI debe checkout del head realmente
evaluado y subir evidencia aun con fallo con nombre
`w10-release-rollback-<SHA>`; no confundir SHA de merge sintético con head. W09
puede seguir generando su propio `evaluation-result.json` en otro job/checkout.
No reutilizar como W10 un archivo con assignmentId W09 ni subir sesiones,
cookies, `.env`, payloads o trazas sin revisar. Cobertura sólo si fue generada.

## Reparto y estado que deben consumir las issues

| Issue | Contrato y siguiente trabajo, fuera de #107 |
| --- | --- |
| #108 — release/contenedor | Implementar Dockerfile, release-process y runbook; health/identidad inmutable, arranque, artefactos postbuild, compatibilidad y recuperación A→B→A. Validar comandos antes de marcarlos ejecutados. |
| #109 — CI/gates | Atender ambas rutas de workflow oficiales, adaptar check defectuoso sin sobreescribir acumulativos; registrar smoke fuera de `npm test` previo a build; AC-04 y reporte W10 por SHA. |
| #110 — evidencia owner | Añadir sólo hechos propios con los siete campos oficiales; declaración de IA y validación humana explícita, sin atribuir ejecución del agente al estudiante. |
| #111 — smoke Osbaldo | Implementar S1–S4 en `tests/smoke.spec.ts` y comando acordado; consumir contrato #108 sin esperar implementación completa. Fallar ante suite vacía/omitida/regresión. |
| #112 / #113 — evidencia personal | Cada persona añade sólo su aporte, prueba real o pendiente y límites; conservar W01–W09 y autorías. |
| #114 — consolidación | Contrastar el SHA final limpio, npm ci + make verify + gates W10, Actions/reportes/evidencia; preparar PR/URL/SHA sin publicar, fusionar ni enviar LMS. Pendientes de compañeros se declaran, no se inventan. |
| #115 — checklist Julián | Documento manual de seis casos según su issue; consumir arranque/health/SHA/recuperación de esta baseline y #108. No implementar tests ni ejecutar rollback por completar la tabla. |

Evidencia oficial por persona: estudiante; SHA evaluado; decisión defendible;
prueba ejecutada/resultado; limitación/fallo diagnosticado; cambio que podría
defender/modificar en vivo; IA (herramienta, propósito, fragmentos influidos y
validación). Esta baseline no rellena `evidence/individual.md`: la evidencia
personal W10 y la revisión/defensa humana permanecen pendientes de #110/#112/#113.
Los contratos se publican por PR; #107 permanece abierta durante su revisión.

Los cuerpos de **#107–#115 se actualizaron en GitHub** con fuente/hash, enlace
versionado al contrato, ajustes específicos y límites de los resultados. Una
relectura confirmó los nueve cuerpos, títulos y asignaciones conservados y las
nueve issues abiertas. #114 conserva además su ajuste de reparto posterior al
apartado del kit. No se cambia responsable, dificultad, puntos ni fase, ni se
implementa el trabajo de las otras issues.

## Validación de esta baseline

PR de propuesta: [#116](https://github.com/Draggodeidad/pwa-utt/pull/116).
Primer commit atómico de inventarios/contratos:
[`2447e57bbe3c936a910bf99684bdfb1caf6b7432`](https://github.com/Draggodeidad/pwa-utt/commit/2447e57bbe3c936a910bf99684bdfb1caf6b7432).
Los siguientes resultados locales corresponden a ese SHA y a sus fuentes sin
cambios de lógica, el 02/11/2026 entre 16:04 y 16:06, America/Mexico_City.
El segundo commit sólo registra estos resultados documentales posteriores.

Se seleccionó explícitamente **Node v22.22.3/npm 10.9.8** porque el shell por
defecto usa Node 26.2.0. Las ejecuciones heredaron URL/clave pública sintéticas
de loopback y `NEXT_TELEMETRY_DISABLED=1`, sin consultar servicios privados ni
publicar valores de entornos personales. El harness E2E reemplaza su propia
configuración sintética. Son ejecuciones de Codex, no defensa personal del owner.

| Comando / comprobación real | Resultado observado | Alcance |
| --- | --- | --- |
| CRC + lectura íntegra + hashes del ZIP | Completado; ocho archivos | No autentica procedencia docente. |
| Consistencia de inventarios por blob/ZIP | exit 0; 322 blobs y ocho archivos coinciden en bytes/SHA-256 | Snapshot del corte, no del repo futuro. |
| Markdown/enlaces locales y SVG | exit 0; bloques cerrados, destinos existentes; cinco SVG sin script/referencia externa | No acredita el contenido de enlaces web ni auditoría de activos. |
| `npm ci --no-audit --no-fund` | exit 0 | Instalación limpia con lockfile; no se ejecutó auditoría de dependencias. |
| `npx playwright install chromium` | exit 0 | Chromium disponible para la versión instalada de Playwright. |
| `npm run lint` | exit 0 | Código/scripts/tests existentes. |
| `bash public-tests/check.sh`, `bash public-tests/check-w05.sh`, `bash public-tests/check-w06.sh` | exit 0 cada uno | Gates acumulativos; distintos de los bytes del check W10 original. |
| `npm run test:unit` | exit 0 | Dos entradas: dominio/fotos sintéticas. |
| `npm run test:integration` | exit 0 | Dos entradas: HTTP/cola sintéticos; sin RLS remota. |
| `make verify` | exit 0; `reports/verification.json` indica `pass` | Typecheck, 31 entradas de `npm test`, build/postbuild (47 assets), métricas HTTP y W06. |
| `npm run verify:w09` | exit 0; `evaluation-result.json` indica `pass`, assignmentId W09 | Gate W09 y seguridad productiva/sintética; no reporte W10. |
| `E2E_SKIP_BUILD=1 npm run test:e2e` | exit 0; `1 passed` en Chromium | Flujo acumulativo sobre build previa y backend sintético; no rollback W10. |
| Cuatro probes del check W10 original | Salidas 0/0/0/1 según tabla anterior | Evidencia del defecto del check, no aceptación W10. |
| Docker/build de imagen, health nuevo, smoke/recuperación W10, evaluador privado | No ejecutados / pendientes | No existen en este baseline; corresponden a #108/#109/#111 o al instructor. |
| SQL desechable, servicios desplegados, publicación y defensa humana W10 | No ejecutados / pendientes | Fuera de la validación documental #107. |

Los reportes locales conservan el SHA `2447e57…` y **workingTreeClean=false**:
typecheck/build modificaron el archivo incremental versionado
`tsconfig.tsbuildinfo`. Se comprobó la diferencia y se restauraron sus bytes
originales guardados antes de las pruebas. No se altera el reporte para aparentar
una ejecución en árbol limpio. El árbol quedó limpio antes de registrar este
segundo commit documental; el SHA final y sus runs de PR se consultan en #116.
Las ejecuciones locales anteriores no se atribuyen automáticamente a ese SHA
posterior ni a una entrega final W10.

Logs y resultados originales: directorio externo de revisión del kit,
`validation.json`, `validation-*.log`, `public-check-probes.json` y copias
`baseline-verification.json`, `baseline-rendering-metrics.json`,
`baseline-evaluation-result.json`. Estos archivos locales son auxiliares; la
evidencia remota se consulta en los artefactos reales de Actions del PR. Al
registrar este documento, esos runs seguían en ejecución, sin resultado W10.

Se observaron avisos de deprecación de ESLint, carga de módulos TypeScript y
variables de color; los comandos terminaron con exit 0. Se conservan como límites
del entorno y no se cambia el stack para ocultarlos. No se modifica JSX ni
`className`; la revisión de Tailwind inline no aplica. La calificación, defensa
humana y evidencia personal W10 permanecen pendientes y no se inventan.
