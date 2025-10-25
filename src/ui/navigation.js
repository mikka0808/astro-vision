const navs = Array.from(document.querySelectorAll('[data-app-nav]'));

const DESKTOP_QUERY = '(min-width: 720px)';
const desktopMatcher = window.matchMedia ? window.matchMedia(DESKTOP_QUERY) : null;

const isDesktop = () => (desktopMatcher ? desktopMatcher.matches : window.innerWidth >= 720);

const syncNavToViewport = (nav, toggle, panel, scrim) => {
  nav.classList.remove('app-nav--open');
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'false');
  }
  if (!panel) {
    return;
  }
  if (isDesktop()) {
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
  } else {
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
  }
  if (scrim) {
    scrim.hidden = true;
  }
};

const closeNav = (nav, toggle, panel, scrim, { focusToggle = false } = {}) => {
  nav.classList.remove('app-nav--open');
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'false');
  }
  if (panel) {
    if (isDesktop()) {
      panel.hidden = false;
      panel.setAttribute('aria-hidden', 'false');
    } else {
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
    }
  }
  if (scrim) {
    scrim.hidden = true;
  }
  if (focusToggle && toggle) {
    toggle.focus();
  }
};

const openNav = (nav, toggle, panel, scrim) => {
  if (isDesktop()) {
    return;
  }
  nav.classList.add('app-nav--open');
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'true');
  }
  if (panel) {
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    if (typeof panel.focus === 'function') {
      try {
        panel.focus({ preventScroll: true });
      } catch (error) {
        panel.focus();
      }
    }
  }
  if (scrim) {
    scrim.hidden = false;
  }
};

navs.forEach((nav) => {
  const toggle = nav.querySelector('[data-app-nav-toggle]');
  const panel = nav.querySelector('[data-app-nav-list]');
  const scrim = nav.querySelector('[data-app-nav-scrim]');
  const linkContainer = panel ? panel.querySelector('.app-nav__list') || panel : null;
  if (!toggle || !panel) {
    return;
  }

  nav.classList.add('app-nav--collapsible');
  toggle.setAttribute('aria-expanded', 'false');
  panel.setAttribute('aria-hidden', isDesktop() ? 'false' : 'true');
  panel.hidden = !isDesktop();
  if (scrim) {
    scrim.hidden = true;
  }

  toggle.addEventListener('click', () => {
    if (isDesktop()) {
      return;
    }
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      closeNav(nav, toggle, panel, scrim);
    } else {
      openNav(nav, toggle, panel, scrim);
    }
  });

  if (scrim) {
    scrim.addEventListener('click', () => {
      closeNav(nav, toggle, panel, scrim, { focusToggle: true });
    });
  }

  if (linkContainer) {
    linkContainer.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (!link || isDesktop()) {
        return;
      }
      closeNav(nav, toggle, panel, scrim);
    });
  }

  nav.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('app-nav--open')) {
      event.preventDefault();
      closeNav(nav, toggle, panel, scrim, { focusToggle: true });
    }
  });
});

if (navs.length > 0) {
  document.addEventListener('click', (event) => {
    navs.forEach((nav) => {
      const toggle = nav.querySelector('[data-app-nav-toggle]');
      const panel = nav.querySelector('[data-app-nav-list]');
      const scrim = nav.querySelector('[data-app-nav-scrim]');
      if (!toggle || !panel || isDesktop()) {
        return;
      }
      if (!nav.contains(event.target) && nav.classList.contains('app-nav--open')) {
        closeNav(nav, toggle, panel, scrim);
      }
    });
  });

  const handleViewportChange = () => {
    navs.forEach((nav) => {
      const toggle = nav.querySelector('[data-app-nav-toggle]');
      const panel = nav.querySelector('[data-app-nav-list]');
      const scrim = nav.querySelector('[data-app-nav-scrim]');
      if (!toggle || !panel) {
        return;
      }
      syncNavToViewport(nav, toggle, panel, scrim);
    });
  };

  if (desktopMatcher) {
    if (typeof desktopMatcher.addEventListener === 'function') {
      desktopMatcher.addEventListener('change', handleViewportChange);
    } else if (typeof desktopMatcher.addListener === 'function') {
      desktopMatcher.addListener(handleViewportChange);
    }
  } else if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resize', handleViewportChange);
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('orientationchange', handleViewportChange);
  }
}
