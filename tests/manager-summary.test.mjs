import assert from 'node:assert/strict';
import { buildManagerSummary } from '../src/lib/manager-summary.ts';
const data = {
 roster: [
  { staffId:'1', date:'2026-11-06', status:'Scheduled', staffDepartment:'Ground Operations' },
  { staffId:'1', date:'2026-11-06', status:'Scheduled', staffDepartment:'Ground Operations' },
  { staffId:'2', date:'2026-11-06', status:'OFF', staffDepartment:'Maintenance' },
 ],
 leaves:[{status:'approved', startDate:'2026-11-05',endDate:'2026-11-09',staffDepartment:'Ground Operations'}],
 overtime:[{status:'approved',date:'2026-11-06',hours:2.5,staffDepartment:'Ground Operations'}, {status:'pending',date:'2026-11-06',hours:3, staffDepartment:'Maintenance'}],
 flights:[{date:'2026-11-06'}], birds:[],fod:[],ramp:[],lights:[],
};
const result = buildManagerSummary(data, '2026-11-06','2026-11-06');
assert.equal(result.roster.dutyShifts,1);
assert.equal(result.roster.duplicates,1);
assert.equal(result.leave.approved,1);
assert.equal(result.overtime.approvedHours,2.5);
assert.equal(result.overtime.pending,1);
assert.equal(result.operations.scheduledFlights,1);
assert.equal(buildManagerSummary(data,'2026-11-06','2026-11-06','Maintenance').leave.approved,0);
console.log('PASS manager report totals');
