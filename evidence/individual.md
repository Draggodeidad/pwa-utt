# Evidencia individual del equipo

## Integrante 1 — Imanol Antonio De la Cruz

- Nombre: Imanol Antonio De la Cruz
- Repositorio y commit evaluado: https://github.com/Draggodeidad/pwa-utt — SHA evaluado: c850922b9e362dd6d7c9e53f95acbc1b69c825fc (commit con todos los artefactos y la evidencia completa)
- Mi contribución concreta: instalación y verificación del starter (`npm ci`, `npm run dev`, comprobación de las 3 inspecciones sintéticas en `http://localhost:3000`), redacción completa de `docs/requirements.md` (problema, usuarios, dos escenarios —uno con conectividad intermitente—, requisitos funcionales y no funcionales, datos sintéticos y criterios de aceptación) y de `docs/decision-record.md` (comparación PWA / web tradicional / nativa / multiplataforma, decisión, riesgos y validación), creación del repositorio privado y ejecución de la verificación local y en GitHub Actions.
- Decisión técnica que puedo explicar: por qué se eligió PWA sobre Next.js en lugar de app nativa o multiplataforma — la restricción de conectividad intermitente exige offline e instalación, y la restricción de tiempo/presupuesto del curso descarta tiendas de aplicaciones y un segundo ecosistema de código; la base web única mantiene la verificación reproducible en CI.
- Comando o prueba que ejecuté y resultado: `make verify && bash public-tests/check.sh` — `npm run verify` generó `reports/verification.json` con `status: "pass"` y el check público imprimió `PUBLIC_OK`; además `npm test` ejecutó `tests/starter.spec.mjs` sin errores.
- Limitación o riesgo que encontré: la comprobación de contenido del starter no detecta credenciales por análisis profundo, solo coincidencias literales de palabras comunes, así que la garantía real contra datos sensibles depende de no escribirlos nunca en el repositorio; además, el funcionamiento offline todavía no existe, por lo que el escenario de conectividad intermitente es por ahora solo un requisito documentado.
- Uso de IA (herramienta, propósito, fragmentos influenciados y validación humana): usé un asistente de IA (opencode) para la redacción inicial de los tres documentos de esta carpeta y de `docs/`, y para ejecutar los comandos de instalación y verificación. Todo el contenido fue revisado y corregido por mí contra el comportamiento real del proyecto (verificación de las 3 inspecciones en el navegador, resultados de `make verify` y del check público) antes de cada commit; la responsabilidad técnica de lo entregado es mía.

---

## Integrante 2 — Álvarez Martínez Osbaldo

- Nombre: Álvarez Martínez Osbaldo (Matrícula: 3523110279)
- Repositorio y commit evaluado: https://github.com/Draggodeidad/pwa-utt — SHA evaluado: a776a25d550e8af1d8aeaf4cef731186b4ec4da8
- Mi contribución concreta: Implementación del criterio **AC-03 (Diagnóstico y manejo del fallo controlado)** y **AC-05 (Aportación individual)**. Creación de pruebas unitarias de regresión en `tests/inspections.spec.mjs`, reproducción empírica de un fallo por mutación accidental de estado en `src/lib/data/inspections.ts`, análisis de causa raíz y corrección de la función `getInspectionStatusLabel`. Integración de la función en la interfaz gráfica (`src/app/page.tsx`), compatibilidad ESM sin flags experimentales en `package.json`, redacción del documento formal `docs/bug-diagnosis.md` y reportes de evidencia individual.
- Decisión técnica que puedo explicar: Importancia del uso de comparadores strictly inmutables (`===`) y consumo directo de funciones derivadas en la UI sobre arreglos de datos sintéticos en memoria para evitar efectos colaterales entre pruebas y vistas.
- Comando o prueba ejecutada: `npm test`, `node scripts/verify.mjs` y `bash scripts/verificar_cierre.sh`.
- Limitación o riesgo que encontré: La transpilación en tiempo de ejecución en entornos sin compilación previa requiere cargar módulos TypeScript mediante `ts.transpileModule` para garantizar compatibilidad con Node 18, Node 20 LTS y Node 22 en GitHub Actions.
- Uso de IA: Asistente IA Antigravity utilizado para la estructuración metodológica y formateo de reportes; la lógica de código, pruebas y diagnóstico fue validada manualmente en el entorno local.
