# Requisitos del producto — Semana 1

## 1. Problema y contexto

El personal técnico de los laboratorios de la Universidad Tecnológica de Tehuacán registra las inspecciones de mantenimiento en hojas de cálculo y cuadernos. Esto provoca registros incompletos, pérdidas de información al cambiar de equipo y dificultad para dar seguimiento a los hallazgos.

Se construirá una PWA de inspecciones que permita consultar y registrar inspecciones desde el teléfono o computadora del técnico. El contexto real de uso incluye conectividad intermitente: los laboratorios tienen zonas con señal débil y el personal se desplaza entre edificios.

Fuera de alcance en la Semana 1: modo offline, manifest, service worker, sincronización, notificaciones, autenticación y despliegue. Esta semana solo se instala, ejecuta, documenta y verifica el proyecto base con datos sintéticos.

## 2. Usuarios y escenarios

Usuarios principales:

- Técnica/o de mantenimiento: realiza y consulta inspecciones en campo.
- Coordinación de laboratorios: revisa el estado de las inspecciones y los hallazgos.
- Estudiante/desarrollador (rol de este curso): extiende la aplicación semana a semana.

Escenario E-01 — Consulta con conexión estable:
La técnica A abre la aplicación en su teléfono con red disponible, ve la lista de inspecciones recientes con su estado (sin incidencias / requiere atención), la fecha, el laboratorio y el número de hallazgos, y confirma qué espacios ya fueron revisados.

Escenario E-02 — Registro con conectividad intermitente:
El técnico B inicia una inspección en un laboratorio con señal débil. La conexión se corta a mitad del recorrido; la aplicación debe seguir mostrando los datos ya cargados y conservar el registro en curso sin perder información. Al recuperar la conexión, el registro continúa y queda visible en la lista. En la Semana 1 este escenario se documenta como objetivo futuro; la implementación de cola offline y sincronización se hará en semanas posteriores.

## 3. Requisitos funcionales

- RF-01 — La aplicación muestra una lista de inspecciones en la página principal. Aceptación: al abrir `http://localhost:3000` tras `npm run dev`, se renderizan exactamente 3 inspecciones sintéticas con ubicación, fecha, responsable, estado y hallazgos.
- RF-02 — Cada inspección muestra una etiqueta de estado legible. Aceptación: las tarjetas muestran "Sin incidencias" o "Requiere atención" según el campo `status` de los datos.
- RF-03 — La aplicación indica cuántos registros se muestran. Aceptación: la sección de inspecciones incluye un contador con el total de registros (3).
- RF-04 — El proyecto se instala de forma reproducible. Aceptación: `npm ci` completa sin errores usando `package-lock.json`, sin dependencias añadidas manualmente.
- RF-05 — La estructura del proyecto es verificable. Aceptación: `npm run verify` genera `reports/verification.json` con `status: "pass"` y sin archivos faltantes.
- RF-06 — La documentación del producto vive en el repositorio. Aceptación: `docs/requirements.md`, `docs/decision-record.md` y `evidence/individual.md` existen y están completos (verificación: `bash public-tests/check.sh` imprime `PUBLIC_OK`).

## 4. Requisitos no funcionales

- RNF-01 Reproducibilidad: cualquier persona con Node.js 18+ puede clonar el repositorio y ejecutar `npm ci && npm run dev` sin pasos ocultos; el build (`npm run build`) completa sin errores.
- RNF-02 Rendimiento: la página principal responde en menos de 2 segundos en una máquina de desarrollo local y el HTML inicial incluye el contenido de las inspecciones (renderizado del lado del servidor).
- RNF-03 Accesibilidad: las secciones usan encabezados jerárquicos (`h1`–`h3`) y `aria-labelledby`; el contraste de texto permite lectura sin dificultad. Meta: pasar una revisión manual de estructura de encabezados.
- RNF-04 Seguridad y privacidad: el repositorio no contiene credenciales, claves ni datos personales reales; solo datos sintéticos. La revisión se automatiza con `public-tests/check.sh`.
- RNF-05 Operación offline futura: la arquitectura (datos en `src/lib/data/inspections.ts`, vista en `src/app/page.tsx`) permite sustituir la fuente de datos por almacenamiento local sin cambiar la interfaz visual.
- RNF-06 Mantenibilidad: TypeScript estricto con tipado explícito (`Inspection`, `InspectionStatus`) y sin dependencias adicionales a Next.js, React y TypeScript.

## 5. Datos sintéticos y límites

Los datos usados son 100% sintéticos y viven en `src/lib/data/inspections.ts`: tres inspecciones de laboratorios ficticios con fechas de agosto de 2026, responsables genéricos (Técnica A, Técnico B, Técnica C) y conteos de hallazgos inventados.

Queda prohibido registrar en el repositorio o en la documentación: datos personales reales, nombres de personas reales, fotografías de instalaciones, credenciales, claves, identificadores institucionales sensibles o información de equipos reales. Cualquier dato futuro para pruebas deberá generarse de forma artificial.

## 6. Criterios de aceptación de la Semana 1

| Entrega | Verificación |
| --- | --- |
| Instalación limpia | `npm ci` sin errores |
| App ejecutable con 3 inspecciones | `npm run dev` + abrir `http://localhost:3000` |
| Build reproducible | `npm run build` sin errores |
| Estructura y artefactos completos | `make verify` → `reports/verification.json` con `status: "pass"` |
| Prueba automatizada reproducible | `npm test` y `bash public-tests/check.sh` → `PUBLIC_OK` |
| Requisitos y decisión documentados | `docs/requirements.md` y `docs/decision-record.md` completos |
| Evidencia individual | `evidence/individual.md` con contribución, SHA, prueba, limitación y uso de IA |
| CI en verde | GitHub Actions: workflow "Starter Semana 1 — feedback" en estado exitoso |
