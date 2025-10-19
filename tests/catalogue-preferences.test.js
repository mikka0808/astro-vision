import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCatalogueModes,
  getDefaultCatalogueSelections,
  loadCataloguePreferences,
  persistCataloguePreferences,
  resetCataloguePreferences
} from '../catalogue-preferences.js';

const COOKIE_NAME = 'astroSoir:catalogueSelection';

function withDocumentCookie(value, fn) {
  const previousDocument = global.document;
  const store = { value: value ?? '' };
  global.document = {
    get cookie() {
      return store.value;
    },
    set cookie(next) {
      store.value = typeof next === 'string' ? next : '';
    }
  };
  try {
    return fn(() => store.value);
  } finally {
    if (previousDocument === undefined) {
      delete global.document;
    } else {
      global.document = previousDocument;
    }
  }
}

test('default catalogue selections provide independent copies', () => {
  const first = getDefaultCatalogueSelections();
  first.visual.push('test');
  const second = getDefaultCatalogueSelections();
  assert.ok(!second.visual.includes('test'));
});

test('catalogue modes list matches defaults', () => {
  const modes = getCatalogueModes();
  assert.deepEqual(modes.sort(), ['astrophoto', 'research', 'visual']);
});

test('loadCataloguePreferences returns defaults without cookie', () => {
  const defaults = getDefaultCatalogueSelections();
  const loaded = loadCataloguePreferences();
  assert.deepEqual(loaded, defaults);
});

test('loadCataloguePreferences merges cookie overrides', () => {
  const payload = {
    visual: ['messier'],
    research: [],
    astrophoto: ['ngc', 'sharpless']
  };
  const encoded = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(payload))}`;
  withDocumentCookie(encoded, () => {
    const loaded = loadCataloguePreferences();
    assert.deepEqual(loaded.visual, ['messier']);
    assert.deepEqual(loaded.research, []);
    assert.deepEqual(loaded.astrophoto, ['ngc', 'sharpless']);
  });
});

test('persistCataloguePreferences serialises selections to cookie', () => {
  withDocumentCookie('', (getCookie) => {
    persistCataloguePreferences({
      visual: ['messier', 'caldwell'],
      research: ['ngc'],
      astrophoto: []
    });
    const cookie = getCookie();
    assert.ok(cookie.startsWith(`${COOKIE_NAME}=`));
    const value = JSON.parse(decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1).split(';')[0]));
    assert.deepEqual(value.visual, ['messier', 'caldwell']);
    assert.deepEqual(value.research, ['ngc']);
    assert.deepEqual(value.astrophoto, []);
  });
});

test('resetCataloguePreferences clears cookie and returns defaults', () => {
  const defaults = getDefaultCatalogueSelections();
  withDocumentCookie('something', (getCookie) => {
    const afterReset = resetCataloguePreferences();
    assert.deepEqual(afterReset, defaults);
    const cookieValue = getCookie();
    assert.ok(cookieValue.includes(`${COOKIE_NAME}=`));
    assert.ok(cookieValue.includes('expires='));
  });
});
