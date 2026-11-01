# Mis Planillas

App web instalable (PWA) para consultar desde el teléfono dos Excel personales:

- **Cuentas por cobrar**: quién te debe y a quién le debes, horas extra y horas compensatorias.
- **Descuentos**: qué descuentos hay hoy (o cualquier día), con filtros por tarjeta, zona, canal y categoría, y qué día conviene ir a un comercio.

El Excel sigue siendo la fuente de verdad: cada vez que cargas uno nuevo, la app reemplaza los datos de ese tipo.

## Privacidad

- Los Excel se leen **en el teléfono**. No hay servidor, base de datos remota ni analítica.
- Los datos quedan en IndexedDB del navegador. Al cargar un Excel se pide almacenamiento persistente.
- El sitio publicado declara una política de seguridad (`connect-src 'self'`) que impide enviar datos a otros servidores. Los tests revisan que el código no haga requests de red.
- Nunca se suben Excel al repositorio: `*.xlsx` y `privado/` están en `.gitignore`. Los tests usan Excel **sintéticos** generados por `scripts/make-fixtures.mjs`.

## Instalar en el teléfono

**iPhone (Safari):** abre la URL publicada → botón Compartir → **Agregar a inicio**. Después abre la app **desde el ícono** y carga los Excel en Ajustes.

> En iPhone, Safari y la app instalada guardan datos por separado. Carga los Excel desde la app instalada. Si el Excel te llegó por WhatsApp o correo, primero guárdalo en Archivos.

**Android (Chrome):** abre la URL → menú ⋮ → **Instalar app**.

Después de la primera carga funciona sin conexión.

## Actualizar los datos

Ajustes → **Cargar Excel** → elige uno o ambos archivos. La app detecta el tipo por las hojas y encabezados (no por el nombre del archivo) y muestra cuántas filas importó y las advertencias (filas incompletas, valores no reconocidos).

## Trabajo: agregar turnos y marcar pagos desde la app

En **Trabajo → Horas extra** puedes:

- **Agregar un turno** (fecha, horas, recargo, detalle, estado). El recargo se sugiere según el día (sábado y domingo, 50%) y el estado según la fecha (futuro, Programado).
- **Marcar como pagados** varios turnos de una vez: toca ☐ en cada uno → **Marcar pagados** → elige la liquidación (opcional).
- Tocar un turno permite cambiar su estado; si lo agregaste en la app, también editarlo o eliminarlo.

En **Compensatorias** también puedes agregar turnos.

Estos cambios se guardan en el teléfono **aparte del Excel**, así que no se pierden al cargar un Excel nuevo. Un aviso morado indica cuántos cambios faltan por pasar al Excel, con un botón para **copiar un resumen** y anotarlos allá. Cuando cargues un Excel que ya los incluya, la app los quita sola:

- Un turno agregado se considera anotado si en el Excel hay una fila del mismo mes, con las mismas horas y el mismo recargo, y cuya Fecha contiene el día.
- Un cambio de estado se considera anotado si la fila del Excel ya tiene ese estado.
- Si editaste la fila en el Excel y la app ya no la encuentra, te avisa para que revises y deshagas el cambio.

## Descuentos: categorías, subcategorías y sector

Bajo el buscador hay chips de **categoría** (🍽️ Restaurantes, 🛵 Delivery, 👕 Ropa…); al tocar una aparecen sus **subcategorías** (🍕 Pizzería, 🍣 Sushi y nikkei, 👟 Calzado…). Solo se muestran las que tienen descuento ese día, con su cantidad. En **Filtros** también están Categoría, Tipo / subcategoría y **Sector**. El buscador encuentra por comercio, comuna, sector o subcategoría ("pizza", "oriente").

Columnas opcionales que lee la app: `Tipo / subcategoría` (también acepta el nombre anterior `Tipo de restaurante`) y `Sector`. Los emojis se asignan por palabras clave (`src/lib/descuentos/emoji.ts`), así que valores nuevos reciben uno razonable (🏷️ si no calza ninguno).

La zona por defecto muestra todas las zonas menos "Regiones".

## Correr en local

