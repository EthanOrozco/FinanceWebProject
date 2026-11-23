const PAL = {
  gold: "var(--c-gold)",
  blue: "var(--c-blue)",
  teal: "var(--c-teal)",
  purple: "var(--c-purple)",
  coral: "var(--c-coral)",
  pink: "var(--c-pink)",
  slate: "var(--c-text-3)",
};
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const TYPE_LABEL = { expense: 'gasto', income: 'ingreso', transfer: 'transferencia' };
const PAGE_SIZE = 10;

let transactions = [];
let categories = [];
let accounts = [];
let currentType = '';      // pestaña de filtro: '' = todos
let currentPage = 1;
let movType = 'expense';   // tipo seleccionado en el modal
let pendingDeleteId = null;

//helpers 
//el backend guarda los montos en centavos (enteros)
const frmt = (cents) => '$' + (Number(cents) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toCents = (value) => Math.round(Number(value) * 100);

const esc = (str) => String(str ?? '').replace(/[&<>"']/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// las fechas vienen en UTC: se usa solo la parte YYYY-MM-DD para no recorrer un día
const dateKey = (iso) => (iso ? iso.slice(0, 10) : '');
const fmtDate = (iso) => {
  const [y, m, d] = dateKey(iso).split('-').map(Number);
  return { day: `${d} ${MESES[m - 1]}`, year: y };
};

// TEMPORAL: mientras no exista el CRUD de cuentas, el backend usa una cuenta de desarrollo
const accountName = (id) => {
  if (!id) return '—';
  const acc = accounts.find(a => a._id === id);
  return acc ? acc.name : 'Cuenta principal';
};

const showToast = (msg, type = 'success') => {
  const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
  const el = document.createElement('div');
  el.className = `toast tx-toast tx-toast-${type}`;
  el.setAttribute('role', type === 'success' ? 'status' : 'alert');
  el.innerHTML = `
    <div class="d-flex align-items-center gap-2 p-3">
      <i class="fa-solid ${icon}"></i>
      <span class="flex-grow-1">${esc(msg)}</span>
      <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Cerrar"></button>
    </div>`;
  document.getElementById('toast-area').append(el);
  const t = new bootstrap.Toast(el, { delay: 3500 });
  el.addEventListener('hidden.bs.toast', () => el.remove());
  t.show();
};

const setBtnLoading = (btn, on, text = 'Guardando…') => {
  if (on) {
    btn.dataset.html = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${text}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.html;
  }
};

// fetch que regresa { ok, data } y muestra el error del backend en un toast
const api = async (url, options = {}) => {
  try {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.message || 'Ocurrió un error en el servidor', 'error');
      return { ok: false, data };
    }
    return { ok: true, data };
  } catch {
    showToast('No se pudo conectar con el servidor', 'error');
    return { ok: false, data: null };
  }
};

//carga de datos
const loadAccounts = async () => {
  try {
    const res = await fetch('/api/accounts');
    const data = await res.json();
    accounts = Array.isArray(data) ? data : [];
  } catch {
    accounts = []; // todavía no existe el CRUD de cuentas
  }
};

const loadCategories = async () => {
  const { ok, data } = await api('/api/categories?sort=name');
  categories = ok ? data : [];
};

const loadTransactions = async () => {
  document.getElementById('tx-loading').hidden = false;
  const { ok, data } = await api('/api/transactions');
  document.getElementById('tx-loading').hidden = true;
  transactions = ok ? data : [];
  render();
};

const fillFilterSelects = () => {
  const acc = document.getElementById('f-cuenta');
  acc.innerHTML = '<option value="">Todas las cuentas</option>' +
    accounts.map(a => `<option value="${a._id}">${esc(a.name)}</option>`).join('');
  acc.disabled = accounts.length === 0;

  const group = (kind, label) => {
    const list = categories.filter(c => c.kind === kind);
    return list.length
      ? `<optgroup label="${label}">${list.map(c => `<option value="${c._id}">${esc(c.name)}</option>`).join('')}</optgroup>`
      : '';
  };
  document.getElementById('f-categoria').innerHTML = '<option value="">Todas las categorías</option>' +
    group('expense', 'Gastos') + group('income', 'Ingresos');
};

const filterTransactions = () => {
  const q = document.getElementById('tx-search').value.trim().toLowerCase();
  const from = document.getElementById('f-desde').value;
  const to = document.getElementById('f-hasta').value;
  const account = document.getElementById('f-cuenta').value;
  const category = document.getElementById('f-categoria').value;
  const sort = document.getElementById('f-orden').value;

  const list = transactions.filter(t => {
    if (currentType && t.type !== currentType) return false;
    const d = dateKey(t.date);
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (account && t.accountId !== account && t.toAccountId !== account) return false;
    if (category && t.categoryId?._id !== category) return false;
    if (q) {
      const text = `${t.description} ${t.categoryId?.name ?? ''}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  const byDate = (a, b) => dateKey(b.date).localeCompare(dateKey(a.date)) || new Date(b.createdAt) - new Date(a.createdAt);
  const sorters = {
    new: byDate,
    old: (a, b) => -byDate(a, b),
    hi: (a, b) => b.amount - a.amount,
    lo: (a, b) => a.amount - b.amount,
    az: (a, b) => titleOf(a).localeCompare(titleOf(b), 'es'),
  };
  return list.sort(sorters[sort] || sorters.new);
};

//render 
const titleOf = (t) => t.description || t.categoryId?.name || (t.type === 'transfer' ? 'Transferencia' : 'Movimiento');

const renderStats = (list) => {
  const sum = (type) => list.filter(t => t.type === type).reduce((acc, t) => acc + t.amount, 0);
  const income = sum('income');
  const expense = sum('expense');
  const net = income - expense;

  document.getElementById('stat-count').textContent = list.length;
  document.getElementById('stat-income').textContent = frmt(income);
  document.getElementById('stat-expense').textContent = frmt(expense);
  const netEl = document.getElementById('stat-net');
  netEl.textContent = (net > 0 ? '+' : net < 0 ? '−' : '') + frmt(Math.abs(net));
  netEl.classList.toggle('is-negative', net < 0);
};

const rowHTML = (t) => {
  const { day, year } = fmtDate(t.date);
  const isTransfer = t.type === 'transfer';
  const icon = {
    income: ['tx-income-icon', 'fa-arrow-down'],
    expense: ['tx-expense-icon', 'fa-arrow-up'],
    transfer: ['tx-transfer-icon', 'fa-right-left'],
  }[t.type];

  // abonos a metas: goalId viene populado con { name, kind }
  const goal = t.goalId;
  const note = goal
    ? `${goal.kind === 'debt' ? 'Pago a deuda' : 'Abono a meta'}: ${goal.name}`
    : isTransfer ? `${accountName(t.accountId)} → ${accountName(t.toAccountId)}` : '';

  let badge;
  if (goal) badge = `<span class="cat-badge" style="--dot:${PAL.gold}">${goal.kind === 'debt' ? 'Deuda' : 'Ahorro'}</span>`;
  else if (isTransfer) badge = `<span class="cat-badge" style="--dot:var(--c-blue)">Transferencia</span>`;
  else if (t.categoryId) badge = `<span class="cat-badge" style="--dot:${PAL[t.categoryId.color] || PAL.slate}">${esc(t.categoryId.name)}</span>`;
  else badge = `<span class="cat-badge" style="--dot:${PAL.slate}">Sin categoría</span>`;

  const amount = isTransfer
    ? `<td class="tx-amount tx-amount-transfer">${frmt(t.amount)}</td>`
    : t.type === 'income'
      ? `<td class="tx-amount text-income">+${frmt(t.amount)}</td>`
      : `<td class="tx-amount text-expense">−${frmt(t.amount)}</td>`;

  return `
    <tr class="tx-row">
      <td class="tx-date"><span>${day}</span><span class="tx-time">${year}</span></td>
      <td><div class="tx-concept">
        <span class="tx-icon-wrap ${icon[0]}"><i class="fa-solid ${icon[1]}"></i></span>
        <div><span class="tx-title">${esc(titleOf(t))}</span>${note ? `<span class="tx-note">${esc(note)}</span>` : ''}</div>
      </div></td>
      <td>${badge}</td>
      <td class="tx-acct">${esc(accountName(t.accountId))}</td>
      ${amount}
      <td><div class="tx-actions">${goal ? `
        <a class="tx-btn" href="/metas" aria-label="Administrar en Metas" title="Se administra desde Metas"><i class="fa-solid fa-bullseye"></i></a>` : `
        <button class="tx-btn" aria-label="Editar movimiento" onclick="openEditModal('${t._id}')"><i class="fa-regular fa-pen-to-square"></i></button>
        <button class="tx-btn tx-btn-danger" aria-label="Eliminar movimiento" onclick="openDeleteModal('${t._id}')"><i class="fa-regular fa-trash-can"></i></button>`}
      </div></td>
    </tr>`;
};

const renderPagination = (total) => {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  document.getElementById('tx-pagination').hidden = total === 0;
  if (!total) return;

  const first = (currentPage - 1) * PAGE_SIZE + 1;
  const last = Math.min(currentPage * PAGE_SIZE, total);
  document.getElementById('tx-page-info').textContent = `Mostrando ${first}–${last} de ${total} movimientos`;

  //ventana de hasta 5 páginas alrededor de la actual
  const start = Math.max(1, Math.min(currentPage - 2, pages - 4));
  const end = Math.min(pages, start + 4);
  const item = (label, page, { disabled = false, active = false, aria = '' } = {}) => `
    <li class="page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}">
      <button type="button" class="page-link" ${disabled ? 'disabled' : `onclick="goPage(${page})"`} ${aria ? `aria-label="${aria}"` : ''}>${label}</button>
    </li>`;

  let html = item('<i class="fa-solid fa-chevron-left"></i>', currentPage - 1, { disabled: currentPage === 1, aria: 'Anterior' });
  for (let p = start; p <= end; p++) html += item(p, p, { active: p === currentPage });
  html += item('<i class="fa-solid fa-chevron-right"></i>', currentPage + 1, { disabled: currentPage === pages, aria: 'Siguiente' });
  document.getElementById('tx-pages').innerHTML = html;
};

const render = () => {
  const list = filterTransactions();
  renderStats(list);

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (currentPage > pages) currentPage = pages;
  const pageItems = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  document.getElementById('tx-body').innerHTML = pageItems.map(rowHTML).join('');
  renderPagination(list.length);

  document.getElementById('tx-empty').hidden = list.length > 0;
  document.getElementById('tx-empty-text').textContent = transactions.length
    ? 'No hay movimientos con estos filtros.'
    : 'Aún no tienes movimientos. Registra el primero con "Nuevo movimiento".';
};

window.goPage = (page) => {
  currentPage = page;
  render();
};

// cualquier cambio de filtro regresa a la página 1
const onFilterChange = () => {
  currentPage = 1;
  render();
};

//modal crear / editar
const fillAccountSelect = (select, selected = '', exclude = '') => {
  if (!accounts.length) {
    select.innerHTML = '<option value="">Cuenta principal</option>';
    select.disabled = true;
    return;
  }
  select.disabled = false;
  select.innerHTML = accounts
    .filter(a => a._id !== exclude)
    .map(a => `<option value="${a._id}" ${a._id === selected ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
};

const fillCategorySelect = (selected = '') => {
  const select = document.getElementById('mov-categoria');
  const list = categories.filter(c => c.kind === movType);
  select.innerHTML = list.length
    ? '<option value="">Elige una categoría</option>' +
      list.map(c => `<option value="${c._id}" ${c._id === selected ? 'selected' : ''}>${esc(c.name)}</option>`).join('')
    : `<option value="">No tienes categorías de ${TYPE_LABEL[movType]}</option>`;
  document.getElementById('mov-categoria-error').textContent = list.length
    ? 'Elige una categoría.'
    : `Primero crea una categoría de ${TYPE_LABEL[movType]} en Categorías.`;
};

const clearValidation = () => {
  document.querySelectorAll('#mov-form .is-invalid').forEach(el => el.classList.remove('is-invalid'));
};

//selector de tipo del modal
window.selectType = (type) => {
  if (type === 'transfer' && accounts.length < 2) {
    showToast('Necesitas al menos dos cuentas para hacer una transferencia', 'error');
    return;
  }
  applyType(type);
};

// cambia el formulario según el tipo (para poder editar lo ya guardado)
const applyType = (type, selectedCategory = '') => {
  movType = type;
  document.querySelectorAll('#mov-type-wrap .btn-type').forEach(b => b.classList.toggle('active', b.dataset.type === type));

  const isTransfer = type === 'transfer';
  document.getElementById('mov-categoria-wrap').hidden = isTransfer;
  document.getElementById('mov-destino-wrap').hidden = !isTransfer;
  document.getElementById('mov-cuenta-label').textContent = isTransfer ? 'Cuenta origen' : 'Cuenta';
  if (!isTransfer) fillCategorySelect(selectedCategory);
  clearValidation();
};

window.openNewModal = (type = 'expense') => {
  if (type === 'transfer' && accounts.length < 2) {
    showToast('Necesitas al menos dos cuentas para hacer una transferencia', 'error');
    return;
  }
  document.getElementById('mov-form').reset();
  document.getElementById('mov-edit-id').value = '';
  document.getElementById('movModalTitle').textContent = 'Nuevo movimiento';
  document.getElementById('mov-save-btn').textContent = 'Guardar movimiento';
  document.getElementById('mov-fecha').value = todayStr();
  fillAccountSelect(document.getElementById('mov-cuenta'));
  fillAccountSelect(document.getElementById('mov-destino'));
  applyType(type);
  bootstrap.Modal.getOrCreateInstance(document.getElementById('nuevoMovimientoModal')).show();
};

window.openEditModal = (id) => {
  const t = transactions.find(x => x._id === id);
  if (!t || t.goalId) return;
  document.getElementById('mov-form').reset();
  document.getElementById('mov-edit-id').value = id;
  document.getElementById('movModalTitle').textContent = 'Editar movimiento';
  document.getElementById('mov-save-btn').textContent = 'Guardar cambios';

  document.getElementById('mov-monto').value = (t.amount / 100).toFixed(2);
  document.getElementById('mov-descripcion').value = t.description || '';
  document.getElementById('mov-fecha').value = dateKey(t.date);
  fillAccountSelect(document.getElementById('mov-cuenta'), t.accountId || '');
  fillAccountSelect(document.getElementById('mov-destino'), t.toAccountId || '');

  applyType(t.type, t.categoryId?._id || '');
  bootstrap.Modal.getOrCreateInstance(document.getElementById('nuevoMovimientoModal')).show();
};

const validateForm = () => {
  const amountEl = document.getElementById('mov-monto');
  const catEl = document.getElementById('mov-categoria');
  const fromEl = document.getElementById('mov-cuenta');
  const toEl = document.getElementById('mov-destino');
  const dateEl = document.getElementById('mov-fecha');

  const amountOk = amountEl.value !== '' && toCents(amountEl.value) >= 1;
  amountEl.classList.toggle('is-invalid', !amountOk);

  const catOk = movType === 'transfer' || !!catEl.value;
  catEl.classList.toggle('is-invalid', !catOk);

  const destOk = movType !== 'transfer' || (!!toEl.value && toEl.value !== fromEl.value);
  toEl.classList.toggle('is-invalid', !destOk);

  const dateOk = !!dateEl.value;
  dateEl.classList.toggle('is-invalid', !dateOk);

  return amountOk && catOk && destOk && dateOk;
};

window.saveTransaction = async () => {
  if (!validateForm()) return;
  const id = document.getElementById('mov-edit-id').value;
  const isTransfer = movType === 'transfer';

  const body = {
    type: movType,
    amount: toCents(document.getElementById('mov-monto').value),
    accountId: document.getElementById('mov-cuenta').value || null,
    categoryId: isTransfer ? null : document.getElementById('mov-categoria').value,
    toAccountId: isTransfer ? document.getElementById('mov-destino').value : null,
    description: document.getElementById('mov-descripcion').value.trim(),
    date: document.getElementById('mov-fecha').value,
  };

  const btn = document.getElementById('mov-save-btn');
  setBtnLoading(btn, true);
  const { ok } = await api(id ? `/api/transactions/${id}` : '/api/transactions', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(body),
  });
  setBtnLoading(btn, false);
  if (!ok) return;

  bootstrap.Modal.getInstance(document.getElementById('nuevoMovimientoModal')).hide();
  showToast(id ? 'Movimiento actualizado' : 'Movimiento guardado');
  await loadTransactions();
};

window.openDeleteModal = (id) => {
  const t = transactions.find(x => x._id === id);
  if (!t) return;
  pendingDeleteId = id;
  document.getElementById('delete-desc').textContent =
    `"${titleOf(t)}" por ${frmt(t.amount)}. Esta acción no se puede deshacer.`;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('deleteModal')).show();
};

window.confirmDelete = async () => {
  if (!pendingDeleteId) return;
  const btn = document.getElementById('delete-confirm-btn');
  setBtnLoading(btn, true, 'Eliminando…');
  const { ok } = await api(`/api/transactions/${pendingDeleteId}`, { method: 'DELETE' });
  setBtnLoading(btn, false);
  if (!ok) return;
  bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
  pendingDeleteId = null;
  showToast('Movimiento eliminado');
  await loadTransactions();
};

//listeners 
document.querySelectorAll('.type-tabs .type-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.type-tabs .type-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentType = btn.dataset.type;
    onFilterChange();
  });
});

document.getElementById('tx-search').addEventListener('input', onFilterChange);
['f-desde', 'f-hasta', 'f-cuenta', 'f-categoria', 'f-orden'].forEach(id => {
  document.getElementById(id).addEventListener('change', onFilterChange);
});

document.querySelectorAll('#mov-form input, #mov-form select').forEach(el => {
  el.addEventListener('input', () => el.classList.remove('is-invalid'));
});
document.getElementById('mov-form').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); saveTransaction(); }
});

(async () => {
  await Promise.all([loadAccounts(), loadCategories()]);
  fillFilterSelects();
  // desde "Ver movimientos" en categorías llega ?categoria=<id>
  const cat = new URLSearchParams(location.search).get('categoria');
  if (cat && categories.some(c => c._id === cat)) document.getElementById('f-categoria').value = cat;
  await loadTransactions();
})();
