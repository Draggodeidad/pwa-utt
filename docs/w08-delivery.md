# Entrega verificable W08 — consolidación del owner (#84)

## Fuente, fecha y contribuciones reales

Se releyeron `ASSIGNMENT.md`, `evaluation.json`, el workflow y el check público del ZIP oficial. La copia local coincide con el SHA-256 `8e3630e8df6e6b4a0e3bfc7e1863e3947893951f9ae162548ee698e709f194d3` del [baseline](w08-baseline.md). El kit exige setup, lint, build, tests, reportes y un caso de fallo corregido; sus checks parciales no sustituyen la evidencia de comportamiento. No contiene el evaluador privado ni un esquema suficiente para fabricar su reporte/calificación.

Fecha conservada del baseline: **25/10/2026, America/Mexico_City, sin hora confirmada**. El ZIP fija domingo y duración máxima de siete días; no confirma una hora ni una ampliación al 26/10. No se afirma una nueva consulta autenticada a Classroom en esta consolidación.

- **Draggodeidad:** baseline, E2E, niveles/CI y evidencia anteriores (#75–#78, PR #85/#86); ahora asume la estrategia #81 y consolida #84 con asistencia de Codex. Añade lint real y su reporte en CI, revalida un fallo histórico y corrige las referencias documentales de #88.
- **Osbaldo (`osbaldoXxC`):** fotos `7a958749c00491eda172dbf5cc1563dad18fe8e9`, wrapper de cola `e7379f65caddb79f437ded61841c8648fbf63084` y evidencia `8eec493b94147925effaceabc9633e09a9b560da` / `9ccda90a8b5b5888a49dd9156b1f8efab1e90c0e`, conservados en [PR #88](https://github.com/Draggodeidad/pwa-utt/pull/88).

Julián no participa ni cuenta como contribuyente W08 por decisión del owner. #81 está reasignada; #83 se retiró como `not_planned` por estar dedicada sólo a su evidencia personal. No se crea sección ni plantilla a su nombre. Las contribuciones legítimas de semanas anteriores permanecen intactas y su ausencia no bloquea validaciones ni consolidación.

## Matriz de aceptación

Los estados siguientes describen comprobaciones técnicas y documentos inspeccionables, no una calificación. La evidencia del SHA final se fija en [PR #89](https://github.com/Draggodeidad/pwa-utt/pull/89), encadenado sobre #88; hay que contrastar su head con `commitSha` de los reportes antes de entregar.

| Requisito | Artefacto | Validación | Estado | Límite |
| --- | --- | --- | --- | --- |
| AC-01: instalación limpia y build | Lockfile, Node 22.22.3, `Makefile` | `npm ci --no-audit --no-fund` y `make verify`, código 0 en el código `86f2d7f79ae7be38b0153243b1f296941afed4d4` | Verificado localmente; CI final en PR #89 | El build local detectó `.env`/`.env.local` existentes; la reproducción sin configuración privada se contrasta en Actions limpio. No se publican esos archivos. |
| Lint obligatorio | `eslint.config.mjs`, script `lint`, workflow y reporter | `npm run lint`: 0; entrada sintética por stdin con clave duplicada: `no-dupe-keys`, código 1 | Implementado y verificado localmente; resultado `lint` obligatorio en CI | Reglas mínimas de sintaxis/corrección, sin formato ni auditoría exhaustiva. Sólo dependencias y archivos generados están excluidos. |
| AC-02/03: dominio y fotos | Dos entradas en `tests/unit/` | `npm run test:unit`: 0; dominio y 14 casos de fotos | Verificado | Node, datos en memoria; fotos no prueban cámara ni Sharp. |
| AC-02/03: HTTP y recuperación de cola | Dos entradas en `tests/integration/` | `npm run test:integration`: 0; HTTP real de Next y suite de recuperación | Verificado | Backend, IndexedDB y transporte sintéticos según suite; no RLS remota. |
| AC-02/03: E2E crítico | `tests/e2e/critical-flow.spec.ts`, Playwright/Chromium | Después de integración y `make verify`: `E2E_SKIP_BUILD=1 npm run test:e2e`, 0, `1 passed` | Verificado | Un recorrido Chromium con backend sintético; sin hardware ni otros motores. |
| AC-03: caso real corregido | `57ee3ea` y escenario existente de `tests/photo-local.spec.ts` | Mismo test: código anterior 1 por exposición tras logout; arreglo y código actual 0 | Fallo histórico real revalidado en W08 | Arreglo de W06, no se presenta como bug nuevo ni como trabajo personal de otro integrante. |
| AC-02/04: estrategia y decisiones | [Estrategia](test-strategy.md) | Cinco suites con riesgo, casos, comando, dependencias, límites y evidencia; rutas/scripts contrastados | Completado por el owner para #81 | No se inventa cobertura ni evidencia remota; revisión/defensa humana pendiente. |
| CI y reportes | `.github/workflows/academic-evaluation.yml`, `scripts/write-academic-evaluation-report.mjs` | Node 22.22.3; instalación, lint, unitarias, integración, `make verify`, E2E; artefactos ligados a SHA | Infraestructura implementada; head final y resultado fijados en PR #89 | No equivale al evaluador privado, no genera nota académica. |
| README, evidencia y trazabilidad | README, este documento, `evidence/individual.md`, #88/#89 | Aportes, commits, ejecuciones históricas/locales/Actions y pendientes separados | Preparación documental completada | La revisión humana no se infiere de un PASS técnico. |
| Entrega y revisión humana | URL/SHA y artefacto del PR #89 | Revisión humana del owner, académica y envío a Classroom | Pendiente humano | Sin merge, tag, despliegue manual ni envío LMS por Codex. |

## Verificación local y trazabilidad de CI

Fecha local: 24/10/2026. Runtime real: Node `v22.22.3`, npm `10.9.8`. Código verificado: `86f2d7f79ae7be38b0153243b1f296941afed4d4` ([PR #89](https://github.com/Draggodeidad/pwa-utt/pull/89)); las ediciones posteriores son documentales. El checkout conserva una eliminación local ajena de `PWA-w03-kit-estudiante.zip`, no incluida en ningún commit. Los cambios de `tsconfig.tsbuildinfo` generados por typecheck fueron restaurados; no forman parte de la entrega.

| Comando efectivamente ejecutado, en orden | Resultado observado |
| --- | --- |
| `npm ci --no-audit --no-fund` | 0, instalación limpia. |
| `npx playwright install chromium` | 0, navegador disponible. |
| `bash public-tests/check.sh` | 0, `PUBLIC_OK`. |
| `bash public-tests/check-w05.sh` | 0. |
| `bash public-tests/check-w06.sh` | 0, `W06_PUBLIC_OK`. |
| `npm run lint` | 0, sin errores ni warnings de lint. |
| `npm run test:unit` | 0, dos suites; fotos: 14 casos. |
| `npm run test:integration` | 0, dos suites: HTTP y recuperación de cola. |
| `make verify` | 0: typecheck, `npm test` acumulativo, build/postbuild, métricas de rendering y gate W06 pasaron. |
| `E2E_SKIP_BUILD=1 npm run test:e2e` | 0, `1 passed` en Chromium, después de generar la build de producción. |

El intento preliminar de `npm run typecheck` antes de instalar dependencias no pudo ejecutar `tsc` (`command not found`); no se cuenta como PASS. Después de `npm ci`, el typecheck dentro de `make verify` sí terminó con código 0. Los avisos existentes de Node sobre detección de módulos y colores no son errores de prueba. No se cambió el stack ni se desactivó ninguna prueba para resolverlos.

Los logs, los resultados por comando y los snapshots de reproducción se conservaron fuera de Git en `/home/dragodeidad/Documents/PWA/w08-owner-validation/` (`local-results.json`, logs por comando, `photo-race-results.json` y ZIPs de reportes descargados). No se versionan logs de navegador, sesiones ni archivos de entorno. Para evaluación externa se usan los artefactos de Actions enlazados desde los PR.

Evidencia de #88 comprobada por el owner:

| SHA evaluado | Run / artefacto inspeccionado | Resultado y autoría |
| --- | --- | --- |
| `9ccda90a8b5b5888a49dd9156b1f8efab1e90c0e` | [40020745057](https://github.com/Draggodeidad/pwa-utt/actions/runs/40020745057), [12529754946](https://github.com/Draggodeidad/pwa-utt/actions/runs/40020745057/artifacts/12529754946) | Node 22.22.3, todos los pasos W08 de ese workflow pasaron; no incluía lint. Verificación de consolidación del owner, separada del reporte local de Osbaldo con Node 22.12.0. |
| `9d1ed9acb3b5cc46eed73e18f88244d4b2d018af` | [40163768210](https://github.com/Draggodeidad/pwa-utt/actions/runs/40163768210), [12586929893](https://github.com/Draggodeidad/pwa-utt/actions/runs/40163768210/artifacts/12586929893) | Corrección documental del owner: Node 22.22.3, todos los pasos pasaron. Los tres reportes descargados coinciden en SHA/runtime; `academic-evaluation.json` y `verification.json` indican `pass`. |

El SHA final de #89 no se inventa dentro de su propio commit. La descripción y nota de consolidación del PR fijan el head publicado, su run y su artefacto después de comprobarlos. Cada resultado posterior se atribuye al owner con asistencia de Codex; no se convierte en una ejecución personal de Osbaldo.

## Fallo real corregido en W06 y revalidado en W08

- **Síntoma:** una lectura local de foto iniciada con sesión válida podía devolver el `Blob` después del logout. También faltaba revalidar la sesión tras preparar asincrónicamente una foto antes de guardarla.
- **Reproducción determinista:** establecer una sesión sintética; iniciar `repository.read` con `storage.getPhoto` pendiente; bloquear la sesión; resolver el almacenamiento con un Blob sintético. La assertion existente exige `{ status: "error", code: "forbidden" }`. El mismo escenario comprueba que `attach` no escribe tras cerrar sesión durante el hash.
- **Causa:** el epoch de la sesión sólo se comprobaba antes de algunos `await`; la operación retenía autorización obsoleta al completarse.
- **Corrección original:** Draggodeidad, 09/10/2026, [57ee3ead91dcc21ac07f67d22135ff6083903604](https://github.com/Draggodeidad/pwa-utt/commit/57ee3ead91dcc21ac07f67d22135ff6083903604), revalida `active()` tras las operaciones asíncronas. El test existente se incorporó posteriormente en `0211fc959615ab788d0b90246fd14d190f9f6141`.
- **Validación de W08 por Codex:** se ejecutó la misma suite `tests/photo-local.spec.ts` de `9d1ed9a` sobre snapshots íntegros de `src`/`tests`, sustituyendo únicamente el archivo de test en la copia temporal. El padre `c556a732722dcbb29d617771388e59f505f1952d` terminó con código 1 por la assertion real: recibió `status: success` y Blob de 9 bytes en lugar de `forbidden`. `57ee3ea` terminó con 0; el código de `9d1ed9a` terminó con 0. La suite acumulativa de la consolidación también pasó.
- **Límite:** sesiones/almacenamiento sintéticos, sin acceso a cuentas reales. Se revalida un arreglo histórico legítimo; no se altera producción, se introduce una regresión artificial ni se usa `assert.fail` como evidencia del bug. La aceptación académica de esta evidencia histórica queda sujeta a revisión.

Receta reproducible desde el repositorio, con Node 22.22.3 activo (copias temporales, sin alterar el checkout):

```python
import io, pathlib, subprocess, tarfile, tempfile

suite_sha = "9d1ed9acb3b5cc46eed73e18f88244d4b2d018af"
fixed_sha = "57ee3ead91dcc21ac07f67d22135ff6083903604"
suite = subprocess.check_output(["git", "show", f"{suite_sha}:tests/photo-local.spec.ts"])
for ref, expected in [(fixed_sha + "^", 1), (fixed_sha, 0), (suite_sha, 0)]:
    sha = subprocess.check_output(["git", "rev-parse", ref], text=True).strip()
    with tempfile.TemporaryDirectory(prefix="w08-photo-race-") as folder:
        archive = subprocess.check_output(["git", "archive", sha, "src", "tests"])
        with tarfile.open(fileobj=io.BytesIO(archive)) as files:
            files.extractall(folder, filter="data")
        pathlib.Path(folder, "tests/photo-local.spec.ts").write_bytes(suite)
        result = subprocess.run(["node", "tests/photo-local.spec.ts"], cwd=folder)
        print(sha, "exitCode", result.returncode)
        assert result.returncode == expected
```

## Pendientes humanos y límites

La revisión y defensa humana del owner no se han realizado ni firmado mediante este trabajo. Los reportes no asignan puntos ni ejecutan el evaluador privado. Hardware físico, permisos del SO, Supabase/RLS remoto y otros navegadores siguen fuera de las pruebas sintéticas. El owner debe revisar los PR y decidir su integración, confirmar la hora en Classroom y realizar la entrega del SHA/reporte; Codex no ejecuta esos pasos. Ninguno depende de participación de Julián.
