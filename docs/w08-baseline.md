# Baseline W08: kit, inventario y contratos (#75)

## Estado y alcance de esta issue

Esta issue confirma la fuente, inventaría el kit completo, compara sus contratos con el repositorio y fija el reparto de trabajo. No implementa suites W08, configura CI, copia el ZIP ni cambia la aplicación o el stack. El único artefacto nuevo de esta issue es este baseline.

- Responsable: `@Draggodeidad`; dificultad Medium, 2 pts; Fase 1 — owner.
- Base: `main` actualizado desde `origin/main`, SHA completo `7fd77027cbc4d0e4e04c5a1d26308593d219bf0e`.
- Rama de trabajo: `feat/w08-baseline-contracts`.
- No se sustituyó ni eliminó ninguna prueba previa.

## Fuente, fecha y archivo oficial

- Actividad de Classroom: [Semana 08 — Pirámide de pruebas e integración continua (8 puntos)](https://classroom.google.com/c/ODc2NjkzNjkzNzYy/a/ODc2Njk2NTc0OTA0/details). La actividad indica entrega **25/10/2026** y plazo máximo de **7 días**. La página muestra el día, pero no una hora límite; no se interpreta como 23:59. La fecha de publicación 19/10/2026 es el contexto de la actividad registrado al planificarla.
- Adjunto enlazado desde la actividad: [PWA-w08-kit-estudiante.zip en Google Drive](https://drive.google.com/file/d/175-kD3-rSWWJn4AM-K4wbGkXnqZAKxvj/view).
- Nombre exacto: `PWA-w08-kit-estudiante.zip`. La copia descargada desde el adjunto y la copia local en la raíz del repositorio coinciden en SHA-256: `8e3630e8df6e6b4a0e3bfc7e1863e3947893951f9ae162548ee698e709f194d3` (8 236 bytes). El archivo permanece sin seguimiento y no se añade al repositorio.
- Se extrajo fuera del repositorio en `/tmp/pwa-w08-kit-analysis` y se leyó cada archivo. El ZIP contiene ocho archivos de texto (13 674 bytes descomprimidos), cinco entradas de directorio y ningún recurso binario.

### Inventario íntegro del ZIP

| Entrada | Bytes | Formato y contenido |
| --- | ---: | --- |
| `ASSIGNMENT.md` | 6 715 | Markdown: actividad, requisitos, rúbrica, setup, entrega, evidencia, política de IA y checks. |
| `README.md` | 411 | Markdown: nombre del paquete y comando para el check público. |
| `evidence/individual.md` | 288 | Markdown: campos de evidencia individual. |
| `tests/README.md` | 205 | Markdown: contrato de pruebas deterministas con datos sintéticos. |
| `.github/workflows/week-08-w08-testing-ci.yml` | 1 664 | YAML: workflow de feedback académico. |
| `evaluation.json` | 3 890 | JSON: esquema v2, criterios AC-01–AC-04, puntos y rutas de salida. |
| `public-tests/README.md` | 178 | Markdown: uso del check público. |
| `public-tests/check.sh` | 323 | Bash: existencia de rutas/README y búsqueda simple de palabras sensibles. |
| Directorios | — | `evidence/`, `tests/`, `.github/`, `.github/workflows/`, `public-tests/`. |

No se encontró en el ZIP implementación de la aplicación, una suite de pruebas ejecutable, datos binarios ni el evaluador privado mencionado por la actividad. La carpeta `tests/` sólo contiene el README contractual. El contenido de un evaluador privado no es verificable desde este archivo.

## Contrato oficial leído

La actividad pide continuar el repositorio acumulado de la PWA y usar sólo datos sintéticos. El objetivo W08 es probar los riesgos del flujo crítico con una pirámide de pruebas, justificar la selección, automatizarla en CI y diagnosticar al menos un fallo reproducible y corregido. El incremento no se satisface sólo por crear los nombres de ruta.

Los entregables requeridos por Classroom y el kit son `tests/unit/`, `tests/integration/`, `tests/e2e/`, `docs/test-strategy.md`, `.github/workflows/academic-evaluation.yml`, `README.md` y `evidence/individual.md`; la entrega también incluye el commit o enlace evaluado y el reporte que produzca CI. La rúbrica oficial suma 8 puntos: instalación/build 2, artefactos/implementación 3, pruebas críticas 2 e ingeniería/evidencia 1. Los 18 puntos del reparto de issues son planificación del equipo, no puntos de la rúbrica.

Reproducibilidad indicada: Node 22.x en el proyecto (el workflow W06 fija 22.22.3), `npm ci` y luego `make verify` o un equivalente exacto documentado. `evaluation.json` declara `make verify` y `npm run dev`. El texto de la actividad pide además lint en CI, pero `package.json` no define un script `lint` y el workflow de muestra tampoco ejecuta uno; no se declarará lint cubierto sin una decisión y comando reales.

El workflow dentro del ZIP se llama `week-08-w08-testing-ci.yml` y se describe como feedback formativo, no como autoridad final de calificación. Instala con `npm ci --ignore-scripts --no-audit --no-fund`, intenta `npm run build --if-present`, comprueba presencia de algunas rutas y ejecuta `npm run test --if-present -- --run`; sube, si existen, `evaluation-result.json`, `coverage/` y `test-results/`. El check público también se limita a rutas y README y busca `api_key|secret|password|token` entre los archivos que `rg` inspecciona por defecto; no valida comportamiento de las pruebas y puede encontrar texto legítimo del proyecto. Ninguna de estas comprobaciones parciales sustituye el commit fijado ni la revisión de evidencia.

El kit pide reportes, pero no contiene un esquema de `evaluation-result.json` ni genera cobertura. `evaluation.json` incluye un objetivo narrativo de automatización del 90%, que no equivale a cobertura de código ni a un umbral de aceptación de Classroom. Se conserva el reporte técnico que ya produce el proyecto; no se fabrican nota, JSON DMI, porcentaje de cobertura o salida privada.

## Matriz de cobertura existente y trabajo W08

Los estados describen evidencia encontrada en este SHA, no la calificación final. “Cumplido” sólo se usa para el artefacto o comportamiento citado y dentro de su límite declarado.

| Requisito | Estado | Evidencia existente / artefacto W08 | Issue y validación pendiente |
| --- | --- | --- | --- |
| Repositorio acumulado, stack y datos sintéticos | Cumplido | Mismo proyecto Next/PWA; dependencias y lockfile existentes. Las suites citadas usan fixtures/identificadores sintéticos. Se conservan el manifest PWA en formato JSON `public/manifest.webmanifest` y el service worker JavaScript `public/sw.js`; W08 no exige cambiar esos formatos. | #75 conserva la base; no descargar starter ni migrar stack. |
| Instalación limpia y build (AC-01) | Parcial | `package.json`, `package-lock.json`, Node declarado `22.x`, `Makefile`, `scripts/verify.mjs`; CI W06 histórica para el SHA base [pasó](https://github.com/Draggodeidad/pwa-utt/actions/runs/38201561308). | #77: ejecutar `npm ci` y CI W08 sobre el SHA final con Node 22.22.3. El `make verify` local registrado abajo usó Node 26.2.0, no ejecutó `npm ci` y no sustituye ese gate. |
| Pruebas unitarias de lógica | Parcial | `tests/domain-contracts.spec.ts`, `tests/date-format.spec.ts`, `tests/photo-validation.spec.ts` y otras suites ejecutables desde `npm test`. Validan lógica real con assertions; aún no están bajo `tests/unit/`. | #77 organiza `tests/unit/domain-contracts.spec.ts`; #79 expone `tests/unit/photo-validation.spec.ts`. Añadir scripts `test:unit` con fallos propagados. |
| Pruebas de integración | Parcial | `tests/online-inspection-workflow.spec.ts` levanta rutas reales de Next contra backend HTTP sintético y declara “without a browser”. `tests/queue-recovery.spec.ts` usa `LocalStorage`, harness IndexedDB y transporte sintético para persistencia/reintento/ACK. Aún no están bajo `tests/integration/`. | #77 organiza `tests/integration/online-workflow.spec.ts`; #80 expone `tests/integration/queue-recovery.spec.ts` reutilizando las suites. Añadir `test:integration`. |
| E2E automatizado del flujo crítico en navegador real | Sin evidencia | No existe `tests/e2e/`, config/runner ni script `test:e2e`. La evidencia W06 describe recorridos manuales con harnesses temporales fuera del repo; no es una prueba E2E versionada reproducible. | #76: implementar flujo crítico automatizado de navegador real, con assertions de comportamiento y fixtures sintéticos. |
| Estrategia de selección de pruebas | Pendiente | Hay decisiones W06 y contratos distribuidos, pero no existe `docs/test-strategy.md`. | #81 transcribe este contrato sin inventar arquitectura, resultados ni métricas. |
| CI académico W08 | Parcial | Existen workflows acumulativos W01–W06; `.github/workflows/week-06-w06-device-push.yml` instala, ejecuta checks y `make verify`, y sube reportes del proyecto. No existe `academic-evaluation.yml`. | #77 adapta el workflow W08 y propaga fallos reales. No contar `--if-present` como ejecución obligatoria ni inventar un lint. |
| Reporte, README y trazabilidad del SHA | Parcial | `scripts/verify.mjs` genera `reports/verification.json` con SHA, resultado técnico y límites; `README.md` y `evidence/individual.md` contienen entregas anteriores. No hay salida W08 ni sección individual W08 consolidada. | #77/#84 actualizan documentación y enlazan el reporte del SHA exacto; #78, #82 y #83 añaden sólo la evidencia propia de cada persona. |
| Fallo W08 reproducible y corregido | Pendiente | Las suites actuales contienen casos negativos y fallan ante assertions rotas, pero no se identificó una regresión W08 diagnosticada/corregida con evidencia ligada al commit. | #76/#77 registran el caso real cuando exista; no fabricar un fallo ni usar un fallo de harness como regresión de producto. |
| Contrato privado del evaluador | No verificable | La actividad menciona checks privados, pero el ZIP no contiene `private-evaluator/w08-testing-ci/check.sh` ni su contrato JSON. | No inferir sus condiciones; usar sólo los checks y fuentes efectivamente entregados. |

### Reproducción local de la base

- Fecha: 19/10/2026 (`America/Mexico_City`). SHA completo de HEAD: `7fd77027cbc4d0e4e04c5a1d26308593d219bf0e`.
- Comando exacto: `make verify`.
- Caso: verificación técnica acumulativa de la base local W08 antes de añadir este documento.
- Esperado: exitCode `0` y ejecución satisfactoria de typecheck, pruebas, build/postbuild, métricas de rendering y gate W06.
- Observado: exitCode `0`; typecheck, suite `npm test`, build/postbuild, métricas de rendering y `bash public-tests/check-w06.sh` pasaron. `reports/verification.json` indica revisión académica pendiente.
- Entorno y límite: Node `v26.2.0`; no se ejecutó `npm ci`. Por tanto acredita el resultado local de `make verify` en esa instalación, no instalación limpia ni ejecución del workflow W08 en Node 22.22.3. La integración HTTP es simulada y no acredita un navegador real, hardware o servicios privados. El checkout tenía cambios locales ajenos a este baseline al momento de la ejecución.

## Contratos independientes del equipo

Todas las rutas siguientes son propuestas nuevas, salvo las suites `tests/` de origen que se indican para reutilizar. La existencia de una ruta no cuenta como prueba hasta tener casos y assertions que detecten regresiones.

- **Owner — E2E (#76):** preparar `tests/e2e/critical-flow.spec.ts`, `tests/e2e/fixtures/backend.cjs`, config/runner y el script `test:e2e`. Cubrir el flujo crítico en navegador real con datos sintéticos; fallo de assertion o harness debe terminar con código distinto de cero.
- **Owner — organización y CI (#77):** preparar `tests/unit/domain-contracts.spec.ts` y `tests/integration/online-workflow.spec.ts`, reutilizando `tests/domain-contracts.spec.ts` y `tests/online-inspection-workflow.spec.ts`; exponer `test:unit` y `test:integration` sin reemplazar ni borrar las suites acumulativas. Preparar el workflow académico W08 y los comandos/reportes sólo después de verificarlos.
- **Osbaldo (#79/#80):** limitar sus cambios a `tests/unit/photo-validation.spec.ts` y `tests/integration/queue-recovery.spec.ts`; reutilizar `src/lib/photos/validation.ts`, `tests/photo-validation.spec.ts` y `tests/queue-recovery.spec.ts`. No editar runners, `package.json` ni workflows. Usar datos sintéticos y assertions reales.
- **Julián (#81):** transcribir decisiones fijadas aquí a `docs/test-strategy.md` con los campos: propósito; nivel/ruta; caso esperado; comando confirmado por owner; límite/mock; evidencia/SHA/CI. No inventar arquitectura, comandos, resultados o métricas. El owner puede consolidar aunque ese documento aún falte.
- **Evidencia individual (#78/#82/#83):** cada autor redacta únicamente su sección W08 en `evidence/individual.md`, con contribución propia, SHA trazable, decisión defendible, comprobación ejecutada y resultado real, límite y declaración de IA. El owner consolida sin sustituir declaraciones ajenas.

Cada resultado que se registre debe conservar fecha, SHA completo, comando exacto, exitCode, caso, esperado, observado y límite del entorno. Formato adicional de reporte se añadirá sólo cuando un comando real o un requisito del kit lo genere; no se inventará un esquema docente.

## Dependencias y trazabilidad del reparto

No hay dependencias técnicas entre las tareas owner y los aportes de compañeros. Publicar este contrato permite preparar en paralelo #79, #80, #81, #82 y #83, sin esperar a cerrar otro trabajo independiente ni la implementación E2E. Sólo #76, #77 y #78 dependen del contrato del owner. La consolidación #84 referencia todas las contribuciones; si falta alguna, permanece marcada pendiente sin fabricar resultados.

La relación de aceptación se conserva así: instalación/build → #75/#77/#84; organización de unit/integration → #77/#79/#80; E2E → #76; CI y estrategia → #77/#81; evidencia individual → #78/#82/#83; reporte final por URL o SHA → #84. El reparto de 18 puntos es una planificación interna (Draggodeidad 11, Osbaldo 5, Julián 2), no altera la rúbrica oficial de 8 puntos.

## Decisiones y límites

- Se reutiliza el repositorio y las suites existentes; no se reescriben ni se desactivan.
- Este baseline no copia el ZIP, no crea carpetas vacías, no implementa suites ni CI, no altera la evidencia personal de compañeros y no cambia producción.
- La inspección del ZIP está completa; la presencia del material no significa que la entrega W08 esté implementada o calificada.
- Los comandos `test:unit`, `test:integration` y `test:e2e` siguen siendo propuestas hasta implementarlos y ejecutarlos. La hora límite no consta en Classroom y queda sin determinar.

## Addendum de implementación del owner — #77 (19/10/2026)

Este addendum actualiza el estado de #77 sin reescribir el inventario histórico anterior. La implementación quedó en `feat/w08-academic-evaluation`, commit de código `ec587feb3dff16141ecbed4473130c0e2f8a2d6c`.

### Clasificación y contrato de ejecución

| Nivel | Entrada registrada | Suite ejercitada | Comando | Límite |
| --- | --- | --- | --- | --- |
| Unitario | `tests/unit/domain-contracts.spec.ts` | `tests/domain-contracts.spec.ts` | `npm run test:unit` | Dominio/adaptadores en Node; no arranca Next ni navegador. |
| Integración | `tests/integration/online-workflow.spec.ts` | `tests/online-inspection-workflow.spec.ts` | `npm run test:integration` | Rutas HTTP reales de Next con backend HTTP sintético; sin navegador y sin afirmar RLS remota. |
| E2E | `tests/e2e/critical-flow.spec.ts` | Flujo offline, recuperación, sincronización y finalización en Chromium | `npm run test:e2e` | Backend/API sintéticos; un navegador Chromium; no acredita servicios remotos ni hardware. |

Los runners de nivel descubren sólo archivos `.spec.ts` hijos directos, en orden alfabético, de `tests/unit/` y `tests/integration/`. Fallan si el directorio no existe, está vacío, una suite falla o el proceso no puede arrancar; propagan el primer `exitCode` fallido. Por ello las rutas reservadas `tests/unit/photo-validation.spec.ts` y `tests/integration/queue-recovery.spec.ts` se incorporarán automáticamente cuando existan, sin hacer depender la infraestructura de sus aportes. Los wrappers conservan las assertions y salida de las suites existentes como procesos Node; no son checks estructurales ni sustituyen el `npm test` acumulativo.

El workflow `.github/workflows/academic-evaluation.yml` fija Node 22.22.3, hace instalación limpia, mantiene checks públicos W02/W05/W06, ejecuta unitarias e integración, luego `make verify` y al final E2E sobre la build de producción recién generada. Instala Chromium mediante Playwright y sólo solicita `contents: read`. Los pasos de comprobación/reportes usan condiciones para intentar publicar los reportes incluso si falla una suite. El artefacto queda nombrado con el SHA de checkout y sólo contiene `academic-evaluation.json`, `verification.json` y `rendering-metrics.json`; no contiene estado de sesión, cookies, secretos, tokens ni trazas del navegador. No usa `pull_request_target` ni credenciales de servicios remotos. El reporte declara evaluación técnica y revisión académica pendiente; no asigna calificación.

La plantilla de estrategia para transcribir o ampliar por nivel está en `docs/test-strategy.md`: propósito, nivel/ruta, caso esperado, comando confirmado, límite/mock y evidencia (SHA, fecha, resultado y URL de Actions cuando exista). No se fija umbral de cobertura. Las suites simuladas no se presentan como pruebas remotas de RLS.

### Comprobaciones locales del commit de código

Entorno: Node `v22.22.3`, npm `10.9.8`; fecha `19/10/2026` (`America/Mexico_City`). Cada resultado siguiente corresponde al código `ec587feb3dff16141ecbed4473130c0e2f8a2d6c`; no es un run histórico W01–W06.

| Comando ejecutado | Resultado observado |
| --- | --- |
| `npm ci --no-audit --no-fund` | ExitCode `0`; instalación limpia. |
| `npx playwright install chromium` | ExitCode `0`; Chromium instalado para Playwright. |
| `bash public-tests/check.sh` | ExitCode `0`; `PUBLIC_OK`. |
| `bash public-tests/check-w05.sh` y `bash public-tests/check-w06.sh` | Ambos ExitCode `0`. |
| `npm run test:unit` | ExitCode `0`; suite de contratos de dominio pasó. |
| `npm run test:integration` | ExitCode `0`; flujo HTTP de Next pasó con backend sintético. |
| `make verify` | ExitCode `0`; incluyó typecheck, `npm test`, build/postbuild, métricas de rendering y gate W06. Los reportes indican revisión humana/académica pendiente. |
| `E2E_SKIP_BUILD=1 npm run test:e2e` | ExitCode `0` después de `make verify`; Chromium pasó 1 flujo crítico (`1 passed`, 36.8 s). La variable sólo evita reconstruir la build ya creada por `make verify`. |
| Prueba negativa temporal `tests/unit/ci-assertion-probe.spec.ts` con `assert.fail(...)`, ejecutada mediante `npm run test:unit` | El runner imprimió `ci-assertion-probe.spec.ts: exitCode 1` y el comando terminó distinto de cero; la suite real de dominio también se ejecutó. El archivo temporal se eliminó tras la comprobación. |

La instalación y ejecución locales no sustituyen Actions. El workflow W08 terminó `success` para el SHA `5b810c2c98d35170bbded78dcefd9328f2d4043b` en [run #4](https://github.com/Draggodeidad/pwa-utt/actions/runs/39371358843); instalación, navegador, checks previos, unitarias, integración, `make verify`, E2E, reporte y subida de artefacto completaron correctamente. El artefacto publicado se llama `w08-academic-evaluation-5b810c2c98d35170bbded78dcefd9328f2d4043b` e incluye los reportes declarados en el workflow.

Se verificó también la propagación en Actions con una rama temporal controlada: el commit `18b8be3b0d16c62cadcd7f898b806b19ec807c8b` añadió sólo `tests/unit/ci-assertion-probe.spec.ts` con `assert.fail`. En [run #5](https://github.com/Draggodeidad/pwa-utt/actions/runs/39371736135), `Run unit suites` falló como se esperaba, mientras integración, `make verify`, E2E, escritura del reporte y upload terminaron correctamente; el run total quedó `failure` y el artefacto `w08-academic-evaluation-18b8be3b0d16c62cadcd7f898b806b19ec807c8b` se publicó. Tras comprobarlo, se retiraron el archivo temporal y las ramas local/remota `codex/w08-assertion-probe`. Este control negativo no es el SHA de entrega. El run W06 histórico del SHA base no acredita W08. Revisión humana de la estrategia y calificación siguen fuera del reporte técnico.
