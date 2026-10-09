# Semana 06: baseline y contratos compartidos (#68)

## Base y material inspeccionado

- Base fijada: `main` / `origin/main`, `ca7fd2cabf9ff6f9e7d35979b6b03acc0ad56de5`. Rama: `feat/w06-baseline-contracts`, checkout aislado. Se preservan en el checkout original la eliminación local del ZIP W03 y el ZIP W06 sin versionar; no se incluyen ZIP ni cambios ajenos.
- Kit: `PWA-w06-kit-estudiante.zip`, SHA-256 `8bfa7f52c7293f129c5c3e174624b17655df832c9580f400b7a29e939f12af00`. Las copias externas/locales son idénticas. Inspección completa el 9/10/2026 desde `/home/dragodeidad/Documents/PWA-w06-kit-estudiante.zip`, extraído fuera del repo a `/tmp/pwa-w06-kit-inspection-6vjpoai0` tras validar rutas y tamaños.
- Inventario completo: ocho archivos (`ASSIGNMENT.md`, `README.md`, `evaluation.json`, `evidence/individual.md`, `tests/README.md`, `public-tests/README.md`, `public-tests/check.sh`, `.github/workflows/week-06-w06-device-push.yml`) y cinco directorios (`evidence/`, `tests/`, `.github/`, `.github/workflows/`, `public-tests/`). No contiene implementación, fixtures, suites ejecutables ni evaluador privado.
- `ASSIGNMENT.md` confirma evidencia opcional y notificación de cambio con fallback, permisos bajo acción del usuario, privacidad y datos sintéticos. Rúbrica: instalación/build 2, implementación 3, pruebas 2, ingeniería 1; total 8. `evaluation.json` fija `make verify` y la ruta del workflow. Sus referencias al evaluador privado no permiten verificarlo localmente.
- Fecha objetivo proporcionada en la issue/correo docente: **11/10/2026, America/Mexico_City, sin hora especificada**. El ZIP establece domingo y máximo siete días, sin una fecha absoluta. No extender al 12 ni atribuir al ZIP la fecha del correo.

## Inventario y brechas

| Artefacto docente | Estado en el SHA base | Responsabilidad posterior |
| --- | --- | --- |
| `src/lib/device/camera.ts` | Ausente; no captura funcional | #69: cámara, selector y fotos |
| `src/lib/device/geolocation.ts` | Ausente | #70: ubicación voluntaria y fallback manual |
| `src/lib/notifications/client.ts` | Ausente; service worker existente no equivale a notificaciones | #70: notificación local de cambio confirmado |
| `docs/capabilities.md` | Ausente | #71: política/matriz sustentada en implementación |
| `tests/capabilities.spec.ts` | Ausente | #68: runner; #71/#72: suites reales |

La app ya tiene Auth/Supabase y RLS, IndexedDB v2 con partición por cuenta, cola persistente, ACK/reenvío y conflictos. No existen store de blobs, asociación persistente de fotos ni bucket/políticas para la extensión. Las entregas anteriores se conservan. `AGENT.md` describía un starter sin backend, Node20 y PWA sólo planeada; se corrige contra código/package.json. README ya declaraba Node22, pero omitía el baseline W06 y afirmaba incorrectamente que rendering no estaba en npm test. Algunas rutas históricas del Context Index (p.ej. `docs/architecture.md` y `docs/actors-and-permissions.md`) no están en este checkout; no se crean documentos sustitutos en #68.

## Interfaces y límites acordados para integración

Contratos, sin adaptadores funcionales:

- `src/lib/device/contracts.ts`: `CapabilityResult<T, F>` discrimina `success`, `denied`, `unsupported`, `error`; los fallos incluyen código identificable y fallback. `CameraResult<T>` añade `cancelled`. `CameraDependencies` inyecta seguridad, mediaDevices, codificador de frame, object URLs y reloj; `GeolocationDependencies` inyecta seguridad, API puntual y reloj.
- #69 exportará `createCameraClient(dependencies: CameraDependencies): CameraClient` desde `camera.ts`. `open()` sólo por acción explícita, `audio: false`; sesión con stream, `capture()` y `stop()` idempotente. Denegado, sin API/dispositivo, contexto inseguro y error conservan selector de archivo. Cerrar/cancelar/desmontar libera tracks; revocar las object URLs al retirar previews. Cancelar no crea adjuntos.
- #70 exportará `createGeolocationClient(dependencies: GeolocationDependencies): GeolocationClient` desde `geolocation.ts`. `locate()` es voluntario y puntual; éxito devuelve latitud/longitud/precisión/instante. Denegado, timeout, unavailable, SSR/API ausente e inseguridad usan el resultado tipado; selección manual del laboratorio y guardado sin coordenadas siguen disponibles. Sin watchPosition ni coordenadas remotas/migraciones por defecto.
- `src/lib/notifications/contracts.ts`: #70 exportará `createNotificationsClient(dependencies: NotificationDependencies): NotificationsClient` desde `client.ts`. Se inyectan API/permisos, seguridad, reloj y presentador accesible de fallback. `requestPermission()` exige acción explícita; `showConfirmed()` no solicita permiso. Un evento `sync-completed` tiene ID estable y sólo nace de ACK confirmado, no de cada intento. Repetirlo en la misma sesión/cuenta no muestra otro aviso (`already-shown`); recrear cliente al cambiar de cuenta. `default`/`denied`/API ausente/error muestran fallback dentro de la app y no bloquean guardar/sincronizar.
- No evaluar `navigator`, `window` o `Notification` al importar; las APIs se resuelven en la frontera client-only. Adaptadores reales accesibles a tests mediante imports relativos `.ts`, sin requerir servicios privados. El kit menciona Push como resultado institucional, pero su mínimo permite enviar/mostrar una notificación; notificación local no acredita Push remoto/app cerrada. Servidor Push, VAPID y cron quedan fuera del baseline.

