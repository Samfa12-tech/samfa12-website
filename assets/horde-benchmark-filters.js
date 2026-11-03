import {friendlyDeviceName} from './horde-benchmark-summary.js';

// Verified against VERSION at these exact source commits. Different package /
// compiler fingerprints for a source commit retain its declared game version.
const SOURCE_VERSIONS = new Map([
  ['6c06df462a6154fbd0a30e751b03d1dee01c565c', '1.7.0'],
  ['b169400a25bce1f257a70c54aff66999e4a35c49', '1.7.0'],
  ['43d5886df9a4141d8898a30a32624b8bbd7bbb9d', '1.6.2'],
]);
const known = value => typeof value === 'string' && value.length > 0 && value !== 'Unknown';
const option = (value, label = value) => ({value, label});

export function gameVersion(build) {
  const declared = /^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(build || '');
  const source = /^g:([0-9a-f]{40});/i.exec(build || '');
  const version = declared?.[1] || (source && SOURCE_VERSIONS.get(source[1].toLowerCase()));
  if (version) return option(`version:${version}`, version);
  // Unknown source IDs never inherit the current public release's version.
  return option(`build:${build}`, source ? `Unidentified build (${source[1].slice(0, 7)})` : 'Unidentified build');
}

// Legal values and serialization are from the 1.7.0 source:
// src/graphics/GraphicsSettings.h and src/telemetry/RtPerformanceEvidence.cpp.
const GAME_SETTINGS = {
  water: [option('off', 'Off'), option('mobile', 'Mobile'), option('high', 'High')],
  dielectric: [option('mobile', 'Mobile'), option('high', 'High')],
  fire: [option('low', 'Low'), option('mobile', 'Mobile'), option('high', 'High')],
  backend: [option('RayTracingPipeline', 'Ray tracing (pipeline)'), option('RayQueryCompute', 'Ray queries (compute)')],
};

function distinct(choices) {
  return [...new Map(choices.map(choice => [choice.value, choice])).values()]
    .sort((a, b) => a.label.localeCompare(b.label, 'en', {numeric: true}));
}

export function optionCatalog(rows) {
  const catalog = {...GAME_SETTINGS};
  catalog.version = distinct(rows.filter(row => known(row.build)).map(row => gameVersion(row.build)))
    .sort((a, b) => Number(b.value.startsWith('version:')) - Number(a.value.startsWith('version:')) || b.label.localeCompare(a.label, 'en', {numeric: true}));
  catalog.model = distinct(rows.map(row => friendlyDeviceName(row.model)).filter(known).map(model => option(model)));
  catalog.profile = distinct(rows.map(row => row.profile).filter(known).map(profile => option(profile, profile === 'custom' ? 'Custom settings' : profile)));
  catalog.internal = distinct(rows.map(row => row.internal).filter(known).map(value => option(value)));
  catalog.output = distinct(rows.map(row => row.output).filter(known).map(value => option(value)));
  return catalog;
}

export function matchesOptions(row, filters) {
  const values = {version: gameVersion(row.build).value, model: friendlyDeviceName(row.model), profile: row.profile, internal: row.internal, output: row.output, water: row.water, dielectric: row.dielectric, fire: row.fire, backend: row.backend};
  return Object.entries(values).every(([key, value]) => !filters[key] || String(value).toLowerCase() === filters[key].toLowerCase());
}
