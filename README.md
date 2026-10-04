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

> Flower/Color Items และ Foundry Combat พร้อมใช้งานในเวอร์ชัน 1.2.0

## เวอร์ชัน 1.3.0

- ใช้ Initiative และ Round/Turn ของ Foundry โดยตรง
- ต้องมี **Stage Token** ใน Combat ก่อน Begin Combat มี Stage Actor พร้อมชีท Set / Routine / Omen / Skills และ Compendium Stage preset 7 แบบ
- **Omen ทำงานอัตโนมัติทุกเทิร์น** รวม Enemy และ Stage โดยไม่ทำซ้ำเมื่อ render/update ซ้ำ Stage attacks ทอยและใช้ผลอัตโนมัติ
- มีปุ่ม **Charge Dice — All** สำหรับ DM เท่านั้น ไม่มีปุ่ม Charge ของผู้เล่น เต๋าที่เหลือข้ามรอบคงอยู่
- **End Combat** ล้าง Set dice ทุก Skill ของทุกคนใน Combat รวมสกิลสำรองและ Stage Skills ยกเลิก End Combat แล้วเต๋ายังคงอยู่
- กด **ใช้ Skill** กับ Foundry Targets โดยตรง ไม่มีหน้าต่างเล็ง ไม่เลือกคู่ต่อสู้อัตโนมัติ ไม่ตรวจ Garden, timing, Parent, slot หรือ Set dice เพื่อขวางการกด สกิลที่ต้องเลือกค่าหรือเหตุการณ์เฉพาะโพสต์ข้อความให้ Director ใช้ผลเอง
- Region Behavior **Garden** ค่า 1–6 ตั้ง Garden ให้ Token ทุกตัวใน Region และอัปเดต Actor ที่มีฟิลด์ Garden เมื่อเข้า/เคลื่อนภายใน หรือเปลี่ยนค่า Behavior
- **Block Script** ใน Skill Items: เรียงบล็อก ลากสลับ/เพิ่ม/ลบ/ย้ายขึ้นลงได้ ไม่มี JavaScript รองรับ Roll, Attack, Damage, Heal/revive, Add Set dice, Stat bonus, Message, If และ Repeat
- เปิด Director rulings เป็นค่าเริ่มต้น แก้ loadout ระหว่าง combat และเลือก Skill ข้าม Flower/Color ได้ คง ownership และการป้องกันกดซ้ำ
- Compendium **Color**: 25 Skills + 6 Parent Items; **Flower**: 28 Skills + 7 Parent Items; **Special**: Knight’s Etiquette; **Stages**: 7 Stage Actors พร้อม Skill Items

## Region Garden และ Block Script

1. สร้าง Scene Region → เพิ่ม Behavior **Garden** → ตั้ง Garden 1–6 เมื่อ Token อยู่ใน Region จะรับค่านั้น Token มีค่าของตัวเอง ส่วน Actor ที่ linked ใช้ค่า Garden ร่วมกัน
2. เปิด Skill Item → **Block Script** → เปิด Use Block Script เพื่อใช้บล็อกแทนเอฟเฟกต์เดิม → Add Block เลือกคำสั่ง เป้าหมาย และค่า ลากที่ ☷ หรือใช้ ↑/↓ เพื่อเรียงลำดับ
3. ตัวอย่าง: Roll 2 dice → If total ≥ 5 → Damage จาก Last dice total หรือ Repeat 2 → Heal 1 ให้ผู้ใช้ If/Repeat ใช้กับบล็อกถัดไปหนึ่งบล็อก Repeat สูงสุด 10 ครั้ง
4. ค่าใช้ Fixed value, Foundry Round หรือ Last dice total ได้ เป้าหมายเลือก Foundry Targets / ผู้ใช้ / All fighters in Combat ส่วน Add Set dice ใช้ Value เป็นจำนวนลูก และ Set die face เป็นช่อง 1–6
5. Stage Set/Omen Skill Items เปิด Block Script ได้เช่นกัน ระบบใช้ script ของ Item นั้นแทน routine เดิมเมื่อถึงต้น Round/Turn ข้อความ custom ที่ไม่มีบล็อกให้ Director ใช้ผลเอง

## ใช้ชีท Edit / Play และ Skill Items

> เวอร์ชัน 1.2.1 แยกแท็บ Details / Stellar Battle และแก้การเปิด Sidebar กับการสร้าง Combat สำหรับ Foundry v14

