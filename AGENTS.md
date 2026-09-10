# Instrucciones del proyecto

## Abstracción de estilos Tailwind

- En pantallas y componentes de aplicación, extrae las clases Tailwind estáticas de `className` a un único objeto plano `const s = { ... }` ubicado al final del archivo, después de los componentes.
- Usa nombres semánticos basados en la función visual del elemento, como `page`, `header`, `title`, `actions`, `card`, `field` o `emptyState`. No uses nombres posicionales o genéricos como `style1`, `div2` o `classA`.
- Reutiliza una sola propiedad de `s` cuando la cadena de clases sea idéntica y el nombre siga siendo comprensible en todos sus usos.
- Conserva las clases como cadenas literales completas para que Tailwind pueda detectarlas. No construyas clases con fragmentos, interpolaciones de colores o factories.
- Para estilos condicionales, conserva la condición y extrae por separado la base y cada variante estática, por ejemplo: ``className={`${s.item} ${active ? s.itemActive : s.itemInactive}`}``.
- No introduzcas CSS Modules, Styled Components, nuevos helpers, CVA, archivos CSS ni dependencias para esta abstracción.
- No cambies lógica, props, tipos, componentes, estructura funcional, orden de clases, breakpoints ni apariencia al extraer estilos.
- No modifiques los componentes base de `src/components/ui` únicamente para aplicar esta convención; conserva sus APIs y variantes existentes.
- Antes de terminar, confirma que no quedan cadenas Tailwind estáticas inline en el JSX modificado y ejecuta el typecheck y las pruebas disponibles.
