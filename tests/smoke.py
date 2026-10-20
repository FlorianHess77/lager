"""Durchklick-Test am Handyformat mit Screenshots (python3 tests/smoke.py)."""
import asyncio, os, sys, threading, http.server, socketserver, functools
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('SHOTS', os.path.join(ROOT, 'tests', '_shots')); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT)); srv.daemon_threads = True
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}/'
errors = []
def check(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: errors.append(msg)

async def run(theme):
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True,
                                  locale='de-AT', color_scheme=theme)
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errors.append(f'{theme}: JS-Fehler {e}'))
        pg.on('console', lambda m: m.type == 'error' and 'fonts.g' not in (m.location.get('url') or '') and errors.append(f'{theme}: console {m.text} {m.location.get("url")}'))
        await pg.goto(BASE); await pg.wait_for_timeout(600)
        shot = lambda n: pg.screenshot(path=f'{OUT}/{theme}-{n}.png', full_page=True)
        await shot('01-welcome')
        await pg.click('[data-n="Garage"]'); await pg.click('[data-n="Bad"]'); await pg.click('[data-n="Wohnzimmer"]')
        await pg.click('[data-a="createStarter"]'); await pg.wait_for_timeout(300)
        check(await pg.locator('.kc').count() == 6, f'{theme}: 6 Raumkarten')
        # Ding mit Foto einräumen
        items = [('Keller', 'Regal links', 'Akkuschrauber Bosch', 1, 'Werkzeug, Akku'), ('Keller', 'Regal links', 'Weihnachtsdeko', 3, 'Kisten'),
                 ('Keller', 'Weinregal', 'Rotwein Zweigelt', 6, ''), ('Werkstatt', 'Wand', 'Schraubenzieher-Set', 1, 'Werkzeug'),
                 ('Werkstatt', 'Lade 2', 'Schrauben 4x40', 2, ''), ('Küche', 'Speis', 'Nudeln', 1, ''), ('Garage', '', 'Winterreifen', 4, 'Auto')]
        for i, (room, place, name, qty, tags) in enumerate(items):
            await pg.goto(BASE + '#/'); await pg.wait_for_timeout(150)
            await pg.click('.nav-add'); await pg.wait_for_timeout(200)
            await pg.fill('#fName', name)
            await pg.click(f'#fRooms .chip:has-text("{room}")')
            await pg.fill('#fPlace', place)
            await pg.fill('#fQty', str(qty))
            await pg.fill('#fTags', tags)
            if i in (0, 3):
                await pg.set_input_files('#filePick', os.path.join(ROOT, 'tests', 'sample.jpg')); await pg.wait_for_timeout(500)
                check(await pg.locator('#fPhotos .pt').count() == 1, f'{theme}: Foto im Formular')
                if i == 0: await shot('03-form')
            if name == 'Nudeln': await pg.fill('#fMin', '2')
            await pg.click('button[type=submit]'); await pg.wait_for_timeout(250)
        check(len(await pg.evaluate("S.items")) == 7, f'{theme}: 7 Dinge gespeichert')
        await pg.goto(BASE + '#/'); await pg.wait_for_timeout(400)
        await shot('02-home')
        await pg.click('.kc:has-text("Keller")'); await pg.wait_for_timeout(300)
        await shot('04-room')
        check(await pg.locator('.shelf').count() == 2, f'{theme}: Keller hat 2 Plätze')
        await pg.click('.it:has-text("Akkuschrauber")'); await pg.wait_for_timeout(400)
        await shot('05-item')
        # Suche mit Tippfehler / Mehrzahl / Umlaut
        for q, want in [('schraube', 'Schraubenzieher-Set'), ('akuschrauber', 'Akkuschrauber Bosch'), ('nudel', 'Nudeln'), ('werkzeug', 'Schraubenzieher-Set'), ('kuche', 'Nudeln'), ('winterreifen garage', 'Winterreifen')]:
            res = await pg.evaluate(f"search({q!r}).map(x=>x.it.name)")
            check(want in res, f'{theme}: Suche „{q}“ findet {want} ({res[:3]})')
        await pg.goto(BASE + '#/search'); await pg.wait_for_timeout(200)
        await pg.fill('#sq', 'schrauben'); await pg.wait_for_timeout(200)
        await shot('06-search')
        await pg.goto(BASE + '#/lists/low'); await pg.wait_for_timeout(200)
        check(await pg.locator('.it:has-text("Nudeln")').count() == 1, f'{theme}: Nudeln stehen auf „Wird knapp“')
        await pg.goto(BASE + '#/more'); await pg.wait_for_timeout(200); await shot('07-more')
        await pg.goto(BASE + '#/'); await pg.wait_for_timeout(200); await pg.click('.annex'); await pg.wait_for_timeout(400); await shot('08-newroom')
        # Zurück-Taste schließt das Sheet, ohne die Seite zu verlassen
        await pg.go_back(); await pg.wait_for_timeout(300)
        check(await pg.locator('#sheet').is_hidden() and await pg.locator('.kk').count() == 1, f'{theme}: Zurück schließt Sheet')
        # Löschen + Rückgängig
        nid = await pg.evaluate("S.items.find(i=>i.name==='Nudeln').id")
        await pg.goto(BASE + '#/room/' + await pg.evaluate("S.items.find(i=>i.name==='Nudeln').roomId")); await pg.wait_for_timeout(200)
        await pg.goto(BASE + '#/item/' + nid); await pg.wait_for_timeout(200)
        await pg.click('[data-a="delItem"]'); await pg.wait_for_timeout(300)
        check(await pg.evaluate(f"!itemById('{nid}')"), f'{theme}: Ding gelöscht')
        await pg.click('#toast button'); await pg.wait_for_timeout(300)
        check(await pg.evaluate(f"!!itemById('{nid}')"), f'{theme}: Rückgängig holt es zurück')
        # Entwurf übersteht Neuladen (Android beendet die App beim Fotografieren)
        await pg.goto(BASE + '#/'); await pg.wait_for_timeout(150); await pg.click('.nav-add'); await pg.wait_for_timeout(200)
        await pg.fill('#fName', 'Halbfertig'); await pg.reload(); await pg.wait_for_timeout(500)
        check(await pg.input_value('#fName') == 'Halbfertig', f'{theme}: Entwurf nach Neuladen noch da')
        await pg.click('[data-a="cancelEdit"]'); await pg.wait_for_timeout(300)
        check(await pg.evaluate("localStorage.getItem('lager.draft')") is None, f'{theme}: Abbrechen verwirft Entwurf')
        await b.close()

asyncio.run(run(sys.argv[1] if len(sys.argv) > 1 else 'light'))
if len(sys.argv) <= 1: asyncio.run(run('dark'))
print('\n' + ('ALLES OK' if not errors else 'FEHLER:\n' + '\n'.join(errors)))
sys.exit(1 if errors else 0)
