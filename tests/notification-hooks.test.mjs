import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const api=readFileSync(new URL('../functions/api/[[path]].ts',import.meta.url),'utf8');
for (const event of ['leave:submitted:', 'leave:approved:', 'leave:rejected:',
  'ot:submitted:', 'ot:approved:', 'ot:rejected:', 'password-reset:completed:', 'password-reset:'])
  assert.ok(api.includes(event),`Missing event ${event}`);
assert.ok(api.includes('eq(appNotifications.userId, currentUser.id)'));
assert.ok(api.includes('eq(appPushSubscriptions.userId, currentUser.id)'));
assert.ok(api.includes('onConflictDoNothing().returning'));
const start=api.indexOf('if (pathname === "/api/leave-requests" && method === "POST")');
const end=api.indexOf('if (url.pathname.startsWith("/api/leave-requests/")',start);
assert.ok(api.slice(start,end).includes('emitNotifications'));
assert.ok(api.includes('const isPublicRequest ='));
console.log('PASS notification hook and user scope checks');
