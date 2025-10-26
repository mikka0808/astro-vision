import { APP_VERSION } from '../../config/app-config.js';
import { translate, onLanguageChange } from '../ui/i18n.js';

const SW_URL = 'sw.js';
const OFFLINE_INDICATOR_ID = 'offlineIndicator';
const ONLINE_CLASS = 'is-online';
const OFFLINE_CLASS = 'is-offline';

function updateIndicator(online) {
  const indicator = document.getElementById(OFFLINE_INDICATOR_ID);
  if (!indicator) return;
  if (online) {
    indicator.dataset.i18nKey = 'status.online';
    const text = translate('status.online');
    indicator.textContent = text && text !== 'status.online' ? text : indicator.textContent;
    indicator.hidden = false;
    indicator.classList.remove(OFFLINE_CLASS);
    indicator.classList.add(ONLINE_CLASS);
    window.setTimeout(() => {
      indicator.hidden = true;
      indicator.classList.remove(ONLINE_CLASS);
    }, 3500);
  } else {
    indicator.dataset.i18nKey = 'status.offline';
    const text = translate('status.offline');
    indicator.textContent = text && text !== 'status.offline' ? text : indicator.textContent;
    indicator.hidden = false;
    indicator.classList.add(OFFLINE_CLASS);
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  navigator.serviceWorker
    .register(SW_URL, { type: 'module', updateViaCache: 'none' })
    .then((registration) => {
      if (registration.active) {
        updateIndicator(navigator.onLine);
      }
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed') {
            updateIndicator(navigator.onLine);
          }
        });
      });
    })
    .catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
}

function initNetworkListeners() {
  window.addEventListener('online', () => updateIndicator(true));
  window.addEventListener('offline', () => updateIndicator(false));
}

if (document.readyState === 'complete') {
  registerServiceWorker();
  initNetworkListeners();
} else {
  window.addEventListener('load', () => {
    registerServiceWorker();
    initNetworkListeners();
  }, { once: true });
}

console.debug(`PWA bootstrap ready (v${APP_VERSION})`);

onLanguageChange(() => updateIndicator(navigator.onLine));
