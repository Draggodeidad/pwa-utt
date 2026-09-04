# Evidencia individual del equipo

## Integrante 1 — Imanol Antonio De la Cruz
- Nombre: Imanol Antonio De la Cruz
- Repositorio y commit evaluado: https://github.com/Draggodeidad/pwa-utt — SHA evaluado: c850922b9e362dd6d7c9e53f95acbc1b69c825fc
- Mi contribución concreta: instalación y verificación del starter (`npm ci`, `npm run dev`, comprobación de las 3 inspecciones sintéticas en `http://localhost:3000`), redacción completa de `docs/requirements.md` y `docs/decision-record.md`, creación del repositorio e integración continua inicial.
- Decisión técnica que puedo explicar: elección de PWA sobre Next.js por restricciones de tiempo y presupuesto.
- Comando o prueba ejecutado: `npm run verify` y `public-tests/check.sh`.
- Limitación encontrada: funcionamiento offline pendiente para semanas posteriores.
- Uso de IA: Asistente IA para redacción inicial de documentación, revisado por el integrante.

---

## Integrante 2 — Álvarez Martínez Osbaldo
- Nombre: Álvarez Martínez Osbaldo (Matrícula: 3523110279)
- Repositorio y commit evaluado: https://github.com/Draggodeidad/pwa-utt — SHA evaluado: 072295e0a1b2552ac45b1e7ec067808dd7f35654
- Mi contribución concreta: Implementación del criterio **AC-03 (Diagnóstico y manejo del fallo controlado)**. Creación de pruebas unitarias de regresión en `tests/inspections.spec.mjs`, reproducción empírica de un fallo por mutación accidental de estado en `src/lib/data/inspections.ts`, análisis de causa raíz y corrección de la función `getInspectionStatusLabel`. Redacción del documento formal `docs/bug-diagnosis.md` y actualización de artefactos de verificación.
- Decisión técnica que puedo explicar: Importancia del uso de comparadores estrictos de inmutabilidad (`===`) sobre arreglos de datos sintéticos en memoria para evitar efectos colaterales entre pruebas y vistas.
- Comando o prueba ejecutado: `npm test`, `node scripts/verify.mjs` y `bash scripts/verificar_cierre.sh`.
- Limitación encontrada: Las comprobaciones de tipos en Node 22 requieren flags experimentales (`--experimental-strip-types`) en ausencia de un transpilador previo durante la fase de desarrollo local.
- Uso de IA: Asistente IA Antigravity utilizado para la estructuración metodológica y formateo de reportes; la lógica de código, pruebas y diagnóstico fue validada manualmente en el entorno local.
