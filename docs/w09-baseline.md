# Baseline W09 — kit, inventario y contratos (#91)

## Corte, fuente y límites

- Corte de código: `3fc20505f7cb8f3e25b795884d28fee9f94cd881` (HEAD inicial de `main`). Rama de esta tarea: `feat/w09-baseline`.
- Fuente de verdad de la actividad: **`PWA-w09-kit-estudiante.zip`**, proporcionado localmente por el owner en la raíz del repositorio. Tamaño: **8 380 bytes**. SHA-256: `a641eb48fc8f0a74d4ac13ca16a53bb205915dc878bfc2b9f2839d04a6a2d28d`.
- Se comprobó la integridad de lectura de todos los miembros, se extrajo fuera del repositorio y se leyeron completos sus ocho archivos, incluidos JSON, shell y YAML. No contiene aplicación, lockfile, dependencias, imágenes, otros binarios ni archivos del evaluador privado. No es un starter nuevo.
- La identidad interna es `w09-security-privacy`, semana 9, parcial 2, máximo siete días, C13 primaria y C06/C07 acumulativas. El nombre del ZIP ya está localizado; la búsqueda previa sin resultados en Drive queda como antecedente, no como estado vigente.
- La procedencia es el archivo entregado por el owner como kit oficial. No contiene firma, enlace verificable a su distribución original ni hora de Classroom: esos extremos no se pueden autenticar a partir del ZIP. Su hash permite identificar exactamente la fuente revisada, no demostrar su emisor.
- El contexto de [#91](https://github.com/Draggodeidad/pwa-utt/issues/91) registra correo publicado el 26/10/2026 a las 08:00 CST y fecha mostrada **1/11/2026 sin hora**. El kit confirma lunes a domingo de la misma semana y siete días como máximo, sin indicar fecha absoluta, hora o zona. La hora oficial sigue **no verificable**. El acuerdo interno del 1/11 a las 17:00 `America/Mexico_City` no es la hora oficial.
- Sólo se implementa documentación de baseline. Los controles, pruebas W09, workflow, robots, reporte W09 y evidencia personal pertenecen a #92–#99. No se copian plantillas sobre documentos existentes, no se reemplaza trabajo acumulado y no se cierra ninguna issue por una inspección documental.

## Inventario íntegro del ZIP

Los tamaños son bytes descomprimidos; los hashes corresponden al contenido exacto. Hay **13 entradas: ocho archivos (13 883 bytes en total) y cinco entradas de directorio de tamaño declarado 0**: `evidence/`, `tests/`, `.github/`, `.github/workflows/`, `public-tests/`.

| Archivo | Bytes | SHA-256 | Contenido y decisión de integración |
| --- | ---: | --- | --- |
| `ASSIGNMENT.md` | 6807 | `1a9588130e29b5b064bd9fdff4f56a8f8002504479d01400227e7497ab71aa44` | Actividad completa, mínimos, AC-01–04, rúbrica, calidad, IA y entrega. Consumir como fuente; no sustituir `ACTIVIDAD-01.md`. |
| `README.md` | 417 | `eb59968e8949d9b20db7ef441a4718ee06b17a5f73aec2d7465edf12613f5816` | Continuar el mismo repo; check público y SHA/reporte CI. Añadir sección W09 al README existente en #93. |
| `evaluation.json` | 3979 | `9d8a2ce5b6258ecc4a8dd910da043e513b6b64d4ced8f4a8d905dfc32f950731` | Contrato de evaluación v2, setup, comandos, pesos y rutas. Es configuración, **no** un reporte de resultados. |
| `.github/workflows/week-09-w09-security-privacy.yml` | 1675 | `c90a5bba4878807176f0a8dbedfe5895ec76933c3e2de2fce041f8bba725c2c9` | Feedback formativo: instalación, build, existencia, test, upload. Adaptación mínima en #93; conservar CI acumulativa. |
| `evidence/individual.md` | 288 | `3e6c8feabf542eb61b1f00fdf9d753f907dcd24e0b8f5a0aff6dd018f4aacdf8` | Siete campos oficiales. Incorporar por persona al final del historial, nunca sobrescribirlo (#94/#96/#97). |
| `tests/README.md` | 205 | `93f63b688fa7435c55a45db431fc630f830f7660ca45df7c283331a73b31bc9a` | Pruebas deterministas, sintéticas, con regresión relevante. No incluye suite, runner ni fixtures. |
| `public-tests/README.md` | 184 | `baf7f38fd59560e45a3ccde66e5883bf0518db83777c5e02bb1af445f129b481` | Invocar el check desde la raíz. Preservar README/checks anteriores. |
| `public-tests/check.sh` | 328 | `4a7db14facd65c2da919aeab2d762428f86872a2990d561e27ea5980874479be` | Existencia, README y búsqueda léxica. Contiene falsos positivos y falsos éxitos reproducidos abajo. No copiar encima del check acumulativo. |

Para identificar otra copia: `sha256sum PWA-w09-kit-estudiante.zip` y `unzip -t PWA-w09-kit-estudiante.zip`. No se necesita versionar el ZIP para implementar el baseline.

## Inventario del repositorio y contraste funcional

[w09-repository-inventory.tsv](w09-repository-inventory.tsv) fija **los 308 archivos del árbol Git de ese SHA**, con ruta, bytes, SHA-256, blob Git, tipo y coincidencia con el árbol de trabajo al inventariar. Incluye todos los archivos, no sólo coincidencias de una búsqueda. Se obtuvo con `git ls-tree -rz --full-tree <SHA>` y `git cat-file blob <blob>`; los hashes no dependen de `.next` ni de `node_modules`. El inventario acredita identidad y cobertura de rutas, no una auditoría semántica ni ausencia de secretos.

| Área inventariada | Archivos | Comparación con W09 y puntos de inspección |
| --- | ---: | --- |
| `src/` | 167 | Rutas/pantallas, shell, features, validadores, repositorios, transporte, sesión, capacidades, persistencia y sincronización. W09 endurece esta app; no incorpora otro stack ni pantallas nuevas. |
| `tests/` | 49 | Suites acumulativas, arneses, dos entradas unitarias, dos de integración y E2E crítico. Faltan la ruta obligatoria W09 y su registro. |
| `supabase/` | 19 | Ocho migraciones, seed y diez suites/bootstrap SQL. Leer las migraciones en orden: la última redefine políticas y funciones; las políticas iniciales no describen solas el estado final. |
| `public/` | 18 | Manifest, SW, cinco SVG y once imágenes raster/ICO. No existe robots. No hay activos equivalentes en el ZIP para copiar. |
| `docs/` + `evidence/` | 16 + 1 | Requisitos/ADR, políticas, contratos/entregas W05/W06/W08 y evidencia histórica. Hay descripciones históricas superadas por el código; preservar historia y explicar W09 en sus documentos nuevos. |
| `scripts/` | 6 | Verify, métricas, postbuild, runners por nivel, reporte académico W08 y SQL desechable. No existe comando ni reporte W09. |
| `.github/` + `public-tests/` | 7 + 4 | Workflows W01–W06 y académico W08; gates acumulativos. No sobrescribirlos con los homónimos genéricos del kit. |
| Raíz | 21 | README, instrucciones, configuración, Node, lockfile y ZIP histórico entre otros. `package-lock.json` v3 contiene 292 entradas, incluida la raíz; Next 14.2.35, React 18.3.1, Supabase y Sharp siguen siendo el stack. |

El árbol de trabajo ya tenía `PWA-w03-kit-estudiante.zip` eliminado y el ZIP W09 sin seguimiento. El inventario del ZIP W03 usa su blob original, sin restaurar ni incluir esa eliminación en esta tarea. Durante el trabajo apareció además una edición de `.gitignore` que añade `*.zip`, ajena a los cambios de este baseline; se conserva y el ZIP W09 pasa a estar ignorado. La columna `working_tree` refleja el estado al cerrar el inventario, sin incorporar esas diferencias al contenido del SHA base. No se inspeccionan ni publican valores de entornos locales ignorados. `public/offline-assets.json` y `public/sw-build.js` son salidas ignoradas del postbuild, no archivos de entrada del baseline. El `tsconfig.tsbuildinfo` modificado por la verificación se restauró a su contenido inicial.

### Binarios y recursos públicos

Se decodificaron e inspeccionaron visualmente las once imágenes y se analizaron estructura y referencias de los cinco SVG. Tamaños y hashes completos están en el TSV.

| Recursos | Resultado observable | Límite / acción mínima |
| --- | --- | --- |
| `apple-touch-icon.png`, `favicon.ico`, `icons/favicon-96x96.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | 180×180; ICO principal 48×48; 96×96; 192×192; 512×512; 512×512. Identidad gráfica de laboratorio/escudo. Los dos PNG de 512 son idénticos. | Algunos PNG conservan campo `Software`; no afirmar que todos los activos públicos carecen de metadatos. |
| `icons/icon.svg`, `icon-maskable.svg` | Idénticos, 1 760 981 bytes cada uno; cada SVG contiene dos imágenes PNG embebidas de 1254×1254, sin scripts ni imágenes externas. | No optimizar ni sustituir iconos en #91. |
| `icons/shortcut-{list,new,sync}.svg` | Vectores de 24×24, sin scripts ni imágenes embebidas. | Conservar. |
| `screenshots/desktop-home.png`, `mobile-home.png` | 1280×800 y 750×1334; pantalla de login; sin campos de metadatos detectados por Pillow. | La inspección visual no certifica procedencia ni ausencia absoluta de información. |
| `inspection-assets/finding-evidence.png` | 4×64; Pillow detecta `Raw profile type APP1`, aunque `getexif()` no devuelve etiquetas. | No confundir `getexif()` vacío con eliminación de todo metadato. Revisar uso/procedencia en #92. |
| `inspection-assets/laboratory-evidence-{1,2}.jpeg` | 235×128 y 512×279; fotografías de laboratorio con personas visibles; sin etiquetas EXIF detectadas. El detalle de demostración referencia la primera. | **Sin evidencia** de origen sintético/no PII. #92 debe resolver procedencia y alcance; #93 sólo corrige una brecha demostrada. No dar por cumplida la regla de datos exclusivamente sintéticos por el nombre de un fixture. |

La recodificación de fotos subidas en `src/lib/photos/server-validation.ts` no transforma automáticamente estos archivos estáticos ni los blobs originales guardados offline. No se ha copiado ni modificado ningún binario.

### Responsabilidades de los controles existentes

| Superficie / dato | Control real y artefactos | Validación reutilizable / límite |
| --- | --- | --- |
| Acceso, perfil y roles | `src/middleware.ts`, `src/lib/auth/{guards,session-store}.ts`, rutas auth/session, `src/lib/supabase/server.ts`: identidad con `getUser`, perfil activo, rol, cookies HttpOnly/SameSite Lax/Secure en producción y respuestas privadas sin caché. UI y API repiten autorización; middleware excluye API. | `tests/auth.spec.ts`, API/coordination y SQL. No asumir que ocultar un botón o redirigir una página sustituye RLS. |
| Entrada y mutaciones | `src/lib/auth/http.ts`, `src/lib/api/{inspection,finding}-http.ts`, `src/types/entity.ts`, esquemas de dominio y `src/features/sync/types.ts`: origen/protocolo/host, JSON, campos permitidos, UUID, versiones, límites e idempotencia. La coordinación admite cuerpo de 16 384 frente a 4096 por defecto. | Domain/API suites. `request.text().length` mide caracteres; no afirmar un límite de bytes estricto para JSON. Fotos sí limitan bytes durante streaming. |
| Configuración | `.env.example`, `.gitignore`, `src/lib/supabase/config.ts`: sólo `SUPABASE_URL` y `SUPABASE_ANON_KEY` de servidor; fallo ante ausencias; sin fallback sintético. | `tests/supabase-config.spec.ts`. La URL sólo se valida por prefijo http(s), no por parseo completo; el código no verifica que la clave no sea `service_role`. Documentación prohibitiva no equivale a enforcement. |
| Permisos de datos | Migraciones/RLS, RPC `apply_operation`, `coordinate_inspection` y fotos: identidad, rol, propiedad, estado, campos permitidos, versiones, locks y recibos. Sin DML directo de roles de app. La migración final impide que un coordinador antes técnico lea sus antiguos borradores. | SQL de permisos/coordinación/fotos/GPS y HTTP sintético; la configuración remota real no se infiere del SQL versionado. |
| Dispositivo compartido | `src/lib/pwa/{offline-session,offline-storage,indexed-db}.ts`, `src/components/pwa/session-memory.tsx`: particiones por cuenta y epochs; logout bloquea acceso y trabajo antiguo. IndexedDB v3 contiene inspecciones, hallazgos, fotos, catálogo, cola, conflictos y metadata. | `tests/session-isolation.spec.ts`, almacenamiento/cola. Conserva borradores para el mismo dueño; no borra físicamente toda la base ni la cifra. LocalStorage recuerda UUID/nombre y estado de bloqueo, no credenciales. |
| Sincronización y conflictos | `src/lib/pwa/sync/`, `src/lib/sync/`, `src/features/sync/`: intentos durables, request congelado, ACK, versiones, dependencias y leases. | Queue/transport/recovery/conflict suites y E2E. No enviar credenciales en payload ni reportar snapshots privados. |
| Caché y offline | `public/sw.js`, postbuild y registro: sólo shell público `/offline`, assets permitidos y JS/CSS; navegación privada no se almacena, fallback público, exclusión API/login/auth/sync y respuestas privadas/no-store/Set-Cookie. | `tests/{service-worker,offline,offline-shell,safe-pwa-update}.spec.ts`; harness y Chromium. Documentación W03 histórica no sustituye la implementación actual. |
| Fotos | `src/lib/photos/{validation,server-validation,remote}.ts`, API fotos, `photo.repository.ts`, bucket privado y políticas: JPEG/PNG/WebP, 5 MiB, tres por hallazgo, decodificación/recodificación, hash, ACK y asociación al hallazgo. | Photo suites/capabilities y SQL. EXIF se elimina en servidor tras subir; el original local puede conservarlo. Sin URLs públicas/firmadas persistidas. |
| GPS y avisos | Geolocalización voluntaria y puntual, sin GPS en borrador; snapshot al finalizar; tabla de ubicación sólo coordinación, sin `request_payload` legible por técnicos en recibos. Avisos locales genéricos y opt-in, fallback en app. | Location/capabilities suites. El enlace a Google Maps transmite coordenadas al pulsarlo (`no-referrer`); declararlo en inventario. Sin Push remoto/VAPID. |
| Ciclo de vida | Revisión, archivo y eliminación lógica en coordinación; fotos y filas finalizadas permanecen físicamente. | `docs/coordinator-lifecycle.md`, migración final y suites. Retención/backup/borrado físico remoto sin plazo implementado: explicitar, no prometer. |
| CI y dependencias | Node 22.x declarado, CI 22.22.3, lockfile, permisos `contents: read`, lint, niveles, build y reportes W08. | `scripts/verify.mjs` cubre typecheck, 31 entradas de `npm test`, build/postbuild, métricas y gate W06. No ejecuta por sí solo niveles, E2E, suites de seguridad remota ni evaluación privada. No se ejecutó auditoría de vulnerabilidades en #91. |

Hay una discrepancia de frontera que #92 debe resolver antes de fijar pruebas: esquemas TS permiten resumen/descripción de 4000 caracteres y título de 500; el SQL estructural limita esos campos a 3000/3000/160. No relajar SQL, duplicar reglas ni acreditar aceptación remota a partir del validador local. El baseline registra la brecha; #93 sólo armoniza los límites acordados y #95 verifica el límite y límite + 1.

## Requisitos, estado, responsables y validación

Estados: **cumplido** = evidencia suficiente para esa afirmación acotada; **parcial** = existe parte del requisito; **pendiente** = falta artefacto/comportamiento; **sin evidencia** = afirmación sin respaldo observado; **no verificable** = fuente o entorno disponible no permite confirmarlo. Un PASS acumulativo no acredita la entrega W09.

| Requisito del kit | Estado en el corte | Artefacto / issue | Validación necesaria |
| --- | --- | --- | --- |
| Continuar el mismo repo, Node declarado y lockfile | Cumplido | `package.json`, lockfile, app acumulada | Instalación con Node 22.22.3; no starter nuevo. |
| Inspección integral del kit y baseline trazable | Cumplido para lectura/inventario | Este documento y TSV; #91 | Ocho archivos leídos; hashes; comparación y contratos. No acredita emisor/hora. |
| Modelo de amenazas | Pendiente | `docs/threat-model.md`; #92 | Activos/límites, amenazas priorizadas, control y riesgo residual enlazados a prueba. |
| Inventario de privacidad | Pendiente | `docs/privacy-data-inventory.md`; #92 | Ciclo de vida real, acceso/retención, fotos/GPS/terceros/configuración. |
| Validación y mínimo privilegio | Parcial | Controles anteriores; #92/#93/#95 | Casos positivos/negativos, fronteras TS/SQL y matriz de roles. |
| Secretos, transporte, headers/CSP y fallback seguro | Parcial; CSP pendiente | Config/auth/caché; `next.config.mjs`; #92/#93/#95 | Fallo seguro/redacción y headers HTTP reales; HTTPS de despliegue queda no verificable localmente. |
| Módulos de seguridad consumidos por la app | Pendiente | `src/lib/security/`; #93 | Interfaces siguientes con consumidores reales, sin código decorativo. |
| Suite crítica determinista | Parcial | Suites existentes; `tests/security.spec.ts`; #95 | Ruta obligatoria, registro y fallo ante regresión. Suites `security-direct.spec.cjs` y `security-http.spec.cjs` no están en `npm test` y necesitan cuentas/entorno adicionales. |
| Política de rastreo | Pendiente | `public/robots.txt`; #99; integración #93, pruebas #95 | HTTP público 200, texto/cuerpo correctos; conservar autorización privada. |
| README de ejecución/supuestos/evidencia | Parcial | `README.md`; #93/#98 | Sección W09 añadida sin borrar el setup/historia. |
| Reporte de verificación y CI W09 | Pendiente | `evaluation-result.json`, workflow W09; #93/#98 | Resultados reales ligados a SHA/run; upload incluso ante fallo. Configuración `evaluation.json` no es resultado. |
| Evidencia individual/IA/defensa | Pendiente | `evidence/individual.md`; #94/#96/#97/#98 | Campos oficiales siguientes; contribuciones y validación humana propias. |
| Sólo datos sintéticos, sin secretos/PII | Parcial; procedencia de fotos sin evidencia | Fixtures, activos, logs y reportes; #92/#93/#98 | Revisar contenido y procedencia; no deducir cumplimiento por búsqueda léxica o nombres. |
| Pruebas privadas y nota docente | No verificable | `private-evaluator/w09-security-privacy/check.sh` ausente | No reconstruir el evaluador ni afirmar puntos a partir de checks públicos. |
| Hora oficial / procedencia LMS | No verificable | Fuente original, fuera del ZIP | Mantener pendiente; no convertir acuerdo interno en hora oficial. |

## Diferencias entre correo, kit y automatización

1. El ZIP confirma las cinco rutas específicas y README; añade explícitamente **reporte generado por CI o localmente**, configuración de Node, HTTPS en despliegue, dependencias auditables y fallback seguro. Evidencia individual, declaración de IA y defensa son requisitos aunque no figuren como cinco rutas de AC-02.
2. La rúbrica académica es **8 puntos**: AC-01 reproducibilidad 2, AC-02 implementación 3, AC-03 pruebas 2, AC-04 ingeniería 1. `evaluation.json` especifica 7 automáticos + 1 semiautomático y 0 manuales; revisión humana sólo por banderas, hasta cinco minutos. No cambia los **16 puntos de planificación** ni los responsables.
3. `evaluation.json` fija `make verify` y `npm run dev`; `ASSIGNMENT.md` pide `npm ci` antes de verify o equivalente exacto. Setup del workflow: `npm ci --ignore-scripts --no-audit --no-fund`. El kit no exige Jest/Vitest, Zod, un scanner específico, nonce obligatorio ni una arquitectura nueva.
4. El workflow suministrado ejecuta AC-01–03, **omite AC-04**, no fija Node ni genera `evaluation-result.json`, cobertura o resultados; sólo intenta subirlos con `if-no-files-found: ignore`. Tampoco invoca el check público ni el privado pese al plan narrado en ASSIGNMENT. Registrar la diferencia y cubrir el comportamiento con CI propia; no afirmar que se ejecutó el evaluador docente.
5. AC-01 usa `build --if-present`, AC-03 `test --if-present -- --run`; podrían omitir scripts ausentes. En este repo hay scripts, pero `npm test` es una cadena de procesos Node, no un runner que necesite `--run`. El contrato local usa `npm test` y una suite W09 explícita sin depender de ese argumento.
6. El check público del ZIP **no es un gate fiable**. La lista `test ... && ...` no fuerza salida por cada ausencia bajo `set -e`; `! rg ...` tampoco dispara `errexit` por un match y confunde error de herramienta con ausencia de coincidencias. El `echo PUBLIC_OK` final devuelve 0. Una búsqueda por `api[_-]?key|secret|password|token` encuentra identificadores/fixtures/docs legítimos, no necesariamente secretos.

Reproducciones ejecutadas con el script original extraído, sin copiarlo al repo:

| Entorno / estímulo | Resultado observado | Interpretación |
| --- | --- | --- |
| Repo acumulado sin los cinco artefactos W09 y con coincidencias léxicas | exit 0, `PUBLIC_OK`, 179 líneas de stdout | No acredita ni estructura W09 ni ausencia de secretos. |
| Directorio temporal con sólo `README.md` inocuo; todos los artefactos W09 ausentes | exit 0, `PUBLIC_OK` | Falso éxito por la lista AND. |
| Directorio temporal con artefactos de prueba, `PATH=/nonexistent`, invocación `/usr/bin/bash <check original>` | stderr `rg: command not found`; exit 0, `PUBLIC_OK` | Falso éxito ante herramienta ausente. |

En #93 preservar `public-tests/check.sh` acumulativo y añadir `public-tests/check-w09.sh` con comprobación individual de archivos no vacíos, directorio con módulos consumidos y registro ejecutable. La revisión de secretos debe distinguir valores de nombres, no imprimir coincidencias sensibles y propagar errores de herramientas. Documentar cualquier sustitución exacta en README; no ocultar falsos positivos renombrando `password` o quitando pruebas de rechazo.

## Contratos para #92, #93, #95 y #99

Estos contratos son decisiones de integración del repo derivadas del kit; **no son interfaces suministradas por el docente**. #92 completa la política/amenazas antes de implementar y puede precisar una excepción con evidencia, actualizando este contrato y las issues afectadas primero. #91 no crea los módulos ni los documentos de #92.

### Nombres finales y responsabilidades

| Ruta / interfaz acordada | Responsable | Responsabilidad y consumidor previsto |
| --- | --- | --- |
| `docs/threat-model.md` | #92 | Modelo real y matriz de amenazas indicada abajo. |
| `docs/privacy-data-inventory.md` | #92 | Inventario indicado abajo, incluyendo metadatos y retención real. |
| `src/lib/security/validation.ts` | #93 | Reexportar `validateDomainOperation` y `validateOperationId` con las firmas/tipos de `src/features/sync/types.ts`; consumidores: entradas HTTP de inspecciones/hallazgos/fotos. No duplicar esquemas, reglas ni errores. |
| `src/lib/security/config.ts` | #93 | Punto de entrada servidor de `getSupabaseServerConfig(env?: NodeJS.ProcessEnv): SupabaseServerConfig`, constantes y tipo existentes; consumidor: `src/lib/supabase/server.ts`. Mantener `{url, anonKey}` y ausencia de fallback; concretar endurecimiento en #92. No importar desde cliente. |
| `src/lib/security/headers.mjs` | #93 | `getSecurityHeaders({ production })` devuelve pares `{ key, value }` de headers; consumidor: `next.config.mjs` vía `headers()`. JS nativo porque Next config es ESM sin compilación TS. La prueba debe observar su efecto HTTP, no sólo el objeto. |
| `tests/security.spec.ts` | #95; smoke mínimo #93 | Ejecutable directamente con Node 22.22.3; reutiliza módulos reales y arneses existentes. Archivo propio, no Playwright auto-descubierto por la configuración E2E actual. |
| `public/robots.txt` | #99 | Archivo de texto de rastreo; política mínima propuesta abajo, confirmada por #92. #93 integra, no duplica su creación. |
| `public-tests/check-w09.sh` | #93 | Gate estructural estricto independiente; preservar gates anteriores. |
| Scripts `test:security`, `verify:w09` y `scripts/verify-w09.mjs` | #93 | `test:security` = `node tests/security.spec.ts`. `verify:w09` ejecuta gate W09 + suite, sin invocarse a sí mismo ni llamar recursivamente a `make verify`. Reporter descrito abajo. La suite se registra en ese gate y CI; `npm test` conserva las pruebas acumulativas. |
| `.github/workflows/week-09-w09-security-privacy.yml` | #93 | Nombre oficial del kit para feedback W09, Node 22.22.3, permisos mínimos y reporte asociado al SHA. Mantener `.github/workflows/academic-evaluation.yml` y sus checks acumulativos; no borrar W08 ni duplicar innecesariamente todo su trabajo. |
| `evaluation-result.json` | #93 genera; #98 consolida | Salida técnica W09 generada e ignorada en Git, subida por CI aun ante fallo. No copiar `evaluation.json` bajo este nombre. |
| `README.md`, `evidence/individual.md` | #93/#98 y #94/#96/#97 | Secciones W09 aditivas; formato siguiente; no sustituir documentación histórica. |

### Matrices documentales estables

Modelo de amenazas: `ID | activo | actor | límite de confianza | escenario/amenaza | impacto | probabilidad y razón | prioridad | control existente (ruta) | brecha/cambio (issue) | validación (caso/comando) | riesgo residual/estado`. IDs estables `W09-T01`, `W09-T02`, etc.; no declarar mitigada una amenaza sin control y evidencia. Cubrir navegador↔Next, Next↔Auth/Postgres/Storage, almacenamiento del navegador, repositorio/CI, operador y terceros (enlace de mapas).

Inventario de privacidad: `ID/dato | finalidad | origen | ubicación/flujo | acceso/rol | minimización | retención/eliminación real | sensibilidad (si fuera real) | sintético/configuración | evidencia/limitación`. Incluir credenciales transitorias, cookies, perfil, datos de inspección/hallazgo, fotos originales y recodificadas, GPS, cola/recibos/conflictos, UUID de instalación, catálogo, cachés, logs/reportes y terceros. No publicar valores. Describir borrado lógico frente a físico, persistencia tras logout, ausencia de TTL y límites de backups; no inventar garantías legales ni plazos de borrado implementados.

### Políticas mínimas que #92 debe concretar

- **Validación:** reutilizar allowlists, UUID, tipos/versiones y contratos de error existentes; validar en servidor aun si UI valida. Frontera consistente con SQL; documentar caracteres frente a bytes. Autorización no proviene de `ownerUserId` enviado por el cliente.
- **Secretos/transporte:** mantener sólo las dos variables de servidor, sin `NEXT_PUBLIC_*`, `service_role` ni valores en fixtures/reportes. Fallar antes de usar configuración incompleta; errores con nombres de variables, nunca contenido. #92 debe definir parseo de URL y distinción HTTPS productivo / HTTP loopback de pruebas para que las pruebas sintéticas no dependan de un servicio privado.
- **CSP:** política efectiva en respuestas de producción y prueba de hidratación/flujo crítico. Base a justificar por directiva: `default-src 'self'`, `base-uri 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`, `connect-src 'self'`, `img-src 'self' data: blob:`, `font-src 'self'`, `worker-src 'self'`, `manifest-src 'self'`. Supabase se consume desde Next, por lo que no agregar comodines Supabase/CDN al navegador sin necesidad demostrada. #92 fija `script-src`/`style-src` compatibles con scripts inline de Next 14 y estilos actuales; cualquier `unsafe-inline` debe quedar como excepción justificada con riesgo residual, sin presentarla como protección XSS completa. `unsafe-eval` queda excluido de producción; una excepción de desarrollo no se propaga a producción. No se exige en #91 rediseñar toda la app con nonces. Cabeceras adicionales mínimas propuestas: `X-Content-Type-Options: nosniff` y `Referrer-Policy: no-referrer`; confirmar en #92. HTTPS de despliegue se comprueba separadamente.
- **Permisos:** anónimo/inactivo sin datos; técnico A ve y edita únicamente su borrador; B no ve A; coordinación sólo completadas, seguimiento/revisión según estado; ningún rol app obtiene escritura directa ni lee `request_payload` sensible. Mantener comprobaciones Auth/API/RLS y no ampliar grants por una prueba.
- **Privacidad/fallback:** caché sólo pública; no credenciales en LocalStorage/IndexedDB; bloquear partición y ACK tardío al cambiar sesión conservando borradores propios; GPS opcional y fotos recodificadas; rechazo de permisos deja captura manual/feedback útil. Inventariar los metadatos locales y activos estáticos, sin afirmar limpieza inexistente.
- **Rastreo:** para una PWA de inspecciones sin contenido público destinado a buscadores, propuesta mínima `User-agent: *` y `Disallow: /`, con salto final y sin sitemap ni listado de rutas sensibles. #92 confirma esta decisión antes de que #99 publique el archivo; el kit no impone directivas concretas. #93 debe excluir **exactamente `/robots.txt`** del matcher de middleware, que ahora lo interceptaría, y #95 comprueba publicación anónima y protección privada por separado. Robots no es autenticación ni autorización y los bots pueden ignorarlo.

### Casos consumibles por #95 sin esperar a #93

Cada caso registra `ID | amenaza/control | precondición/fixture sintético | estímulo | esperado | observado/exitCode | límite`. Los resultados empiezan pendientes. Ejecutar código real con backend/arneses sintéticos existentes; no reconstruir un control dentro del test para probar sólo la copia.

| Bloque | Éxito | Frontera | Falla / regresión relevante | Reutilización |
| --- | --- | --- | --- | --- |
| `W09-V` validación | Operación válida llega al servicio con el mismo contrato. | Longitud máxima acordada TS/SQL; cuerpo en límite. | Límite + 1, UUID inválido, campo ajeno, JSON/MIME incorrectos, origen ausente/externo → 422/403 sin mutación. | Domain, auth, inspection/finding API y photo-validation. |
| `W09-S` configuración/secretos | Config sintética válida normaliza espacios en servidor. | Espacios/vacíos, URL y protocolo según política #92. | Variable ausente/URL inválida: fallo sin incluir valor centinela; respuesta sesión/log/reporte sin credenciales. | Supabase config, auth y HTTP real. No afirmar scanner integral ni validar `service_role` sin regla definida. |
| `W09-C` CSP/transporte | GET de producción contiene directivas y el flujo real hidrata/funciona. | Público, privado y rechazo HTTP; desarrollo separado de producción. | Falta o relajación de `object-src`/`frame-ancestors`, origen extra no autorizado o `unsafe-eval` en producción debe fallar. | Next de producción y E2E Chromium; no basta buscar texto en config. HTTPS remoto queda separado. |
| `W09-A` autorización | A modifica su borrador; coordinación lee una completada. | Transición completada/archivada/eliminada y perfil inactivo. | Anónimo 401 API; rol indebido 403; B/recurso no visible 404; no DML/recibo sensible. | Auth/API/coordination, SQL permisos y lifecycle. Dobles HTTP no acreditan RLS real. |
| `W09-P` privacidad | ACK propio y caché pública, imagen recodificada sin EXIF. | Cambio A→B con operación en vuelo; GPS null y 5 MiB exactos. | Sesión vieja no abre partición ni aplica ACK, no guarda credenciales/HTML privado, EXIF no sobrevive al servidor; permiso denegado conserva fallback. | Session-isolation, SW/offline, photo/local/remote, location y capabilities. No prometer borrado de originales locales. |
| `W09-R` rastreo | GET anónimo `/robots.txt` → 200, tipo `text/plain`, cuerpo con política acordada. | Cookie de logout bloqueado, ruta exacta y slash/otras rutas según Next. | Artefacto ausente/vacío/reglas alteradas o redirect a login falla; una ruta/API privada sigue denegada aunque el bot ignore robots. | HTTP Next real; implementación reservada a #99. |

La suite W09 debe fallar si falta un control, si no ejecuta casos o si una assertion falla; no `skip` silencioso ni `--if-present` que produzca un verde sin suite. Se ejecuta explícitamente después de la build de `make verify`, mediante `verify:w09` y CI: no insertar una prueba dependiente de build productiva en el tramo de `npm test` anterior a build. Las pruebas remotas `security-direct`/`security-http` necesitan cuentas sintéticas distintas y entrada interactiva de credenciales: quedan fuera del gate determinista. SQL local desechable verifica políticas versionadas; Supabase desplegado, permisos físicos del SO y otros navegadores siguen siendo validaciones distintas.

## Comandos y reporte de entrega

**Actualmente existentes:** `npm ci`, `npm run dev`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, `make verify` (equivalente exacto: `npm run verify`) y gates W02/W05/W06. Make sólo delega en `npm run verify`; el kit no trae Makefile, package.json ni código de seguridad.

**Contrato W09 a implementar en #93:** comando único `npm run verify:w09`; equivalente exacto `node scripts/verify-w09.mjs`. Ejecuta secuencialmente `bash public-tests/check-w09.sh` y `npm run test:security`, registra cada exitCode y escribe siempre `evaluation-result.json`. Tiene salida no cero si cualquier comprobación falla/no se ejecuta o si no puede generar reporte. No sustituye instalación, lint, niveles, E2E ni `make verify`.

Orden final previsto en #98 (los comandos W09 todavía no existen en este baseline):

```bash
npm ci
npx playwright install chromium
bash public-tests/check.sh
bash public-tests/check-w05.sh
bash public-tests/check-w06.sh
npm run lint
npm run test:unit
npm run test:integration
make verify
npm run verify:w09
E2E_SKIP_BUILD=1 npm run test:e2e
```

Si la suite W09 usa `next dev`, deberá restaurar build antes del E2E; se prefiere probar headers contra la build productiva creada por `make verify`. La integración acumulativa usa dev y por eso precede a verify. CI puede instalar Chromium con `--with-deps`. Mantener la variante de instalación del kit documentada, sin eliminar la instalación completa del flujo acumulativo que utiliza Sharp.

Reporte `evaluation-result.json`: `schemaVersion`, `assignmentId: w09-security-privacy`, `commitSha` completo obtenido de Git, `workingTreeClean`, `generatedAt`, `runtime` (Node/npm), `runUrl` o null, `status` técnico, `checks[]` con id/comando/status/exitCode y `limits`. Distinguir `pass`, `fail` y `not-run`; no transformar un check omitido en éxito. Registrar cobertura/resultados sólo si se generan realmente. El kit enumera rutas de upload, pero **no define un schema de resultado**: éste es el contrato técnico local, sin inventar compatibilidad con el evaluador privado ni puntajes.

CI debe subir `evaluation-result.json` y reportes acumulativos disponibles con `if: always()`, ligados al head realmente probado; no subir cookies, `.env`, estado de sesión o fixtures con credenciales reales. El reporte W08 existente contiene variables `W08_*` y rutas `reports/`; no basta renombrarlo o subirlo como W09. Preservarlo y generar evidencia W09 explícita. Un reporte de un árbol sucio debe decirlo y no presentarse como validación del SHA de una entrega limpia.

## Evidencia individual y ajustes de planificación

En `evidence/individual.md`, añadir `## Semana 09` y una subsección por persona, conservando W01–W08. Los siete campos oficiales son:

```markdown
- Estudiante:
- Commit SHA evaluado:
- Decisión técnica que puedo explicar:
- Prueba que ejecuté y resultado:
- Limitación o fallo diagnosticado:
- Cambio que podría defender o modificar en vivo:
- Uso declarado de IA (herramienta, propósito, validación):
```

Agregar enlaces a contribución/PR/run, comando/exitCode, alcance que verifica y no verifica, fragmentos/archivos influidos por IA y estado de validación humana. Si falta algo, escribir pendiente/no ejecutado. No atribuir a una persona lo observado por el agente o por Actions ni completar defensas/revisión humana por inferencia. #94, #96 y #97 conservan la autoría individual; #98 consolida y prepara URL/PR o SHA, reporte y evidencia para LMS. Sin respuestas de quizzes ni envío desde esta tarea.

Se contrastaron completos los cuerpos vigentes de #91–#99. Sus nueve cuerpos se actualizaron en GitHub con un apartado «Actualización de baseline W09 — ZIP revisado (#91)» que registra fuente, hash y los ajustes siguientes; una relectura confirmó el contenido, los títulos y las asignaciones conservados y las nueve issues abiertas. En esa actualización inicial se indicó que la documentación aún estaba local; su publicación posterior se realiza mediante PR. Estos ajustes resuelven diferencias del kit sin cambiar puntos o fases:

| Issue | Ajuste contractual que debe quedar reflejado en su planificación |
| --- | --- |
| #91 — Draggodeidad, 2 | ZIP localizado y leído, inventario/hashes, fuente y hora con límites, defectos del check, contratos y resultados de este documento. |
| #92 — Draggodeidad, 3 | Consumir formatos; cerrar política CSP/robots y frontera TS/SQL/config; inventariar originales locales, mapas, retención y procedencia de fotos públicas. No es una auditoría legal ni un rediseño. |
| #93 — Draggodeidad, 3 | Módulos con consumidores, gate y comando W09, reporte generado y workflow con ruta oficial; conservar CI/checks acumulativos, ajustar matcher exacto para robots. No crear el archivo asignado a #99 salvo contingencia documentada. |
| #94 — Draggodeidad, 1 | Siete campos oficiales, incluido cambio defendible; IA/validación humana y hechos propios. No escribir evidencia del owner desde inferencias del agente. |
| #95 — osbaldoXxC, 2 | Matriz de seis bloques, comando `npm run test:security`, respuestas de producción y fixtures sintéticos; no copiar check léxico como prueba de secretos; robots sigue en #99. |
| #96 — osbaldoXxC, 1 | Formato oficial, contribución propia y prueba real; no copiar PASS ajenos. |
| #97 — JulianDele, 1 | Formato oficial con defensa/IA; evidencia sólo de lo realizado en #99 o pendiente explícito. |
| #98 — Draggodeidad, 2 | Añadir reporte obligatorio, AC-04 omitido del YAML del kit, SHA limpio/CI, límites privados/remotos/humanos y hora oficial no confirmada. Sin merge, release, tag obligatorio ni envío LMS. |
| #99 — JulianDele, 1 | Kit confirma archivo, no reglas concretas; consumir política de #92. HTTP público depende del ajuste de matcher de #93; preparar archivo y verificación sin tocar Auth/RLS/CSP. No confundir ese paso de integración con ausencia de aporte propio. |

Se mantienen **16 puntos**: Draggodeidad 11 (68.75%), osbaldoXxC 3 (18.75%), JulianDele 2 (12.50%). #91 habilita el baseline; #92 precisa políticas, #93 implementa, #95 prueba en paralelo desde contrato y #99 entrega robots. #94/#96/#97 registran hechos propios y #98 consolida. No se añaden tareas por el solo hecho de encontrar ejemplos en el kit.

## Validación observada de este baseline

Ejecución asistida por Codex en el árbol de trabajo previo al commit documental; no es defensa/validación humana del owner ni ejecución remota. Node **22.22.3** seleccionado explícitamente porque el shell por defecto usa Node 26.2.0. Durante esas ejecuciones, el SHA de código era el corte indicado y los documentos nuevos aún no formaban parte de un commit. Los cambios preexistentes y esta documentación hacían que el árbol no estuviera limpio; estos resultados no acreditan por sí solos el SHA publicado después.

| Comando / comprobación | Resultado observado | Alcance |
| --- | --- | --- |
| Lectura de ocho miembros del ZIP y SHA-256 | Completada | Contenido íntegro, sin binarios; no autentica distribución original. |
| Inventario Git por blob y hashes | 308 entradas | Árbol del SHA inicial; falta local del ZIP W03 preservada. |
| Instalación `npm ci --no-audit --no-fund` | exit 0; 262 paquetes instalados | Instalación real con lockfile; no se ejecutó `npm audit`. Advertencia de deprecación de ESLint conservada como límite del entorno. |
| `npm run lint` | exit 0 | Código/scripts/pruebas existentes; no auditoría de seguridad. |
| `npm run test:unit` | exit 0 | Dos entradas de nivel; dominio y fotos sintéticas. |
| `npm run test:integration` | exit 0 | Dos entradas de nivel; HTTP/cola sintéticos, sin RLS remota. |
| `make verify` | exit 0; reporte técnico `pass` | Typecheck, 31 entradas de pruebas, build/postbuild (47 assets), métricas y W06; no W09. |
| `E2E_SKIP_BUILD=1 npm run test:e2e` | exit 0; `1 passed` | Chromium sobre backend sintético; no RLS remota ni otros navegadores. |
| Consistencia documental local | exit 0 | Se contrastaron los 308 blobs/tamaños/hashes, los ocho hashes/tamaños del ZIP, enlaces locales y cierre de bloques Markdown. |
| Check original W09 extraído | exit 0 en los tres escenarios descritos | Defecto reproducido, **no PASS W09**. |
| `npm run verify:w09`, CI del SHA W09, evaluador privado | No ejecutados / pendientes | Los artefactos de implementación no se crean en #91. |

Logs locales de esta inspección en `/tmp/pwa-w09-baseline-*.log`; son temporales y no forman parte de la entrega. Los resultados anteriores no se convierten en evidencia personal ni sustituyen los reportes del SHA final. Sin JSX modificado: la comprobación de Tailwind inline no aplica. La revisión humana, origen de fotografías, distribución original y hora oficial permanecen identificados con su estado real.
