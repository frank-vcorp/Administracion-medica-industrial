import re, os, json

mods = ['empresas','medicos','pacientes','servicios','descuentos','usuarios','firmas','lugares_proceso',
        'departamentos','recipientes','muestras','metodologias','indicaciones','valores_referencia',
        'unidades','clasificaciones','respuestas_rapidas','tipos_cargos','bacterias']

catalogs = {}
for m in mods:
    fname = f'pages/cat_{m}.html'
    if not os.path.exists(fname):
        continue
    with open(fname, encoding='utf-8') as f:
        html = f.read()

    # Fields (form inputs) - robust regex
    pattern = r'<input[^>]+name=["\']([^"\']+)["\'][^>]*>'
    inputs = re.findall(pattern, html)
    inputs_unique = list(dict.fromkeys(inputs))[:25]

    # Selects + options
    selects = []
    sel_pattern = r'<select[^>]*name=["\']([^"\']+)["\'][^>]*>(.*?)</select>'
    for sel_match in re.finditer(sel_pattern, html, re.DOTALL):
        sel_name = sel_match.group(1)
        sel_body = sel_match.group(2)
        opt_pattern = r'<option[^>]*>([^<]+)</option>'
        opts = re.findall(opt_pattern, sel_body)
        if opts:
            selects.append({'name': sel_name, 'options_sample': [o.strip() for o in opts[:5]]})

    # Headings
    headings = []
    for h in re.findall(r'<h[1-5][^>]*>(.*?)</h[1-5]>', html, re.DOTALL):
        t = re.sub(r'<[^>]+>', '', h).strip()
        if t and len(t) < 100:
            headings.append(t)

    # Buttons
    buttons = []
    for b in re.findall(r'<button[^>]*>(.*?)</button>', html, re.DOTALL):
        t = re.sub(r'<[^>]+>', ' ', b).strip()
        if t and len(t) < 50 and t not in buttons:
            buttons.append(t)

    # Textareas (rich text for notas)
    textareas = re.findall(r'<textarea[^>]*name=["\']([^"\']+)["\'][^>]*>', html)

    catalogs[m] = {
        'inputs': inputs_unique,
        'selects': selects[:10],
        'headings': headings[:5],
        'buttons': list(dict.fromkeys(buttons))[:15],
        'textareas': list(dict.fromkeys(textareas))[:10],
    }

with open('catalog-meta.json', 'w', encoding='utf-8') as f:
    json.dump(catalogs, f, indent=2, ensure_ascii=False, default=str)

print(f"Catalogs mapped: {len(catalogs)}")
print("\n--- RESUMEN ---")
for m, c in catalogs.items():
    print(f"\n[{m.upper()}]")
    print(f"  Inputs:   {c['inputs'][:8]}")
    print(f"  Selects:  {[s['name'] for s in c['selects']][:5]}")
    print(f"  Headings: {c['headings'][:3]}")
