# Changelog

Registro de cambios funcionales de GymTrack (`index.html`). Cada entrada indica qué se hizo, por qué, y qué se verificó antes de darlo por terminado.

Este archivo no existía antes de la entrada de 2026-08-24 — se crea a partir de ahí.

## 2026-08-24 — Beneficios por categoría y seguimiento personalizado por miembro

**Qué se hizo:**
- `categoriasMembresia` ahora acepta un campo `beneficios` (array de strings, `[]` por default): cada gimnasio define libremente qué incluye cada una de sus categorías (ej. "Nutrición personalizada", "Casillero"), sin nada hardcodeado en el código.
- El modal de gestión de categorías (`modal-categorias`) permite expandir cada categoría para ver, agregar y quitar beneficios individuales, con el mismo patrón de interacción que el resto de la app (chips removibles, input + botón agregar).
- Nuevo helper `beneficiosDeCategoria(nombre)`: busca la categoría por nombre y devuelve sus beneficios, o `[]` si no hay match — no truena si la categoría fue renombrada o borrada después de asignarse a un miembro.
- En el perfil del miembro, nueva tarjeta "Este plan incluye" que muestra los beneficios de su categoría actual; se oculta por completo si la lista está vacía.
- Cada `miembro` ahora puede tener `notasPlan` (array de `{tema, contenido, creadoEn}`, texto libre en ambos campos, definido por el gym — no hay campos fijos tipo "nutrición" o días de la semana hardcodeados).
- Nueva sección "Seguimiento personalizado" en el perfil, para agregar/ver/quitar notas individuales por miembro (mismo patrón visual que los beneficios de categoría).

**Por qué:**
Cada gimnasio ofrece beneficios distintos según su plan, y necesita anotar seguimiento específico por cliente (nutrición particular, rutina día por día, etc.) sin que el código imponga una lista fija de conceptos. La solución es texto libre en ambos niveles: general (por categoría) e individual (por miembro).

**Regla de acceso, sin flag nuevo:**
La sección de seguimiento personalizado solo aparece si `beneficiosDeCategoria(categoriaMembresia del miembro).length > 0` — se reutiliza la misma señal de la Parte 1 en vez de agregar un campo booleano nuevo tipo "premium".

**Qué se verificó:**
- `node --check` sobre el script principal (sintaxis válida).
- `beneficiosDeCategoria` probado de forma aislada: categoría con beneficios, categoría con `beneficios:[]`, categoría antigua sin el campo (documentos creados antes de este cambio), categoría renombrada/borrada, y miembro sin categoría asignada — todos los casos devuelven `[]` sin excepción en vez de fallar.
- Revisión manual de que `agregarCategoriaMembresia`, `editarCategoriaMembresia`, `eliminarCategoriaMembresia` y `populateCategoriaMembresiaSelect` (alta/edición/borrado de categoría, asignación a miembro) siguen intactos — solo se añadió `beneficios:[]` al crear una categoría nueva.
- Revisión manual de que `saveMiembro`/`editMiembro` no cambiaron — `notasPlan` se administra únicamente desde el perfil (no desde el modal de alta/edición), y no se escribe al crear un miembro (se lee con fallback `m.notasPlan||[]` donde se usa, igual que `beneficios` en categorías).
- No se tocó `firestore.rules` (sin validación de esquema por campo) ni las funciones de exportar/importar Excel.
