import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const server=readFileSync(new URL('../tools/dev-standings-preview.mjs',import.meta.url),'utf8');
test('DEV HTML injections must not emit a literal backslash-n above page content',()=>{
 assert.ok(!server.includes(String.raw`</script>\\n</head>`));
 assert.ok(server.includes(String.raw`</script>\n</head>`));
});