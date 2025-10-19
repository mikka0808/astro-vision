const siteNav = document.getElementById('siteNav');
const navToggle = document.querySelector('[data-nav-toggle]');
const navLinks = siteNav ? Array.from(siteNav.querySelectorAll('.site-nav__link')) : [];

const currentPath = window.location.pathname.split('/').pop() || 'index.html';

navLinks.forEach((link) => {
  const href = link.getAttribute('href');
  if (!href) {
    return;
  }
  const normalized = href.split('#')[0];
  const isIndex = normalized === 'index.html' && (currentPath === '' || currentPath === '/');
  if (normalized === currentPath || isIndex) {
    link.classList.add('is-active');
  }
});

if (siteNav && navToggle) {
  const closeNav = () => {
    navToggle.setAttribute('aria-expanded', 'false');
    siteNav.classList.remove('is-open');
    document.body.classList.remove('nav-open');
  };

  navToggle.addEventListener('click', () => {
    const expanded = navToggle.getAttribute('aria-expanded') === 'true';
    const nextState = !expanded;
    navToggle.setAttribute('aria-expanded', String(nextState));
    siteNav.classList.toggle('is-open', nextState);
    document.body.classList.toggle('nav-open', nextState);
  });

  siteNav.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('.site-nav__link') : null;
    if (target) {
      closeNav();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true') {
      closeNav();
      navToggle.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900 && siteNav.classList.contains('is-open')) {
      closeNav();
    }
  });
}
