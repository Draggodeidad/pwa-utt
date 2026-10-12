# Consolidación W06 — issue #73

Entrega preparada en [PR #74](https://github.com/Draggodeidad/pwa-utt/pull/74), rama `feat/w06-baseline-contracts`, sobre `main` `ca7fd2cabf9ff6f9e7d35979b6b03acc0ad56de5`. No se fusiona, despliega ni entrega a Classroom. La entrega consiste en el enlace al PR, el SHA completo evaluado, README, evidencia individual y reportes reales. El PASS técnico no asigna los 8 puntos ni acredita revisión humana.

## Fuente y alcance confirmado

Fecha objetivo: **11/10/2026, America/Mexico_City** según el correo docente citado en #73. La hora oficial no consta: sigue pendiente consultarla en Classroom; no se extiende al 12 ni se exige tag.

La copia local del kit fue reinspeccionada fuera del repositorio durante #73 y coincide con #68: SHA-256 `8bfa7f52c7293f129c5c3e174624b17655df832c9580f400b7a29e939f12af00`. `ASSIGNMENT.md` confirma los cinco artefactos, permisos bajo acción, evidencia opcional, notificación de cambio con fallback, `npm ci` y `make verify`. AC-01/02/03/04 aportan 2/3/2/1 puntos. El kit ya está disponible; su presencia no demuestra contrato aprobado, calificación ni ejecución del evaluador privado.

El kit no aporta implementación, suites de dispositivo ni el directorio `private-evaluator/w06-device-push`. Su workflow usa `--if-present`, no fija Node y pide artefactos que no genera. Se conserva la implementación estricta de #68: mismo nombre de archivo docente, Node 22.22.3, instalación real, suites acumulativas, gate que falla ante faltantes y reportes realmente producidos. No se fabrica `evaluation-result.json`, cobertura ni resultados privados.

## Matriz requisito → issue → artefacto → validación

| Rúbrica/requisito | Issue | Artefacto y conexión real | Validación y límite |
| --- | --- | --- | --- |
| AC-01 instalación/build, 2 pts | #68, #73 | `package-lock.json`, `package.json`, `Makefile`, workflow W06 | `npm ci`; `make verify` incluye typecheck/build/postbuild; usar Actions W06 del SHA final |
| AC-02 cámara/permisos/fallback, 3 pts compartidos | #69, #72 | `src/lib/device/camera.ts` → `FindingPhotos` → diálogo del editor | 25 escenarios de Osbaldo, suites `photo-*`, interfaz Chrome con vídeo sintético; hardware pendiente |
| AC-02 GPS opcional | #70, #71 | `src/lib/device/geolocation.ts` → `OptionalLocation` → finalización; tabla `inspection_locations` → detalle de coordinación | Éxito/denegado/timeout/unavailable/ausente/inseguro, borrador sin GPS, finalización/cola y Chrome sintético; GPS físico y RLS remoto pendientes |
| AC-02 avisos opcionales | #70, #71 | `src/lib/notifications/client.ts` → `SyncNotificationsProvider` montado en layout; `browser-runner` emite después del ACK durable | 16 escenarios compartidos GPS/avisos, pruebas acumulativas y Chrome: permiso explícito, fallback, deduplicación, fallo parcial, sesión; aviso SO real pendiente |
| AC-03 pruebas críticas, 2 pts | #68, #71, #72 | `tests/capabilities.spec.ts` registrado en `npm test`, ambos helpers y `tests/w06-baseline.spec.mjs` | 25 + 16 escenarios; fallos no cero ante helpers inválidos/assertions. Mutaciones externas de ambas suites reales también produjeron `AssertionError`/salida 1 |
| AC-04 ingeniería/evidencia, 1 pt | #71, #73 | `docs/capabilities.md`, README, este reporte, `evidence/individual.md` | Inspección código → decisión → prueba; evidencia propia conservada; defensa humana del owner pendiente |
| Fotos persistentes, extensión del usuario | #69, #72 | Migración fotos, bucket privado/RLS, metadatos y `photo_local` IndexedDB v3 | `photo-local` prueba upgrade v2/atomicidad/cuentas/reintento; `photo-validation` verifica EXIF presente antes de sanitizar; transporte simulado. Storage HTTP real y recarga offline en dispositivo pendientes |
| Entrega enlace/SHA y CI | #73 | PR #74, `reports/verification.json`, `reports/rendering-metrics.json`, artefacto Actions W06 | Contrastar `commitSha` con head completo entregado y `headSha` de Actions; envío Classroom fuera del alcance |

Los cinco artefactos están presentes y conectados; `docs/capabilities.md` documenta las factories ejercitadas por las suites. La inspección no se limita a existencia. `lib` no depende de UI; las APIs del navegador se resuelven en fronteras cliente y los adaptadores importan con seguridad desde Node/SSR. No se modifica JSX en #73, por lo que no se introducen clases Tailwind inline; se conserva la convención `s`.

## Contribuciones y revisión controlada

| Integrante | SHA real de contribución | Alcance revisado |
| --- | --- | --- |
| Imanol / Draggodeidad | Baseline `ee8f817100329e8bdafc05668519b510636beab7`; cámara `ff63265f9ae0fbd112871b63cc932f228d418578`; integración fotos `49539c9d5a5b6efa4b02af94df0ba67164153d32`; capacidades `95b53e772337d131a532a1132680276281cacda4`; integración avisos `ff8a49bc5f7ca3e3dfb1c467b549f16a0d073f9e`; GPS final `110bad4ffbcfd6024733a3f830f8484d1a9b2fb8` | Baseline, implementación funcional, integración y consolidación #73; su revisión/defensa humana final no se sustituye con Codex |
| Osbaldo | `02099d0d025141a96ddb604285689702415ef843`, evidencia ampliada en `164b3a49d56e24f750cd6ee5088fff02c2dc10be` | Helper cámara/fotos: 25 escenarios. Declaración personal existente preservada |
| Jose Julian | `9dea33a66e316fa3d167a1e66bd3f610fbf701a9` | Helper GPS/avisos: 16 escenarios, `docs/capabilities.md`, README y evidencia propia |

Se incorporaron los tres commits de compañeros mediante fast-forward desde origin; el historial y las secciones previas permanecen. Las aportaciones están en el PR común #74; no se inventan PRs individuales. La suite de Julián y la de Osbaldo pasan juntas. No se reescriben sus pruebas ni se atribuye implementación funcional a los compañeros. Correcciones futuras de módulos corresponden al owner; pruebas/documentación a sus autores.

Discrepancias de evidencia que requieren atención humana:

- La sección personal de Julián cita `164b3a4`, que pertenece a Osbaldo, y conserva una instrucción de completar SHA/rama. El historial prueba que su aporte real es `9dea33a66e316fa3d167a1e66bd3f610fbf701a9`; esta tabla consolida esa referencia sin inventar ni completar su validación personal.
- La evidencia de Osbaldo menciona AbortSignal y cobertura del 100% de contratos. El cliente actual no acepta AbortSignal: cancela mediante `session.stop()` y un contador de generación en UI. La aceptación usa esas rutas y no un porcentaje de cobertura no medido. Su escenario EXIF parte de una imagen sin EXIF; la comprobación de eliminación con EXIF real está en la suite previa del owner `tests/photo-validation.spec.ts`.
- El timeout de rendering registrado por Julián se conserva como resultado de su ejecución. La verificación acumulativa de consolidación se ejecutó de nuevo y pasó en este entorno; no se cambia su registro histórico para hacerlo parecer aprobado.

Las issues #70, #71 y #72 siguen abiertas al revisar; #68/#69 están cerradas. No se equipara estado de issue a aceptación. #73 no se cierra mientras falten revisión humana/evidencia corregida y verificaciones reales requeridas.

## Resultados observados en la consolidación

El 11/10/2026 (America/Mexico_City), Codex ejecutó con Node **22.22.3** y npm **10.9.8**:

- `npm ci`: salida 0, 157 paquetes. Auditoría informó 10 vulnerabilidades existentes (2 moderate, 7 high, 1 critical). No se modifican dependencias ni lockfile en #73; este resultado no es aprobación de seguridad.
- `node tests/capabilities.spec.ts`: salida 0, 25 + 16 escenarios sobre adaptadores reales con APIs sintéticas.
- `node tests/w06-baseline.spec.mjs`: salida 0; verifica salida 1 ante faltantes/vacío/export inválido/cero escenarios/assertion fallida en ambos helpers.
- Mutaciones de copias externas de las suites reales: expectativa de apertura prematura de cámara y timeout GPS incorrecto produjeron ambas `AssertionError`, salida 1. Los archivos originales se conservan.
- Verificación preliminar `make verify`: salida 0, structure/typecheck/test/build/rendering-metrics/w06-contract **pass**, sobre `9dea33a66e316fa3d167a1e66bd3f610fbf701a9` con documentación en preparación. Es evidencia preliminar, no la ejecución del commit final.
- Chrome **155.0.8059.39**, headless, viewport **390 × 844**, build de producción local y backend sintético: ausencia de prompts al abrir, GPS exitoso/borrado/denegado/callback tardío, borrador sin GPS y snapshot sólo al confirmar finalización. Avisos: permiso explícito, evento tras ACK durable final, fallos/parcial/cola sin ACK silenciosos, fallback/deduplicación, activación entre navegaciones, reset por recarga/cambio de cuenta. Sin errores de página. SW de presentación y permisos simulados: no prueba avisos del sistema operativo.

- Cámara/fotos en el mismo Chrome: denegación conserva selector, vídeo de canvas sintético produce JPEG, cancelar/capturar detiene tracks, confirmar hallazgo offline conserva el blob y la confirmación final queda deshabilitada por fotos pendientes. IndexedDB conserva identidad/bytes tras recarga online; no se probó recarga offline en este recorrido. Capturas sintéticas revisadas visualmente por Codex. Dos intentos iniciales del harness asumían el bloqueo en otro botón: se corrigió para comprobar el botón real de confirmación, sin cambiar producción.

Los harness/logs preliminares están fuera de Git en `/home/dragodeidad/Documents/PWA/w06-73-final-validation/`. Se corrigen únicamente rutas de imports en las copias negativas para ejecutarlas desde esa carpeta; un fallo inicial de ruta del harness no se cuenta como detección de regresión. Las credenciales de fixtures son ficticias; no se usan ni publican ubicación real ni secretos.

## Verificación del commit final y reportes

Después de crear el commit de consolidación, ejecutar **secuencialmente** sobre ese head (sin build/tests o navegador competidores):

```bash
git rev-parse HEAD
node --version
npm --version
npm ci
bash public-tests/check.sh
bash public-tests/check-w05.sh
make verify
```

El gate W06 se ejecuta dentro de `make verify`; no hace falta sustituirlo por el check débil del ZIP. Conservar el log completo y copiar ambos JSON generados a una carpeta de entrega externa. El campo `workingTreeClean` es real: localmente puede ser falso por los ZIP ajenos preservados y `tsconfig.tsbuildinfo` rastreado que genera typecheck; no se oculta ni se confunde con SHA distinto. Restaurar sólo ese cache generado después de verificar y comprobar que los cambios de usuario en los ZIP se conservan.

Subir el commit a la rama y consultar [Actions W06](https://github.com/Draggodeidad/pwa-utt/actions/workflows/week-06-w06-device-push.yml). Exigir ejecución **success** del `headSha` exacto y descargar el artefacto **w06-baseline-verification**: comparar `commitSha`, runtime, checks y fecha de su JSON. Los workflows anteriores y la ejecución verde del aporte previo `9dea33a` no sustituyen esta comprobación. El SHA/URL definitivos y los resultados posteriores al commit se conservan en los reportes generados y en el registro de entrega externo; este documento no inventa un hash autorreferencial.

## Límites y aceptación pendiente

- Kit inspeccionado; evaluador privado, aprobación docente del contrato y nota siguen no verificables.
- No se migró Supabase remoto ni se creó su bucket. SQL local, mocks y pruebas HTTP contra backend controlado no acreditan Storage/RLS remoto con cuentas normales.
- Cámara/GPS físicos, prompts reales y presentación del SO, instalación PWA Safari/iPhone y matriz multinavegador pendientes. El recorrido Chrome automatizado no es firma humana ni validación física.
- Notificaciones locales mientras la app sincroniza; sin servidor Push/VAPID, suscripción ni garantía con app cerrada.
- Photos/Storage no comparten transacción con Postgres: conservar identidad/blob y reintentar; reservas abandonadas requieren revisión administrativa. Eviction/cuota/pérdida de perfil siguen siendo límites del almacenamiento local.
- Revisión/defensa personal del owner, referencia de evidencia de Julián y precisión de afirmaciones de Osbaldo pendientes de sus autores. No se firman por terceros.
- Hora oficial y envío Classroom pendientes del usuario. No se solicita ni registra tag obligatorio.

La documentación preliminar ya puede consolidarse. El cierre total queda condicionado a estas aceptaciones observables, aunque el commit final alcance PASS técnico y CI verde.
