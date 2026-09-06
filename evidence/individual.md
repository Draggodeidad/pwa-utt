# Evidencia individual del equipo

- Grupo y equipo: 9B-E02
- Repositorio del equipo: https://github.com/Draggodeidad/pwa-utt

## Integrante: Imanol Antonio De la Cruz

- Mi contribución concreta y enlace a archivo, commit anterior o revisión: puesta en marcha y verificación del starter (arranque con `npm ci` y `npm run dev`, comprobación de las tres inspecciones sintéticas en `http://localhost:3000`); redacción de `docs/requirements.md` (problema, usuarios, escenarios E-01/E-02 con conectividad intermitente, requisitos funcionales y no funcionales, datos sintéticos, límites y criterios de aceptación) y de `docs/decision-record.md` (comparación PWA / web tradicional / nativa / multiplataforma, decisión, riesgos y validación); creación del repositorio privado del equipo y actualización de las herramientas de verificación a la versión aclarada del 4 de septiembre. Enlaces: commit de contenido inicial https://github.com/Draggodeidad/pwa-utt/commit/bb812f23e808e6050b60cd5feb49dfe5ce1a5e43 y documentos en `docs/requirements.md`, `docs/decision-record.md`, `evidence/individual.md`.
- Decisión que puedo explicar y por qué: se mantiene PWA sobre Next.js en lugar de app nativa o multiplataforma porque el escenario de conectividad intermitente (E-02) exige conservar registros sin red y sincronizarlos después; la PWA lo permite sin cuentas de tienda ni un segundo ecosistema de código, y la base web única se verifica de forma reproducible en local y en GitHub Actions. Una app nativa se justificaría solo ante hardware especializado; una web tradicional no cubre el trabajo sin conexión.
- Comando o prueba proporcionada que ejecuté: `npm run verify` (estructura + `npm test` + `npm run build`) sobre el árbol limpio, y `bash public-tests/check.sh` para el check de estructura.
- Resultado real que observé: `npm run verify` terminó con código 0 y generó `reports/verification.json` con `status: "pass"`; la prueba `tests/starter.spec.mjs` imprimió `PASS` y el build de Next.js completó sin errores; GitHub Actions ejecutó la misma verificación en verde.
- Qué verifica esa prueba y qué no verifica: verifica que los archivos requeridos existen, que el starter mantiene su pantalla de inspecciones sintéticas y que el proyecto compila; NO verifica la calidad del análisis de los documentos, no detecta secretos y no cubre el comportamiento completo de la aplicación (la suite no es exhaustiva).
- Limitación, dificultad o riesgo que identifiqué: la verificación técnica da `pass` aunque los documentos tengan análisis débil, porque la revisión académica es manual; además el funcionamiento offline todavía no existe, por lo que el escenario E-02 es por ahora solo un requisito documentado, y la sincronización futura requerirá resolver conflictos de registros duplicados.
- Uso de IA: herramienta, propósito, partes influenciadas y validación propia: usé un asistente de IA (opencode) para redactar el borrador inicial de `docs/requirements.md`, `docs/decision-record.md` y esta evidencia, y para ejecutar los comandos de instalación y verificación. Validé personalmente el resultado contra el comportamiento real del proyecto (las tres inspecciones en el navegador, la salida de `npm run verify` y de Actions) y ajusté el contenido antes de cada commit; la responsabilidad técnica de lo entregado es mía.

## Integrante: Osbaldo Alvarez Marinez

