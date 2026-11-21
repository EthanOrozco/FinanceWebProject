// Loaded synchronously in <head>, before any stylesheet paints, so the saved
// theme is applied on first frame (no dark→light flash on navigation).
(function () {
  let saved = 'dark';
  try { saved = localStorage.getItem('theme') || 'dark'; } catch (e) {}
  document.documentElement.setAttribute('data-bs-theme', saved);
})();

window.getTheme = () => document.documentElement.getAttribute('data-bs-theme');

// Read a CSS token's resolved value, for places that can't use var() (canvas/Chart.js).
window.cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

window.toggleTheme = () => {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-bs-theme', next);
  try { localStorage.setItem('theme', next); } catch (e) {}
  updateThemeIcon();
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
};

function updateThemeIcon() {
  const btn = document.getElementById('theme-btn');
  if (!btn) return;
  const isDark = getTheme() === 'dark';
  // Icon shows the mode you'll switch to.
  btn.querySelector('i').className = isDark ? 'fa-regular fa-sun' : 'fa-regular fa-moon';
  btn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
}

document.addEventListener('DOMContentLoaded', updateThemeIcon);
