import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createState,addHabit,toggleHabit,changeWater,submitReflection,escapeHTML} from '../dist/assets/state.js';

test('a new session does not inherit personal entries, preferences, or habits',()=>{
  const first=createState();first.name='Sample';first.habits[0].done=true;submitReflection(first,'morning',{mood:4,intention:'Take a walk'});
  const next=createState();assert.equal(next.name,'');assert.equal(next.morning,null);assert.equal(next.habits[0].done,false);
});
test('habits toggle independently and ignore unknown identifiers',()=>{
  const state=createState();toggleHabit(state,1);assert.equal(state.habits[0].done,true);assert.equal(state.habits[1].done,false);toggleHabit(state,1);toggleHabit(state,999);assert.equal(state.habits[0].done,false);
});
test('custom habits reject empty/duplicate names and enforce a useful limit',()=>{
  const state=createState();assert.equal(addHabit(state,'  '),false);assert.equal(addHabit(state,'STEP OUTSIDE'),false);
  for(let i=0;i<5;i++)assert.equal(addHabit(state,`Custom ${i}`),true);
  assert.equal(state.habits.length,8);assert.equal(addHabit(state,'Ninth'),false);
  assert.equal(new Set(state.habits.map(h=>h.id)).size,8);
});
test('water cannot become negative or exceed the preview limit',()=>{const state=createState();changeWater(state,-1);assert.equal(state.water,0);changeWater(state,1);assert.equal(state.water,1);changeWater(state,100);assert.equal(state.water,20);});
test('reflections require a valid mood and only keep allowed fields',()=>{
  const state=createState();assert.throws(()=>submitReflection(state,'morning',{mood:0}));assert.throws(()=>submitReflection(state,'morning',{mood:'4'}));assert.throws(()=>submitReflection(state,'other',{mood:4}));
  submitReflection(state,'morning',{mood:4,intention:'  A calm start  ',unexpected:'private'});assert.equal(state.morning.intention,'A calm start');assert.equal(state.morning.unexpected,undefined);assert.equal(state.evening,null);
});
test('evening reflection does not overwrite morning; edits replace only one entry',()=>{
  const state=createState();submitReflection(state,'morning',{mood:3,intention:'Walk'});submitReflection(state,'evening',{mood:5,word:'Grounded'});submitReflection(state,'evening',{mood:4,word:'Quiet'});
  assert.equal(state.morning.intention,'Walk');assert.equal(state.evening.word,'Quiet');assert.equal(state.evening.mood,4);
});
test('user-generated strings are escaped for text and attributes',()=>{
  assert.equal(escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');assert.equal(escapeHTML("A&B's"),'A&amp;B&#39;s');
});
