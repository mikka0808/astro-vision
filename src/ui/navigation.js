const navs = Array.from(document.querySelectorAll('[data-app-nav]'));

const DESKTOP_QUERY = '(min-width: 720px)';
const desktopMatcher = window.matchMedia ? window.matchMedia(DESKTOP_QUERY) : null;

const isDesktop = () => (desktopMatcher ? desktopMatcher.matches : window.innerWidth >= 720);

const closeNav = (nav, toggle) => {
  nav.classList.remove('app-nav--open');
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'false');
  }
};

const openNav = (nav, toggle) => {
  nav.classList.add('app-nav--open');
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'true');
  }
};

navs.forEach((nav) => {
  const toggle = nav.querySelector('[data-app-nav-toggle]');
  const list = nav.querySelector('[data-app-nav-list]');
  if (!toggle || !list) {
    return;
  }

  nav.classList.add('app-nav--collapsible');
  toggle.setAttribute('aria-expanded', 'false');

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      closeNav(nav, toggle);
    } else {
      openNav(nav, toggle);
    }
  });

  list.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link || isDesktop()) {
      return;
    }
    closeNav(nav, toggle);
  });
});

if (navs.length > 0) {
  document.addEventListener('click', (event) => {
    navs.forEach((nav) => {
      const toggle = nav.querySelector('[data-app-nav-toggle]');
      if (!toggle || isDesktop()) {
        return;
      }
      if (!nav.contains(event.target) && nav.classList.contains('app-nav--open')) {
        closeNav(nav, toggle);
      }
    });
  });

  if (desktopMatcher && typeof desktopMatcher.addEventListener === 'function') {
    desktopMatcher.addEventListener('change', (event) => {
      if (event.matches) {
        navs.forEach((nav) => {
          const toggle = nav.querySelector('[data-app-nav-toggle]');
          if (toggle) {
            closeNav(nav, toggle);
          }
        });
      }
    });
  }
}
