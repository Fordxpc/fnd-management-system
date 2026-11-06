import assert from 'node:assert/strict';
import { EMPTY_ROSTER_BEFORE_LEAVE, snapshotRosterBeforeLeave as snapshot } from '../src/lib/roster-restore.ts';
assert.deepEqual(snapshot([]), { previousStatus: EMPTY_ROSTER_BEFORE_LEAVE, previousShiftTime: null });
assert.deepEqual(snapshot([{ status: 'scheduled', shiftTime: '06:00 - 14:00' }]), {
  previousStatus: 'scheduled', previousShiftTime: '06:00 - 14:00'
});
assert.deepEqual(snapshot([{ status: 'OFF DAY' }]), { previousStatus: 'OFF DAY', previousShiftTime: null });
assert.deepEqual(snapshot([{ status: 'ABSENT' }]), { previousStatus: 'ABSENT', previousShiftTime: null });
assert.deepEqual(snapshot([{ status: 'OFF DAY' }, { status: 'OFF DAY' }]), { previousStatus: 'OFF DAY', previousShiftTime: null });
assert.throws(() => snapshot([{ status: 'scheduled', shiftTime: '06:00 - 14:00' }, { status: 'OFF DAY' }]), /Conflicting/);
assert.throws(() => snapshot([{ status: 'ANNUAL LEAVE' }]), /pre-existing/);
assert.throws(() => snapshot([{ status: 'ANNUAL LEAVE', leaveRequestId: 'leave-a' }]), /approved leave/);
console.log('Roster restoration snapshots passed.');
