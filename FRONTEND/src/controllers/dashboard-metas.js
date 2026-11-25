// metas prioritarias del dashboard
(() => {
  const SAVING_COLORS = ['teal', 'blue', 'purple', 'pink', 'coral'];
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MAX_GOALS = 3;

  // los montos de las metas vienen en centavos
  const frmt = (cents) => '$' + (Number(cents) / 100).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const esc = (str) => String(str ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

  const parseDate = (iso) => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  // mismo color que en la pagina de metas
  const colorOf = (g) => {
    if (g.kind === 'debt') return { bar: 'var(--c-gold-dark)', text: 'var(--c-gold-text)' };
    const n = [...g._id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const c = SAVING_COLORS[n % SAVING_COLORS.length];
    return { bar: `var(--c-${c})`, text: `var(--c-${c})` };
  };

  // prioridad: fecha limite mas cercana primero, luego mayor progreso
  const byPriority = (a, b) => {
    const da = a.deadline ? parseDate(a.deadline).getTime() : Infinity;
    const db = b.deadline ? parseDate(b.deadline).getTime() : Infinity;
    if (da !== db) return da - db;
    return b.progress - a.progress;
  };

  const goalItemHTML = (g, i) => {
    const isDebt = g.kind === 'debt';
    const c = colorOf(g);
    const remaining = Math.max(0, g.targetAmount - g.saved);
    const d = g.deadline ? parseDate(g.deadline) : null;
    const sub = isDebt
      ? `Deuda · ${d ? `liquidar ${MESES[d.getMonth()]} ${d.getFullYear()}` : 'baja hacia $0'}`
      : `Ahorro · ${d ? `meta ${MESES[d.getMonth()]} ${d.getFullYear()}` : 'sin fecha límite'}`;

    return `
      <li class="goal-item${i > 0 ? ' mt-3' : ''}">
        <div class="goal-header">
          <div>
            <p class="item-name">${esc(g.name)}</p>
            <p class="item-sub">${sub}</p>
          </div>
          <span style="font-weight: 700; color: ${c.text};">${g.progress}%</span>
        </div>
        <div class="progress" style="height: 8px; background: var(--c-input-bg);" role="progressbar" aria-label="Progreso de ${esc(g.name)}" aria-valuenow="${g.progress}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar" style="width: ${g.progress}%; background: ${c.bar};"></div>
        </div>
        <div class="goal-footer">
          <span>${isDebt ? `${frmt(remaining)} pendientes` : `${frmt(g.saved)} ahorrados`}</span>
          <span>${isDebt ? 'Inicial' : 'Meta'} ${frmt(g.targetAmount)}</span>
        </div>
      </li>`;
  };

  const loadDashGoals = async () => {
    const list = document.getElementById('dash-goals');
    if (!list) return;
    try {
      const res = await fetch('/api/goals?status=active');
      if (!res.ok) throw new Error();
      const goals = await res.json();

      if (!goals.length) {
        list.innerHTML = `
          <li class="text-center py-3" style="font-size: 13px; color: var(--c-text-muted);">
            Aún no tienes metas activas. <a href="/metas">Crear una</a>
          </li>`;
        return;
      }
      list.innerHTML = goals.sort(byPriority).slice(0, MAX_GOALS).map(goalItemHTML).join('');
    } catch {
      list.innerHTML = `
        <li class="text-center py-3" style="font-size: 13px; color: var(--c-coral);">
          No se pudieron cargar las metas.
        </li>`;
    }
  };

  loadDashGoals();
})();