Stella Knights v1.3.0 for Foundry VTT v14

- Native Foundry Initiative determines turn order without overwriting scores or forcing the Enemy first. Foundry Round drives current Charge and round-based effects.
- Add Stage Actors with editable Set, Routine, Omen and Skill data. A Stage Token must be included in Combat before Begin Combat. Seven ready-made Stage Actors are included in the Stages compendium.
- Run Omen automatically on every turn, including Enemy and Stage turns. Built-in Stage attacks roll and apply damage automatically; rerenders and repeated updates do not trigger duplicate Omen.
- DM-only Charge Dice — All rolls and allocates dice once per fighter per Round, preserving unused dice between rounds. Remove the player Charge button. Confirming End Combat clears all Skill dice, including reserves and Stage Skills; cancelling leaves dice intact.
- Skill clicks use locked Foundry Targets directly, without an aiming dialog or Garden, timing, parent, slot or dice restrictions blocking use. Effects requiring additional choices or unavailable reaction context are posted for the Director to apply.
- Add Garden Region Behavior (1–6): assigns Garden to Tokens inside the Region and updates Actors that have a Garden field.
- Add visual Block Scripts to Skill Items: drag/reorder actions, Roll, Attack, Damage, Heal/revive, Add Set dice, Stat bonus, Message, If and Repeat. Supports fixed values, Foundry Round, last dice total and target selection without writing JavaScript. Stage Set/Omen Skills can use Block Scripts instead of built-in routines.
- Ship native LevelDB compendiums: Color (25 Skills + 6 Parent Items), Flower (28 Skills + 7 Parent Items), Special (Knight’s Etiquette), and Stages (7 Actors with their Skill Items).
- Remove the Arena / Stage / Gardens window. Director rulings are enabled by default to allow flexible loadouts and encounter decisions while retaining ownership and duplicate-action protection.

Updating: add a Stage Token to your encounter before starting Combat. Existing Actor/Skill data is retained; new script fields default to disabled with an empty block list.

Validation: 82 automated tests pass. Manifest, JavaScript, JSON, Handlebars, Compendium and package checks pass. Chromium verifies character-sheet interactions, block editing/drag order and Stage Omen editing with mocked Foundry APIs. Garden uses documented Foundry v14 Region Behavior APIs. This release has not been run on an actual Foundry v14 server or with an installed Tokenizer module.

Install/update:
https://github.com/NicoRaz/FVTT-StellaKnights-System/releases/latest/download/system.json
