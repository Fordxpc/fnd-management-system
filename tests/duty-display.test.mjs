import assert from 'node:assert/strict';
import { groupDutyDisplayEntries as group, deduplicateDutyEntries } from '../src/lib/duty-identity.ts';
const department = 'Ground Operations';
const records = [
  ['a', 'Adam Faisal'], ['b', 'Adam Faisal'],
  ['c', 'Adam Shakir'], ['d', 'Adam Skakir'],
  ['e', 'Mohamed Fuadh'], ['f', 'Mohamed Fuadhu'],
  ['g', 'Mohamed Adam'], ['h', 'Mohamed Adam'],
  ['i', 'Mohamed Nadheem'],
].map(([id,staffName])=> ({id,staffId:id,staffName,staffDepartment:department,shiftTime:'06:00 - 14:00'}));
const staff = records.map((entry, index)=> ({id:entry.staffId,sn:`SN-${index+1000}`,name:entry.staffName,department}));
const verified = deduplicateDutyEntries(records, staff);
assert.equal(verified.length, 9, 'Do not collapse distinct verified staff IDs');
const display = group(verified);
assert.equal(display.length, 9, 'Different verified SNs are kept separate, even with similar names');
assert.equal(display.filter(g=>g.possibleDuplicate).length,0);
assert.equal(display.find(g=>g.staffName==='Mohamed Nadheem')?.possibleDuplicate,false);
assert.equal(group([{ ...records[0], shiftTime:'08:00 - 16:00' }, records[1]]).length,2, 'Different shift times cannot be grouped');
assert.equal(group([{ ...records[0], staffSn: undefined }, { ...records[1], staffSn: undefined }]).length,1, 'Only uncertain, unnumbered name matches are grouped for review');
assert.equal(group([{ ...records[0], staffDepartment: 'Security' }, records[1]]).length,2, 'Different departments cannot be grouped');
console.log('Duty presentation grouping passed.');
