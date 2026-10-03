Stella Knights v1.2.1 for Foundry VTT v14

- Split character sheets into Details (character information) and Stellar Battle (current stats, Color, Flower and Skills). Each tab preserves its scroll position across updates and Edit/Play changes.
- Fix Combat Tracker and Items sidebar navigation using the Foundry v14 changeTab API.
- Create encounters through the configured Combat document class, and include scene IDs when creating Combatants. This corrects the encounter creation/start path for native Foundry Combat.
- Keep native Combat rounds, turns and Stellar Set/Charge/Actions/Cut phases integrated with the tracker.

Validation: 48 automated tests pass, including configured Combat creation, combat start and phase advancement. Manifest, JavaScript, JSON, Handlebars and package checks pass. Chromium interaction checks cover tabs, Item swaps, Color replacement, calculated Charge, Edit/Play, File Browser paths, collapse and scroll preservation using mocked Foundry APIs. This release has not been run on an actual Foundry v14 server or with an installed Tokenizer module.

Install/update:
https://github.com/NicoRaz/FVTT-StellaKnights-System/releases/latest/download/system.json
