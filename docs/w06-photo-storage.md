# W06 #69: cámara y fotos del hallazgo

La cámara es parte del mínimo docente; conservar fotos en Supabase es la extensión autorizada por el usuario. Este módulo no implementa geolocalización, notificaciones ni las suites independientes de #71/#72. La aceptación final requiere esas pruebas y validación humana en el proyecto real.

## Uso y fronteras

En el editor de un borrador, Agregar/Editar hallazgo permite **Usar cámara** o **Seleccionar foto**. La cámara se solicita por acción explícita, con vídeo y sin micrófono. Cancelar, capturar y desmontar detienen los tracks; cerrar el diálogo descarta las fotos todavía no confirmadas. El selector sigue disponible ante contexto inseguro, API ausente, permiso denegado o cámara no disponible.

Las fotos son opcionales: JPEG, PNG o WebP; máximo 5 MiB por archivo y tres por hallazgo. El cliente comprueba bytes, MIME y decodificación antes de preparar un adjunto. El servidor usa sharp 0.35.5 para decodificar completamente, contrastar formato real/MIME, rechazar imágenes animadas/multipágina y más de 25 megapíxeles, orientar y recodificar sin metadatos EXIF. Conserva hashes del original y del objeto normalizado. Un objeto normalizado que excede 5 MiB también se rechaza. Si el servidor rechaza un archivo, se conserva localmente como error hasta reintentar o quitarlo explícitamente.

Confirmar el hallazgo guarda entidades, blobs y trabajos en una misma transacción IndexedDB. Versión 3 añade `photo_local` sin borrar los stores anteriores. Los blobs permanecen particionados por cuenta hasta confirmar la subida o el descarte. Las vistas muestran pendiente/subido/error según confirmación real; los bytes ya subidos se consultan autorizadamente y no se conservan como nueva caché offline. Sin red, una foto ya subida puede no tener vista previa. Las URL de objeto se revocan y nunca son identidad persistente.

## Supabase: intervención manual requerida

Usar el proyecto actual elegido por el usuario. No hay un comando de migración en package.json.

1. En Dashboard → Storage crear `finding-photos`, **privado**, límite `5242880` bytes (5 MiB) y MIME permitidos exactamente `image/jpeg`, `image/png`, `image/webp`.
2. En SQL Editor ejecutar completo `supabase/migrations/20261009234656_finding_photos.sql`, después de las migraciones anteriores existentes. No ejecutar de nuevo si ya terminó correctamente. La transacción comprueba el bucket antes de crear el esquema; un error requiere rollback/corregir configuración antes de reintentar.
3. Comprobar tabla `public.finding_photos`, RPCs `reserve_finding_photo`, `complete_finding_photo`, `delete_finding_photo` y tres políticas específicas de `storage.objects`. No añadir políticas amplias de lectura/escritura para este bucket: las políticas permisivas se combinan mediante OR y podrían ampliar acceso.
4. Usar las variables Supabase ya existentes del servidor y una sesión normal de la app. No se requiere service_role ni una nueva clave del navegador.

El bucket se administra por Dashboard. Los objetos se escriben/eliminan por Storage API; la migración no manipula directamente `storage.objects`.

## Permisos y recuperación

El técnico activo sólo modifica fotos de su borrador; otro técnico, perfil inactivo o anon no tienen acceso. Coordinación sólo consulta fotos subidas de inspecciones finalizadas. La evidencia finalizada es inmutable. Se valida la relación real hallazgo/inspección/propietario, no sólo el nombre de carpeta.

Orden: confirmar inspección y hallazgo → reservar identidad → subir objeto sin upsert → confirmar metadatos → finalizar. El UUID de foto y path `propietario/inspección/hallazgo/foto` son estables. La reserva serializa el límite de tres usando el lock de la inspección. La finalización se bloquea tanto en cliente/runner como en SQL si hay pendientes o eliminaciones incompletas.

Storage y Postgres no comparten transacción. Si falla la subida, la reserva queda pendiente y el blob permanece local. Si se pierde la confirmación después de subir, el siguiente intento compara el hash del objeto existente y completa los metadatos sin sobrescribir ni duplicar. Eliminar marca `deleting`, elimina por Storage API y confirma `deleted`; sólo entonces pueden borrarse el hallazgo o borrador. Un trabajo nunca enviado puede descartarse localmente. Una reserva remota abandonada por pérdida definitiva del almacenamiento local exige revisión administrativa; no hay limpiador automático. Copiar un borrador en conflicto conserva las fotos con nuevas identidades; las ya subidas necesitan conexión para recuperar bytes. Las peticiones dependientes ya congeladas requieren revisión y no se reescriben.

La validación de contenido reside en la API de la app. Storage/RPCs validan permisos, asociación y metadatos; no decodifican imágenes por SQL. Un cliente autenticado que eluda la API no queda sometido al decodificador sharp. Esto debe considerarse al revisar el modelo de confianza antes de usos fuera de esta entrega.

## Verificación propia y pendiente

`npm test` ejecuta `photo-validation.spec.ts`, `photo-local.spec.ts` y `photo-remote.spec.ts` antes del gate W06 existente. Cubren cámara inyectada, decodificación real, upgrade aditivo, aislamiento, rollback, límite, orden, respuesta perdida, recuperación parcial, descarte y copia con fotos. Los puertos Storage/RPC del test remoto son dobles; no acreditan HTTP Storage real.

`supabase/tests/photo-module-smoke.sql` se ejecuta **sólo en PostgreSQL local desechable con auth y Storage simulados**, con todas las migraciones y rol authenticated. Usa datos sintéticos y rollback. Comprueba límite, finalización, eliminación idempotente, lectura entre cuentas y evidencia inmutable. Nunca insertar objetos ficticios con este archivo en el proyecto real: no genera archivos en Storage.

Validación humana/independiente pendiente: con cuentas sintéticas A/B/coordinación, capturar y seleccionar; denegar permisos; cancelar y cerrar; guardar offline y reabrir; reconectar y perder una respuesta; comprobar una sola identidad; quitar fotos y descartar; finalizar sólo tras confirmación; verificar que B/anon/inactivo no leen y coordinación sólo lee tras finalizar, con intentos reales de Storage API. No publicar fotografías personales, coordenadas, tokens ni claves. #72 registra sus propias pruebas/evidencia.

Referencias de APIs: [Supabase Storage RLS](https://supabase.com/docs/guides/storage/security/access-control), [sharp: salida y metadatos](https://sharp.pixelplumbing.com/api-output/).


### Reproducir la comprobación SQL local

Docker con una base vacía y sin puerto publicado. El bootstrap rechaza una base que ya tenga `auth.users`; no representa el esquema completo de Supabase ni un servicio Storage. Todos los comandos se ejecutan desde este checkout. Si un comando falla, detener la prueba y corregir antes de continuar.

```bash
docker run --rm -d --name pwa-w06-photo-sql -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine
docker exec pwa-w06-photo-sql pg_isready -U postgres
# Continuar cuando pg_isready indique accepting connections.
docker exec -i pwa-w06-photo-sql psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/photo-local-bootstrap.sql
for migration in supabase/migrations/*.sql; do
  docker exec -i pwa-w06-photo-sql psql -U postgres -v ON_ERROR_STOP=1 < "$migration" || exit 1
done
docker exec -i pwa-w06-photo-sql psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/photo-module-smoke.sql
docker stop pwa-w06-photo-sql
```

El smoke aborta con `SMOKE:` si un permiso o guard falla; `ROLLBACK` confirma que no conserva sus filas sintéticas. No acredita lectura/upload por HTTP ni permisos reales del navegador.
