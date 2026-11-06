import assert from 'node:assert/strict';
import { buildDutyConflictReport } from '../src/lib/duty-conflict-report.ts';

const directory = [
  {id: 'shakir', sn: 'SN-0038', name: 'Adam Shakir'},
  {id: 'legacy', sn: 'SN-9002', name: 'Adam Skakir'},
  {id: 'fuadhu', sn: 'SN-0729', name: 'Mohamed Fuadhu'},
];
const duty = { id: 'roster1', staffId: 'legacy', staffName: 'Adam Skakir', date: '2026-11-06', shiftTime: '06:00 - 14:00' };
const leave = { id: 'leave1', staffId: 'shakir', staffName: 'Adam Shakir', leaveType: 'SICK LEAVE / MC', startDate: '2026-11-06', endDate: '2026-11-06' };
const report = buildDutyConflictReport([{entry: duty, unavailable: leave, reason: 'name-review'}], directory);
assert.equal(report.length, 1);
assert.equal(report[0].rosterSn, 'SN-9002');
assert.equal(report[0].unavailableSn, 'SN-0038');
assert.equal(report[0].needsIdentityReview, true);
assert.match(report[0].evidence, /verify/i);
assert.equal(report[0].rosterEntryId, 'roster1');
assert.equal(report[0].unavailableType, 'Approved leave');
assert.equal(report[0].unavailableDates, '2026-11-06');

const linked = buildDutyConflictReport([{entry: {...duty, staffId:'shakir'}, unavailable: leave, reason:'staff-id'}], directory);
assert.equal(linked[0].needsIdentityReview, false);
assert.match(linked[0].evidence, /Same linked staff ID/);

const sameSn = buildDutyConflictReport([{entry: {...duty, staffId:'absent', staffSn:'SN-0729'}, unavailable: {...leave, staffId:'fuadhu'}, reason:'staff-number'}], directory);
assert.equal(sameSn[0].needsIdentityReview, false);
assert.match(sameSn[0].evidence, /Same verified SN/);

const duplicatedSn = buildDutyConflictReport([{entry: {...duty, staffId:'legacy', staffSn:'SN-0038'}, unavailable: leave, reason:'staff-number'}],
  [...directory, {id:'duplicateShakir', sn:'SN-0038', name:'Adam Shakir'}]);
assert.equal(duplicatedSn[0].needsIdentityReview, true, 'duplicate directory staff numbers are not treated as verified');

const missing = buildDutyConflictReport([{entry: {id:'r2',staffName:'Unknown A'}, unavailable:{id:'l2',staffName:'Unknown B'},reason:'name-review'}], []);
assert.equal(missing[0].needsIdentityReview, true);
assert.equal(missing[0].rosterSn, 'SN missing');
assert.equal(missing[0].unavailableSn, 'SN missing');
console.log('Duty conflict review report tests passed.');
