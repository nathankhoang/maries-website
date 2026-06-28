/* ── Mobile nav toggle ──────────────────────────── */
const toggle = document.querySelector('.nav__toggle');
const navLinks = document.querySelector('.nav__links');

if (toggle && navLinks) {
  toggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    toggle.classList.toggle('is-open');
    const isOpen = navLinks.classList.contains('open');
    toggle.setAttribute('aria-expanded', isOpen);
  });

  // Close nav on link click
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      toggle.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ── Mark active nav link ───────────────────────── */
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav__links a').forEach(a => {
  const href = a.getAttribute('href');
  if (href === currentPage || (currentPage === '' && href === 'index.html')) {
    a.classList.add('active');
  }
});

/* ── Tab switcher ───────────────────────────────── */
document.querySelectorAll('.tabs').forEach(tabContainer => {
  const buttons = tabContainer.querySelectorAll('.tabs__btn');
  const panels  = tabContainer.querySelectorAll('.tabs__panel');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      buttons.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const panel = tabContainer.querySelector(`[data-panel="${target}"]`);
      if (panel) {
        panel.classList.add('active');
        panel.querySelectorAll('.trans-section').forEach(el => el.classList.add('visible'));
      }
    });
  });
});

/* ── Newsletter form ────────────────────────────── */
document.querySelectorAll('.newsletter-form').forEach(form => {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const input = form.querySelector('input[type="email"]');
    const thanks = form.closest('.newsletter').querySelector('.newsletter-thanks');
    if (input && input.value) {
      form.style.display = 'none';
      if (thanks) thanks.style.display = 'block';
    }
  });
});

/* ── Scroll fade-in animations ──────────────────── */
const observer = new IntersectionObserver(
  entries => entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  }),
  { threshold: 0.1 }
);

document.querySelectorAll('.card, .split, .section__header, .trans-section').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.visible').forEach(el => {
    el.style.opacity = '1';
    el.style.transform = 'none';
  });
});

// Patch for IntersectionObserver adding .visible
const styleSheet = document.createElement('style');
styleSheet.textContent = '.visible { opacity: 1 !important; transform: none !important; }';
document.head.appendChild(styleSheet);

/* ── PWA: register service worker (installable + offline phrasebook) ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support unavailable — app still works online */
    });
  });
}
