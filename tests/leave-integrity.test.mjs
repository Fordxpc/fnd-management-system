import assert from 'node:assert/strict';
import { leaveDateRange, countLeaveDays, overlappingLeaveRequest, approvalRosterConflict, auditLeaveRosterIntegrity } from '../src/lib/leave-integrity.ts';
const days = leaveDateRange('2026-11-05', '2026-11-18');
assert.equal(days.length, 14);
assert.equal(countLeaveDays('ANNUAL LEAVE', days), 12);
assert.equal(countLeaveDays('ANNUAL LEAVE', days, ['2026-11-07']), 11);
assert.equal(countLeaveDays('SICK LEAVE', days), 14);
assert.throws(() => leaveDateRange('2026-02-30', '2026-03-02'), /Invalid/);
assert.throws(() => leaveDateRange('2026-11-20', '2026-11-05'), /end date/);
assert.throws(() => leaveDateRange('2026-11-05', '2028-11-05'), /exceed/);
assert.equal(approvalRosterConflict([], 'new'), null);
assert.equal(approvalRosterConflict([{ leaveRequestId: null }], 'new'), null);
assert.match(approvalRosterConflict([{ leaveRequestId: 'other' }], 'new'), /Another approved/);
assert.match(approvalRosterConflict([{ leaveRequestId: 'new' }], 'new'), /already/);
assert.match(approvalRosterConflict([{ leaveRequestId: null }, { leaveRequestId: null }], 'new'), /Multiple/);
const existing = [{ id:'a',staffId:'one',startDate:'2026-11-05',endDate:'2026-11-18',status:'approved' },
                  { id:'b',staffId:'one',startDate:'2026-11-15',endDate:'2026-11-15',status:'rejected' }];
assert.equal(overlappingLeaveRequest(existing,'one','2026-11-04','2026-11-07')?.id,'a');
assert.equal(overlappingLeaveRequest(existing,'one','2026-11-15','2026-11-15','a'),undefined);
assert.equal(overlappingLeaveRequest(existing,'two','2026-11-05','2026-11-18'),undefined);
const leaves = [{ id:'a',staffId:'one',startDate:'2026-11-05',endDate:'2026-11-05',leaveType:'ANNUAL LEAVE',days:1,status:'approved' }];
const validRoster = [{ id:'r1',staffId:'one',date:'2026-11-05',status:'ANNUAL LEAVE',leaveRequestId:'a',previousStatus:'OFF DAY' }];
const staff = [{ id:'one',name:'Test Staff',sn:'SN-0001' }];
const clean = auditLeaveRosterIntegrity(leaves,validRoster,[],staff);
assert.equal(clean.totalIssues,0);
const broken = auditLeaveRosterIntegrity(leaves,[
  { ...validRoster[0],previousStatus:null },
  { id:'r2',staffId:'one',date:'2026-11-05',status:'scheduled',leaveRequestId:null },
  { id:'r3',staffId:'one',date:'2026-11-06',status:'SICK LEAVE',leaveRequestId:'missing' }
], [],staff);
assert.equal(broken.counts.duplicate_roster,1);
assert.equal(broken.counts.missing_restore_snapshot,1);
assert.equal(broken.counts.orphaned_roster_leave,1);
const noRoster = auditLeaveRosterIntegrity(leaves,[],[],staff);
assert.equal(noRoster.counts.approved_leave_missing_roster,1);
const overlap = auditLeaveRosterIntegrity([...leaves,{ ...leaves[0],id:'b',startDate:'2026-11-05' }], validRoster,[],staff);
assert.equal(overlap.counts.overlapping_approved_leave,1);
console.log('Phase 6 leave integrity validations passed.');
