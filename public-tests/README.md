# Checks públicos acumulativos

Desde la raíz del proyecto: `bash public-tests/check.sh`. Comprueba los artefactos obligatorios de las Semanas 02 y 04 y la estructura acumulativa del proyecto. No califica documentos ni sustituye una auditoría de seguridad.

Para pruebas, build y medición de carga usen `npm run verify`; produce `reports/verification.json` y `reports/rendering-metrics.json`. La calidad del contenido se revisa con la rúbrica.

El escaneo literal del ZIP de Semana 04 busca palabras como `password` en todo el repositorio y marca falsos positivos en el código de login y en documentación existente. Por eso no se usa como detector de credenciales; la ausencia de secretos requiere una revisión específica del contenido versionado.
