import { Favoris } from '../state/favoris.js';
import { parseCataloguePayload } from '../../catalogue-data.js';

const listesContainer = document.getElementById('listesContainer');
const createQuickListButton = document.getElementById('createQuickList');
const listesHint = document.getElementById('listesHint');

let objectIndex = new Map();
let objectsLoaded = false;

function sanitizeFileName(value) {
  return (
    String(value || 'liste')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/(^-|-$)+/g, '') || 'liste'
  ).toLowerCase();
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatRightAscension(raHours) {
  if (!Number.isFinite(raHours)) {
    return '—';
  }
  const totalSeconds = Math.round(raHours * 3600);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

function formatDeclination(decDeg) {
  if (!Number.isFinite(decDeg)) {
    return '—';
  }
  const totalSeconds = Math.round(Math.abs(decDeg) * 3600);
  const degrees = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const sign = decDeg >= 0 ? '+' : '−';
  return `${sign}${pad(degrees)}° ${pad(minutes)}′ ${pad(seconds)}″`;
}

function formatMagnitude(value) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return Number(value).toFixed(1);
}

function formatCatalogueRefs(object) {
  if (Array.isArray(object?.catalogueRefs) && object.catalogueRefs.length > 0) {
    return object.catalogueRefs.map((ref) => String(ref).toUpperCase()).join(', ');
  }
  if (object?.primaryCatalogueId) {
    return String(object.primaryCatalogueId).toUpperCase();
  }
  return 'Catalogue inconnu';
}

function toCsvRow(values) {
  return values
    .map((value) => {
      const normalized = value === null || value === undefined ? '' : String(value);
      return `"${normalized.replace(/"/g, '""')}"`;
    })
    .join(';');
}

function getObjectForId(id) {
  if (!id) return null;
  return objectIndex.get(id) || null;
}

function renderListes() {
  if (!listesContainer) {
    return;
  }
  const listes = Favoris.getListes();
  const favorisCount = Favoris.getIds().size;
  if (listesHint) {
    if (listes.length === 0) {
      listesHint.textContent =
        favorisCount === 0
          ? 'Aucune liste enregistrée pour le moment. Ajoute un favori depuis le catalogue pour commencer.'
          : 'Crée ta première liste pour organiser tes favoris enregistrés.';
    } else {
      const plural = listes.length > 1 ? 'listes' : 'liste';
      const favorisPlural = favorisCount > 1 ? 'favoris' : 'favori';
      listesHint.textContent = `Tu disposes de ${listes.length} ${plural} couvrant ${favorisCount} ${favorisPlural}.`;
    }
  }
  listesContainer.innerHTML = '';
  if (!Array.isArray(listes) || listes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'listes-empty';
    empty.innerHTML = `
      <p>Aucune liste personnalisée pour l’instant.</p>
      <p>Depuis le catalogue, ajoute un objet en favori puis rattache-le à une liste pour le retrouver ici.</p>
    `;
    listesContainer.appendChild(empty);
    return;
  }
  listes.forEach((liste) => {
    const card = document.createElement('article');
    card.className = 'liste-card';
    card.dataset.listId = liste.id;

    const header = document.createElement('header');
    header.className = 'liste-card__header';
    const title = document.createElement('h3');
    title.textContent = liste.nom;
    const count = document.createElement('span');
    const itemCount = Array.isArray(liste.cibleIds) ? liste.cibleIds.length : 0;
    count.className = 'liste-card__count';
    count.textContent = `${itemCount} cible${itemCount > 1 ? 's' : ''}`;
    header.appendChild(title);
    header.appendChild(count);

    const actions = document.createElement('div');
    actions.className = 'liste-card__actions';
    actions.innerHTML = `
      <button type="button" class="link-button" data-action="rename">Renommer</button>
      <button type="button" class="link-button" data-action="export">Exporter en CSV</button>
      <button type="button" class="link-button link-button--danger" data-action="delete">Supprimer</button>
    `;

    const body = document.createElement('div');
    body.className = 'liste-card__body';
    const items = document.createElement('ul');
    items.className = 'liste-items';

    if (!liste.cibleIds || liste.cibleIds.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'liste-item';
      emptyItem.innerHTML = '<span>Aucune cible enregistrée pour cette liste.</span>';
      items.appendChild(emptyItem);
    } else {
      liste.cibleIds.forEach((cibleId) => {
        const object = getObjectForId(cibleId);
        const item = document.createElement('li');
        item.className = 'liste-item';
        if (object) {
          const ra = formatRightAscension(object.raHours);
          const dec = formatDeclination(object.decDeg);
          const mag = formatMagnitude(object.magnitude);
          const catalogue = formatCatalogueRefs(object);
          item.innerHTML = `
            <strong>${object.name}</strong>
            <div class="liste-item__meta">
              <span>RA ${ra}</span>
              <span>Dec ${dec}</span>
              <span>Mag ${mag}</span>
            </div>
            <div class="liste-item__catalogue">${catalogue} • ${object.type || 'Type à préciser'}</div>
          `;
        } else {
          item.innerHTML = `
            <strong>${cibleId}</strong>
            <div class="liste-item__meta"><span>Objet introuvable dans le catalogue actuel.</span></div>
          `;
        }
        items.appendChild(item);
      });
    }

    body.appendChild(items);
    card.appendChild(header);
    card.appendChild(actions);
    card.appendChild(body);
    listesContainer.appendChild(card);
  });
}

