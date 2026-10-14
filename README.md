<p align="center">
  <img src="design/icon-256.png" alt="AppKit icoon" width="96" height="96">
</p>

<h1 align="center">AppKit for Power Apps</h1>

<p align="center">
  Bewerk de schermen en controls van je Power Apps canvas apps als YAML vanuit één browserextensie.
</p>

Power Apps Studio laat de code van een scherm wel zien via **Code weergeven**, maar die editor is alleen-lezen. AppKit opent het scherm of de control die je in Studio hebt geselecteerd in een volledige YAML-editor. Daar bewerk je de code, zie je direct fouten en zet je het resultaat met één klik terug in Studio. De extensie werkt in Microsoft Edge en Chrome.

![De AppKit-editor met een scherm als YAML](design/store-screenshots/1-editor.png)

## Functies

### YAML-editor
Bewerk een volledig scherm of een losse control in een editor met syntaxkleuring, regelnummers en blokken die je kunt inklappen. Het structuurpaneel toont alle schermen, containers en controls met hun type. Klik op een naam om ernaartoe te springen. Vanuit de werkbalk kun je:

- **Opslaan in Studio**: de code terugzetten in Power Apps Studio, ook met Ctrl+S.
- **Kopiëren** en **Downloaden**: de code naar het klembord of als `.pa.yaml`-bestand.
- **Openen**: een eerder opgeslagen YAML-bestand laden.
- **Herstellen**: terug naar de code zoals die uit Studio kwam.

### Controle terwijl je typt
De editor controleert de code direct. Een fout in de YAML-structuur wordt rood gemarkeerd. Een eigenschap waarvan de formule niet met `=` begint en een naam die dubbel voorkomt krijgen een waarschuwing, want Studio weigert of hernoemt die bij het plakken. Klik onderin op het aantal problemen om naar het eerste probleem te springen.

![Waarschuwing bij een formule zonder =](design/store-screenshots/2-validation.png)

### Origineel vervangen in Studio
Met **Opslaan in Studio** en de keuze **Origineel vervangen** verwijdert AppKit in Studio het originele scherm of de originele control en plakt de nieuwe code op dezelfde plek. Alle namen blijven gelijk, dus verwijzingen in formules blijven werken. Weigert Studio de nieuwe code, dan zet AppKit het origineel automatisch terug. In Studio kun je het vervangen altijd ongedaan maken met Ctrl+Z. Kies **Als nieuw toevoegen** om de code als extra scherm of control te plakken.

![Melding na het vervangen van een scherm](design/store-screenshots/3-replace.png)

### Concepten en geschiedenis
Wijzigingen worden automatisch als concept bewaard. Sluit je het tabblad per ongeluk, dan staan ze de volgende keer weer klaar. Elke versie die je naar Studio opslaat komt in de geschiedenis, waar je de laatste 30 versies met één klik terugzet.

![Geschiedenis van opgeslagen versies](design/store-screenshots/4-history.png)

### Licht en donker, met de bekende sneltoetsen
Wissel met één klik tussen een licht en donker thema. Zoeken (Ctrl+F), vervangen (Ctrl+H), ga naar regel (Ctrl+G), commentaar aan of uit (Ctrl+/), regels verplaatsen (Alt+pijl) en dupliceren (Shift+Alt+pijl omlaag) werken zoals in andere code-editors.

![Donker thema met zoeken](design/store-screenshots/5-dark-mode.png)

## Gebruik
1. Open een canvas app in [Power Apps](https://make.powerapps.com) in bewerkmodus.
2. Selecteer in de structuurweergave het scherm of de control die je wilt bewerken.
3. Klik rechtsonder in Studio op **YAML bewerken**, druk op **Ctrl+Shift+Y** of klik op het AppKit-icoon in de werkbalk van je browser en kies **Selectie openen in editor**. Het icoon is alleen actief op Power Apps-pagina's.
4. De code opent in een nieuw tabblad. Pas de code aan en klik op **Opslaan in Studio**.

Lukt automatisch plakken niet, dan staat de code op het klembord en druk je in de structuurweergave zelf op **Ctrl+V**. Het laatste scherm van een app kan Studio niet verwijderen; voeg in dat geval tijdelijk een leeg scherm toe. Mislukt het vervangen, klik dan in de editor op **Diagnose kopiëren** en voeg de tekst toe aan een [issue](https://github.com/StanFV/Power-Apps-Tools/issues).

## Installeren
Totdat AppKit in Microsoft Edge Add-ons staat, installeer je de extensie zo:

1. Download of clone deze repository.
2. Ga in Edge naar `edge://extensions` of in Chrome naar `chrome://extensions`.
3. Zet de ontwikkelaarsmodus aan.
4. Kies "Uitgepakt laden" en selecteer de map `extension`.
5. Vernieuw een Power Apps-tabblad dat al open stond.

## Privacy
AppKit heeft geen eigen servers, maakt geen verbinding met internet en verzamelt geen gegevens. De code van je app wordt alleen in je browser verwerkt. Concepten en geschiedenis worden lokaal in de browser bewaard. Lees de volledige [privacyverklaring](PRIVACY.md).

## Projectstructuur

| Map of bestand | Inhoud |
| --- | --- |
| `extension/` | De extensie zelf, klaar om te laden of te zippen voor Edge Add-ons |
| `extension/src/background.js` | Herkent Power Apps-pagina's en koppelt editortabbladen aan Power Apps Studio |
| `extension/src/content/` | De knop in Studio en het ophalen, vervangen en plakken van YAML |
| `extension/editor/` | De editor met validatie, structuurpaneel en geschiedenis |
| `extension/vendor/` | CodeMirror 5 en js-yaml, met hun licentiebestanden |
| `design/` | Bronbestanden van het icoon (`icon.svg`, `icon-small.svg` voor 16 en 32px) en grote versies voor de store |
| `design/store-screenshots/` | Screenshots voor de store en deze README |

## Verantwoording
De editor gebruikt [CodeMirror 5](https://codemirror.net/5/) en [js-yaml](https://github.com/nodeca/js-yaml), beide onder de MIT-licentie.

AppKit is niet gelieerd aan of goedgekeurd door Microsoft. Power Apps is een handelsmerk van de Microsoft-groep.
