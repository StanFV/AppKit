# Power Apps Tools: YAML Editor

Browserextensie (Chrome en Edge, Manifest V3) waarmee je de YAML-code van schermen en controls in een Power Apps canvas app bewerkt in een volwaardige editor. Power Apps Studio kan de code wel tonen via **Code weergeven**, maar die editor is alleen-lezen. Deze extensie opent de code in een nieuw tabblad waar je wel kunt bewerken en zet het resultaat met één klik terug in Studio.

Het idee is vergelijkbaar met [Power Automate Tools](https://chromewebstore.google.com/detail/power-automate-tools/jccblbmcghkddifenlocnjfmeemjeacc), maar dan voor canvas apps.

## Functies

De editor is gebouwd op CodeMirror en biedt YAML-syntaxkleuring, regelnummers, inklappen van blokken, zoeken en vervangen, ga naar regel, commentaar aan/uit, regels verplaatsen (Alt+pijl) en dupliceren (Shift+Alt+pijl omlaag). Een structuurpaneel toont alle schermen en controls met hun type; klik op een naam om ernaartoe te springen.

Tijdens het typen controleert de editor de code. Syntaxfouten in de YAML worden als fout gemarkeerd. Eigenschappen waarvan de formule niet met `=` begint en namen die dubbel voorkomen krijgen een waarschuwing, want Studio weigert of hernoemt die bij het plakken.

Wijzigingen worden automatisch als concept bewaard in de browser, zodat je niets kwijtraakt als je het tabblad per ongeluk sluit. Elke versie die je naar Studio opslaat komt in de geschiedenis (laatste 30 versies). Je kunt de code ook downloaden als `.pa.yaml`, een bestand openen of terugzetten naar de oorspronkelijke versie uit Studio. Er is een licht en donker thema.

## Installeren

1. Download of kloon deze repository.
2. Ga in Chrome naar `chrome://extensions` of in Edge naar `edge://extensions`.
3. Zet **Ontwikkelaarsmodus** aan.
4. Klik op **Uitgepakte extensie laden** en kies de map van deze repository.
5. Vernieuw een Power Apps Studio tabblad dat al open stond.

## Gebruik

1. Open een canvas app in Power Apps Studio.
2. Selecteer in de structuurweergave het scherm of de control die je wilt bewerken.
3. Klik rechtsonder op de knop **YAML bewerken** of druk op **Ctrl+Shift+Y**. De code opent in een nieuw tabblad naast Studio.
4. Pas de code aan en klik op **Opslaan in Studio** (of **Ctrl+S**).

Bij opslaan zet de extensie de code op het klembord, schakelt terug naar het Studio tabblad en plakt de code daar. Lukt automatisch plakken niet, dan staat de code klaar op het klembord en druk je zelf op **Ctrl+V** in de structuurweergave.

Met de keuzelijst naast de opslaanknop kies je wat er moet gebeuren:

* **Origineel vervangen**: na het plakken staat de nieuwe versie naast het origineel (Studio voegt `_1` toe aan de naam). Verwijder het origineel en geef de nieuwe versie de oorspronkelijke naam.
* **Als nieuw toevoegen**: de code wordt als extra scherm of control geplakt.

Werkt het ophalen van de selectie niet, open dan in Studio **Code weergeven** en klik op **Code kopiëren**. Klik daarna op **YAML bewerken**; de extensie gebruikt dan de zojuist gekopieerde code. Via het extensie-icoon kun je ook een lege editor openen en zelf YAML plakken.

## Hoe het werkt (en de beperking)

Power Apps Studio heeft geen openbare API om de code van een bestaand scherm te overschrijven. De enige ondersteunde manier om YAML in een app te krijgen is **Code plakken**, wat nieuwe controls aanmaakt. Deze extensie gebruikt daarom dezelfde route als jij handmatig zou doen, maar dan geautomatiseerd:

* **Ophalen**: de extensie leest de code uit een geopend venster **Code weergeven**, klikt op **Code kopiëren** of stuurt een kopieeropdracht naar de geselecteerde control. Een klein script in de pagina vangt de YAML op op het moment dat Studio die naar het klembord schrijft.
* **Opslaan**: de bewerkte YAML gaat naar het klembord en wordt als plakactie naar Studio gestuurd.

Dat betekent dat het origineel niet automatisch wordt vervangen. Verwijderen en hernoemen doe je zelf in Studio, zodat de extensie nooit zonder jouw controle iets uit je app weghaalt.

Omdat de extensie meelift op de interface van Studio, kan een update van Power Apps het ophalen of plakken beïnvloeden. De terugvalroute via het klembord blijft altijd werken.

## Projectstructuur

```
manifest.json              Extensieconfiguratie (MV3)
src/background.js          Service worker: koppelt editortabbladen aan het Studio tabblad
src/content/studio.js      Content script in Studio: knop, ophalen en plakken
src/content/page-bridge.js Script in de pagina zelf: leest Monaco en vangt klembordschrijfacties op
src/yaml-tools.js          Structuur en validatie van Power Apps YAML
editor/                    Het editortabblad
popup/                     Popup van het extensie-icoon
vendor/                    CodeMirror 5 en js-yaml (MIT)
test/                      Unit tests voor yaml-tools
```

## Ontwikkelen

Er is geen buildstap nodig. Na een wijziging klik je op `chrome://extensions` op het vernieuwicoon van de extensie en vernieuw je het Studio tabblad.

Tests draaien met Node 18 of hoger:

```
npm test
```

Andere Power Platform clouds (zoals GCC) voeg je toe door de bijbehorende domeinen op te nemen in `host_permissions` en `content_scripts` in `manifest.json` en de reguliere expressie `IS_STUDIO_FRAME` in `src/content/studio.js` aan te passen.

## Licenties

CodeMirror en js-yaml vallen onder de MIT-licentie; de licentiebestanden staan in `vendor/`.
