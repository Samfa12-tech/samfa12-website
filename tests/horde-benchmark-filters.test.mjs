import test from 'node:test';
import assert from 'node:assert/strict';
import {gameVersion, optionCatalog, matchesOptions} from '../assets/horde-benchmark-filters.js';

const build = hash => `g:${hash};i:${'0'.repeat(64)};c:R;s:C`;
const current = build('6c06df462a6154fbd0a30e751b03d1dee01c565c');
const android = build('b169400a25bce1f257a70c54aff66999e4a35c49');
const older = build('43d5886df9a4141d8898a30a32624b8bbd7bbb9d');
const row = {build:current,model:'SM-S948B',profile:'custom',internal:'475 × 980',output:'1440 × 3120',water:'mobile',dielectric:'mobile',fire:'Mobile',backend:'RayTracingPipeline'};

test('build choices use verified versions, combine packages and do not mislabel older or unknown builds', () => {
  assert.deepEqual(gameVersion(current),{value:'version:1.7.0',label:'1.7.0'});
  assert.deepEqual(gameVersion(android),gameVersion(current));
  assert.deepEqual(gameVersion(build('d1c6d152d18c7002c41638d51dc9d9bcceea1bd4')),gameVersion(current));
  assert.deepEqual(gameVersion(older),{value:'version:1.6.2',label:'1.6.2'});
  assert.equal(gameVersion(build('a'.repeat(40))).label,'Unidentified build (aaaaaaa)');
  assert.equal(gameVersion('1.8.0').label,'1.8.0');
  assert.deepEqual(optionCatalog([row,{...row,build:android},{...row,build:older}]).version.map(choice=>choice.label),['1.7.0','1.6.2']);
});

test('quality and backend choices match actual game settings even without reports', () => {
  const catalog=optionCatalog([]);
  assert.deepEqual(catalog.water.map(choice=>choice.value),['off','mobile','high']);
  assert.deepEqual(catalog.dielectric.map(choice=>choice.value),['mobile','high']);
  assert.deepEqual(catalog.fire.map(choice=>choice.value),['low','mobile','high']);
  assert.deepEqual(catalog.backend.map(choice=>choice.value),['RayTracingPipeline','RayQueryCompute']);
  assert.deepEqual(catalog.version,[]);
  assert.deepEqual(catalog.model,[]);
});

test('model/profile/resolution choices derive only from public reports and group friendly phone aliases', () => {
  const catalog=optionCatalog([row,{...row,model:'Galaxy S26 Ultra'},{...row,model:'Unknown',internal:'1920 × 1080'}]);
  assert.deepEqual(catalog.model,[{value:'Galaxy S26 Ultra',label:'Galaxy S26 Ultra'}]);
  assert.deepEqual(catalog.profile,[{value:'custom',label:'Custom settings'}]);
  assert.deepEqual(catalog.internal.map(choice=>choice.value),['475 × 980','1920 × 1080']);
});

test('exact choices combine locally, normalize serializer case and match all packages of a game version', () => {
  assert.equal(matchesOptions(row,{version:'version:1.7.0',fire:'mobile',model:'Galaxy S26 Ultra'}),true);
  assert.equal(matchesOptions({...row,build:android},{version:'version:1.7.0'}),true);
  assert.equal(matchesOptions({...row,build:older},{version:'version:1.7.0'}),false);
  assert.equal(matchesOptions(row,{water:'high'}),false);
  assert.equal(matchesOptions(row,{backend:'RayQueryCompute'}),false);
  assert.equal(matchesOptions(row,{internal:'1920 × 1080'}),false);
  assert.equal(matchesOptions(row,{}),true);
});