- Mi contribución concreta y enlace a archivo, commit anterior o revisión: revisión técnica y auditoría del repositorio del equipo; comprobación de que la estructura de archivos, la documentación y la verificación cumplen los requisitos de Semana 1; ejecución de `npm run verify` para confirmar que el proyecto instala, pasa la prueba y compila de forma reproducible; revisión de `docs/requirements.md`, `docs/decision-record.md`, `README.md` y `evidence/individual.md` para identificar el estado de completitud de la entrega; registro de la propia evidencia en esta sección. Archivo principal revisado: `evidence/individual.md` (esta sección).
- Decisión que puedo explicar y por qué: se eligió PWA sobre Next.js porque es la única estrategia web que puede cubrir el escenario E-02 (conectividad intermitente) sin requerir cuentas de tienda de aplicaciones ni un segundo ecosistema de código. La comparación con web tradicional, app nativa y multiplataforma está documentada en `docs/decision-record.md`; la PWA permite instalación desde el navegador, una base de código única verificable en GitHub Actions y crecimiento incremental durante las 14 semanas del curso, lo cual se ajusta a las restricciones del equipo.
- Comando o prueba proporcionada que ejecuté: `npm run verify` desde la raíz del proyecto (equivale a estructura + `npm test` + `npm run build`).
- Resultado real que observé: `npm run verify` terminó con código de salida 0; la prueba `tests/starter.spec.mjs` imprimió `starter.spec.mjs: PASS`; el build de Next.js 14 completó sin errores generando páginas estáticas; se generó `reports/verification.json` con `"status": "pass"`. SHA del commit evaluado: `c2f218d88add8d9628a98112ccde0d5a13b38ccf`.
- Qué verifica esa prueba y qué no verifica: verifica que los archivos requeridos existen (`package.json`, `README.md`, `src/app/page.tsx`, `docs/requirements.md`, etc.), que `page.tsx` contiene las cadenas "Inspecciones de laboratorio" y "sintéticos", que el script de build es `next build` y que el proyecto compila. NO verifica la calidad del análisis de los documentos, no detecta credenciales ni secretos, no prueba el comportamiento real de la interfaz en el navegador y no cubre el funcionamiento offline (no implementado en Semana 1).
- Limitación, dificultad o riesgo que identifiqué: la verificación técnica devuelve `pass` aunque los documentos tengan análisis insuficiente, ya que la revisión de contenido es manual y queda fuera del script; además, el funcionamiento offline (E-02) no existe todavía: está documentado como requisito futuro pero no implementado, por lo que el escenario de conectividad intermitente sigue sin cubrirse en esta entrega.
- Uso de IA: herramienta, propósito, partes influenciadas y validación propia: usé Antigravity (asistente de IA de Google) para analizar la estructura completa del proyecto, auditar el estado de los requisitos de Semana 1 contra los criterios de `ACTIVIDAD-01.md` y redactar el borrador de esta sección de evidencia. Validé personalmente los resultados reales observados (salida de `npm run verify`, estado de Git, contenido de los documentos del equipo) antes de aprobar el contenido; la responsabilidad de lo registrado aquí es mía.

## Integrante: Jose Julian Alvarez Flores

Mi contribución concreta y enlace a archivo commit o revisión:
- Puesta en marcha y verificación del starter: instalación con `npm ci`, arranque con `npm run dev` y comprobación de las tres inspecciones sintéticas en http://localhost:3000.
- Revisión y edición de docs/requirements.md y docs/decision-record.md.
- Enlaces: commit principal de mi aporte https://github.com/Draggodeidad/pwa-utt/commit/3152c1659b1ca5b3eb7f92d0e9c69cad4721a8fb archivos editados: docs/requirements.md, docs/decision-record.md, evidence/individual.md.

Decisión que puedo explicar y por qué:
- Mantener PWA sobre Next.js para cubrir el escenario E-02 (conectividad intermitente) porque permite almacenamiento local y sincronización posterior sin desplegar en tiendas ni mantener un segundo ecosistema de código. La PWA facilita verificación reproducible en local y CI.

Comando o prueba proporcionada que ejecuté:
- `npm run verify` desde la raíz del proyecto.

Resultado real que observé:
- `npm run verify` terminó con código de salida 0 y generó `reports/verification.json` con `"status": "pass"`.
- La prueba `tests/starter.spec.mjs` imprimió PASS y el build de Next.js completó sin errores.

Qué verifica esa prueba y qué no verifica:
- Verifica: existencia de archivos requeridos, que la página contiene las cadenas esperadas y que el proyecto compila.
- No verifica: calidad del análisis en los documentos, ausencia de secretos, ni el comportamiento offline real.

Limitación, dificultad o riesgo que identifiqué:
- La verificación técnica puede pasar aunque el análisis documental sea insuficiente.
- El funcionamiento offline y la sincronización de registros aún no están implementados; la resolución de conflictos en sincronización es un riesgo futuro.

Uso de IA herramienta propósito partes influenciadas y validación propia:
- Herramienta: Ninguna por que soy increible.
- Propósito: redactar borrador inicial de documentos y esta evidencia.
- Partes influenciadas: borrador de docs/requirements.md, docs/decision-record.md y esta sección.
- Validación: verifiqué manualmente los cambios ejecutando `npm run verify`, comprobando la UI en http://localhost:3000 y revisando los commits antes de push.