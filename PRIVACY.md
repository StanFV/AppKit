# AppKit for Power Apps: Privacy Policy

*Last updated: 14 October 2026*

[Nederlandse versie hieronder](#nederlands)

AppKit for Power Apps ("AppKit", "the extension") is a browser extension that lets you edit the YAML code of screens and controls in your own Power Apps canvas apps and put the result back in Power Apps Studio. This policy explains what data the extension handles and what it does with it.

## Summary

AppKit has no servers of its own and makes no network requests. It does not collect, store, sell or share any of your data with the developer or with third parties. Everything the extension does happens in your browser, on Power Apps pages you have opened yourself.

## Data the extension handles

**Page addresses (URLs).** AppKit reads the address of your tabs to recognise Power Apps pages (`*.powerapps.com` and `*.powerplatformusercontent.com`). It uses this only to enable its toolbar icon on those pages and to find the Power Apps Studio tab to save to. Addresses are not stored and not sent anywhere.

**App code (YAML).** When you open a screen or control in the editor, AppKit reads its YAML code from Power Apps Studio: from the read-only "View code" window, or by capturing the code at the moment Studio copies it to the clipboard. When you save, AppKit puts the edited code on your clipboard and pastes it into Studio. When you choose "Replace original", it also deletes the original screen or control in Studio's tree view just before pasting, and undoes that if the paste fails.

**Clipboard.** AppKit writes to the clipboard when you save or copy code. It only reads the clipboard when the code of your selection could not be read directly in Studio, or when you click "Read clipboard" in the editor, so that the code you just copied can be loaded.

**Locally stored data.** AppKit stores the following in your browser's extension storage on your own device:

- unsaved changes (drafts) per editor tab, so they are not lost when you close the tab;
- the last 30 versions you saved to Studio (the YAML code, the screen or control name, the app name and the time), shown under "History";
- your settings: theme, save mode and whether the "Edit YAML" button is shown in Studio;
- the code of each open editor tab and the Studio tab it came from, kept in session storage and cleared when you close the browser.

This data never leaves your browser. You can clear the history with the "Clear" button in the History window, or remove all data by removing the extension.

## Services the extension connects to

None. AppKit makes no network requests. All code, including the editor (CodeMirror) and the YAML parser (js-yaml), is included in the extension package. The extension does not use analytics, tracking, advertising or any server operated by the developer.

## What the extension does not do

- It does not sell or transfer your data to third parties.
- It does not use your data for purposes unrelated to its single purpose: editing the code of your Power Apps canvas apps.
- It does not use your data to determine creditworthiness or for lending purposes.
- It does not run remote code; all code is included in the extension package.

## Your control

Changes are only made in Power Apps Studio when you click "Save to Studio". Before the first replace in an editor tab, AppKit asks for confirmation, and you can always undo the change in Studio with Ctrl+Z. You can remove all data the extension holds at any time by removing the extension at `chrome://extensions` or `edge://extensions`.

## Changes to this policy

Changes are published in this file in the [source repository](https://github.com/StanFV/Power-Apps-Tools), with the date at the top updated.

## Contact

Questions about this policy can be submitted as an issue at <https://github.com/StanFV/Power-Apps-Tools/issues>.

---

<a id="nederlands"></a>

# AppKit for Power Apps: Privacyverklaring

*Laatst bijgewerkt: 14 oktober 2026*

AppKit for Power Apps ("AppKit", "de extensie") is een browserextensie waarmee je de YAML-code van schermen en controls in je eigen Power Apps canvas apps bewerkt en het resultaat terugzet in Power Apps Studio. Deze verklaring legt uit welke gegevens de extensie verwerkt en wat ermee gebeurt.

## Samenvatting

AppKit heeft geen eigen servers en maakt geen verbinding met internet. De extensie verzamelt, bewaart, verkoopt of deelt geen gegevens met de ontwikkelaar of met derden. Alles gebeurt in je browser, op Power Apps-pagina's die je zelf hebt geopend.

## Welke gegevens de extensie verwerkt

**Webadressen (URL's).** AppKit leest het adres van je tabbladen om Power Apps-pagina's te herkennen (`*.powerapps.com` en `*.powerplatformusercontent.com`). Dat wordt alleen gebruikt om het icoon in de werkbalk op die pagina's actief te maken en om het Power Apps Studio-tabblad te vinden waarin opgeslagen moet worden. Adressen worden niet bewaard en nergens heen gestuurd.

**Code van je app (YAML).** Als je een scherm of control in de editor opent, leest AppKit de YAML-code uit Power Apps Studio: uit het alleen-lezen venster "Code weergeven" of door de code op te vangen op het moment dat Studio die naar het klembord kopieert. Bij opslaan zet AppKit de bewerkte code op je klembord en plakt die in Studio. Kies je "Origineel vervangen", dan verwijdert AppKit vlak voor het plakken ook het originele scherm of de originele control in de structuurweergave van Studio. Mislukt het plakken, dan wordt dat ongedaan gemaakt.

**Klembord.** AppKit schrijft naar het klembord als je code opslaat of kopieert. Het klembord wordt alleen gelezen als de code van je selectie niet direct in Studio uitgelezen kon worden, of als je in de editor op "Klembord lezen" klikt, zodat de code die je net hebt gekopieerd geladen kan worden.

**Lokaal bewaarde gegevens.** AppKit bewaart het volgende in de extensieopslag van je browser, op je eigen apparaat:

- niet opgeslagen wijzigingen (concepten) per editortabblad, zodat ze niet verloren gaan als je het tabblad sluit;
- de laatste 30 versies die je naar Studio hebt opgeslagen (de YAML-code, de naam van het scherm of de control, de naam van de app en het tijdstip), te zien onder "Geschiedenis";
- je instellingen: thema, manier van opslaan en of de knop "YAML bewerken" in Studio getoond wordt;
- de code van elk geopend editortabblad en het Studio-tabblad waar die vandaan kwam, in de sessieopslag. Die wordt gewist als je de browser sluit.

Deze gegevens verlaten je browser nooit. Je wist de geschiedenis met de knop "Wissen" in het venster Geschiedenis, of verwijdert alle gegevens door de extensie te verwijderen.

## Diensten waarmee de extensie verbinding maakt

Geen. AppKit maakt geen verbinding met internet. Alle code, ook de editor (CodeMirror) en de YAML-verwerking (js-yaml), zit in het extensiepakket. De extensie gebruikt geen analytics, tracking of advertenties en geen server van de ontwikkelaar.

## Wat de extensie niet doet

- Gegevens verkopen of doorgeven aan derden.
- Gegevens gebruiken voor iets anders dan het enige doel van de extensie: de code van je Power Apps canvas apps bewerken.
- Gegevens gebruiken om kredietwaardigheid te beoordelen of voor leningen.
- Code van buitenaf uitvoeren; alle code zit in het extensiepakket.

## Zelf de regie houden

Er wordt alleen iets in Power Apps Studio gewijzigd als je op "Opslaan in Studio" klikt. Voor de eerste vervanging in een editortabblad vraagt AppKit om bevestiging. In Studio kun je de wijziging altijd ongedaan maken met Ctrl+Z. Je kunt alle gegevens die de extensie bewaart op elk moment verwijderen door de extensie te verwijderen via `chrome://extensions` of `edge://extensions`.

## Wijzigingen in deze verklaring

Wijzigingen worden in dit bestand gepubliceerd in de [broncode-repository](https://github.com/StanFV/Power-Apps-Tools). De datum bovenaan wordt dan aangepast.

## Contact

Vragen over deze verklaring kun je stellen via een issue op <https://github.com/StanFV/Power-Apps-Tools/issues>.
