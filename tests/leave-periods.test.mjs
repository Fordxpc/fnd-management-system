import assert from 'node:assert/strict';
import { displayLeavePeriods, ROSTER_ORIGIN } from '../src/lib/leave-periods.ts';
const base = { staffId: 'id-shakir', staffSn: 'SN-0038', leaveType: 'SICK LEAVE / MC', status: 'approved' };
const make = (id, startDate, endDate, reviewedAt, reviewedBy, extra = {}) => ({...base,id,startDate,endDate,reviewedAt,reviewedBy,days:1,...extra});
const rows = [
 make('a','2026-11-03','2026-11-04','2026-11-05T07:21:00+05:00','manager@example.com',{days:2}),
 make('b','2026-11-05','2026-11-05','2026-11-05T07:29:00+05:00','manager@example.com'),
 make('c','2026-11-06','2026-11-08','2026-11-06T03:36:00+05:00','developer@example.com',{reason: ROSTER_ORIGIN, days:3}),
];
const merged = displayLeavePeriods(rows);
assert.equal(merged.length, 1);
assert.deepEqual([merged[0].startDate, merged[0].endDate, merged[0].days], ['2026-11-03','2026-11-08',6]);
assert.deepEqual(merged[0].records.map(r => r.id), ['a','b','c']);
assert.equal(merged[0].hasDifferentRecordedAccounts, true);
assert.equal(rows[0].startDate,'2026-11-03');
assert.equal(displayLeavePeriods(rows.map(r => ({...r,staffId: r.id}))).length, 1); // SN is authoritative
assert.equal(displayLeavePeriods(rows.map(r => ({...r,staffSn: `SN-${r.id}`}))).length, 3);
assert.equal(displayLeavePeriods([rows[0], {...rows[1], reviewedBy:'other@example.com'}]).length, 2);
assert.equal(displayLeavePeriods([rows[0], {...rows[1], reviewedAt:'2026-11-12T12:00:00+05:00'}]).length, 2);
assert.equal(displayLeavePeriods([rows[0], {...rows[1], startDate:'2026-11-09', endDate:'2026-11-09'}]).length, 2);
assert.equal(displayLeavePeriods([rows[0], {...rows[1], leaveType:'ANNUAL LEAVE'}]).length, 2);
assert.equal(displayLeavePeriods([rows[0], {...rows[1], status:'pending'}]).length, 2);
assert.equal(displayLeavePeriods([rows[0], {...rows[1], reviewedAt: null}]).length, 2);
const annual=[make('d','2026-11-05','2026-11-05','2026-11-06T02:00:00Z','manager@example.com',{leaveType:'ANNUAL LEAVE'}),make('e','2026-11-06','2026-11-08','2026-11-06T03:00:00Z','manager@example.com',{leaveType:'ANNUAL LEAVE'})];
assert.equal(displayLeavePeriods(annual,['2026-11-07'])[0].days,2); // Friday and holiday excluded
console.log('leave display period tests: passed');
