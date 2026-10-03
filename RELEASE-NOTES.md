Stella Knights v1.2.0 for Foundry VTT v14

- Flower and Color are native Foundry Items. Each parent defines its child Skill keys and character stats; the library imports 54 Skill Items, seven Flower Items and six Color Items.
- Drag parent Items onto the character, or choose their UUIDs in the loadout builder. Parent replacement recalculates stats and moves ineligible Skills to reserve. Drag Skill Items onto a parent sheet to add child Skills.
- Knight’s Etiquette is optional: move it to any slot, keep it in reserve or delete it. All six slots are freely assignable to eligible Skills.
- Bringer sheets show current Endurance, Defense, Charge and Attack bonus after effects, Stage bonuses and combat rounds. Base stat inputs and Garden are removed from the sheet; Garden controls are available in the Arena.
- Native Foundry Combat/Combatant documents and Combat Tracker own initiative order, rounds and turns. Stellar Set/Charge/Actions/Cut phases and Stage routines integrate with the tracker; encounter details are stored in Combat flags.
- Bringer Partner choices show only Sheaths; Sheath Partner choices show only Bringers.
- Existing worlds migrate legacy Flower/Color selections into embedded Items and active legacy battles into native Combat documents.

Validation: 45 automated tests pass. Manifest, JavaScript imports/syntax, JSON, Handlebars and package checks pass. Chromium interaction checks cover Item swaps, Color replacement, calculated Charge, Edit/Play, File Browser paths, collapse and scroll preservation using mocked Foundry APIs. This release has not been run on an actual Foundry v14 server or with an installed Tokenizer module.

Install/update:
https://github.com/NicoRaz/FVTT-StellaKnights-System/releases/latest/download/system.json