async function ensureObjects() {
  if (objectsLoaded) {
    return;
  }
  try {
    const response = await fetch('../../objects.json');
    if (!response.ok) {
      throw new Error('Réponse réseau invalide');
    }
    const payload = await response.json();
    const { objects } = parseCataloguePayload(payload);
    const index = new Map();
    objects.forEach((object) => {
      if (!object) return;
      if (object.slug) {
        index.set(object.slug, object);
      }
      if (object.primaryCatalogueId && Number.isFinite(object.number)) {
        index.set(`${object.primaryCatalogueId}:${object.number}`, object);
      }
      if (object.name) {
        index.set(object.name.trim(), object);
      }
    });
    objectIndex = index;
    objectsLoaded = true;
    renderListes();
  } catch (error) {
    console.error('Impossible de charger les objets du catalogue :', error);
    if (listesHint) {
      listesHint.textContent =
        'Impossible de charger les données du catalogue. Vérifie ta connexion puis recharge la page.';
    }
  }
}

function exportListe(listId) {
  const listes = Favoris.getListes();
  const target = listes.find((liste) => liste.id === listId);
  if (!target) {
    return;
  }
  const rows = [
    'Nom;Ascension droite (RA);Déclinaison (Dec);Type;Magnitude;Catalogue'
  ];
  target.cibleIds.forEach((cibleId) => {
    const object = getObjectForId(cibleId);
    if (!object) {
      rows.push(toCsvRow([cibleId, '', '', '', '', '']));
      return;
    }
    rows.push(
      toCsvRow([
        object.name || cibleId,
        formatRightAscension(object.raHours),
        formatDeclination(object.decDeg),
        object.type || '—',
        formatMagnitude(object.magnitude),
        formatCatalogueRefs(object)
      ])
    );
  });
  if (rows.length === 1) {
    rows.push(toCsvRow(['(liste vide)', '', '', '', '', '']));
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFileName(target.nom)}.csv`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 0);
}

if (listesContainer) {
  listesContainer.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }
    const card = button.closest('.liste-card');
    if (!card) {
      return;
    }
    const listId = card.dataset.listId;
    if (!listId) {
      return;
    }
    const action = button.dataset.action;
    if (action === 'rename') {
      const currentName = card.querySelector('h3')?.textContent || '';
      const nextName = window.prompt('Nouveau nom de la liste :', currentName);
      if (nextName === null) {
        return;
      }
      const trimmed = nextName.trim();
      Favoris.renommerListe(listId, trimmed || currentName);
      renderListes();
    } else if (action === 'delete') {
      const confirmation = window.confirm('Supprimer définitivement cette liste ?');
      if (!confirmation) {
        return;
      }
      Favoris.supprimerListe(listId);
      renderListes();
    } else if (action === 'export') {
      exportListe(listId);
    }
  });
}

if (createQuickListButton) {
  createQuickListButton.addEventListener('click', () => {
    const listes = Favoris.getListes();
    const defaultName = `Nouvelle liste ${listes.length + 1}`;
    const input = window.prompt('Nom de la nouvelle liste :', defaultName);
    if (input === null) {
      return;
    }
    const trimmed = input.trim();
    Favoris.creerListe(trimmed || defaultName);
    renderListes();
  });
}

Favoris.subscribe(() => {
  renderListes();
});

renderListes();
ensureObjects();
