// Preserve upstream system.hp/defense/charge/details/exp and Item ability fields.
const f = foundry.data.fields;
const str = (initial = "") => new f.StringField({required: true, blank: true, initial});
const num = (initial = 0, min = 0, max = 999) => new f.NumberField({required: true, initial, integer: true, min, max});
const bool = () => new f.BooleanField({required: true, initial: false});
const schema = o => new f.SchemaField(o);
function details() {
  return schema({age: str(), sex: str(), career: str(), story: str(),
    karma: schema({type: str("hope"), detail: str()}), wish: str(),
    personality: schema({first: str(), second: str()}), crest: schema({color: str("Black"), flower: str("Rose")}),
    keyword: str(), biography: str(), partner: str(), wishTier: num(1, 1, 10), weapon: str(), dress: str(), scars: str()});
}
export class FighterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {details: details(), hp: schema({value: num(), min: num(), max: num()}),
      defense: schema({value: num(1, 1, 6), min: num(1, 1, 6)}), charge: schema({value: num(), min: num()}),
      exp: num(), distortion: num(0, 0, 3), bouquet: num(), bouquetSpent: num(), garden: num(1, 1, 6),
      enemy: bool(), done: bool(), atypia: bool(), reportReroll: bool(), flames: num(), blessings: schema({hp: num(), charge: num(), attack: num()}),
      modifiers: new f.ArrayField(new f.ObjectField(), {initial: []})};
  }
  static migrateData(source) {
    if (source.defense && source.defense.value < 1) source.defense.value = 3;
    // Upstream templates accidentally stored Hope/Despair outside details.
    if (source.karma) {source.details ??= {}; source.details.karma ??= source.karma; delete source.karma;}
    return super.migrateData(source);
  }
}
export class SheathData extends foundry.abstract.TypeDataModel {
  static defineSchema() {return {details: details()};}
}
export class AbilityData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {type: str(), class: str(), timing: str("Your Turn"), word: str(), effect: str(),
      charge: num(), number: num(0, 0, 6), key: str(), parentType: str(), parentKey: str(), page: num(), timingKey: str("your-turn"),
      scriptEnabled:bool(),blocks:new f.ArrayField(schema({op:str("roll"),value:num(1,-100,100),face:num(1,1,6),source:str("fixed"),target:str("targets"),text:str(),stat:str("attack"),duration:str("round")}),{initial:[]}),
      attackDice: num(0, 0, 99), move: num(0, 0, 6), uses: new f.ObjectField({initial: {}})};
  }
}

export class CrestData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {key:str(),description:str(),stats:schema({hp:num(),defense:num(0,0,6),charge:num()}),
      skillKeys:new f.ArrayField(str(),{initial:[]})};
  }
}

export class StageData extends foundry.abstract.TypeDataModel {
  static defineSchema(){return {garden:num(1,1,6),key:str(),description:str(),setText:str(),omen:num(),routines:new f.ArrayField(schema({name:str(),text:str()}),{initial:[]})};}
}
