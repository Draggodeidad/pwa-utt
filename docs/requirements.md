# Requisitos del producto — documento del equipo

Equipo: **9B-E02** · Actividad 1 · Semana 1 (2026-09-04)

## 1. Problema y contexto

El personal técnico de los laboratorios registra las inspecciones de mantenimiento en hojas de cálculo y cuadernos. Esto provoca registros incompletos, pérdidas de información al cambiar de equipo y dificultad para dar seguimiento a un hallazgo. Un registro interrumpido por la falta de conexión agrava el problema: si el técnico no puede anotar en el momento, el hallazgo se olvida o se anota tarde.

Se construirá una PWA de inspecciones que permita consultar y registrar inspecciones desde el teléfono o la computadora del técnico. La conectividad importa porque los laboratorios tienen zonas con señal débil y el personal se desplaza entre edificios: la aplicación debe seguir siendo útil con conexión intermitente (capacidad futura, no implementada en Semana 1).

Fuera de alcance en la Semana 1: modo offline, manifest, service worker, sincronización, notificaciones, autenticación y despliegue. Esta semana solo se instala, ejecuta, documenta y verifica el proyecto base con datos sintéticos. Los requisitos del producto futuro se describen aquí y se implementarán en las semanas correspondientes.

## 2. Usuarios y escenarios

Usuarios principales:

- **Técnica/o de mantenimiento:** realiza y consulta inspecciones en campo, muchas veces en movimiento.
- **Coordinación de laboratorios:** revisa el estado de las inspecciones y prioriza los hallazgos.
- **Estudiante/desarrollador (equipo del curso):** extiende la aplicación semana a semana.

### Escenario E-01 — Consulta con conexión estable

- **Situación inicial:** la técnica A entra a un laboratorio con red disponible y necesita saber qué espacios ya fueron revisados.
- **Acción:** abre la aplicación en su teléfono y mira la lista de inspecciones recientes.
- **Resultado esperado:** ve las tres inspecciones sintéticas con su estado (sin incidencias / requiere atención), fecha, laboratorio y número de hallazgos, y confirma qué espacios están al día.

### Escenario E-02 — Registro con conectividad intermitente

- **Situación inicial:** el técnico B inicia una inspección en un laboratorio con señal débil y la conexión se corta a mitad del recorrido.
- **Acción:** sigue registrando el hallazgo en la aplicación y espera conservarlo para enviarlo después.
- **Resultado esperado (capacidad futura):** la aplicación conserva el registro en curso sin perder información y, al recuperar la conexión, lo envía y queda visible en la lista.

En la Semana 1 E-02 se documenta como objetivo futuro: la cola offline y la sincronización se implementarán en semanas posteriores.

## 3. Requisitos funcionales

Cada requisito se vincula a los escenarios y declara si aplica desde Semana 1 o es del producto futuro.

| ID | Acción del producto | Condición observable de aceptación | Alcance | Escenario |
|---|---|---|---|---|
| RF-01 | Mostrar los registros sintéticos del starter | Al abrir `http://localhost:3000` tras `npm run dev` se ven las 3 inspecciones con ubicación, fecha, responsable, estado y hallazgos | Semana 1 | E-01 |
| RF-02 | Etiquetar el estado de cada inspección | Las tarjetas muestran "Sin incidencias" o "Requiere atención" según el campo `status` | Semana 1 | E-01 |
| RF-03 | Indicar cuántos registros se muestran | La sección de inspecciones incluye un contador con el total (3) | Semana 1 | E-01 |
| RF-04 | Instalarse de forma reproducible | `npm ci` termina sin errores usando `package-lock.json`, sin dependencias añadidas manualmente | Semana 1 | — |
| RF-05 | Verificar la estructura del proyecto | `npm run verify` genera `reports/verification.json` con `status: "pass"` y sin archivos faltantes | Semana 1 | — |
| RF-06 | Registrar una inspección | Al guardar datos válidos de laboratorio, fecha y hallazgo, aparece un registro nuevo con esos mismos valores | Futuro | E-02 |
| RF-07 | Conservar un registro sin conexión | Al perder la conexión, un registro en curso permanece disponible en el dispositivo y no se pierde al recargar | Futuro | E-02 |
| RF-08 | Sincronizar registros pendientes | Al recuperar la conexión, los registros conservados se envían y quedan visibles en la lista sin duplicarse | Futuro | E-02 |

