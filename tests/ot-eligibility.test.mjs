import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OT_POLICY, otPeriod, otWeekStart, calculateOTWeek, calculateOTPeriod,
  normalizeOtPolicy, shiftDuration,
} from '../src/lib/ot-eligibility.ts';
const person = 't1';
const policy = { ...DEFAULT_OT_POLICY, deductLeaves: ['SICK LEAVE', 'SICK LEAVE / MC', 'FAMILY RESPONSIBILITY LEAVE (FRL)'] };
const shifts = (start, count) => Array.from({ length: count }, (_,i) => ({ staffId:person, date: new Date(new Date(`${start}T00:00:00Z`).getTime()+i*86400000).toISOString().slice(0,10), status:'scheduled', shiftTime:'06:00 - 14:00' }));
const ot = (id,date,hours,status='approved') => ({ id, staffId:person, date, hours, status });
const leave = (type,startDate,endDate) => ({ staffId:person, status:'approved', leaveType:type, startDate,endDate });
test('16-15 period, including January rollover', () => {
  assert.deepEqual(otPeriod('2026-11'), {from:'2026-10-16',to:'2026-11-15'});
  assert.deepEqual(otPeriod('2027-01'), {from:'2026-12-16',to:'2027-01-15'});
});
test('Saturday-Friday week stays intact when crossing a monthly cutoff', () => {
  assert.equal(otWeekStart('2026-11-16'),'2026-11-14');
  assert.equal(otWeekStart('2026-11-15'),'2026-11-14');
});
test('one excluded 8h SL day makes 8 of 12 approved OT hours ineligible in that week', () => {
  const week = calculateOTWeek(person,'2026-11-14',48,[ot('ot1','2026-11-16',12)],shifts('2026-11-14',5),[leave('SICK LEAVE','2026-11-19','2026-11-19')],policy);
  assert.equal(week.dutyHours,40);
  assert.equal(week.approvedOtHours,12);
  assert.equal(week.eligibleOtHours,4);
  assert.equal(week.ineligibleOtHours,8);
});
test('shortfall is isolated: following fully staffed week gets all approved OT eligible', () => {
  const a = calculateOTWeek(person,'2026-11-14',48,[ot('a','2026-11-16',12)],shifts('2026-11-14',5),[leave('SICK LEAVE','2026-11-19','2026-11-19')],policy);
  const b = calculateOTWeek(person,'2026-11-21',48,[ot('b','2026-11-23',10)],shifts('2026-11-21',6),[],policy);
  assert.equal(a.ineligibleOtHours,8);
  assert.equal(b.ineligibleOtHours,0);
  assert.equal(b.eligibleOtHours,10);
});
test('non-excluded annual leave credits weekly duty, without double counting OFF days', () => {
  const r = [...shifts('2026-11-14',4), { staffId:person, date:'2026-11-18',status:'OFF DAY',shiftTime:'' }];
  const result = calculateOTWeek(person,'2026-11-14',40,[ot('a','2026-11-16',8)],r,[leave('ANNUAL LEAVE','2026-11-19','2026-11-19')],policy);
  assert.equal(result.dutyHours,40);
  assert.equal(result.eligibleOtHours,8);
});
test('FRL: only final 6 days are excluded when selected by manager', () => {
  const r = calculateOTWeek(person,'2026-11-14',48,[ot('a','2026-11-17',10)],[],[leave('FAMILY RESPONSIBILITY LEAVE (FRL)','2026-11-10','2026-11-20')],policy);
  assert.equal(r.excludedLeaveDates.length,6);
  assert.equal(r.creditedLeaveHours,8); // November 14 is before final six; Nov 15-20 excluded
});
test('month boundary prorates week deduction rather than doubling it', () => {
  const entries=[ot('a','2026-11-15',6),ot('b','2026-11-16',6)];
  const roster = shifts('2026-11-14',5);
  const leaves=[leave('SICK LEAVE','2026-11-19','2026-11-19')];
  const first=calculateOTPeriod('2026-11',person,48,entries,roster,leaves,policy,80);
  const second=calculateOTPeriod('2026-12',person,48,entries,roster,leaves,policy,80);
  assert.equal(first.ineligibleHours + second.ineligibleHours,8);
  assert.equal(first.eligibleHours + second.eligibleHours,4);
  assert.equal(first.estimatedEligibleIncomeMvr + second.estimatedEligibleIncomeMvr,320);
});
test('pending/rejected OT not paid, rate absent means no guessed income', () => {
  const result=calculateOTPeriod('2026-12',person,48,[ot('a','2026-11-23',10),ot('b','2026-11-23',5,'pending'),ot('c','2026-11-24',3,'rejected')],shifts('2026-11-21',6),[],policy);
  assert.equal(result.approvedHours,10);
  assert.equal(result.pendingHours,5);
  assert.equal(result.estimatedEligibleIncomeMvr,null);
});
test('overnight shifts and invalid rate/settings are handled safely',()=>{
  assert.equal(shiftDuration('22:00 - 06:00'),8);
  assert.equal(normalizeOtPolicy({regularHours:-3,deductLeaves:['SL','SL','MC'],leaveDayHours:100}).regularHours,48);
  assert.deepEqual(normalizeOtPolicy({deductLeaves:['SL','SL','MC']}).deductLeaves,['SICK LEAVE','SICK LEAVE / MC']);
});

test('allocation rounds without negative eligible hours for many tiny OT entries', () => {
  const entries=Array.from({length:10},(_,i)=>ot(`a${i}`,'2026-11-16',0.01));
  const w=calculateOTWeek(person,'2026-11-14',47.98,entries,shifts('2026-11-14',6),[],policy);
  assert.equal(w.ineligibleOtHours,0);
  assert.equal(w.allocations.reduce((sum,a)=>sum+a.eligibleHours,0).toFixed(2),'0.10');
  const short=calculateOTWeek(person,'2026-11-14',48.02,entries,shifts('2026-11-14',6),[],policy);
  assert.equal(short.ineligibleOtHours,0.02);
  assert.equal(short.allocations.every(a=>a.eligibleHours>=0 && a.ineligibleHours<=a.approvedHours),true);
  assert.equal(short.allocations.reduce((sum,a)=>sum+a.ineligibleHours,0).toFixed(2),'0.02');
});
