import assert from 'node:assert/strict';
import { reconcileDutyAvailability } from '../src/lib/duty-identity.ts';

const department = 'Ground Operations';
const duty = { id: 'r1', staffId: 'duty-1', staffName: 'Adam Skakir', staffDepartment: department, status: 'scheduled', shiftTime: '06:00 - 14:00' };
const leave = { id: 'l1', staffId: 'leave-1', staffName: 'Adam Shakir', staffDepartment: department, status: 'approved', leaveType: 'SICK LEAVE / MC' };
const directory = [
  { id: 'duty-1', sn: 'SN-1001', name: 'Adam Skakir', department },
  { id: 'leave-1', sn: 'SN-2002', name: 'Adam Shakir', department },
];

// The specific regression reported from the Dashboard screenshot.
const spellingConflict = reconcileDutyAvailability([duty], [leave], directory);
assert.equal(spellingConflict.visibleDutyEntries.length, 0, 'possible spelling alias on leave cannot appear as confirmed on-duty');
assert.equal(spellingConflict.conflictingDutyEntries.length, 1);
assert.equal(spellingConflict.conflictingDutyEntries[0].reason, 'name-review');

// Verified ID or staff-number matches override different stored spellings.
const idConflict = reconcileDutyAvailability([duty], [{ ...leave, staffId: 'duty-1' }], directory);
assert.equal(idConflict.conflictingDutyEntries[0].reason, 'staff-id');
const snConflict = reconcileDutyAvailability([duty], [leave], [
  directory[0], { ...directory[1], sn: 'SN-1001' },
]);
assert.equal(snConflict.conflictingDutyEntries[0].reason, 'staff-number');

// An unrelated duty assignment in another department is preserved.
const unrelated = reconcileDutyAvailability([duty], [
  { ...leave, staffDepartment: 'Maintenance' },
], [directory[0], { ...directory[1], department: 'Maintenance' }]);
assert.equal(unrelated.visibleDutyEntries.length, 1);
assert.equal(unrelated.conflictingDutyEntries.length, 0);

// Non-duty roster statuses conflict with a simultaneous scheduled shift.
const offDay = reconcileDutyAvailability([duty], [
  { id: 'off1', staffId: 'duty-1', staffName: 'Adam Skakir', staffDepartment: department, status: 'off' },
], directory);
assert.equal(offDay.visibleDutyEntries.length, 0);
assert.equal(offDay.conflictingDutyEntries[0].reason, 'staff-id');

// No conflict does not change any existing duty records.
const noConflict = reconcileDutyAvailability([duty], [], directory);
assert.deepEqual(noConflict.visibleDutyEntries, [duty]);
assert.deepEqual(noConflict.conflictingDutyEntries, []);
console.log('Dashboard duty availability regression tests passed.');
