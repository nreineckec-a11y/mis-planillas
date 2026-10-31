# Especificación — App "Mis Planillas" (PWA para iPhone/Android)

> Documento para Claude Code. Léelo completo antes de escribir código.

## 1. Objetivo
Web app móvil (PWA instalable en la pantalla de inicio) para **consultar** dos Excel personales de forma cómoda desde el teléfono. La fuente de verdad sigue siendo el Excel: cada vez que el usuario carga un Excel nuevo, la app reemplaza los datos de ese tipo.

## 2. Restricciones no negociables
- **Todo se procesa en el dispositivo.** Sin backend, sin base de datos remota, sin analítica, sin llamadas a APIs externas con los datos. El Excel se lee en el navegador.
- Persistencia local en **IndexedDB** (no localStorage: el archivo de descuentos tiene ~870 filas). Guardar también fecha de carga y nombre del archivo.
- **Nunca** commitear los Excel reales ni datos derivados. Carpeta `privado/` en `.gitignore`. Tests con fixtures **sintéticos** (nombres y montos inventados).
- Ningún nombre de persona, tarjeta, monto ni valor hora hardcodeado en el código: todo sale del Excel.
- Stack: Vite + React + TypeScript + Tailwind. Lectura de Excel con **SheetJS** instalado desde `https://cdn.sheetjs.com` (la versión `xlsx` de npm está desactualizada). PWA con `vite-plugin-pwa` (funciona offline).
- Idioma de la UI: español de Chile. Montos en CLP con formato `$275.000` (Intl `es-CL`, sin decimales). Porcentajes como `40%`.
- Diseño mobile-first (375 px), modo oscuro automático, botones ≥44 px, navegación por barra inferior.

## 3. Carga y detección automática de archivos
- Botón "Cargar Excel" (input file `.xlsx`) visible en Ajustes y en el estado vacío. Aceptar varios archivos a la vez.
- Detectar el tipo **por nombres de hoja y encabezados**, no por nombre de archivo:
  - **Cuentas**: contiene hojas que empiezan con `Personal - Detalle` y/o `Trabajo - `.
  - **Descuentos**: contiene la hoja `Por día` con encabezados `Día`, `% dcto.`, `Tarjeta`, `Comercio`.
  - Si no calza con ninguno: mensaje claro indicando qué hojas/encabezados esperaba.
- Ubicar la fila de encabezados **buscando el texto del encabezado** (no asumir fila fija), y mapear columnas **por nombre**, para tolerar columnas movidas o agregadas.
- Hojas con año en el nombre (`Trabajo - Horas extra 2026`): detectar por prefijo para que funcione con 2027.
- Tras cargar: resumen "X filas importadas, Y advertencias" con detalle de advertencias (filas incompletas, valores no reconocidos).
- Pantalla Ajustes: por cada tipo, mostrar archivo, fecha de carga, botón "Borrar datos".

## 4. Regla clave sobre fórmulas
**No confiar en los valores cacheados de las fórmulas.** Si el Excel se guardó con una herramienta que no recalcula, las celdas de fórmula vienen vacías; además `HOY()` queda congelado. La app debe **leer solo los datos de entrada y recalcular todo** con las reglas de abajo. Las hojas de resumen del Excel (`Personal - Resumen`, `Personal - Cobro`, hoja `Resumen` de descuentos) no se leen como datos, salvo la lista de personas.

## 5. Archivo "Cuentas por cobrar"

### 5.1 Hoja `Personal - Detalle` (encabezados en fila 1; columnas A–F)
Entradas: `Concepto`, `Persona`, `Dirección` (`Me debe` | `Yo debo`), `Monto (CLP)`, `Pagado` (`Sí` | `No`). Ignorar columnas `Neto`, `clave` y el bloque de resumen en I:J.
- Fila válida = tiene Monto.
- Neto = +Monto si `Me debe`, −Monto si `Yo debo`.
- Pendiente = Pagado ≠ `Sí` (vacío cuenta como pendiente, igual que el Excel).
- Advertencia: filas con monto pero sin Dirección o sin Pagado.
- Lista de personas: unión de `Personal - Resumen`!A2:A16 (no vacías) y las personas que aparecen en el detalle.

### 5.2 Vista "Personas"
- Encabezado con 3 cifras: **Me deben (pendiente)**, **Yo debo (pendiente)**, **Neto pendiente**. Más "Ya pagado (neto)" en texto pequeño.
- Lista de personas ordenada por |neto pendiente| desc, ocultando las que están en 0 (toggle "mostrar todas"). Cada fila: nombre, neto (verde si me deben, rojo si yo debo), n° ítems pendientes.
- Al tocar una persona: ítems pendientes (concepto, monto con signo) + total, y debajo ítems ya pagados colapsados. Botón **"Copiar cobro"** que copia al portapapeles un texto listo para WhatsApp:
  ```
  Hola <Persona>, te dejo el detalle pendiente:
  • Computador: $275.000
  • ...
  Total: $X
  ```
  (Si el neto es negativo, redactar como "Te debo".)

