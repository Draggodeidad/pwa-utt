# Guía acotada para completar evidencia de Semana 02

Esta guía permite que cada integrante revise y demuestre dominio sin modificar accidentalmente el incremento ya verificado.

## Alcance seguro

1. Parte de `feat/w02-installable-app-shell` después de que Imanol publique la rama.
2. No modifiques `public/`, `src/`, `tests/`, `package.json`, el lockfile ni los workflows.
3. Revisa `public/manifest.webmanifest`, `src/app/layout.tsx`, `src/components/app-shell.tsx` y `tests/manifest.spec.ts` hasta poder explicar su relación.
4. Ejecuta personalmente los comandos indicados y conserva la URL del run de GitHub Actions o una captura de la salida.
5. Edita solo tu sección de `evidence/individual.md`; registra resultados reales, no copies la sección de otra persona.

## Comandos

```bash
git fetch origin
git switch feat/w02-installable-app-shell
git pull --ff-only
npm ci --ignore-scripts --no-audit --no-fund
make verify
bash public-tests/check.sh
git status --short
```

Después, verifica manualmente en el navegador:

1. La navegación principal se recorre con `Tab` y muestra foco visible.
2. El viewport móvil abre/cierra la navegación con el botón correspondiente.
3. DevTools reconoce `/manifest.webmanifest`, los iconos y el modo `standalone`.
4. No aparecen nombres, correos, identificadores ni imágenes de personas reales.

## Único cambio esperado

Completa solo tu bloque en `evidence/individual.md`, crea un commit con mensaje `docs(evidence): add week 02 verification by <nombre>` y abre un pull request hacia `feat/w02-installable-app-shell`. Si cualquier comando falla, no cambies código a ciegas: copia la salida exacta en tu evidencia y solicita revisión.
