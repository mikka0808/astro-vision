const menus = Array.from(document.querySelectorAll('[data-app-menu]'));
const DESKTOP_QUERY = '(min-width: 960px)';
const body = document.body;

const getDesktopMatcher = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia(DESKTOP_QUERY);
};

const isDesktopViewport = (matcher) => {
  if (matcher) {
    return matcher.matches;
  }
  if (typeof window === 'undefined') {
    return false;
  }
  return window.innerWidth >= 960;
};

menus.forEach((menu, index) => {
  const toggle = menu.querySelector('[data-app-menu-toggle]');
  const panel = menu.querySelector('[data-app-menu-panel]');
  const scrim = menu.querySelector('[data-app-menu-scrim]');
  const closeButtons = menu.querySelectorAll('[data-app-menu-close]');

  if (!toggle || !panel) {
    return;
  }

  const matcher = getDesktopMatcher();
  const panelId = panel.id || `appMenuPanel${index + 1}`;
  panel.id = panelId;
  toggle.setAttribute('aria-controls', panelId);
  toggle.setAttribute('aria-expanded', 'false');

  menu.classList.add('app-menu--ready');

  const applyOverlayState = () => {
    if (!body) {
      return;
    }
    if (menu.classList.contains('app-menu--open')) {
      body.classList.add('app-menu-overlay-open');
    } else {
      body.classList.remove('app-menu-overlay-open');
    }
  };

  const syncToViewport = () => {
    const desktop = isDesktopViewport(matcher);
    if (desktop) {
      menu.classList.remove('app-menu--collapsible');
      menu.classList.remove('app-menu--open');
      toggle.setAttribute('aria-expanded', 'false');
      panel.removeAttribute('aria-hidden');
      if (scrim) {
        scrim.hidden = true;
      }
      if (body) {
        body.classList.remove('app-menu-overlay-open');
      }
    } else {
      menu.classList.add('app-menu--collapsible');
      if (menu.classList.contains('app-menu--open')) {
        panel.setAttribute('aria-hidden', 'false');
        if (scrim) {
          scrim.hidden = false;
        }
      } else {
        panel.setAttribute('aria-hidden', 'true');
        if (scrim) {
          scrim.hidden = true;
        }
      }
    }
  };

  const openMenu = () => {
    if (!menu.classList.contains('app-menu--collapsible')) {
      return;
    }
    menu.classList.add('app-menu--open');
    toggle.setAttribute('aria-expanded', 'true');
    panel.setAttribute('aria-hidden', 'false');
    if (scrim) {
      scrim.hidden = false;
    }
    applyOverlayState();
    if (typeof panel.focus === 'function') {
      try {
        panel.focus({ preventScroll: true });
      } catch (error) {
        panel.focus();
      }
    }
  };

  const closeMenu = ({ focusToggle = false } = {}) => {
    menu.classList.remove('app-menu--open');
    toggle.setAttribute('aria-expanded', 'false');
    if (menu.classList.contains('app-menu--collapsible')) {
      panel.setAttribute('aria-hidden', 'true');
      if (scrim) {
        scrim.hidden = true;
      }
    } else {
      panel.removeAttribute('aria-hidden');
      if (scrim) {
        scrim.hidden = true;
      }
    }
    applyOverlayState();
    if (focusToggle) {
      toggle.focus();
    }
  };

  toggle.addEventListener('click', () => {
    if (!menu.classList.contains('app-menu--collapsible')) {
      return;
    }
    if (menu.classList.contains('app-menu--open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  closeButtons.forEach((button) => {
    button.addEventListener('click', () => closeMenu({ focusToggle: true }));
  });

  if (scrim) {
    scrim.addEventListener('click', () => closeMenu());
  }

  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('app-menu--open')) {
      event.preventDefault();
      closeMenu({ focusToggle: true });
    }
  });

  panel.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link || !menu.classList.contains('app-menu--collapsible')) {
      return;
    }
    closeMenu();
  });

  syncToViewport();

  if (matcher) {
    const handleChange = () => {
      syncToViewport();
      applyOverlayState();
    };
    if (typeof matcher.addEventListener === 'function') {
      matcher.addEventListener('change', handleChange);
    } else if (typeof matcher.addListener === 'function') {
      matcher.addListener(handleChange);
    }
  } else if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resize', () => {
      syncToViewport();
      applyOverlayState();
    });
  }

  document.addEventListener('click', (event) => {
    if (!menu.classList.contains('app-menu--collapsible')) {
      return;
    }
    if (!menu.contains(event.target) && menu.classList.contains('app-menu--open')) {
      closeMenu();
    }
  });
});
