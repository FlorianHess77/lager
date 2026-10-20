"""Rendert die App-Symbole aus tools/icon*.svg (python3 tools/render_icons.py)."""
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for src, out, size in [('icon.svg','icon-512.png',512),('icon.svg','icon-192.png',192),('icon-maskable.svg','icon-maskable-512.png',512)]:
            pg = await b.new_page(viewport={'width':size,'height':size})
            svg = open(os.path.join(ROOT,'tools',src)).read()
            await pg.set_content(f'<html><body style="margin:0;background:transparent">{svg.replace("<svg ", f"<svg width=\"{size}\" height=\"{size}\" ",1)}</body></html>')
            await pg.screenshot(path=os.path.join(ROOT,out), omit_background=True)
        await b.close()
asyncio.run(main())
