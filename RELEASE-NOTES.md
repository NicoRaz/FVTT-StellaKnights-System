Stella Knights v1.1.0 for Foundry VTT v14

- Capitalized Bringer / Sheath sheet titles; clarified Starting Endurance, Base Defense and Effective Defense.
- Edit / Play mode, collapsible Skill loadout and scroll/section state preserved across sheet updates.
- Portrait and Prototype Token use the native File Browser; Token settings and optional Tokenizer API integration.
- Drag native Skill Items from the Item Directory or Compendiums into numbered slots. Drag between slots or edit Number to swap; drop into the reserve section to unassign. Repeated catalog drops reuse the owned Item.
- Shared Skill library import makes catalog Items readable to players. Existing character Items remain compatible.

Validation: 32 automated tests pass, including slot swaps, reserve assignment, invalid/forbidden drops, File Browser paths, Tokenizer API dispatch and scroll/collapse state. Manifest, JavaScript, JSON and Handlebars checks pass. Browser interaction checks use mocked Foundry APIs; this release has not been run on an actual Foundry v14 server or with the installed Tokenizer module.

Install/update with https://github.com/NicoRaz/FVTT-StellaKnights-System/releases/latest/download/system.json
