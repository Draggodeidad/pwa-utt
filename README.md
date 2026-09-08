# PWA de inspecciones de laboratorio — proyecto del equipo

Comiencen por `START_HERE.md` y lean `ACTIVIDAD-01.md`. Este es un proyecto acumulativo: un repositorio privado por equipo durante el curso. La Semana 1 consiste en arrancar, documentar y explicar la verificación; no en implementar toda la PWA.

## Entorno

Node.js 20.19 o posterior compatible, npm 10 o posterior, Git y cuenta de GitHub. No se requiere Make.

Versiones usadas por el equipo (registrado 2026-09-04):

- Node.js v26.2.0 (`node --version`)
- npm 11.13.0 (`npm --version`)
- Git 2.x · Fedora Linux 44 (Workstation)

Dificultades de entorno encontradas: ninguna bloqueante. La verificación local se ejecutó sin Make y sin servicios adicionales; GitHub Actions usa Node 20.19.6.

## Ejecución

```bash
npm ci
npm run dev
```

Abran `http://localhost:3000` y comprueben las tres inspecciones sintéticas. Detengan el servidor con Ctrl+C.

## Verificación

```bash
npm run verify
```

Ejecuta comprobación de archivos, prueba proporcionada y build; genera `reports/verification.json`. El reporte contiene resultados técnicos y documentos para revisión, no una calificación automática. `make verify` es equivalente. `bash public-tests/check.sh` es un check opcional de estructura.

GitHub Actions ejecuta la misma verificación y permite descargar el artefacto `starter-week-01-evidence`. El reporte local se excluye de Git: adjúntenlo en Classroom o descarguen el del SHA entregado desde Actions.

## Trabajo y entrega en equipo

Equipo: **9B-E02**. Repositorio privado: `https://github.com/Draggodeidad/pwa-utt`. Inviten a los integrantes y al docente al mismo repositorio privado. Cada persona registra su evidencia en una sección de `evidence/individual.md`. Todos entregan en Classroom el mismo SHA final y enlaces, identificando su sección. El formato exacto está en `ACTIVIDAD-01.md`; no se requiere un pull request adicional ni una copia por alumno.

## Supuestos y limitaciones de ejecución

- Los datos del producto son 100 % sintéticos; no se incluyen datos reales de personas, laboratorios o estudiantes.
- El starter todavía no implementa instalación PWA, offline, manifest, service worker ni sincronización: son requisitos futuros documentados en `docs/requirements.md`.
- `reports/verification.json` se genera en cada verificación y se excluye de Git deliberadamente; se entrega en Classroom o se descarga del artefacto de Actions.
- La verificación técnica (`npm run verify`) no califica la calidad de los documentos; la revisión académica se hace con la rúbrica de `ACTIVIDAD-01.md`.

## Estructura y límites

- `src/app/`: pantalla Next.js.
- `src/lib/data/`: inspecciones sintéticas.
- `docs/`: requisitos y decisión del equipo.
- `evidence/`: evidencia propia de cada integrante.
- `tests/`: prueba inicial proporcionada; no es una suite completa de comportamiento.
