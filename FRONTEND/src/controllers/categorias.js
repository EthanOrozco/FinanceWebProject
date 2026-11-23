const PAL = {
  gold: { color: "var(--c-gold)", tint: "var(--c-gold-tint)", label: "Dorado" },
  blue: { color: "var(--c-blue)", tint: "var(--c-blue-tint)", label: "Azul" },
  teal: { color: "var(--c-teal)", tint: "var(--c-teal-tint)", label: "Verde" },
  purple: { color: "var(--c-purple)", tint: "var(--c-purple-tint)", label: "Morado" },
  coral: { color: "var(--c-coral)", tint: "var(--c-coral-tint)", label: "Coral" },
  pink: { color: "var(--c-pink)", tint: "var(--c-pink-tint)", label: "Rosa" },
  slate: { color: "var(--c-text-3)", tint: "var(--c-hover)", label: "Gris" },
};

const ICONS = [
  { key: "fa-utensils", label: "Comida" },
  { key: "fa-car", label: "Auto" },
  { key: "fa-house", label: "Casa" },
  { key: "fa-rotate", label: "Recurrente" },
  { key: "fa-gamepad", label: "Juegos" },
  { key: "fa-heart", label: "Salud" },
  { key: "fa-book", label: "Libro" },
  { key: "fa-bag-shopping", label: "Compras" },
  { key: "fa-briefcase", label: "Trabajo" },
  { key: "fa-laptop", label: "Laptop" },
  { key: "fa-chart-line", label: "Inversión" },
  { key: "fa-tag", label: "Etiqueta" },
  { key: "fa-graduation-cap", label: "Educación" },
];

const toApi = (k) => (k === "gasto" ? "expense" : "income");
const fromApi = (k) => (k === "expense" ? "gasto" : "ingreso");

let categories = [];
let currentKind = 'gasto';
let pendingDeleteId = null;
let selectedColor = 'gold';
let selectedIcon = 'fa-tag';

const loadCategories = async () => {
  const res = await fetch("/api/categories");
  const data = await res.json();
  categories = data.map(c => ({ ...c, kind: fromApi(c.kind) }));
  render();
};

