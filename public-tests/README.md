# Checks públicos acumulativos

Desde la raíz del proyecto: `bash public-tests/check.sh`. Comprueba los artefactos obligatorios de las Semanas 02 y 04 y la estructura acumulativa del proyecto. No califica documentos ni sustituye una auditoría de seguridad.

Para pruebas, build y medición de carga usen `npm run verify`; produce `reports/verification.json` y `reports/rendering-metrics.json`. La calidad del contenido se revisa con la rúbrica.

El escaneo literal del ZIP de Semana 04 busca palabras como `password` en todo el repositorio y marca falsos positivos en el código de login y en documentación existente. Por eso no se usa como detector de credenciales; la ausencia de secretos requiere una revisión específica del contenido versionado.

## W09

`bash public-tests/check-w09.sh` es un gate estricto separado (requiere Bash/Node/Git). No reemplaza `check.sh` ni W05/W06. Verifica archivos no vacíos, contenido, consumidores y scripts. La falta de robots de #99 falla explícitamente; el gate no crea ese archivo.

Después de `make verify`, ejecutar `npm run verify:w09`: corre gate y suite aun si el gate falla, y genera `evaluation-result.json` con SHA/códigos reales sin stdout/stderr de hijos. No acredita RLS remota, ausencia exhaustiva de secretos ni calificación académica.