- **Details** แสดงข้อมูลตัวละคร Partner, Wish, ประวัติ และ XP
- **Stellar Battle** แสดงค่าสถานะปัจจุบัน Color, Flower, Skill loadout และสกิลสำรอง พร้อมปุ่ม Foundry Combat Tracker แต่ละแท็บเก็บตำแหน่งเลื่อนแยกกัน


- ชีทเริ่มใน **Play** เพื่อใช้สกิลและปรับทรัพยากรระหว่างเล่น กด **Play → Edit** เพื่อแก้ข้อมูลตัวละครและจัดสกิล แล้วกด **Edit → Play** เมื่อพร้อมเล่น
- ใน Edit คลิกรูป **Portrait** หรือ **Token** เพื่อเลือกไฟล์ผ่าน Foundry File Browser รูป Token เปลี่ยน Prototype Token; ใช้ **Token settings** สำหรับการตั้งค่าเพิ่มเติม หากเปิดโมดูล **Tokenizer** ที่รองรับ Foundry เวอร์ชันของคุณ จะมีปุ่ม Tokenizer เรียก API `tokenizeActor` ของโมดูล
- กด **Skill Compendiums** เพื่อเปิดคลัง Color / Flower / Special ผู้เล่นลาก Item ลงชีทได้ทันที ไม่ต้อง import ลง World Items
- ลาก Item จาก Directory หรือ Compendium ลงช่อง **No. 1–6** ใน Edit เพื่อเพิ่มสกิลของ Actor ลากสกิลที่มีอยู่ระหว่างช่องเพื่อสลับหมายเลข หรือปรับ Number บน Item sheet รวมทั้ง Knight’s Etiquette ทุกช่อง หากปลายทางมีสกิล ระบบจะสลับช่องให้
- ลากลงส่วน **Skill / Custom** เพื่อเก็บในสำรอง (No. 0) สกิลเดิมยังอยู่เมื่อเปลี่ยนชุด Knight’s Etiquette ย้ายช่อง เก็บสำรอง หรือลบได้โดยไม่มีการล็อก และจัด loadout ได้ระหว่าง Battle เมื่อเปิด Director rulings
- กดหัวข้อ **Skill loadout** เพื่อพับ/ขยาย ชีทเก็บสถานะพับและตำแหน่งเลื่อนขณะอัปเดตหรือเปลี่ยนโหมด
- เลือก **Flower** และ **Color** โดยลาก Parent Items ลงชีท แต่ละ Parent เก็บ `skillKeys` ของลูก Skill ที่เลือกลงช่องได้ ลาก Skill ลง Item sheet ของ Parent เพื่อเพิ่มรายการลูกได้ ในโหมด Director rulings สกิลนอก Parent ลงช่องและใช้ได้; Knight’s Etiquette ใช้ได้ทุกตัวละครโดยไม่มีการล็อกช่อง
- **Color Item** กำหนด Endurance, Defense และ Charge; **Flower Item** เพิ่มค่าสถานะตามที่ระบุใน Item (Flower จากหนังสือเริ่มที่ 0 สำหรับค่าสถานะเหล่านี้) เปลี่ยน Parent แล้วคำนวณใหม่; โหมด Director rulings เก็บสกิลเดิมในช่อง ส่วนโหมดกติกาเข้มงวดจะย้ายสกิลที่ไม่ตรงไปสำรอง
- ชีทแสดงเฉพาะ **Endurance ปัจจุบัน**, **Defense ที่ใช้จริง**, **Charge หลังรวม Round/Stage bonus** และ **Attack bonus** ไม่มีช่อง Base หรือ Garden ค่าที่แสดงใช้ฟังก์ชันเดียวกับการคำนวณใน Combat
- ปุ่ม **Foundry Combat** เปิด Combat Tracker ของ Foundry ใช้ Combat/Combatant, initiative order, round และ turn ของ Foundry เป็นหลัก ระบบเพิ่มเฟส Set/Charge/Actions/Cut และ Stage routine ผ่าน Combat document เก็บรายละเอียด Stage ใน flags ของ Combat
- ใช้ **Director controls** บน Foundry Combat Tracker เพื่อปรับ Round, Garden, Endurance, Bouquet, Medals และ Distortion หรือยกเลิก check / จบ battle Garden ยังใช้กับระยะและกติกา แต่ไม่มีบนชีท Bringer

## เริ่มเล่น