// los montos vienen en centavos desde el backend
const frmt = (cents) => '$' + (cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const esc = (str) => String(str ?? '').replace(/[&<>"']/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const monthName = (offset = 0) => MESES[(new Date().getMonth() + offset + 12) % 12];

// en gastos subir es malo (coral) y en ingresos es bueno (verde)
const deltaInfo = (cat) => {
  if (cat.delta === null || cat.delta === 0) return null;
  const up = cat.delta > 0;
  const good = cat.kind === 'ingreso' ? up : !up;
  return {
    cls: good ? 'cat-delta-good' : 'cat-delta-bad',
    icon: up ? 'fa-arrow-up' : 'fa-arrow-down',
    text: `${Math.abs(cat.delta)}% vs ${monthName(-1)}`,
  };
};

const renderStats = () => {
  const list = categories.filter(c => c.kind === currentKind);
  const isExpense = currentKind === 'gasto';
  const total = list.reduce((acc, c) => acc + c.amount, 0);

  document.getElementById('tab-count-gasto').textContent = categories.filter(c => c.kind === 'gasto').length;
  document.getElementById('tab-count-ingreso').textContent = categories.filter(c => c.kind === 'ingreso').length;

  document.getElementById('stat-sum-label').textContent = `${isExpense ? 'Gastado' : 'Recibido'} en ${monthName()}`;
  document.getElementById('stat-sum-value').textContent = frmt(total);

  const top = [...list].sort((a, b) => b.amount - a.amount)[0];
  document.getElementById('stat-top-name').textContent = top && top.amount ? top.name : '—';
  document.getElementById('stat-top-note').textContent = top && top.amount
    ? `${frmt(top.amount)} · ${Math.round((top.amount / total) * 100)}% del total`
    : 'Sin movimientos este mes';

  // mayor cambio en pesos (no en %), para que una categoría de $10 → $30 no gane a una de $1,000 → $2,000
  const mover = [...list]
    .filter(c => c.amount !== c.prevAmount)
    .sort((a, b) => Math.abs(b.amount - b.prevAmount) - Math.abs(a.amount - a.prevAmount))[0];
  document.getElementById('stat-mover-label').textContent = `Mayor cambio vs ${monthName(-1)}`;
  document.getElementById('stat-mover-name').textContent = mover ? mover.name : '—';
  document.getElementById('stat-mover-note').textContent = mover
    ? `${mover.amount > mover.prevAmount ? '+' : '−'}${frmt(Math.abs(mover.amount - mover.prevAmount))}`
    : 'Sin cambios';

  const idle = list.filter(c => c.txMonth === 0).length;
  document.getElementById('stat-count').textContent = list.length;
  document.getElementById('stat-count-note').textContent = idle ? `${idle} sin movimientos este mes` : 'Todas con movimientos';
};

const render = () => {
  renderStats();
  const q = document.getElementById('cat-search').value.trim().toLowerCase();
  const sort = document.getElementById('cat-sort').value;
  const grid = document.getElementById("cat-grid");
  grid.innerHTML = "";

  const ofKind = categories.filter(c => c.kind === currentKind);
  const total = ofKind.reduce((acc, c) => acc + c.amount, 0);
  const sorters = {
    amount: (a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'es'),
    count: (a, b) => b.txMonth - a.txMonth || a.name.localeCompare(b.name, 'es'),
    az: (a, b) => a.name.localeCompare(b.name, 'es'),
  };
  const filtered = ofKind
    .filter(c => !q || c.name.toLowerCase().includes(q))
    .sort(sorters[sort] || sorters.amount);

  filtered.forEach((cat) => {
    const article = document.createElement("article");
    const p = PAL[cat.color] || PAL.slate;
    const pct = total ? Math.round((cat.amount / total) * 100) : 0;
    const d = deltaInfo(cat);
    article.className = "cat-card";
    article.innerHTML = `
      <div class="cat-card-header">
        <span class="cat-card-icon" style="background:${p.tint}; color:${p.color};">
            <i class="fa-solid ${cat.icon}"></i>
        </span>
        <div class="cat-card-name-wrap">
          <h2 class="cat-card-name">${esc(cat.name)}</h2>
        </div>
        <div class="cat-card-btns">
          <button class="cat-action-btn" aria-label="Editar ${esc(cat.name)}" onclick="openEditModal('${cat._id}')">
            <i class="fa-regular fa-pen-to-square"></i>
          </button>
          <button class="cat-action-btn cat-delete-btn" aria-label="Eliminar ${esc(cat.name)}" onclick="openDeleteModal('${cat._id}')"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      </div>

      <div class="cat-card-amount-row">
        <div>
          <p class="cat-month-label">Este mes</p>
          <p class="cat-amount">${frmt(cat.amount)}</p>
        </div>
        ${d ? `<span class="cat-delta ${d.cls}"><i class="fa-solid ${d.icon}"></i> ${d.text}</span>` : ''}
      </div>

      <div class="cat-card-bar">
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width:${pct}%; background:${p.color};"></div>
          </div>
        <div class="cat-bar-labels">
          <span>${pct}% del total</span>
          <span>${cat.txMonth} ${cat.txMonth === 1 ? 'movimiento' : 'movimientos'}</span>
        </div>
      </div>

      <a href="/transacciones?categoria=${cat._id}" class="cat-view-link">
        Ver movimientos <i class="fa-solid fa-arrow-right"></i>
      </a>
    `;
    grid.append(article)
  });

  document.getElementById('empty-state').hidden = filtered.length > 0;
};


const openNewModal = () => {
  document.getElementById('form-edit-id').value = '';
  document.getElementById('form-name').value = '';
  document.getElementById('catModalTitle').textContent = 'Nueva categoría';
  document.getElementById('modal-save-btn').textContent = 'Crear categoría';
  document.getElementById('form-kind-wrap').hidden = false;

  // Set kind to match current tab
  document.querySelectorAll('#cat-form .btn-type').forEach(b => {
    b.classList.toggle('active', b.dataset.kind === currentKind);
  });

  selectedColor = 'gold';
  selectedIcon = 'fa-tag';
  buildSwatches();
  buildIcons();
  updatePreview();

  new bootstrap.Modal(document.getElementById('catModal')).show();
};

const buildSwatches = () => {
  const grid = document.getElementById('swatch-grid');
  grid.innerHTML = '';
  Object.entries(PAL).forEach(([key, p]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch-btn' + (key === selectedColor ? ' active' : '');
    btn.setAttribute('aria-label', 'Color ' + p.label);
    btn.setAttribute('aria-pressed', key === selectedColor ? 'true' : 'false');
    btn.style.cssText = key === selectedColor ? `background:${p.tint}; border-color: var(--c-text-strong);` : `background:${p.tint}; border-color:transparent;`;
    btn.innerHTML = `<span style="background:${p.color};"></span>`;
    btn.onclick = () => { selectedColor = key; buildSwatches(); buildIcons(); updatePreview(); };
    grid.appendChild(btn);
  });
};

const buildIcons = () => {
      const grid = document.getElementById('icon-grid');
      grid.innerHTML = '';
      const p = PAL[selectedColor];
      ICONS.forEach(ic => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'icon-btn' + (ic.key === selectedIcon ? ' active' : '');
        btn.setAttribute('aria-label', 'Ícono ' + ic.label);
        btn.setAttribute('aria-pressed', ic.key === selectedIcon ? 'true' : 'false');
        btn.style.cssText = ic.key === selectedIcon
          ? `background:${p.tint}; color:${p.color}; border-color:${p.color};`
          : 'background:var(--c-sunken); color:var(--c-text-3); border-color:transparent;';
        btn.innerHTML = `<i class="fa-solid ${ic.key}"></i>`;
        btn.onclick = () => { selectedIcon = ic.key; buildIcons(); updatePreview(); };
        grid.appendChild(btn);
      });
}

const updatePreview = () => {
  const name = document.getElementById('form-name').value.trim() || 'Nueva categoría';
  const p = PAL[selectedColor];
  const kindBtn = document.querySelector('.btn-type.active[data-kind]');
  const kind = kindBtn ? kindBtn.dataset.kind : 'gasto';
  document.getElementById('preview-name').textContent = name;
  document.getElementById('preview-kind').textContent = kind === 'ingreso' ? 'Ingreso' : 'Gasto';
  document.getElementById('preview-icon-wrap').style.background = p.tint;
  document.getElementById('preview-icon-wrap').style.color = p.color;
  document.getElementById('preview-icon').className = 'fa-solid ' + selectedIcon;
}

window.selectKind = (btn) => {
  document.querySelectorAll('#cat-form .btn-type').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updatePreview();
};

window.openEditModal = (id) => {
  const c = categories.find(x => x._id === id);
  if (!c) return;

  document.getElementById('form-edit-id').value = id;
  document.getElementById('form-name').value = c.name;
  document.getElementById('catModalTitle').textContent = 'Editar categoría';
  document.getElementById('modal-save-btn').textContent = 'Guardar cambios';
  // Hide type selector for existing categories
  document.getElementById('form-kind-wrap').hidden = true;

  selectedColor = c.color;
  selectedIcon = c.icon;
  buildSwatches();
  buildIcons();
  updatePreview();

  new bootstrap.Modal(document.getElementById('catModal')).show();
};

window.saveCategory = async () => {
  const id = document.getElementById('form-edit-id').value;
  const name = document.getElementById('form-name').value.trim();
  if (!name) return;

  const kindBtn = document.querySelector('#cat-form .btn-type.active[data-kind]');
  const kind = kindBtn ? kindBtn.dataset.kind : currentKind;

  const body = { name, kind: toApi(kind), color: selectedColor, icon: selectedIcon };
  const res = await fetch(id ? `/api/categories/${id}` : '/api/categories', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return;
  bootstrap.Modal.getInstance(document.getElementById('catModal')).hide();
  await loadCategories();
}

window.openDeleteModal = (id) => {
  const c = categories.find(x => x._id === id);
  if (!c) return;
  pendingDeleteId = id;
  document.getElementById('delete-title').textContent = '¿Eliminar "' + c.name + '"?';

  // si tiene movimientos, el backend exige moverlos a otra categoría del mismo tipo (?moveTo=)
  const others = categories.filter(x => x.kind === c.kind && x._id !== id);
  const moveWrap = document.getElementById('delete-move-wrap');
  const confirmBtn = document.getElementById('confirm-delete-btn');
  const desc = document.getElementById('delete-desc');
  const n = c.txCount === 1 ? '1 movimiento' : `${c.txCount} movimientos`;

  moveWrap.hidden = !c.txCount || !others.length;
  confirmBtn.disabled = c.txCount > 0 && !others.length;
  if (!c.txCount) {
    desc.textContent = 'Esta acción no se puede deshacer.';
  } else if (!others.length) {
    desc.textContent = `Tiene ${n}. Crea otra categoría de ${c.kind} para pasarlos antes de eliminarla.`;
  } else {
    desc.textContent = `Tiene ${n}. Elige a qué categoría pasarlos.`;
    document.getElementById('delete-move-to').innerHTML =
      others.map(x => `<option value="${x._id}">${esc(x.name)}</option>`).join('');
  }
  bootstrap.Modal.getOrCreateInstance(document.getElementById('deleteModal')).show();
};

window.confirmDelete = async () => {
  if (!pendingDeleteId) return;
  const moveWrap = document.getElementById('delete-move-wrap');
  const moveTo = moveWrap.hidden ? '' : `?moveTo=${document.getElementById('delete-move-to').value}`;
  const res = await fetch(`/api/categories/${pendingDeleteId}${moveTo}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    document.getElementById('delete-desc').textContent = data.message || 'No se pudo eliminar la categoría.';
    return;
  }
  bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
  pendingDeleteId = null;
  await loadCategories();
};

//listeners 
document.querySelectorAll('.kind-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.kind-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentKind = btn.dataset.kind;
    render();
  });
});




loadCategories();
