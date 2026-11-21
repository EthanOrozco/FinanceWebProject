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

const frmt = (num) => {
  return '$' + num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const render = () => {
  const q = document.getElementById('cat-search').value.trim().toLowerCase();
  const grid = document.getElementById("cat-grid");
  grid.innerHTML = "";
  
  const filtered = categories
    .filter(c => c.kind === currentKind)
    .filter(c => !q || c.name.toLowerCase().includes(q));
  filtered.forEach((cat) => {
    const article = document.createElement("article");
    const p = PAL[cat.color];
    article.className = "cat-card";
    article.innerHTML = `
      <div class="cat-card-header">
        <span class="cat-card-icon" style="background:${p.tint}; color:${p.color};">
            <i class="fa-solid ${cat.icon}"></i>
        </span>
        <div class="cat-card-name-wrap">
          <h2 class="cat-card-name">${cat.name}</h2>
        </div>
        <div class="cat-card-btns">
          <button class="cat-action-btn" aria-label="Editar ${cat.name}" onclick="openEditModal('${cat._id}')">
            <i class="fa-regular fa-pen-to-square"></i>
          </button>
          <button class="cat-action-btn cat-delete-btn" aria-label="Eliminar ${cat.name}" onclick="openDeleteModal('${cat._id}')"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      </div>

      <div class="cat-card-amount-row">
        <div>
          <p class="cat-month-label">Este mes</p>
          <p class="cat-amount">${frmt(0)}</p>
        </div>

      </div>

      <div class="cat-card-bar">
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width:0%; background:${p.color};"></div>
          </div>
        <div class="cat-bar-labels">
          <span>0% del total</span>
          <span>0 movimientos</span>
        </div>
      </div>

      <a href="/transacciones" class="cat-view-link">
        Ver movimientos <i class="fa-solid fa-arrow-right"></i>
      </a>
    `;
    // <span style="font-size:12px; font-weight:600; color:${d.color};">${d.text}</span>
    grid.append(article)
  });
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
  document.getElementById('delete-desc').textContent = 'Esta acción no se puede deshacer.';
  new bootstrap.Modal(document.getElementById('deleteModal')).show();
};

window.confirmDelete = async () => {
  if (!pendingDeleteId) return;
  const res = await fetch(`/api/categories/${pendingDeleteId}`, { method: 'DELETE' });
  if (!res.ok) return;
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
