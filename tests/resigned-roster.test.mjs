import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isInactiveStaff,
  resignationLastDay,
  shouldDisplayResigned,
  showStaffInRosterPeriod,
} from '../src/lib/resigned-roster.ts';

const resigned = {status: 'resigned', resignationLastDay: '2026-11-05'};

test('active staff can appear on rosters', () => {
  assert.equal(isInactiveStaff({status:'active'}),false);
  assert.equal(showStaffInRosterPeriod({status:'active'},'2026-11-16'),true);
  assert.equal(shouldDisplayResigned({status:'active',resignationLastDay:'2026-11-05'},'2026-11-06','2026-10-16','2026-11-15'),false);
});

test('offboarded staff remain visible in their last 16th–15th roster period', () => {
  assert.equal(isInactiveStaff(resigned),true);
  assert.equal(showStaffInRosterPeriod(resigned,'2026-10-16'),true);
  assert.equal(shouldDisplayResigned(resigned,'2026-11-04','2026-10-16','2026-11-15'),false);
  assert.equal(shouldDisplayResigned(resigned,'2026-11-05','2026-10-16','2026-11-15'),false);
  assert.equal(shouldDisplayResigned(resigned,'2026-11-06','2026-10-16','2026-11-15'),true);
  assert.equal(shouldDisplayResigned(resigned,'2026-11-15','2026-10-16','2026-11-15'),true);
});

test('resigned staff are excluded from following roster period', () => {
  assert.equal(showStaffInRosterPeriod(resigned,'2026-11-16'),false);
  assert.equal(showStaffInRosterPeriod(resigned,'2026-09-16'),true);
  assert.equal(shouldDisplayResigned(resigned,'2026-11-17','2026-11-16','2026-12-15'),false);
});

test('staff without a verified last working day do not acquire synthetic RES cells', () => {
  const archived = {status:'archived', resignationLastDay:null};
  assert.equal(isInactiveStaff(archived),true);
  assert.equal(resignationLastDay(archived),null);
  assert.equal(shouldDisplayResigned(archived,'2026-11-06','2026-10-16','2026-11-15'),false);
  assert.equal(showStaffInRosterPeriod(archived,'2027-01-16',false),false);
});
