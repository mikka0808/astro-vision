export function normaliseCatalogueId(id) {
  if (typeof id !== 'string') return '';
  return id.trim().toLowerCase();
}

export function normaliseCatalogueIdList(ids = []) {
  if (!Array.isArray(ids)) return [];
  return Array.from(
    new Set(
      ids
        .map(normaliseCatalogueId)
        .filter(Boolean)
    )
  );
}

export function filterObjectsByCatalogue(objects = [], catalogueIds = null) {
  if (!Array.isArray(objects) || objects.length === 0) return [];
  if (catalogueIds === null) return objects;
  const active = Array.isArray(catalogueIds) ? normaliseCatalogueIdList(catalogueIds) : [normaliseCatalogueId(catalogueIds)];
  const allowed = active.filter(Boolean);
  if (allowed.length === 0) return [];
  const allowedSet = new Set(allowed);
  return objects.filter((object) => {
    const refs = Array.isArray(object?.catalogueRefs) ? object.catalogueRefs : [];
    if (refs.length === 0) return false;
    return refs.some((id) => allowedSet.has(normaliseCatalogueId(id)));
  });
}

export function countObjectsByCatalogue(objects = []) {
  const counts = new Map();
  if (!Array.isArray(objects)) {
    return counts;
  }
  objects.forEach((object) => {
    const primary = normaliseCatalogueId(object?.primaryCatalogueId);
    const refs = Array.isArray(object?.catalogueRefs) ? object.catalogueRefs : [];
    const seen = new Set();
    if (primary) {
      counts.set(primary, (counts.get(primary) || 0) + 1);
      seen.add(primary);
    }
    refs
      .map(normaliseCatalogueId)
      .filter((id) => id && !seen.has(id))
      .forEach((id) => {
        if (!primary || id === primary) {
          counts.set(id, (counts.get(id) || 0) + 1);
          seen.add(id);
        }
      });
  });
  return counts;
}
