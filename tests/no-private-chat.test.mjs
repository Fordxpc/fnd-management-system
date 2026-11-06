import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(root, path), 'utf8');
const api = read('functions/api/[[path]].ts');
const nav = read('src/Dashboard.tsx');
const schema = read('src/db/schema.ts');
for (const fragment of ['/api/chat/direct/', 'directThreads', 'directMessages', 'direct-chat-policy']) {
  assert.equal(api.includes(fragment), false, `direct chat fragment remains in API: ${fragment}`);
}
for (const fragment of ['PrivateChatsPage', 'privateChats', 'private-chats.css']) {
  assert.equal(nav.includes(fragment), false, `direct chat fragment remains in navigation: ${fragment}`);
}
for (const fragment of ['directThreads', 'directMessages', 'direct_threads', 'direct_messages']) {
  assert.equal(schema.includes(fragment), false, `direct chat fragment remains in schema: ${fragment}`);
}
assert.ok(api.includes('if (pathname === "/api/chat/groups"'));
assert.match(nav, /<ConversationsPage \/>/);
assert.match(schema, /export const chatGroups/);
for (const path of ['src/pages/PrivateChatsPage.tsx', 'src/styles/private-chats.css',
  'src/lib/direct-chat-policy.ts', 'tests/direct-chat-policy.test.mjs',
  'migrations/phase7_11_direct_chat.sql']) {
  assert.equal(existsSync(join(root, path)), false, `obsolete private chat file remains: ${path}`);
}
console.log('PASS: private chat removed; group conversations retained');
