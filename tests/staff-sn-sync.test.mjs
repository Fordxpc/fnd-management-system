import assert from 'node:assert/strict';
import { canonicalSn, staffNumberConflict, deduplicateDutyEntries, reconcileDutyAvailability, groupDutyDisplayEntries, reviewKnownStaffIdentityCollisions } from '../src/lib/duty-identity.ts';

assert.equal(canonicalSn('SN-0038'), '0038');
assert.equal(canonicalSn('0038'), '0038');
assert.equal(canonicalSn('sn 38'), '0038');
assert.equal(canonicalSn('SN-0729'), '0729');
assert.equal(staffNumberConflict([{ id:'a', sn: 'SN-0038' }], '38')?.id, 'a');
assert.equal(staffNumberConflict([{ id:'a', sn: 'SN-0038' }], '38', 'a'), undefined);

const dept = 'Ground Operations';
const staff = [
  { id:'faisal-good', sn: 'SN-0037', name: 'Adam Faisal', department:dept },
  { id:'shakir-good', sn: 'SN-0038', name: 'Adam Shakir', department:dept },
  { id:'fuadhu-good', sn: 'SN-0729', name: 'Mohamed Fuadhu', department:dept },
  { id:'adam-good', sn: 'SN-0757', name: 'Mohamed Adam', department:dept },
  { id:'faisal-old', sn: 'SN-9001', name: 'Adam Faisal', department:dept },
  { id:'shakir-old', sn: 'SN-9002', name: 'Adam Skakir', department:dept },
  { id:'fuadhu-old', sn: 'SN-9003', name: 'Mohamed Fuadh', department:dept },
  { id:'adam-old', sn: 'SN-9004', name: 'Mohamed Adam', department:dept },
];
const reviews = reviewKnownStaffIdentityCollisions(staff);
assert.equal(reviews.length, 4, 'four wrong duplicate profiles are flagged for review, not deleted');
assert.ok(reviews.some(row => row.name === 'Adam Skakir' && row.correctName === 'Adam Shakir'));
assert.ok(reviews.some(row => row.name === 'Mohamed Fuadh' && row.correctName === 'Mohamed Fuadhu'));
const duty = staff.map((person, i) => ({
 id:`r${i}`, staffId:person.id, staffName:person.name, staffDepartment:dept,
 status:'scheduled', shiftTime:'06:00 - 14:00'
}));
const unique = deduplicateDutyEntries(duty, staff);
assert.equal(unique.length, 4, 'verified official staff numbers collapse old duplicate duty records');
assert.deepEqual(unique.map(x=>x.staffName).sort(), ['Adam Faisal','Adam Shakir','Mohamed Adam','Mohamed Fuadhu']);
assert.equal(groupDutyDisplayEntries(unique).filter(x=>x.possibleDuplicate).length,0);
assert.equal(unique.find(x=>x.staffName==='Adam Shakir')?.staffSn, '0038');
assert.equal(unique.find(x=>x.staffName==='Mohamed Fuadhu')?.staffSn, '0729');

const leave = [{staffId:'shakir-good', staffName:'Adam Shakir', staffDepartment:dept, status:'approved'}];
const conflict = reconcileDutyAvailability(duty, leave, staff);
assert.equal(conflict.conflictingDutyEntries.length, 2, 'both good and typo Shakir rows withheld on approved leave');
assert.ok(conflict.conflictingDutyEntries.every(x => x.reason !== 'name-review'));

// Never merge unrelated staff simply because a typo looks similar; only the
// verified names in the authoritative directory can canonicalize an alias.
const unrelated = [
  { id: 'u1', sn: 'SN-8001', name: 'Ali Hassan', department: dept },
  { id: 'u2', sn: 'SN-8002', name: 'Ali Hasaan', department: dept },
];
const unrelatedDuty = unrelated.map(person=>({staffId:person.id,staffName:person.name,staffDepartment:dept,shiftTime:'06:00 - 14:00'}));
assert.equal(deduplicateDutyEntries(unrelatedDuty,unrelated).length,2);
console.log('Staff SN synchronization and confirmed spellings tests passed.');
