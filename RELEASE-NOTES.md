Stella Knights v1.3.2 for Foundry VTT v14

Preserve sheet scroll positions when buttons or document updates rerender Character, Item and Stage sheets. Capture scroll at DOM replacement and restore it after render finalization. Keep separate scroll positions for Details and Stellar Battle, and use one constrained scroller per sheet.

Validation: all 84 automated tests and manifest/module/template checks pass. Chromium checks using Foundry's Handlebars part replacement implementation preserve scroll through repeated dice clicks, block movement, adding Omen and scrolling during asynchronous template preparation. Browser tests use mocked documents; this release has not been run on an actual Foundry server.

Update the system from Foundry Setup, then reload the World.

Install/update:
https://github.com/NicoRaz/FVTT-StellaKnights-System/releases/latest/download/system.json
