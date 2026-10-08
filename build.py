import pathlib, re
root = pathlib.Path(__file__).parent
src = root / 'src'
css = (src / 'styles.css').read_text()
engine = (src / 'engine.js').read_text()
seed = (src / 'seed.js').read_text()
store = (src / 'store.js').read_text()
app = '\n'.join((src / f).read_text() for f in ['app-core.js', 'app-pages.js', 'app-export.js', 'app-editors.js', 'app-people.js', 'app-settings.js'])
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora:wght@400;600&display=swap">'
JSZIP = '<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>'
SUPA = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>'

import json as _json
SETUP_SQL = (root / 'sql' / 'digbys-co-ltd-schema.sql').read_text() if (root / 'sql' / 'digbys-co-ltd-schema.sql').exists() else ''
def body(mode):
    scripts = [JSZIP] + ([SUPA] if mode == 'live' else [])
    if mode == 'live': scripts.append('<script>window.SETUP_SQL = ' + _json.dumps(SETUP_SQL).replace('</', '<\\/') + ';</script>')
    return f'''<div id="root"></div>
{''.join(scripts)}
<script>window.DIGBYS_MODE = "{mode}";</script>
<script>
{engine}
</script>
{'<script>' + seed + '</script>' if mode == 'demo' else ''}
<script>
{store}
</script>
<script>
{app}
</script>'''

title_live = "Digby's Accounts"
title_demo = "Digby's Accounts Demo"
full = lambda title, mode: f'''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex"><title>{title}</title>{FONTS}
<style>
{css}
</style></head><body>
{body(mode)}
</body></html>
'''
(root / 'index.html').write_text(full(title_live, 'live'))
(root / 'dist').mkdir(exist_ok=True)
# Artifact page: the publisher wraps it in its own document skeleton
(root / 'dist' / 'artifact-demo.html').write_text(f'''<title>{title_demo}</title>
{FONTS}
<style>
{css}
</style>
{body('demo')}
''')
print('built index.html')
