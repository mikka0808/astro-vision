import { readStorage, writeStorage } from '../utils/storage.js';

const FAVORIS_KEY = 'astro:favoris';
const LISTES_KEY = 'astro:listes';

const state = {
  favoris: loadFavoris(),
  listes: loadListes()
};

const subscribers = new Set();

function normalizeId(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function loadFavoris() {
  const stored = readStorage(FAVORIS_KEY, { fallback: [] });
  if (!Array.isArray(stored)) {
    return new Set();
  }
  const ids = stored.filter((id) => typeof id === 'string' && id.trim().length > 0);
  return new Set(ids);
}

function persistFavoris(ids) {
  writeStorage(FAVORIS_KEY, Array.from(ids));
}

function loadListes() {
  const stored = readStorage(LISTES_KEY, { fallback: [] });
  if (!Array.isArray(stored)) {
    return [];
  }
  return stored
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const raw = entry;
      const id = normalizeId(raw.id);
      const nom = normalizeId(raw.nom) || 'Liste sans titre';
      const cibleIds = Array.isArray(raw.cibleIds)
        ? raw.cibleIds.filter((value) => typeof value === 'string' && value.trim().length > 0)
        : [];
      if (!id) {
        return null;
      }
      return { id, nom, cibleIds };
    })
    .filter(Boolean);
}

function persistListes(listes) {
  writeStorage(LISTES_KEY, listes);
}

function notify() {
  subscribers.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('Erreur dans un écouteur de favoris :', error);
    }
  });
}

function ensureListIndex(listId) {
  return state.listes.findIndex((liste) => liste.id === listId);
}

function cloneListes(listes) {
  return listes.map((liste) => ({ ...liste, cibleIds: [...liste.cibleIds] }));
}

function generateListId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `liste-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function sortListes(listes) {
  return [...listes].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
}

function setListes(listes) {
  state.listes = listes;
  persistListes(state.listes);
}

function setFavoris(ids) {
  state.favoris = new Set(ids);
  persistFavoris(state.favoris);
}

export const Favoris = {
  getIds() {
    return new Set(state.favoris);
  },
  isFavori(id) {
    const normalized = normalizeId(id);
    if (!normalized) return false;
    return state.favoris.has(normalized);
  },
  toggle(id) {
    const normalized = normalizeId(id);
    if (!normalized) return false;
    const favoris = new Set(state.favoris);
    let active = false;
    if (favoris.has(normalized)) {
      favoris.delete(normalized);
      active = false;
    } else {
      favoris.add(normalized);
      active = true;
    }
    setFavoris(favoris);
    notify();
    return active;
  },
  add(id) {
    const normalized = normalizeId(id);
    if (!normalized) return false;
    if (state.favoris.has(normalized)) {
      return false;
    }
    const favoris = new Set(state.favoris);
    favoris.add(normalized);
    setFavoris(favoris);
    notify();
    return true;
  },
  remove(id) {
    const normalized = normalizeId(id);
    if (!normalized) return false;
    if (!state.favoris.has(normalized)) {
      return false;
    }
    const favoris = new Set(state.favoris);
    favoris.delete(normalized);
    setFavoris(favoris);
    notify();
    return true;
  },
  getListes() {
    return cloneListes(sortListes(state.listes));
  },
  creerListe(nom) {
    const normalizedNom = normalizeId(nom) || 'Nouvelle liste';
    const liste = {
      id: generateListId(),
      nom: normalizedNom,
      cibleIds: []
    };
    state.listes.push(liste);
    setListes(state.listes);
    notify();
    return { ...liste, cibleIds: [] };
  },
  renommerListe(listId, nom) {
    const index = ensureListIndex(listId);
    if (index === -1) {
      return null;
    }
    const normalizedNom = normalizeId(nom) || 'Liste sans titre';
    state.listes[index].nom = normalizedNom;
    setListes(state.listes);
    notify();
    const updated = state.listes[index];
    return { ...updated, cibleIds: [...updated.cibleIds] };
  },
  supprimerListe(listId) {
    const index = ensureListIndex(listId);
    if (index === -1) {
      return false;
    }
    state.listes.splice(index, 1);
    setListes(state.listes);
    notify();
    return true;
  },
  addToListe(listId, cibleId) {
    const normalizedListe = normalizeId(listId);
    const normalizedCible = normalizeId(cibleId);
    if (!normalizedListe || !normalizedCible) {
      return false;
    }
    const index = ensureListIndex(normalizedListe);
    if (index === -1) {
      return false;
    }
    const liste = state.listes[index];
    if (liste.cibleIds.includes(normalizedCible)) {
      return false;
    }
    liste.cibleIds.push(normalizedCible);
    setListes(state.listes);
    notify();
    return true;
  },
  removeFromListe(listId, cibleId) {
    const normalizedListe = normalizeId(listId);
    const normalizedCible = normalizeId(cibleId);
    if (!normalizedListe || !normalizedCible) {
      return false;
    }
    const index = ensureListIndex(normalizedListe);
    if (index === -1) {
      return false;
    }
    const liste = state.listes[index];
    const beforeLength = liste.cibleIds.length;
    liste.cibleIds = liste.cibleIds.filter((value) => value !== normalizedCible);
    if (liste.cibleIds.length === beforeLength) {
      return false;
    }
    state.listes[index] = liste;
    setListes(state.listes);
    notify();
    return true;
  },
  subscribe(listener) {
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  }
};