- สร้าง Actor แบบ **Bringer** และ **Sheath** สำหรับแต่ละคู่ โดยมอบ Ownership ให้ผู้เล่นที่ควบคุมบทนั้น
- เปลี่ยนชีทเป็น Edit แล้วบนแผ่น Bringer เลือกคู่หูใน Partner แล้วให้ GM กด **Sync Pair** เพื่อส่ง Wish, Flower/Color, keyword และ Hope/Despair ที่ตรงข้ามไปยัง Sheath ข้อมูลส่วนตัวของ Sheath ยังแก้ไขแยกได้
- กด **สร้างชุดสกิล** เลือก Flower และ Color Items แล้วเลือกหกสกิลที่ไม่ซ้ำลงช่อง 1–6 ใช้ค่าสถานะจาก Parent Items โดยเลือกว่าจะใส่ Knight’s Etiquette หรือไม่ก็ได้
- สกิลที่เปลี่ยนออกจะเก็บไว้ในช่อง 0 เป็นสกิลสำรองตามกฎแคมเปญ จัดช่องด้วยการลากสลับหรือแก้ Number บน Item sheet ได้
- สร้าง **Embraced** หรือ **Eclipsed** เป็นศัตรูและจัดชุดสกิลแบบเดียวกัน Eclipsed มีคู่ Sheath ได้ ส่วน Embraced ไม่มีคู่ตามกฎ
- เปิด Foundry Combat Tracker จากปุ่มบนชีทหรือแถบเครื่องมือ Token ใช้ Combat ของ Foundry สำหรับ encounter, round และ turn

## ฉากและ Bouquet

Director เริ่มและเดินฉากผ่าน API `game.stellaknights.request("session-start", {actors: [actorId]})` และ `game.stellaknights.request("session-next", {})` ได้ ลำดับ Prologue → Chapter One → Chapter Two → Interlude → Final Chapter → Curtain Call → Cleanup ยังเก็บใน World แต่ไม่มีหน้าต่าง Arena สำหรับบังคับลำดับฉาก

เปิดหน้าต่าง Bouquet เพื่อให้ผู้ชมแจก +1 เมื่อ Director อนุญาต Director rulings อนุญาตระหว่าง battle และนอกคู่ที่อยู่ในฉาก ปิดโหมดนี้เพื่อใช้ข้อจำกัดจากหนังสือและตั้งค่า Allow Bouquets during Stellar Battle ตามเดิม

## การต่อสู้

1. ลาก Stage Actor จาก Compendium **Stages** ลง World หรือสร้าง Actor ชนิด Stage แล้ว Load Stage preset วาง Stage Token บน Scene และเพิ่มเข้า Combat พร้อมตัวละคร
2. ทอย Initiative ใน Foundry หรือใส่คะแนนเอง DM กด Begin Combat ระบบอ่าน Set/Omen จาก Stage Token โดยไม่มีหน้าต่างเลือก Stage
3. ที่ต้น Round DM กด Charge Dice — All เพื่อแจกเต๋าให้ fighters ที่ Endurance มากกว่า 0 ไม่มีปุ่ม Charge ของผู้เล่น
4. ใช้ Next/Previous Turn/Round ของ Foundry ตามปกติ Round ใหม่เรียก Set และทุกเทิร์นเรียก Omen อัตโนมัติ ลำดับ Omen วนเมื่อครบรายการ
5. ผู้เล่นล็อก Token เป้าหมายด้วย Foundry Targets แล้วกด Use บน Skill การโจมตีผู้เล่นยังใช้การ์ด Before attack / Roll / Resolve เพื่อปรับผลได้ แต่ไม่ตรวจระยะ Garden
6. ยืนยัน End Combat เพื่อล้าง Set dice ทั้งหมด การย้อน Turn/Round ไม่ย้อนความเสียหายหรือทรัพยากรที่ผ่านมา

Stage preset เดิมใช้ automation ของหนังสือ เมื่อ Omen ให้ศัตรูเลือกสกิลหรือเลือกการเคลื่อนที่ ระบบแจ้งใน Chat ให้ Director ตัดสินและกดใช้เอง หากใช้ Block Script ระบบเรียกบล็อกแทน routine เดิม

Endurance ไม่ติดเพดานค่าเริ่มต้น Defense อยู่ในช่วง 1–6 ข้อกำหนดทางหนังสือสำหรับ Endurance 0 ให้ Director ตัดสิน ปุ่ม Skill ไม่ล็อกการใช้งาน

