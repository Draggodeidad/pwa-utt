# Política de sincronización W05

Esta ruta documenta el comportamiento que usa la app completa. Los contratos del kit en `src/lib/storage/schema.ts`, `src/lib/sync/queue.ts` y `src/lib/sync/conflict-policy.ts` exponen los módulos existentes; no crean una segunda base, cola ni política.

## Persistencia y cola

`src/lib/pwa/indexed-db.ts` define los stores `inspection_local`, `finding_local`, `sync_queue`, `conflict_local`, `catalog_local` y `metadata`. `LocalStorage` exige partición por cuenta. `saveDraftWithIntent` y `saveCapture` confirman la entidad y su intención en una misma transacción IndexedDB; un fallo revierte ambas. Los registros y operaciones pendientes sobreviven una recarga. Una versión local más nueva que el ACK permanece pendiente.

Cada operación tiene un `operationId` estable. `prepareSend` congela la petición completa antes de HTTP y el cliente transmite ese ID en `idempotency-key`. El servidor guarda un recibo de la operación y compara el hash de la solicitud completa: repetir ID y contenido devuelve el resultado anterior con `replayed`, mientras reutilizar el ID con otro contenido es conflicto. `acknowledge` actualiza entidad, cola, dependientes y fecha de última sincronización dentro de una transacción.

## Reintentos y orden

`runQueue` verifica la cuenta activa y adquiere un lease por cuenta. Respeta `dependsOn`, orden local, la inspección padre antes de hallazgos y todos los hallazgos antes de finalizar. Los errores transitorios usan backoff exponencial y `Retry-After`; el límite es cinco intentos. Después queda intervención manual. Los errores permanentes no se reenvían automáticamente; un 401 pausa el proceso. Cerrar la pestaña o perder el ACK conserva la petición congelada para repetirla cuando sea elegible.

## Conflictos

`inspectConflict` obtiene la versión remota mediante un GET autorizado; el cuerpo de un error no se considera snapshot confiable. `resolveConflict` conserva la captura local y la evidencia del conflicto. La decisión `mine` crea una operación nueva basada en la versión remota; `server` adopta el estado remoto y reencadena dependientes. Si el remoto ya está finalizado, la captura local puede copiarse a un borrador nuevo. Claves reutilizadas o datos inaccesibles requieren revisión y no pueden resolverse con una sobrescritura automática. La decisión exige sesión válida y guarda cambios con lease y transacción.

## Evidencia y límites

`tests/sync.spec.ts` usa fixtures sintéticos y un IndexedDB de memoria para comprobar persistencia tras recarga, aislamiento por cuenta, ACK perdido con reenvío idéntico y evidencia remota autorizada. Las suites existentes `local-storage`, `local-capture`, `queue-transport`, `queue-recovery`, `conflict-resolution` y `session-isolation` cubren casos adicionales. Ejecutar `npm ci --ignore-scripts --no-audit --no-fund`, `bash public-tests/check-w05.sh` y `make verify` con Node 22. El harness público no sustituye una prueba contra Supabase real ni una auditoría de seguridad en producción.