### Extensión de fotos del usuario (#69)

`src/features/findings/photo-contracts.ts`, expuesto por la API pública de findings, define `FindingPhotoRepository`, resultados, metadatos y `PHOTO_LIMITS`. La feature recibirá el repositorio por inyección; adaptadores de Storage/IndexedDB y autorización implementarán el port en #69, sin acoplar UI a APIs globales.

- Decisión confirmada por el usuario: JPEG/PNG/WebP, **5 MiB = 5 242 880 bytes por archivo, hasta tres por hallazgo**. Límite exacto permitido; cero bytes, contenido incompatible con MIME y excesos rechazados en cliente/servidor. No aceptar SVG/HEIC por defecto. El kit no prescribe estos límites ni exige Supabase Storage: son extensión de usuario.
- Identidad UUID estable por foto, propietario/cuenta, inspección y hallazgo, MIME/bytes, bucket/path privado y estado `local | pending | uploaded | error`. No persistir una URL firmada como identidad. `uploaded` requiere ACK de objeto y metadatos, no sólo preview o respuesta de Storage.
- Orden: ACK inspección → ACK hallazgo → upload con identidad/path estables → ACK metadatos → finalizar. Fotos pendientes/fallidas bloquean finalización hasta sincronizar o descartar explícitamente en borrador. Sin fotos, se conserva el flujo previo.
- No asumir transacción Storage/Postgres: conservar blob e identidad ante fallos/cuota/ACK perdido; reintentar sin duplicar, reconciliar objeto huérfano/metadatos fallidos y limpiar sólo descartes autorizados. #69 define implementación y migración incremental, aumento aditivo IndexedDB desde v2 y validación real de RLS.
- Técnico activo crea/elimina sólo en su borrador; técnico ajeno, inactivo o anónimo no acceden. Coordinación sólo lee las finalizadas; evidencia finalizada inmutable. Bucket privado, lecturas autorizadas/URL temporal y aislamiento por cuenta; nunca service_role en cliente ni carpeta como única autorización.

Los nombres y decisiones de este baseline están autorizados por el usuario. La revisión de Julian/Osbaldo queda pendiente; no se afirma un acuerdo humano que no se haya registrado.

## Suites, checks y CI

- #72 aporta `tests/helpers/capabilities-camera.ts`, export `runCameraCapabilitiesSuite(): Promise<number>`.
- #71 aporta `tests/helpers/capabilities-geolocation-notifications.ts`, export `runGeolocationNotificationsSuite(): Promise<number>`.
- Cada suite importa adaptadores reales, usa fixtures sintéticos, ejecuta assertions y devuelve un entero positivo de escenarios completados. Sin ejecución al importar. Un conteo no demuestra por sí solo que las assertions sean relevantes: exige revisión de contenido. Propagar failures/rejections, sin tragarlos. Cámara/fotos/permisos Storage corresponden a #72; ubicación/notificaciones y política a #71.
- `tests/capabilities.spec.ts` carga ambos módulos y valida exports antes de ejecutar; falta, archivo vacío, export inválido, cero escenarios o assertion fallida producen código 1. `npm test` conserva las suites anteriores y añade el test propio de infraestructura `tests/w06-baseline.spec.mjs` y el runner W06. El test de infraestructura usa fixtures temporales fuera del repo, no prueba dispositivos ni sustituye suites ajenas.
- Si #72 separa fotos, su suite auxiliar debe invocar/esperar los escenarios Node adicionales y sumarlos; SQL/manual contra Supabase se registra aparte y no se declara validado por mocks.
- El check original del ZIP usa `test ... && ...`: puede continuar con rutas ausentes. Su búsqueda de palabras como password/token confunde código legítimo con secretos. `public-tests/check-w06.sh` exige individualmente contenido, ambas suites y registro real en scripts.test; no certifica secretos/comportamiento. Se preservan checks públicos anteriores.
- Se conserva el nombre de archivo docente del workflow, con Node22.22.3, checkout al SHA del PR, `npm ci`, checks acumulativos, `make verify` y publicación de reportes reales. Se eliminan las debilidades `--if-present`, versión Node implícita y artefactos de evaluación que nadie genera. No se fabrica evaluation-result.json, cobertura, nota ni ejecución privada.
- `scripts/verify.mjs` conserva typecheck/tests/build/rendering, añade gate W06 y recoge el baseline en revisión documental. Sin continue-on-error ni skips; el verificador recoge fallos para producir reporte y termina no cero.

## Verificación y estado de entrega

El usuario eligió gate estricto desde #68. Mientras falten #69–#72, `npm test`, `make verify` y el job contractual W06 deben fallar. Este fallo también afecta workflows anteriores que llaman make verify; no se desactivan para ocultarlo. #68 no acredita AC-02/AC-03 globales ni permite cerrar #73.

Comandos reales: Node22.22.3, `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `make verify`, `bash public-tests/check.sh`, `bash public-tests/check-w05.sh`, `bash public-tests/check-w06.sh`. Los resultados observados y límites están en la sección propia W06 de `evidence/individual.md`. Los reportes ignorados de `reports/` registran SHA y estado; el CI debe verificar el commit subido. No hay comando npm de migración; el procedimiento de la futura migración corresponde a #69 y debe documentarse tras ejecutarse en su entorno real.

No se modificó JSX: la extracción Tailwind no aplica a estos cambios. No se escribe evidencia de compañeros ni se afirma validación humana, dispositivos reales o permisos Storage sin ejecución.
