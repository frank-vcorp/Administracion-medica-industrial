import re

files = {
    'estudios': 'pages/cat_estudio_estudios.html',
    'elementos': 'pages/cat_estudio_elementos.html',
    'perfiles': 'pages/cat_estudio_perfiles.html',
    'cultivos': 'pages/cat_estudio_cultivos.html',
    'antibiogramas': 'pages/cat_estudio_antibiogramas.html',
    'precios_pruebas': 'pages/op_precios_pruebas.html',
    'paquetes': 'pages/op_paquetes.html',
    'ajustes': 'pages/op_ajustes.html',
    'trazabilidad': 'pages/op_trazabilidad.html',
    'bitacora_resultados': 'pages/op_bitacora_resultados.html',
    'ordenes_canceladas': 'pages/op_ordenes_canceladas.html',
    'formulas': 'pages/op_formulas.html',
    'respuestas_predefinidas': 'pages/op_respuestas_predefinidas.html',
    'tesoreria': 'pages/extra_tesoreria.html',
    'cortesias': 'pages/extra_cortesias.html',
    'corte_caja': 'pages/extra_corte_caja.html',
    'facturacion': 'pages/extra_facturacion.html',
    'notificaciones': 'pages/extra_notificaciones.html',
    'modificar_folio': 'pages/extra_modificar_folio.html',
    'reimpresion_resultados': 'pages/op_reimpresion_resultados.html',
    'reimpresion_etiquetas': 'pages/op_reimpresion_etiquetas.html',
    'reimpresion_recibos': 'pages/op_reimpresion_recibos.html',
}

for label, path in files.items():
    try:
        with open(path, encoding='utf-8') as f:
            html = f.read()
    except:
        continue

    body_start = html.find('<body')
    body = html[body_start:] if body_start > 0 else html

    inp = list(dict.fromkeys(re.findall(r'<input[^>]+name="([^"]+)"', body)))

    btns = list(dict.fromkeys([re.sub(r'<[^>]+>',' ',b).strip()[:60] for b in re.findall(r'<button[^>]*>(.*?)</button>', body, re.DOTALL)]))
    btns = [b for b in btns if b and len(b) < 50]

    heads = list(dict.fromkeys([re.sub(r'<[^>]+>',' ',h).strip()[:80] for h in re.findall(r'<h[1-5][^>]*>(.*?)</h[1-5]>', body, re.DOTALL)]))
    heads = [h for h in heads if h and len(h) < 80]

    # Tabs by data-toggle or by anchors to #
    tabs = []
    for m in re.finditer(r'data-toggle="tab"[^>]*>(?:<[^>]+>)*([^<]+)<', body):
        t = m.group(1).strip()
        if t and t not in tabs: tabs.append(t)
    if not tabs:
        for m in re.finditer(r'<a[^>]+href="#([^"]+)"[^>]*>(?:<[^>]+>)*([^<]+)</a>', body):
            t = m.group(2).strip()
            if t and t not in tabs and len(t) < 60: tabs.append(t)

    print(f"\n========== {label.upper()} ==========")
    if heads:
        print(f"  Headings: {heads[:6]}")
    if tabs:
        print(f"  Tabs: {tabs[:10]}")
    print(f"  Inputs: {inp[:18]}")
    print(f"  Buttons: {btns[:12]}")