Requiere Node 22.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests unitarios (genera los Excel sintéticos)
npm run build      # build de producción en dist/
npm run e2e        # prueba en Chromium a 375 px, con capturas en e2e-capturas/
```

`npm run e2e` necesita Playwright con Chromium instalado.

## Publicar (GitHub Pages)

1. Sube este repositorio a GitHub (rama `main`).
2. En el repo, ve a **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada push a `main` corre los tests, compila y publica en `https://<usuario>.github.io/<repo>/`.

El repositorio puede ser público porque no contiene datos. Si prefieres que sea privado, GitHub Pages pide un plan pagado; como alternativa gratuita puedes usar Cloudflare Pages (comando de build `npm run build`, carpeta `dist`).

Cuando publiques una versión nueva, la app se actualiza sola la próxima vez que la abras con conexión. En iPhone puede requerir cerrarla y volver a abrirla.

## Qué lee de cada Excel

### Cuentas por cobrar

| Hoja | Qué se usa |
|---|---|
| `Personal - Detalle` | Concepto, Persona, Dirección (`Me debe`/`Yo debo`), Monto (CLP), Pagado (`Sí`/`No`). Se ignoran Neto, clave y el bloque de resumen. |
| `Personal - Resumen` | Solo la lista de personas (columna A desde la fila 2 hasta la primera celda vacía). |
| `Trabajo - Horas extra <año>` | Parámetros (Valor hora ordinaria, Factor 25%, Factor 50%) y la tabla Mes/Fecha/Detalle/Horas/Recargo/Estado/Liquidación/Observaciones. |
| `Trabajo - Compensatorias <año>` | Fecha, Detalle, Horas trabajadas, Recargo, Horas ya tomadas, Observaciones. Si los parámetros son fórmulas, se toman de la hoja de horas extra del mismo año. |

### Descuentos

Solo la hoja `Por día` (incluidas las columnas opcionales `Tipo / subcategoría` y `Sector`). El mes del set sale del título en `Resumen!A1` (ej. "Descuentos de octubre 2026"). Si el mes no coincide con el actual, la app avisa.

Las celdas con relleno amarillo (`FFF2CC` o cualquier amarillo claro, incluso elegido desde la paleta de tema) en "Tarjetas que aplican" o "Verificación" marcan el descuento con ⚠︎.

### Reglas generales

- **No se confía en los valores cacheados de las fórmulas.** Todo se recalcula en la app: netos, montos de horas extra, horas generadas, saldos y el estado Realizada/Programada (con la fecha del teléfono).
- Los encabezados se buscan por texto, sin asumir una fila fija, y las columnas se mapean por nombre: puedes mover columnas o agregar otras.
- Las hojas con año se detectan por prefijo, así que funcionan en 2027 sin cambios.
- Las fechas se manejan como días calendario (sin hora) para evitar corrimientos con los cambios de horario de Chile.

## Si cambias la estructura del Excel

Si renombras una hoja o un encabezado, la carga mostrará qué esperaba y qué encontró. Para adaptarla:

1. Agrega el nuevo nombre a la lista de nombres aceptados de esa columna (`names` en `src/lib/cuentas/parse.ts` o `src/lib/descuentos/parse.ts`).
2. Agrega el caso a `scripts/make-fixtures.mjs` y un test.
3. `npm test` y push.

## Estructura

```
src/lib/xlsx/reader.ts       Lector .xlsx propio (fflate + XML): valores, fórmulas, rellenos, hipervínculos
src/lib/table.ts             Búsqueda de encabezados y parámetros por texto
src/lib/cuentas/             Parser y cálculos de cuentas, horas extra y compensatorias
src/lib/descuentos/          Parser, fechas específicas y filtros de descuentos
src/lib/importar.ts          Detección de tipo e importación
src/lib/storage.ts           IndexedDB
src/views/                   Pantallas (Descuentos, Personas, Trabajo, Ajustes)
scripts/make-fixtures.mjs    Excel sintéticos para tests
scripts/e2e.mjs              Prueba en navegador real
```

### Por qué un lector propio y no SheetJS

La especificación pedía SheetJS desde `cdn.sheetjs.com`. Se reemplazó por un lector mínimo (`src/lib/xlsx/reader.ts`, sobre `fflate`) por tres razones: la edición gratuita de SheetJS tiene soporte parcial de estilos y no resuelve los colores de tema con tinte (que es como Excel guarda el amarillo de la paleta); la versión de npm está desactualizada; y el CDN no estaba disponible en el entorno donde se construyó. El lector solo lee lo necesario y está cubierto por tests.
