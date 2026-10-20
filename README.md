# Lager – Was liegt wo?

Dein Zuhause als Grundriss: Räume anlegen (Keller, Küche, Werkstatt …), darin Plätze (Regal, Kiste, Lade) und alles, was dort liegt – mit Fotos, Menge, Schlagworten und Notiz. Die Suche findet jedes Ding samt Ort, auch bei Tippfehlern, Umlauten oder Mehrzahl.

**App:** https://florianhess77.github.io/lager/

## Installieren
In Chrome öffnen → ⋮ → **App installieren**. Danach startet Lager vom Startbildschirm ohne Browserleiste und funktioniert offline.

## Funktionen
- Grundriss-Startseite mit allen Räumen (Farbe und Symbol frei wählbar, Reihenfolge unter *Mehr*)
- Plätze innerhalb eines Raums, umbenennen oder entfernen
- Fotos direkt in der App aufnehmen oder aus der Galerie (bis zu 6 pro Ding)
- Suche über Name, Schlagworte, Platz, Raum und Notiz – mit Spracheingabe
- Meldemenge: Dinge, die knapp werden, landen auf einem teilbaren Einkaufszettel
- Verleihen: merkt sich, wer was hat und seit wann
- Umräumen, Kopie anlegen, Inhaltsliste eines Raums teilen
- Backup als Datei speichern und wieder laden (Daten bleiben sonst nur am Gerät)
- Hell, Dunkel oder automatisch

## Technik
Reines HTML/CSS/JS ohne Build-Schritt. Daten in IndexedDB, Offline-Cache über `sw.js`. Bei Änderungen `APP_VER` in `app.js` hochzählen, damit Handys das Update bekommen.

Test: `python3 tests/smoke.py` (Playwright, legt Screenshots in `tests/_shots/` ab).
Symbole neu erzeugen: `python3 tools/render_icons.py`.
