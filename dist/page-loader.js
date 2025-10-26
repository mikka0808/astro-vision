const sharedModules = [
  () => import('../ui/navigation.js'),
  () => import('../state/equipement-header.js'),
  () => import('../ui/i18n.js'),
  () => import('./pwa.js')
];

sharedModules.forEach((loader) => {
  loader().catch((error) => {
    console.warn('Module partagé indisponible :', error);
  });
});

const pageLoaders = {
  index: () => import('../../app.js'),
  dashboard: () => import('../../dashboard.js'),
  catalogue: () => import('../../catalogue.js'),
  'catalogue-detail': () => import('../../catalogue-detail.js'),
  'catalogue-settings': () => import('../../catalogue-settings.js'),
  'score-settings': () => import('../../score-settings.js'),
  'mes-equipements': () => import('../pages/mes-equipements.js'),
  'mes-listes': () => import('../pages/mes-listes.js'),
  'star-map': () => import('../../star-map.js')
};

function createSpinner() {
  const spinner = document.createElement('div');
  spinner.className = 'deferred-spinner';
  spinner.setAttribute('role', 'status');
  spinner.setAttribute('aria-live', 'polite');
  spinner.setAttribute('aria-hidden', 'true');
  spinner.innerHTML = `
    <div class="deferred-spinner__circle" aria-hidden="true"></div>
    <span class="sr-only">Chargement en cours…</span>
  `;
  document.body.appendChild(spinner);
  return spinner;
}

function createSpinnerController(spinner) {
  let activeTimeout = null;
  let hideTimeout = null;
  return {
    schedule() {
      if (activeTimeout !== null) return;
      activeTimeout = window.setTimeout(() => {
        spinner.classList.add('is-visible');
        spinner.setAttribute('aria-hidden', 'false');
      }, 120);
    },
    clear() {
      if (activeTimeout !== null) {
        window.clearTimeout(activeTimeout);
        activeTimeout = null;
      }
      if (hideTimeout !== null) {
        window.clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      spinner.classList.remove('is-visible');
      spinner.setAttribute('aria-hidden', 'true');
      hideTimeout = window.setTimeout(() => {
        if (typeof spinner.remove === 'function') {
          spinner.remove();
        }
      }, 220);
    }
  };
}

function loadActivePage() {
  const { body } = document;
  if (!body) return;
  const spinner = createSpinner();
  const spinnerController = createSpinnerController(spinner);
  const pageId = body.dataset.page || 'index';
  const loader = pageLoaders[pageId];
  if (typeof loader !== 'function') {
    spinnerController.clear();
    return;
  }
  spinnerController.schedule();
  loader()
    .catch((error) => {
      console.error(`Impossible de charger le module pour « ${pageId} » :`, error);
    })
    .finally(() => {
      spinnerController.clear();
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadActivePage, { once: true });
} else {
  loadActivePage();
}