## 4. Requisitos no funcionales

| ID | Condición (medible) | Método de comprobación | Momento de validación |
|---|---|---|---|
| RNF-01 Reproducibilidad | En una copia limpia, con las versiones declaradas en el README (Node v26.2.0 / npm 11.13.0 locales, Node 20.19.6 en CI), `npm ci` y `npm run verify` terminan con código 0 | Ejecutar ambos comandos en un clon sin `node_modules` ni `.next` | Semana 1 y en cada entrega |
| RNF-02 Rendimiento | La página principal responde en menos de 2 s en la máquina de desarrollo y el HTML inicial incluye el contenido de las inspecciones (renderizado del lado del servidor). Supuesto: máquina de desarrollo con red local; el umbral es ilustrativo, no un resultado ya medido | Inspeccionar el HTML devuelto por `http://localhost:3000` y medir el tiempo de respuesta | Semana 1 (carga actual); re-medir con 100 registros sintéticos en la semana de datos |
| RNF-03 Accesibilidad | La estructura de encabezados es jerárquica (`h1`→`h3`) y las secciones usan `aria-labelledby` | Revisión manual de la estructura de encabezados y de atributos ARIA en `src/app/page.tsx` | Semana 1; re-auditar al agregar formularios |
| RNF-04 Seguridad y privacidad | El repositorio no contiene credenciales, claves, `.env` ni datos personales reales; solo datos sintéticos. Nota: `npm run verify` no certifica ausencia de secretos | Revisión manual del contenido versionado y de `.gitignore` (excluye `node_modules/`, `.next/` y `reports/verification.json`) | Antes de cada push; el reporte de verificación declara sus límites |
| RNF-05 Operación offline futura | Con la red desactivada, las 3 inspecciones ya consultadas siguen visibles y un registro nuevo se conserva en el dispositivo. Supuesto: se implementará con service worker y almacenamiento local en semanas posteriores | Prueba manual: cargar la página con red, desactivar la red, recargar y registrar | Semana en la que se implemente offline (no en Semana 1) |
| RNF-06 Mantenibilidad | El proyecto usa TypeScript estricto con tipado explícito (`Inspection`, `InspectionStatus`) y sin dependencias adicionales a Next.js, React y TypeScript | Revisar `tsconfig.json` y `package.json` | Semana 1 y en cada entrega |

## 5. Datos sintéticos y límites

Los datos usados son 100 % sintéticos y viven en `src/lib/data/inspections.ts`: tres inspecciones de laboratorios ficticios con fechas de agosto de 2026, responsables genéricos (Técnica A, Técnico B, Técnica C) y conteos de hallazgos inventados. Campos ficticios: `id`, `location`, `date`, `inspector`, `status`, `findings`, `summary`.

Queda excluida del repositorio y de la documentación: información personal real de estudiantes o personal, fotografías de instalaciones, credenciales, claves, identificadores institucionales sensibles y datos de equipos reales. La identificación académica de los integrantes se registra solo en la evidencia del repositorio privado y en Classroom.

## 6. Criterios de aceptación de la Semana 1

| Entrega | Comprobación técnica | Juicio sobre contenido |
| --- | --- | --- |
| Instalación limpia y reproducible | `npm ci` termina sin errores | — |
| App ejecutable con 3 inspecciones | `npm run dev` + abrir `http://localhost:3000` | — |
| Prueba proporcionada | `npm test` (o `npm run verify`, que la incluye) | — |
| Build reproducible | `npm run build` (incluido en `npm run verify`) | — |
| Estructura y artefactos | `npm run verify` → `reports/verification.json` con `status: "pass"`; `bash public-tests/check.sh` solo valida estructura | El reporte no califica la calidad del análisis |
| Requisitos verificables | — | Revisión de `docs/requirements.md`: escenarios, RF vinculados, RNF medibles, datos y límites |
| Comparación de alternativas | — | Revisión de `docs/decision-record.md` |
| Evidencia por integrante | — | Revisión de `evidence/individual.md` |
| CI en verde | GitHub Actions: workflow "Starter Semana 1 — feedback" exitoso | — |

`npm run verify` valida estructura, prueba y build; NO valida la calidad de los documentos ni certifica ausencia de secretos.
