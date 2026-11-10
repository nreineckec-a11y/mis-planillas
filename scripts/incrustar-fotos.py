#!/usr/bin/env python3
"""Incrusta en el Excel de descuentos las fotos cuyos enlaces vienen en la columna «Foto».

Uso:
    python3 scripts/incrustar-fotos.py ENTRADA.xlsx [SALIDA.xlsx]

- Lee la hoja «Por día»; en cada fila con un enlace https en «Foto», descarga la imagen,
  la reduce a 360 px de ancho (JPEG) y la inserta anclada a esa celda. La app la lee del
  archivo: se ve sin conexión y no depende de que el sitio del banco permita mostrarla.
- Si una foto no se puede descargar, deja el enlace (la app intentará abrirlo igual).
- La misma foto se descarga una sola vez aunque se repita en varias filas.
- No toca las demás hojas ni columnas. SALIDA por defecto: ENTRADA_con_fotos.xlsx.

Requiere: pip install openpyxl pillow
"""
import hashlib
import http.cookiejar
import io
import os
import sys
import time
import urllib.request
from collections import Counter, defaultdict
from urllib.parse import urlparse

try:
    import openpyxl
    from openpyxl.drawing.image import Image as XLImage
    from openpyxl.utils import get_column_letter
    from PIL import Image
except ImportError:
    sys.exit('Faltan dependencias: pip install openpyxl pillow')

ANCHO = 360
CALIDAD = 72

entrada = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
salida = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(entrada)[0] + '_con_fotos.xlsx'
cache = os.path.join(os.path.dirname(os.path.abspath(salida)), '.cache-fotos')
os.makedirs(cache, exist_ok=True)

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
opener.addheaders = [
    ('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1'),
    ('Accept', 'image/avif,image/webp,image/*,*/*;q=0.8'),
]


def descargar(url):
    """Bytes de la imagen o None. Reintenta (algunos sitios piden una cookie en la primera visita)."""
    ruta = os.path.join(cache, hashlib.sha1(url.encode()).hexdigest())
    if os.path.exists(ruta):
        return open(ruta, 'rb').read()
    for intento in range(4):
        try:
            with opener.open(url, timeout=30) as r:
                datos = r.read()
                if r.headers.get_content_type().startswith('image/') and datos:
                    open(ruta, 'wb').write(datos)
                    return datos
        except Exception:
            pass
        time.sleep(1 + intento)
    return None


def reducir(datos):
    im = Image.open(io.BytesIO(datos))
    im = im.convert('RGB')
    if im.width > ANCHO:
        im = im.resize((ANCHO, round(im.height * ANCHO / im.width)), Image.LANCZOS)
    out = io.BytesIO()
    im.save(out, 'JPEG', quality=CALIDAD, optimize=True, progressive=True)
    return out.getvalue()


wb = openpyxl.load_workbook(entrada)
if 'Por día' not in wb.sheetnames:
    sys.exit('No encontré la hoja «Por día».')
ws = wb['Por día']

# Encabezados: se buscan por texto en las primeras filas.
fila_enc, cols = None, {}
for r in range(1, 11):
    valores = [str(c.value or '').strip().lower() for c in ws[r]]
    if 'foto' in valores and 'comercio' in valores:
        fila_enc = r
        cols = {v: i + 1 for i, v in enumerate(valores) if v}
        break
if not fila_enc:
    sys.exit('No encontré las columnas «Foto» y «Comercio» en «Por día».')
c_foto, c_tarjeta = cols['foto'], cols.get('tarjeta')
letra = get_column_letter(c_foto)

reducidas, por_tarjeta, sin_foto, fallidas = {}, defaultdict(Counter), set(), Counter()
for r in range(fila_enc + 1, ws.max_row + 1):
    url = str(ws.cell(r, c_foto).value or '').strip()
    tarjeta = str(ws.cell(r, c_tarjeta).value or '') if c_tarjeta else ''
    if not ws.cell(r, cols['comercio']).value:
        continue
    if not url.startswith('https://'):
        por_tarjeta[tarjeta]['sin enlace'] += 1
        continue
    if url not in reducidas:
        datos = descargar(url)
        try:
            reducidas[url] = reducir(datos) if datos else None
        except Exception:
            reducidas[url] = None
        if reducidas[url] is None:
            fallidas[urlparse(url).netloc] += 1
    if not reducidas[url]:
        por_tarjeta[tarjeta]['no se pudo descargar'] += 1
        continue
    img = XLImage(io.BytesIO(reducidas[url]))
    img.width, img.height = 36, 20  # tamaño visible en Excel; la imagen guardada es de 360 px
    ws.add_image(img, f'{letra}{r}')
    por_tarjeta[tarjeta]['incrustada'] += 1

ws.column_dimensions[letra].width = max(ws.column_dimensions[letra].width or 0, 9)
wb.save(salida)

print(f'Listo: {salida} ({os.path.getsize(salida) / 1048576:.1f} MB)')
print(f'Fotos distintas incrustadas: {sum(1 for v in reducidas.values() if v)}')
for tarjeta, c in sorted(por_tarjeta.items()):
    print(f'  {tarjeta or "(sin tarjeta)"}: ' + ', '.join(f'{k} {v}' for k, v in c.most_common()))
if fallidas:
    print('Sitios desde los que no se pudo descargar (filas): ' + ', '.join(f'{h} {n}' for h, n in fallidas.most_common()))
    print('  Esas filas conservan el enlace; si el entorno bloquea esos sitios, agrégalos a la red permitida y vuelve a correrlo.')
