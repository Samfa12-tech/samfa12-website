import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { verifyRelease, hostedSha256 } from '../scripts/banana-banana-ducky-release.mjs';
const release = fs.readFileSync(new URL('../games/banana-banana-ducky/play/index.html', import.meta.url));
test('reviewed hosting release remains intact', () => {
  assert.equal(verifyRelease(release).hostedSha256, hostedSha256);
});
test('release guard rejects gameplay or metadata changes', () => {
  assert.throws(() => verifyRelease(Buffer.from(release.toString().replace('banana-banana-ducky-v1', 'changed-save'))));
  assert.throws(() => verifyRelease(Buffer.from(release.toString().replace('noindex,follow', 'index,follow'))));
});
