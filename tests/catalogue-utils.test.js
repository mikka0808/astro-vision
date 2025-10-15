import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCatalogueObjectsFromSource, parseCataloguePayload } from '../catalogue-data.js';
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

test('fetchCatalogueObjectsFromSource falls back to embedded datasets when remote fetch fails', async () => {
  const { objects } = await datasetPromise;
  const fallbackTargets = objects.filter((object) => {
    return Array.isArray(object.catalogueRefs)
      ? object.catalogueRefs.some((ref) => normaliseCatalogueId(ref) === 'ngc')
      : false;
  });
  assert.ok(fallbackTargets.length > 0, 'Expected embedded dataset to include NGC objects for fallback');
  const originalFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    return { ok: false, status: 503 };
  };
  try {
    const objectsFromSource = await fetchCatalogueObjectsFromSource('ngc');
    assert.equal(objectsFromSource.length, fallbackTargets.length);
    assert.equal(fetchCalls, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

