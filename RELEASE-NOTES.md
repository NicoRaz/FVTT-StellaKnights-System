Stella Knights v1.3.1 for Foundry VTT v14

Fix opening a World failing with a black screen in v1.3.0. GardenRegionBehavior called the abstract parent defineSchema method, which threw during Foundry localization before the World could initialize. Define the Garden schema directly.

Add a regression test that registers the Garden model and reads its schema with an abstract parent matching Foundry behavior. All 83 automated tests and manifest/module/template checks pass. This patch has not been run on an actual Foundry server.

Update the system from Foundry Setup, then reload the World. Existing Actor, Item and Region data is retained.

Install/update:
https://github.com/NicoRaz/FVTT-StellaKnights-System/releases/latest/download/system.json