## Bouquet และจังหวะสกิล

- **Petite Lucky:** 3 Bouquet เปลี่ยนผล Charge ลูกหนึ่ง ±1 ใช้ซ้ำได้แต่ต้องเป็นลูกเดิมทั้ง check และไม่วน 1↔6
- **Dice Boost:** 4 Bouquet เพิ่มหนึ่งลูกก่อน Attack รวมทุกคนได้ไม่เกินสามครั้งต่อ check
- **Re-roll:** 5 Bouquet ทอยทุกลูกใหม่หลัง Charge/Attack ได้ครั้งเดียวต่อ check
- เลือกผู้จ่ายก่อน ระบบส่งข้อเสนอเข้า Chat **เจ้าของตัวละครผู้รับหรือ GM กด Accept support** จึงจะหักแต้มและใช้เอฟเฟกต์ ป้องกันการช่วยที่ผู้รับไม่ยินยอมและการหักแต้มซ้ำจากการกดซ้ำ
- สกิล Reaction ใช้ผ่านปุ่ม **ใช้สกิล** บนแผ่น ในหน้าต่างที่ตรงกับกฎ เช่น Before Attack / After Roll / After Damage สกิลตอบสนองต่อ damage ใช้ก่อนเกิดเหตุการณ์ถัดไปตามการตัดสินของ Director
- การเคลื่อนที่ระบุ Garden ที่เดินเข้าทีละช่อง เช่น จาก 1 ไป 3 ใช้ `2,3`; เดินจาก 1 ไป 5 ใช้ `6,5` สำหรับสกิลที่ระบุหลายก้าว ผลต่างระยะสวนอย่างเดียวไม่แทนจำนวนก้าวที่เดิน
- ผลที่ต้องเลือกความยินยอมหรือทิศทางของผู้เล่นอื่น ให้ Director ยืนยันกับผู้เล่นนั้นก่อนเลือกในหน้าต่าง Director สามารถข้ามจังหวะและจำนวนครั้งที่ใช้ผ่านโหมด Director rulings ได้; Reaction ที่แก้ผล check ยังต้องมี check ให้แก้
- **Cosmos Order** แจ้งผู้รับให้เลือกและลบ Set die ด้วยปุ่ม −; เป็นการเลือกของผู้รับตามกฎ ไม่ใช่การสุ่มลบ
- **Around the Cosmos** รองรับการเลือกเส้นทางรายคน; ถ้าหลายคนเริ่มอยู่สวนเดียวกันใช้ path ร่วมกันได้
- **Floral Ring** เก็บ Flame Counter กดปุ่ม Flame เพื่อเลือกโต้กลับเมื่อเพิ่งได้รับความเสียหายจากตัวละคร สามารถไม่โต้กลับได้
- **Session report re-roll:** Director ตรวจรายงานเล่นแล้วติ๊กช่องนี้บนแผ่น Bringer ใช้ปุ่มบนการ์ด Charge/Attack ได้หนึ่งครั้งก่อนช่องถูกปิด อ้างอิง p.120

## Distortion, เหรียญ และแคมเปญ

**Immortal Life** เพิ่ม Distortion 1 และฟื้น Endurance เท่าผลรวม 2d6 รวมถึงชุบจาก 0 ได้ **Atypia** เพิ่ม Distortion 1, ฟื้น 4, เพิ่ม Attack ครั้งถัดไป 3 ลูก และทอยหน้าหนึ่งซ้ำจนไม่เป็นหนึ่ง เมื่อถึง Distortion 3 ระบบแจ้งว่าต้องเป็น Eclipsed ในเซสชันถัดไป ไม่เปลี่ยน Actor type กลางการต่อสู้

หลังการต่อสู้สิ้นสุด GM ใช้ Director controls ปรับ Medals ตามผลการเล่น Victory, Decisive, Unwavering, Exemplary และ Collaborative ให้ Director ตัดสินจำนวนเอง Wish Tier 1–5 ต้องการ 6/12/18/24/30 เหรียญ; Tier 6–10 ไม่ระบุจำนวนในหนังสือ

การเปลี่ยนบทบาทเป็น Eclipsed, การเข้าร่วม Covenant Council และการตัดสินว่า Wish สำเร็จเป็นการตัดสินเชิงเรื่องราวของ Director ปรับ Actor/Medals/Distortion หลังเหตุการณ์ตามหนังสือ ตัวละครและสกิลสำรองคงอยู่สำหรับเซสชันถัดไป

