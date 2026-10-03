import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hostedRelease, verifyRelease, hostingMetadata, sourceSha256 } from '../scripts/breakfast-beat-down-release.mjs';

const release = fs.readFileSync(new URL('../games/breakfast-beat-down/play/index.html', import.meta.url));
test('hosted game retains the reviewed source bytes and only adds hosting metadata', () => {
  assert.equal(verifyRelease(release).sourceSha256, sourceSha256);
  const source = Buffer.from(release.toString('utf8').replace(hostingMetadata, ''));
  assert.deepEqual(hostedRelease(source), release);
});
test('release guard rejects changed gameplay, missing metadata and duplicate metadata', () => {
  assert.throws(() => verifyRelease(Buffer.from(release.toString('utf8').replace('samfa12.breakfast-beatdown.v1', 'changed.save.key'))));
  assert.throws(() => verifyRelease(Buffer.from(release.toString('utf8').replace(hostingMetadata, ''))));
  assert.throws(() => verifyRelease(Buffer.concat([release, Buffer.from(hostingMetadata)])));
});
