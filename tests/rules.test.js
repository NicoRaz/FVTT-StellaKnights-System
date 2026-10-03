import test from 'node:test';
import assert from 'node:assert/strict';
import {COLORS,allocate,gardenDistance,adjacent,opposite,toward,successes,shiftDie,endurance,enemyBlessing,wishMedals} from '../module/rules.js';
import {validatePath} from '../module/skills-engine.js';
test('Charge dice allocate independently to slots and do not sum faces',()=>assert.deepEqual(allocate([1,1,2,3,6]),[2,1,1,0,0,1]));
test('Six Gardens form a ring, never through the center',()=>{
 assert.equal(gardenDistance(1,6),1);assert.equal(gardenDistance(1,4),3);assert.equal(opposite(2),5);
 assert.equal(adjacent(1,5),false);assert.equal(toward(6),1);assert.throws(()=>gardenDistance(0,1));
 assert.deepEqual(validatePath(1,[6,5],2,3),[6,5]);assert.throws(()=>validatePath(1,[4],1,2));
});
test('Each die at or over Defense deals one damage, Defense is clamped',()=>{
 assert.equal(successes([1,2,3,4,5,6],3),4);assert.equal(successes([1,6],99),1);assert.equal(successes([1,6],-1),2);
});
test('Petite Lucky has one chosen die, can repeat and cannot wrap',()=>{
 assert.deepEqual(shiftDie([1,3],0,1),[2,3]);assert.deepEqual(shiftDie([2,3],0,1,0),[3,3]);
 assert.throws(()=>shiftDie([1,6],0,-1));assert.throws(()=>shiftDie([1,6],1,1));assert.throws(()=>shiftDie([1,3],1,1,0));
});
test('Endurance can exceed initial; ordinary healing cannot revive',()=>{
 assert.equal(endurance(16,9),25);assert.equal(endurance(2,-7),0);assert.throws(()=>endurance(0,4));assert.equal(endurance(0,4,{revive:true}),4);
});
test('Enemy blessings use Knight count and Purple rolls two base Charge dice',()=>{
 assert.deepEqual(enemyBlessing(3),{hp:15,charge:0,attack:1});assert.deepEqual(enemyBlessing(5),{hp:25,charge:2,attack:1});assert.equal(COLORS.Purple.charge,2);
});
test('Wishes require 6/12/18/24/30 medals; higher tiers are unspecified',()=>{
 assert.equal(wishMedals(1),6);assert.equal(wishMedals(5),30);assert.equal(wishMedals(10),null);
});
