# Stella Knights — Foundry VTT v14 adaptation

A local v14 adaptation of [ksx0330/FVTT-StellaKnights-System](https://github.com/ksx0330/FVTT-StellaKnights-System), based on commit `fe9ddad513ef8b60e925c58338ea258da6dcf1ec`. It keeps the `stellaknights` system ID, upstream Actor/Item field names, Bringer/Sheath sheet structure, Bouquet distribution workflow, Korean/Japanese translations and MIT license.

## ติดตั้งจาก Foundry

เปิด Foundry Setup → Game Systems → Install System → วาง URL นี้ในช่อง Manifest URL แล้วกด Install:

```text
https://github.com/NicoRaz/FVTT-StellaKnights-System/releases/latest/download/system.json
```

สำหรับติดตั้งจาก ZIP ด้วยตนเอง:

1. ปิด Foundry และแตก ZIP ลงใน `<Foundry User Data>/Data/systems/` ให้ได้ `systems/stellaknights/system.json` โดยไม่มีโฟลเดอร์ซ้อนอีกชั้น
2. เปิด Foundry v14 แล้วสร้าง World ที่ใช้ **Silver Sword of Stella Knights — v14**
3. เลือกภาษาไทยได้ใน Settings → Configure Settings → Core → Language
4. ต้องมี GM ออนไลน์สำหรับการดำเนินการร่วมกัน ระบบใช้ GM ที่ออนไลน์และมี user ID เรียงก่อนเป็นผู้ประมวลผลหลัก

Repository สำหรับ v14: [https://github.com/NicoRaz/FVTT-StellaKnights-System](https://github.com/NicoRaz/FVTT-StellaKnights-System) มี manifest และ ZIP ใน GitHub Releases สำหรับติดตั้งและอัปเดตผ่าน Foundry ไม่มี npm install หรือ build ที่ต้องทำเพื่อใช้ใน Foundry

## ใช้ชีท Edit / Play และ Skill Items

- ชีทเริ่มใน **Play** เพื่อใช้สกิลและปรับทรัพยากรระหว่างเล่น กด **Play → Edit** เพื่อแก้ข้อมูลตัวละครและจัดสกิล แล้วกด **Edit → Play** เมื่อพร้อมเล่น
- ใน Edit คลิกรูป **Portrait** หรือ **Token** เพื่อเลือกไฟล์ผ่าน Foundry File Browser รูป Token เปลี่ยน Prototype Token; ใช้ **Token settings** สำหรับการตั้งค่าเพิ่มเติม หากเปิดโมดูล **Tokenizer** ที่รองรับ Foundry เวอร์ชันของคุณ จะมีปุ่ม Tokenizer เรียก API `tokenizeActor` ของโมดูล
- GM กด **Skill Item Library · Import / Open** เพื่อนำเข้าหรือเปิดคลัง 54 สกิลใน Item Directory ผู้เล่นอ่านและลาก Item จากคลังได้ ไม่ต้องสร้างใหม่ทีละสกิล
- ลาก Item จาก Directory หรือ Compendium ลงช่อง **No. 1–6** ใน Edit เพื่อเพิ่มสกิลของ Actor ลากสกิลที่มีอยู่ระหว่างช่องเพื่อสลับหมายเลข หรือปรับ Number บน Item sheet หากปลายทางมีสกิล ระบบจะสลับช่องให้
- ลากลงส่วน **Skill / Custom** เพื่อเก็บในสำรอง (No. 0) สกิลเดิมยังอยู่เมื่อเปลี่ยนชุด ช่อง **No. 1** สงวนให้ Knight’s Etiquette และจัด loadout ได้เมื่อไม่มี Battle ที่กำลังดำเนินอยู่
- กดหัวข้อ **Skill loadout** เพื่อพับ/ขยาย ชีทเก็บสถานะพับและตำแหน่งเลื่อนขณะอัปเดตหรือเปลี่ยนโหมด
- **Starting Endurance** คือ Endurance ตั้งต้นก่อนโบนัส Stage ไม่ใช่เพดานการฟื้น **Base Defense** คือค่าพื้นฐานที่แก้ไขได้ ส่วน **Effective** คือค่าที่ใช้กับการโจมตีหลังรวมเอฟเฟกต์ปัจจุบัน

## เริ่มเล่น

- สร้าง Actor แบบ **Bringer** และ **Sheath** สำหรับแต่ละคู่ โดยมอบ Ownership ให้ผู้เล่นที่ควบคุมบทนั้น
- เปลี่ยนชีทเป็น Edit แล้วบนแผ่น Bringer เลือกคู่หูใน Partner แล้วให้ GM กด **Sync Pair** เพื่อส่ง Wish, Flower/Color, keyword และ Hope/Despair ที่ตรงข้ามไปยัง Sheath ข้อมูลส่วนตัวของ Sheath ยังแก้ไขแยกได้
- กด **สร้างชุดสกิล** เลือกดอกไม้ สี และห้าสกิลที่ไม่ซ้ำ ช่อง 1 เป็น Knight’s Etiquette ค่าสีเริ่มต้นถูกกรอกให้อัตโนมัติ
- สกิลที่เปลี่ยนออกจะเก็บไว้ในช่อง 0 เป็นสกิลสำรองตามกฎแคมเปญ ถ้าต้องการจัดช่องเอง ให้แก้ช่องเดิมเป็น 0 ก่อน แล้วค่อยใส่สกิลใหม่ลงช่องว่าง
- สร้าง **Embraced** หรือ **Eclipsed** เป็นศัตรูและจัดชุดสกิลแบบเดียวกัน Eclipsed มีคู่ Sheath ได้ ส่วน Embraced ไม่มีคู่ตามกฎ
- เปิด **Stellar Battle** จากปุ่มบนแผ่นหรือจากแถบเครื่องมือ Token ระบบมีตัวติดตามการต่อสู้ของตัวเองในหน้าต่าง Arena of Wishes ใช้หน้าต่างนี้ในการดำเนินเทิร์น

## ฉากและ Bouquet

กด **Start Session** เลือก Bringers ของทุกคู่ (รวม Eclipsed หากเล่นแบบ Irregular) แต่ละคู่ต้องเชื่อม Sheath แล้ว ปุ่ม **Next Scene / Chapter** เดินผ่าน Prologue → Chapter One → Chapter Two → Interlude → Final Chapter → Curtain Call → Cleanup ฉากของแต่ละบทจะเดินทีละคู่

เปิดหน้าต่าง Bouquet และกด +1 ที่คู่ซึ่งกำลังแสดง ไม่ต้องเปลี่ยน Ownership ของตัวละครเพื่อให้ผู้ชมมอบ Bouquet ได้ ระหว่าง Chapter One/Two/Interlude จะรับ Bouquet ได้เฉพาะคู่ในฉากปัจจุบัน

ตามกฎ p.114 ไม่มีผู้ชมใน Final Chapter จึงไม่แจก Bouquet ใหม่ระหว่างต่อสู้เป็นค่าเริ่มต้น หากกลุ่มใช้ house rule ให้ GM เปิด **Allow Bouquets during Stellar Battle** ใน System Settings การใช้ Bouquet ที่สะสมไว้ยังทำได้ตามปกติ

**Reference Tables** แสดงตาราง Hope/Despair, Story, Other Worlds, Wish, Personality, Prompts, Time, Location, Schools, Topics และ Sample Synopses พร้อมเต๋าสองลูกและเลขหน้า รูปแบบตารางเดิม D6/D66/ตารางแถว-คอลัมน์ต้องอ่านเลือกผลตามหัวตาราง ปุ่ม **สุ่มฉาก** สุ่มเวลาและสถานที่ให้โดยตรง

## การต่อสู้

1. GM กด **เริ่มการต่อสู้** เลือกหนึ่งศัตรู ผู้เล่น และ Stage หนึ่งใน 7 แบบ ระบบเริ่ม Round 1 / Set และใช้ Set Routine รวมทั้งโบนัส Endurance/Charge/Attack ของศัตรูตามจำนวน Bringers
2. จัด Garden 1–6 บนแผ่นตัวละครก่อนเริ่ม Actions ศูนย์กลางสนามเข้าไม่ได้ ใช้ลูกศร ↑↓ ใน Set เพื่อเปลี่ยนลำดับ Bringers; ศัตรูอยู่ก่อนเสมอ
3. GM กด **เฟส / เทิร์นถัดไป** เข้า Charge ผู้เล่นแต่ละคนกด **ทอย Charge** จากแผ่นหรือหน้าต่าง Arena แล้วใช้ปุ่มบนการ์ด Chat เพื่อปรับ/ทอยใหม่ก่อนกด **ยืนยันผล** ผลแต่ละลูกถูกเพิ่มลงช่องสกิลที่ตรงกับหน้าเต๋า ลูกที่เหลือจากรอบก่อนยังคงอยู่
4. เมื่อผู้ที่ยังไม่หมดสภาพ Charge ครบ GM เดินเข้า Actions ใช้สกิลจากแผ่น ผู้เล่นเลือกเป้าหมายและตัวเลือกตามข้อความสกิล
5. การโจมตีประกาศเป็นการ์ด **Before attack** ก่อนทอย เพื่อใช้สกิลแทรกและ Dice Boost จากนั้นเจ้าของตัวละครหรือ GM กด **ทอย** สกิลหลังทอยและก่อนรับความเสียหายใช้ได้ก่อนกด **ยืนยันผล** ระบบนับลูกที่ ≥ Defense เป็นความเสียหาย
6. GM เดินเทิร์นถัดไปเพื่อใช้ Action Routine ที่ประกาศเป็น Omen หากเกิดการโจมตีของ Stage ต้องยืนยันการ์ด Chat ก่อนเดินเทิร์นต่อ ถ้า Stage ให้ศัตรูใช้สกิลเพิ่ม GM เลือกสกิลที่ได้รับ Set die แล้วใช้สกิลนั้นบนแผ่นศัตรูก่อนเดินต่อ
7. เมื่อทุกคนแสดงแล้วเข้าสู่ Cut และเดินต่อไปยังรอบใหม่ ไม่มี initiative แบบทอยเต๋า เพราะลำดับถูกตกลงร่วมกันตามหนังสือ

การยืนยันความเสียหายดู Garden และ Defense ขณะนั้น ถ้าเป้าหมายออกจากระยะ การโจมตีของตัวละครจะทำความเสียหายเป็น 0 Stage โจมตีได้ทุกสวนตามเงื่อนไขของ Routine และใช้ชุดเต๋าร่วมกันเมื่อโจมตีหลายเป้าหมาย

Endurance ไม่ติดเพดานค่าเริ่มต้น; ค่าสูงสุดบนแผ่นคือค่าเริ่มต้นเพื่อใช้ตรวจเหรียญ Unwavering Knight Defense อยู่ในช่วง 1–6 เสมอ ตัวละคร Endurance 0 ใช้สกิลทั่วไปหรือฟื้นด้วยการรักษาปกติไม่ได้ แต่ยังสนับสนุนด้วย Bouquet และใช้ Distortion ได้

## Bouquet และจังหวะสกิล

- **Petite Lucky:** 3 Bouquet เปลี่ยนผล Charge ลูกหนึ่ง ±1 ใช้ซ้ำได้แต่ต้องเป็นลูกเดิมทั้ง check และไม่วน 1↔6
- **Dice Boost:** 4 Bouquet เพิ่มหนึ่งลูกก่อน Attack รวมทุกคนได้ไม่เกินสามครั้งต่อ check
- **Re-roll:** 5 Bouquet ทอยทุกลูกใหม่หลัง Charge/Attack ได้ครั้งเดียวต่อ check
- เลือกผู้จ่ายก่อน ระบบส่งข้อเสนอเข้า Chat **เจ้าของตัวละครผู้รับหรือ GM กด Accept support** จึงจะหักแต้มและใช้เอฟเฟกต์ ป้องกันการช่วยที่ผู้รับไม่ยินยอมและการหักแต้มซ้ำจากการกดซ้ำ
- สกิล Reaction ใช้ผ่านปุ่ม **ใช้สกิล** บนแผ่น ในหน้าต่างที่ตรงกับกฎ เช่น Before Attack / After Roll / After Damage สกิลตอบสนองต่อ damage ใช้ก่อนเกิดเหตุการณ์ถัดไปตามการตัดสินของ Director
- การเคลื่อนที่ระบุ Garden ที่เดินเข้าทีละช่อง เช่น จาก 1 ไป 3 ใช้ `2,3`; เดินจาก 1 ไป 5 ใช้ `6,5` สำหรับสกิลที่ระบุหลายก้าว ผลต่างระยะสวนอย่างเดียวไม่แทนจำนวนก้าวที่เดิน
- ผลที่ต้องเลือกความยินยอมหรือทิศทางของผู้เล่นอื่น ให้ Director ยืนยันกับผู้เล่นนั้นก่อนเลือกในหน้าต่าง ระบบตรวจข้อจำกัดด้านกฎ แต่ไม่ได้สร้างกล่องยืนยันแยกให้ทุกผลของสกิล
- **Cosmos Order** แจ้งผู้รับให้เลือกและลบ Set die ด้วยปุ่ม −; เป็นการเลือกของผู้รับตามกฎ ไม่ใช่การสุ่มลบ
- **Around the Cosmos** รองรับการเลือกเส้นทางรายคน; ถ้าหลายคนเริ่มอยู่สวนเดียวกันใช้ path ร่วมกันได้
- **Floral Ring** เก็บ Flame Counter กดปุ่ม Flame เพื่อเลือกโต้กลับเมื่อเพิ่งได้รับความเสียหายจากตัวละคร สามารถไม่โต้กลับได้
- **Session report re-roll:** Director ตรวจรายงานเล่นแล้วติ๊กช่องนี้บนแผ่น Bringer ใช้ปุ่มบนการ์ด Charge/Attack ได้หนึ่งครั้งก่อนช่องถูกปิด อ้างอิง p.120

## Distortion, เหรียญ และแคมเปญ

**Immortal Life** เพิ่ม Distortion 1 และฟื้น Endurance เท่าผลรวม 2d6 รวมถึงชุบจาก 0 ได้ **Atypia** เพิ่ม Distortion 1, ฟื้น 4, เพิ่ม Attack ครั้งถัดไป 3 ลูก และทอยหน้าหนึ่งซ้ำจนไม่เป็นหนึ่ง เมื่อถึง Distortion 3 ระบบแจ้งว่าต้องเป็น Eclipsed ในเซสชันถัดไป ไม่เปลี่ยน Actor type กลางการต่อสู้

หลังการต่อสู้สิ้นสุด GM กด **มอบเหรียญรางวัล** แล้วเลือกผู้ที่สนทนากับอัศวินคนอื่น ระบบรวมเหรียญ Victory, Decisive, Unwavering, Exemplary และ Collaborative และป้องกันการมอบซ้ำใน battle เดียว Wish Tier 1–5 ต้องการ 6/12/18/24/30 เหรียญ; Tier 6–10 ไม่ระบุจำนวนในหนังสือ

การเปลี่ยนบทบาทเป็น Eclipsed, การเข้าร่วม Covenant Council และการตัดสินว่า Wish สำเร็จเป็นการตัดสินเชิงเรื่องราวของ Director ปรับ Actor/Medals/Distortion หลังเหตุการณ์ตามหนังสือ ตัวละครและสกิลสำรองคงอยู่สำหรับเซสชันถัดไป

## ย้ายข้อมูลจากโปรเจกต์เดิม

คง `stellaknights`, Actor types `bringer`/`sheath`, Item type `ability`, `system.hp`, `defense`, `charge`, `details`, `exp`, `distortion`, `bouquet` และสกิล `number`/`charge` ของต้นฉบับ Foundry เป็นผู้ทำ core migration จาก `data`/`permission` ไป `system`/`ownership`; adaptation แก้ Hope/Despair ที่ต้นฉบับเคยเก็บผิด path

สำรอง World และ system เดิมก่อนเปิดด้วย v14 การย้าย World จาก v8/v9 ควรทำตามขั้นตอน migration ของ Foundry และรุ่นกลางที่จำเป็น การทดสอบนี้ไม่ได้รัน migration ของ Foundry จริง

สกิลเก่าที่ไม่มี rule key จะยังเก็บข้อความและช่องเดิม แต่ไม่ได้เดาความหมายจากชื่อภาษาญี่ปุ่น/เกาหลี ให้สร้างชุดสกิลจากคลังใหม่เพื่อใช้ automation; ของเก่าถูกเก็บเป็นสกิลสำรอง Custom skill ตั้ง Attack dice/Movement ได้ เอฟเฟกต์ที่เขียนเองนอกคลังให้ Director ตัดสินและปรับค่า

## Validation / ขอบเขต

- ตรวจ manifest, syntax/imports, JSON, Handlebars templates และ handler ของทั้ง 54 สกิล
- Node tests ครอบคลุมการโจมตีหลายครั้ง, consent ของ Bouquet, จำกัดการใช้/การกดซ้ำ, HP/Defense, Garden, Charge ข้ามรอบ, Distortion, สกิลทั้งหมด, 33 Action routines และ session/campaign workflow
- Chromium ตรวจ static sheet layout แสดงหกสกิลและไม่มี horizontal overflow ภาพ preview เป็น layout preview ไม่ใช่ภาพจาก Foundry
- **ยังไม่ได้ทดสอบกับ Foundry v14 runtime จริง** เนื่องจากไม่มีตัวโปรแกรม/เซิร์ฟเวอร์ใน environment ใช้ API documentation v14.368 เป็นแหล่งอ้างอิง ต้องตรวจการโหลด World, sheets, socket หลายผู้เล่น และ core migration ใน Foundry ที่ติดตั้งจริงก่อนเริ่มเกมหลัก
- Socket ตรวจ ownership/GM และ serialize shared writes เหมาะกับผู้ร่วมเล่นที่เชื่อใจกันตามโมเดลของ Foundry world socket ไม่ใช่ขอบเขตความปลอดภัยสำหรับผู้เล่นที่จงใจปลอม socket payload
- ฉาก, ตัวเลือกที่ยินยอม, tie-break ของ Stage, สกิล custom และการสร้างเรื่องเล่าบางส่วนยังต้องใช้ Director ไม่ได้สร้างระบบ AI เล่าเรื่อง

## Development

```sh
npm ci
npm run check
npm test
```

Release publishing: push a tag matching `system.json` (e.g. `v1.0.0`), or run the Release workflow manually. GitHub Actions runs checks/tests, builds the package and attaches `system.json` and `stellaknights-v14.zip` to the release. The GitHub App must have access to the repository and permission to write contents/workflows.

Source layout: `module/` runtime, `data/skills.json`/`stages.json`/`references.json` book-derived mechanical reference data, `templates/` sheets/panels, `tests/` document/roll test doubles. No book PDF or copied illustrations are bundled.

## Attribution

Upstream: ltaeng / ksx0330 — [FVTT-StellaKnights-System](https://github.com/ksx0330/FVTT-StellaKnights-System), commit `fe9ddad513ef8b60e925c58338ea258da6dcf1ec` (0.0.3). Upstream `LICENSE.txt` is retained unchanged. Code modifications follow the MIT license in `LICENSE` (Copyright 2026 NicoRaz); the upstream MIT notice in `LICENSE.txt` is retained as well.

Rules reference: the user-provided `Stellar_Knights_01.pdf`, unofficial fan translation of Silver Blades, Stellar Knights, translation dated May 10, 2025. Book text and game material retain their respective owners' rights; the MIT code license does not relicense that material. Mechanical catalog names/text are kept in English for correspondence with the supplied book, with Thai interface labels and this guide.