### 5.3 Hoja `Trabajo - Horas extra <año>`
- Parámetros (columna A etiqueta → columna B valor): `Valor hora ordinaria`, `Factor 25%`, `Factor 50%`. Buscar por etiqueta.
- Tabla con encabezados `Mes | Fecha | Detalle | Horas | Recargo | Valor hora | Monto bruto estimado | Estado | Liquidación en que se pagó | Observaciones`.
- Recalcular: valor hora = valor ordinario × factor según Recargo (`25%`/`50%`); monto = horas × valor hora.
- `Fecha` es **texto libre** (ej. "14.05 y 15.05") → mostrar tal cual; agrupar por `Mes`.
- Vista: tarjetas resumen por Estado (`Pagado`, `No pagado`, `Programado`) con horas y monto; lista agrupada por mes con chip de estado de color. Filtro por estado.

### 5.4 Hoja `Trabajo - Compensatorias <año>`
- Parámetros `Factor 25% (semana)`, `Factor 50% (fds/feriado)`, `Valor hora ordinaria` (en el Excel son fórmulas que apuntan a la hoja de horas extra → si vienen vacíos, tomarlos de 5.3).
- Tabla: `Mes | Fecha | Día | Detalle | Horas trabajadas | Recargo | Factor | Horas compensatorias generadas | Estado | Horas ya tomadas | Saldo a favor | Observaciones`. Entradas reales: Fecha (fecha Excel), Detalle, Horas trabajadas, Recargo, Horas ya tomadas, Observaciones.
- Recalcular: Mes y Día desde la fecha; factor según recargo; generadas = horas × factor; **Estado = "Realizada" si fecha ≤ hoy, si no "Programada"** (usando la fecha actual del teléfono); saldo = generadas − tomadas; equivalente $ = saldo × valor hora ordinaria.
- Vista: resumen "Realizadas / Programadas / Total año" (horas trabajadas, generadas, tomadas, saldo, equivalente $); destacar **saldo a favor actual** como cifra principal; lista cronológica con próximas programadas arriba.

## 6. Archivo "Descuentos"

### 6.1 Datos
Leer **solo la hoja `Por día`** (las hojas por tarjeta son duplicados; la hoja `Resumen` son fórmulas). Columnas: `Día | Fecha específica | % dcto. | Monto fijo | Tope ($) | Tipo de tope | Tarjeta | Comercio | Categoría | Comuna / región | Zona | Canal | Tarjetas que aplican | Vigencia | Condiciones | Verificación | Fuente`.
- `% dcto.` viene como fracción (0.4 → 40%). Puede venir vacío si hay `Monto fijo`.
- `Día` ∈ {Lunes…Domingo, `Todos los días`, `Fechas específicas`}. Un mismo descuento puede repetirse en varias filas (una por día).
- `Fuente` es un **hipervínculo** (texto "Ver ficha"): extraer la URL (`cell.l.Target` en SheetJS) y abrirla en pestaña nueva.
- Celdas con relleno amarillo (`FFF2CC`) en `Tarjetas que aplican` o `Verificación` = dato no verificado → leer estilos (`cellStyles: true`) y marcar la fila con un ícono ⚠︎ "Verificar en la ficha".
- Título del archivo (hoja `Resumen`!A1, ej. "Descuentos de octubre 2026") → mes/año del set. Si no coincide con el mes actual, banner: "Estos descuentos son de <mes>; carga el Excel nuevo".
- Categorías: hay ~80 valores distintos (ej. "Restaurante – Sabores 40% Visa"). Agrupar por el texto antes de " – " para el filtro.

### 6.2 Vista "Hoy" (pantalla de inicio de la app)
- Por defecto: descuentos del día de la semana actual + `Todos los días` + `Fechas específicas` cuyo texto incluya la fecha de hoy (intentar parsear formatos como "05 al 11 oct" y "06, 13, 20 y 27 oct"; si no se puede parsear, mostrarlo en una sección aparte "Fechas específicas — revisar").
- Selector de día (chips L M M J V S D) para mirar otro día.
- Filtros (hoja inferior desplegable): tarjeta (multiselección, recordar última elección), zona (`RM / online` por defecto), canal, categoría agrupada.
- Buscador por comercio o comuna (sin distinguir tildes ni mayúsculas).
- Orden: % desc, luego tope desc.
- Tarjeta de cada descuento: comercio (grande), % o monto fijo destacado, chip de color por tarjeta bancaria, comuna, tope + tipo de tope, ⚠︎ si no verificado. Al tocar: condiciones, tarjetas que aplican, vigencia, canal y botón "Ver ficha".

### 6.3 Vista "Buscar comercio"
Búsqueda libre en todo el mes → muestra para ese comercio qué días y con qué tarjeta conviene (tabla compacta día × tarjeta con el mejor %).

## 7. Navegación
Barra inferior con 4 pestañas: **Descuentos** (inicio) · **Personas** · **Trabajo** (subpestañas Horas extra / Compensatorias) · **Ajustes** (carga de archivos).
Si un tipo de datos no está cargado, la pestaña muestra estado vacío con botón "Cargar Excel".

## 8. Calidad
- Tests unitarios (Vitest) de los parsers y de los cálculos con fixtures sintéticos generados por script (no copiar los Excel reales).
- Test de que la app no hace ninguna request de red con datos (revisar que no existan `fetch` fuera del service worker).
- Lighthouse PWA instalable; funciona en modo avión tras la primera carga.
- README con: cómo correr en local, cómo publicar, cómo instalar en iPhone ("Compartir → Agregar a inicio").
