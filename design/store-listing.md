# Store listing: AppKit for Power Apps

Teksten en antwoorden voor het indienen bij de [Chrome Web Store](https://chrome.google.com/webstore/devconsole) en [Microsoft Edge Add-ons](https://partner.microsoft.com/dashboard/microsoftedge). Het pakket maak je met `npm run package` (`dist/appkit-<versie>.zip`).

## Basisgegevens

| Veld | Waarde |
| --- | --- |
| Naam | AppKit for Power Apps |
| Categorie | Developer Tools (Chrome) / Developer tools (Edge) |
| Taal | Nederlands (de interface is Nederlandstalig) |
| Icoon | `design/icon-512.png` (store), `extension/icons/icon128.png` (pakket) |
| Screenshots | `design/store-screenshots/1-editor.png` t/m `5-donker.png` (1280×800) |
| Privacybeleid | https://github.com/StanFV/Power-Apps-Tools/blob/main/PRIVACY.md |
| Ondersteuning | https://github.com/StanFV/Power-Apps-Tools/issues |

## Korte beschrijving (max. 132 tekens)

Engels (staat ook in `manifest.json`):

> Edit Power Apps canvas screens and controls as YAML: full editor, validation, outline and one-click replace in Studio.

Nederlands:

> Bewerk schermen en controls van Power Apps canvas apps als YAML, met validatie, structuurpaneel en vervangen in Studio.

## Uitgebreide beschrijving

### Nederlands

Power Apps Studio laat de code van een scherm zien via Code weergeven, maar die editor is alleen-lezen. AppKit opent de code van het geselecteerde scherm of de geselecteerde control in een nieuw tabblad waar je wel kunt bewerken. Met één klik zet je het resultaat terug in Studio.

Functies:
- Editor met syntaxkleuring, regelnummers, inklappen, zoeken en vervangen
- Structuurpaneel met alle schermen, containers en controls
- Controle terwijl je typt: YAML-fouten, formules zonder = en dubbele namen
- Origineel vervangen in Studio met dezelfde namen; mislukt het, dan komt het origineel terug
- Automatische concepten en een geschiedenis van de laatste 30 opgeslagen versies
- Downloaden als .pa.yaml, licht en donker thema

Openen kan met de knop YAML bewerken in Studio, met Ctrl+Shift+Y of via het AppKit-icoon, dat alleen actief is op Power Apps-pagina's.

AppKit heeft geen servers, maakt geen verbinding met internet en verzamelt geen gegevens.

AppKit is niet gelieerd aan of goedgekeurd door Microsoft. Power Apps is een handelsmerk van de Microsoft-groep.

### English

Power Apps Studio shows the code of a screen in View code, but that editor is read-only. AppKit opens the code of the selected screen or control in a new tab where you can edit it, and puts the result back in Studio with one click.

Features:
- Editor with syntax highlighting, line numbers, folding, search and replace
- Outline of all screens, containers and controls
- Checks while you type: YAML errors, formulas without = and duplicate names
- Replace the original in Studio with the same names; if it fails, the original is restored
- Automatic drafts and a history of the last 30 saved versions
- Download as .pa.yaml, light and dark theme

Open the editor with the Edit YAML button in Studio, with Ctrl+Shift+Y or from the AppKit icon, which is only active on Power Apps pages. The interface is in Dutch.

AppKit has no servers, makes no network requests and collects no data.

AppKit is not affiliated with or endorsed by Microsoft. Power Apps is a trademark of the Microsoft group of companies.

## Single purpose

> Edit the YAML code of screens and controls in Power Apps canvas apps in a full editor and put the edited code back in Power Apps Studio.

## Toelichting op de permissies

| Permissie | Toelichting (Engels, voor het formulier) |
| --- | --- |
| `storage` | Stores drafts, the last 30 saved versions and user settings locally, and links each editor tab to the Studio tab it came from (session storage). |
| `clipboardRead` | Power Apps Studio only exposes the code of a screen or control through its Copy code function. When the selection cannot be read directly, the editor reads the code the user just copied from the clipboard. |
| `clipboardWrite` | Puts the edited YAML on the clipboard so it can be pasted into Power Apps Studio, which only accepts code through paste. |
| `tabs` | Reads tab URLs to enable the toolbar icon only on Power Apps pages, to open the editor next to the Studio tab and to switch back to Studio when saving. |
| `scripting` | Finds the Power Apps Studio frame inside the Power Apps page and injects the content script into Studio tabs that were already open before the extension was installed. |
| `webNavigation` | Lists the frames of a Power Apps tab to show a helpful error message when Power Apps Studio cannot be found. |
| Host permissions `https://*.powerapps.com/*`, `https://*.powerplatformusercontent.com/*` | Power Apps Studio runs on these domains (often in an iframe). The content script adds the Edit YAML button, reads the selected code and pastes the edited code back. |

Remote code: **No**. Alle code zit in het pakket.

## Gegevensgebruik (Chrome Web Store, tabblad Privacy)

- Verzamelde gegevens: aanvinken **Website content** (de YAML-code van de app wordt lokaal verwerkt en bewaard). Verder niets.
- Bevestig alle drie de verklaringen: geen verkoop aan derden, geen gebruik buiten het doel van de extensie, geen gebruik voor kredietwaardigheid.