## ย้ายข้อมูลจากโปรเจกต์เดิม

คง `stellaknights`, Actor types `bringer`/`sheath`, Item type `ability`, `system.hp`, `defense`, `charge`, `details`, `exp`, `distortion`, `bouquet` และสกิล `number`/`charge` ของต้นฉบับ Foundry เป็นผู้ทำ core migration จาก `data`/`permission` ไป `system`/`ownership`; adaptation แก้ Hope/Despair ที่ต้นฉบับเคยเก็บผิด path

สำรอง World และ system เดิมก่อนเปิดด้วย v14 การย้าย World จาก v8/v9 ควรทำตามขั้นตอน migration ของ Foundry และรุ่นกลางที่จำเป็น การทดสอบนี้ไม่ได้รัน migration ของ Foundry จริง

สกิลเก่าที่ไม่มี rule key จะยังเก็บข้อความและช่องเดิม แต่ไม่ได้เดาความหมายจากชื่อภาษาญี่ปุ่น/เกาหลี ให้สร้างชุดสกิลจากคลังใหม่เพื่อใช้ automation; ของเก่าถูกเก็บเป็นสกิลสำรอง Custom skill ตั้ง Attack dice/Movement ได้ เอฟเฟกต์ที่เขียนเองนอกคลังให้ Director ตัดสินและปรับค่า

## Validation / ขอบเขต

- ตรวจ manifest, syntax/imports, JSON, Handlebars templates และ handler ของทั้ง 54 สกิล
- 82 Node tests ครอบคลุมการโจมตีหลายครั้ง, consent ของ Bouquet, จำกัดการใช้/การกดซ้ำ, HP/Defense, Garden, Charge ข้ามรอบ, Distortion, สกิลทั้งหมด, 33 Action routines และ session/campaign workflow
- Chromium ตรวจ static sheet layout แสดงหกสกิลและไม่มี horizontal overflow ภาพ preview เป็น layout preview ไม่ใช่ภาพจาก Foundry
- **ยังไม่ได้ทดสอบกับ Foundry v14 runtime จริง** เนื่องจากไม่มีตัวโปรแกรม/เซิร์ฟเวอร์ใน environment ใช้ API documentation v14.368 เป็นแหล่งอ้างอิง ต้องตรวจการโหลด World, sheets, socket หลายผู้เล่น และ core migration ใน Foundry ที่ติดตั้งจริงก่อนเริ่มเกมหลัก
- Socket ตรวจ ownership/GM และ serialize shared writes เหมาะกับผู้ร่วมเล่นที่เชื่อใจกันตามโมเดลของ Foundry world socket ไม่ใช่ขอบเขตความปลอดภัยสำหรับผู้เล่นที่จงใจปลอม socket payload
- ฉาก, ตัวเลือกที่ยินยอม, tie-break ของ Stage, สกิล custom และการสร้างเรื่องเล่าบางส่วนยังต้องใช้ Director ไม่ได้สร้างระบบ AI เล่าเรื่อง

## Development

```sh
npm ci
npm run build:packs
npm run check
npm test
```

Release publishing: push a tag matching `system.json` (e.g. `v1.0.0`), or run the Release workflow manually. GitHub Actions runs checks/tests, builds the package and attaches `system.json` and `stellaknights-v14.zip` to the release. The GitHub App must have access to the repository and permission to write contents/workflows.

Source layout: `module/` runtime, `data/skills.json`/`stages.json`/`references.json` book-derived mechanical reference data, `templates/` sheets/panels, `tests/` document/roll test doubles. No book PDF or copied illustrations are bundled.

## Attribution

Upstream: ltaeng / ksx0330 — [FVTT-StellaKnights-System](https://github.com/ksx0330/FVTT-StellaKnights-System), commit `fe9ddad513ef8b60e925c58338ea258da6dcf1ec` (0.0.3). Upstream `LICENSE.txt` is retained unchanged. Code modifications follow the MIT license in `LICENSE` (Copyright 2026 NicoRaz); the upstream MIT notice in `LICENSE.txt` is retained as well.

Rules reference: the user-provided `Stellar_Knights_01.pdf`, unofficial fan translation of Silver Blades, Stellar Knights, translation dated May 10, 2025. Book text and game material retain their respective owners' rights; the MIT code license does not relicense that material. Mechanical catalog names/text are kept in English for correspondence with the supplied book, with Thai interface labels and this guide.
