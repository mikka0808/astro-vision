import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCataloguePayload } from '../catalogue-data.js';
import {
  normaliseCatalogueId,
  normaliseCatalogueIdList,
  filterObjectsByCatalogue,
  countObjectsByCatalogue
} from '../catalogue-utils.js';
import fs from 'node:fs/promises';

const datasetPromise = (async () => {
  const raw = await fs.readFile(new URL('../objects.json', import.meta.url), 'utf-8');
  return parseCataloguePayload(JSON.parse(raw));
})();

test('normaliseCatalogueId lowers cases and trims', () => {
  assert.equal(normaliseCatalogueId(' UGC '), 'ugc');
  assert.equal(normaliseCatalogueId('Messier'), 'messier');
  assert.equal(normaliseCatalogueId(null), '');
});

test('normaliseCatalogueIdList filters blanks and removes duplicates', () => {
  assert.deepEqual(normaliseCatalogueIdList([' Messier ', 'NGC', 'ngc', '', null]), ['messier', 'ngc']);
  assert.deepEqual(normaliseCatalogueIdList('messier'), []);
});

test('filterObjectsByCatalogue accepts string or array and respects null', async () => {
  const { objects } = await datasetPromise;
  const ugcFromArray = filterObjectsByCatalogue(objects, ['ugc']);
  const ugcFromString = filterObjectsByCatalogue(objects, 'ugc');
  const allObjects = filterObjectsByCatalogue(objects, null);
  assert.equal(ugcFromArray.length, ugcFromString.length);
  assert.equal(allObjects.length, objects.length);
});

test('filterObjectsByCatalogue honours catalogue references for every catalogue', async () => {
  const { catalogues, objects } = await datasetPromise;
  const counts = countObjectsByCatalogue(objects);
  catalogues.forEach((catalogue) => {
    const id = normaliseCatalogueId(catalogue.id);
    const filtered = filterObjectsByCatalogue(objects, [id]);
    assert.equal(
      filtered.length,
      counts.get(id) || 0,
      `Expected ${id} filter to return ${counts.get(id) || 0} objects`
    );
  });
});

