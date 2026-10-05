# Política de sincronización W05

Esta ruta documenta el comportamiento que usa la app completa. Los contratos del kit en `src/lib/storage/schema.ts`, `src/lib/sync/queue.ts` y `src/lib/sync/conflict-policy.ts` exponen los módulos existentes; no crean una segunda base, cola ni política.

## Persistencia y cola

`src/lib/pwa/indexed-db.ts` define los stores `inspection_local`, `finding_local`, `sync_queue`, `conflict_local`, `catalog_local` y `metadata`. `LocalStorage` exige partición por cuenta. `saveDraftWithIntent` y `saveCapture` confirman la entidad y su intención en una misma transacción IndexedDB; un fallo revierte ambas. Los registros y operaciones pendientes sobreviven una recarga. Una versión local más nueva que el ACK permanece pendiente.

Cada operación tiene un `operationId` estable. `prepareSend` congela la petición completa antes de HTTP y el cliente transmite ese ID en `idempotency-key`. El servidor guarda un recibo de la operación y compara el hash de la solicitud completa: repetir ID y contenido devuelve el resultado anterior con `replayed`, mientras reutilizar el ID con otro contenido es conflicto. `acknowledge` actualiza entidad, cola, dependientes y fecha de última sincronización dentro de una transacción.

## Reintentos, backoff y suspensión

`runQueue` verifica la cuenta activa y adquiere un lease por cuenta. Respeta `dependsOn`, orden local, la inspección padre antes de hallazgos y todos los hallazgos antes de finalizar.

Los errores transitorios (HTTP 408, 429 o >= 500) usan backoff exponencial calculado mediante `Math.min(30_000, 1000 * 2 ** (attempt - 1))` y respetan `Retry-After`. El límite estricto de reintentos es cinco (`MAX_ATTEMPTS = 5`). Al quinto fallo consecutivo:
1. `retryDelay` devuelve `null` y `nextAttemptAt` se establece en `null`.
2. `failSend` marca la operación en cola como `status: "error"` y `retryExhausted: true`.
3. La cola suspende automáticamente el reintento de la operación en ejecuciones posteriores mientras no tenga programada una nueva fecha de intento (`item.status === "error" && !item.nextAttemptAt`), evitando bucles infinitos y saturación de red.
4. **Preservación de datos:** La entidad local en `inspection_local` no se altera ni se pierde; los datos capturados offline permanecen seguros en IndexedDB a la espera de intervención manual mediante `retryQueueItem`.

Los errores permanentes no se reenvían automáticamente; un error de autenticación (HTTP 401) pausa inmediatamente el proceso de la cola. Cerrar la pestaña o perder el ACK conserva la petición congelada para repetirla de manera idéntica cuando la conexión se restablezca.

## Conflictos y resolución (`mine` vs `server`)

`inspectConflict` obtiene la versión remota mediante un GET autorizado; el cuerpo de un error HTTP no se considera snapshot confiable y se descarta para evitar inyecciones no verificadas.

`resolveConflict` permite resolver manualmente la colisión sin sobrescritura silenciosa, requiriendo sesión válida y lease activo:
- **Estrategia `"mine"` (prioridad local):** Conserva la captura editada localmente por el técnico en `inspection_local`. Genera una nueva intención en cola (`createIntent`) con un nuevo `operationId` reencadenando su `baseVersion` a la versión remota detectada (`conflict.remoteVersion`). Retira la operación fallida anterior, reencadena dependientes y marca el conflicto en `conflict_local` con `resolution: "mine"`. Si el registro remoto ya estaba finalizado (`completed`), crea una copia editable con un nuevo ID de inspección.
- **Estrategia `"server"` (adopción remota):** Adopta explícitamente el snapshot remoto autorizado en la entidad local (`capturedInspection`), actualizando su `summary`, `version`, `baseVersion` y marcándola como sincronizada (`syncStatus: "synced"`). Retira la operación fallida de la cola sin crear nuevas peticiones y marca el conflicto en `conflict_local` con `resolution: "server"`.

En ambas estrategias, la evidencia original del conflicto y los snapshots previos quedan registrados en `conflict_local` para auditoría.

## Evidencia y correspondencia con pruebas

La suite `tests/sync.spec.ts` valida de manera determinista los comportamientos clave mediante un IndexedDB en memoria (`tests/helpers/indexed-db-harness.ts`) y transporte con reloj virtual inyectado:
1. **Persistencia tras recarga y aislamiento:** Comprueba que `saveDraftWithIntent` sobreviva al cierre y reapertura del almacenamiento, y que cuentas distintas no tengan visibilidad de intenciones ajenas.
2. **Pérdida de ACK e idempotencia:** Simula pérdida de red tras la escritura en el servidor; verifica que el reintento preserve la clave y el cuerpo congelado (`frozenRequest`), produciendo un único registro remoto (`replayed: true`).
3. **Límite de 5 reintentos y suspensión:** Provoca 5 errores 503 sucesivos avanzando el reloj virtual; verifica el backoff, la marcación de `retryExhausted: true`, la suspensión de la cola y la preservación intacta del borrador local.
4. **Inspección de conflicto autorizada:** Comprueba que ante un 409 `VERSION_CONFLICT` se descarte el cuerpo del error y se utilice el snapshot obtenido mediante lectura autorizada.
5. **Resolución `"mine"`:** Comprueba el reencadenamiento con nueva `baseVersion`, preservación del payload técnico local y actualización del estado del conflicto.
6. **Resolución `"server"`:** Comprueba la adopción del snapshot remoto en `inspection_local`, el vaciado de la cola y el cierre del conflicto.

Las suites complementarias `local-storage`, `local-capture`, `queue-transport`, `queue-recovery`, `conflict-resolution` y `session-isolation` cubren combinaciones adicionales.

## Limitaciones técnicas de la prueba

La suite utiliza un arnés IndexedDB en memoria y transporte simulado. Si bien garantiza reproducibilidad, ausencia de retardos en CI y aislamiento de efectos secundarios, presenta las siguientes limitaciones frente a un entorno real:
- No reproduce problemas de latencia, congestión o pérdida física de paquetes TCP/IP.
- No reemplaza una prueba de integración E2E contra una instancia real de Supabase ni una validación de concurrencia multinavegador.
- No audita permisos de seguridad o tokens en producción.
