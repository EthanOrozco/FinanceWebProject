const PAL = {
  gold: { color: "var(--c-gold-light)", tint: "var(--c-gold-tint-2)" },
  blue: { color: "var(--c-blue)", tint: "var(--c-blue-tint)" },
  teal: { color: "var(--c-teal)", tint: "var(--c-teal-tint)" },
  purple: { color: "var(--c-purple)", tint: "var(--c-purple-tint)" },
  coral: { color: "var(--c-coral)", tint: "var(--c-coral-tint)" },
  pink: { color: "var(--c-pink)", tint: "var(--c-pink-tint)" },
  slate: { color: "var(--c-text-3)", tint: "var(--c-hover)" },
};
const SAVING_COLORS = ['teal', 'blue', 'purple', 'pink', 'coral'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

let goals = [];
let accounts = [];
let currentFilter = 'active';
let currentKind = 'saving';
let pendingDeleteId = null;

// ===== helpers =====
const frmt = (num) => '$' + Number(num).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const esc = (str) => String(str ?? '').replace(/[&<>"']/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// las fechas vienen en UTC, se usa la parte de fecha para no recorrer un dia
const toDateInput = (iso) => iso ? iso.slice(0, 10) : '';
const parseDate = (iso) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const fmtMonthYear = (iso) => { const d = parseDate(iso); return `${MESES[d.getMonth()]} ${d.getFullYear()}`; };
const fmtDayMonth = (iso) => { const d = parseDate(iso); return `${d.getDate()} ${MESES[d.getMonth()]}`; };

// el color no se guarda en la BD: deuda dorado, ahorro segun su id
const colorOf = (g) => {
  if (g.kind === 'debt') return 'gold';
  const n = [...g._id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return SAVING_COLORS[n % SAVING_COLORS.length];
};

const accountName = (id) => {
  if (!id) return '';
  const acc = accounts.find(a => a._id === id);
  return acc ? acc.name : '';
};

const remainingOf = (g) => Math.max(0, Math.round((g.targetAmount - g.saved) * 100) / 100);

// meses completos que faltan para la fecha limite (minimo 1)
const monthsLeft = (g) => {
  if (!g.deadline) return null;
  const now = new Date();
  const end = parseDate(g.deadline);
  const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  return Math.max(1, months);
};

const suggestedMonthly = (g) => {
  const m = monthsLeft(g);
  if (m === null || g.status !== 'active') return 0;
  return remainingOf(g) / m;
};

// estado visual de la meta
const goalStatus = (g) => {
  if (g.status === 'completed') return { cls: 'status-ok', text: g.kind === 'debt' ? 'Liquidada' : 'Completada' };
  if (g.status === 'cancelled') return { cls: 'status-cancel', text: 'Cancelada' };
  if (g.progress >= 85) return { cls: 'status-almost', text: 'Casi lista' };
  if (!g.deadline) return { cls: 'status-ok', text: 'Sin fecha límite' };

  const start = new Date(g.createdAt).getTime();
  const end = parseDate(g.deadline).getTime();
  const now = Date.now();
  if (now > end) return { cls: 'status-late', text: 'Vencida' };

  const expected = end > start ? ((now - start) / (end - start)) * 100 : 100;
  if (g.progress + 1 >= expected) return { cls: 'status-ok', text: 'En camino' };
  return { cls: 'status-late', text: `Atrasada · faltan ${frmt(Math.ceil(suggestedMonthly(g)))}/mes` };
};

// abre un modal esperando a que se cierre el que este abierto
const showModal = (id) => {
  const target = document.getElementById(id);
  const open = document.querySelector('.modal.show');
  if (open && open !== target) {
    open.addEventListener('hidden.bs.modal', () => bootstrap.Modal.getOrCreateInstance(target).show(), { once: true });
    bootstrap.Modal.getInstance(open).hide();
  } else {
    bootstrap.Modal.getOrCreateInstance(target).show();
  }
};

// ===== loading y mensajes =====
const setLoading = (on) => {
  document.getElementById('goal-loading').hidden = !on;
  document.getElementById('goal-grid').style.opacity = on ? '0.4' : '1';
};

const setBtnLoading = (btn, on, text) => {
  if (on) {
    btn.dataset.text = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${text || 'Guardando…'}`;
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.text || btn.textContent;
  }
};

const showToast = (msg, type = 'success') => {
  const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
  const el = document.createElement('div');
  el.className = `toast goal-toast goal-toast-${type}`;
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

// fetch que regresa { ok, data } y muestra el error del backend
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
  } catch (err) {
    showToast('No se pudo conectar con el servidor', 'error');
    return { ok: false, data: null };
  }
};

// ===== carga de datos =====
const loadAccounts = async () => {
  try {
    const res = await fetch('/api/accounts');
    const data = await res.json();
    accounts = Array.isArray(data) ? data : [];
  } catch {
    accounts = [];
  }
};

const loadGoals = async () => {
  setLoading(true);
  const { ok, data } = await api('/api/goals');
  setLoading(false);
  if (!ok) return;
  goals = data;
  render();
};

// ===== render =====
const renderStats = () => {
  const active = goals.filter(g => g.status === 'active');
  const savings = active.filter(g => g.kind === 'saving');
  const debts = active.filter(g => g.kind === 'debt');

  const saved = savings.reduce((a, g) => a + g.saved, 0);
  const target = savings.reduce((a, g) => a + g.targetAmount, 0);
  document.getElementById('stat-saved').textContent = frmt(saved);
  document.getElementById('stat-saved-sub').textContent = `de ${frmt(target)} en total`;

  const debtTotal = debts.reduce((a, g) => a + g.targetAmount, 0);
  const debtPaid = debts.reduce((a, g) => a + g.saved, 0);
  const pct = debtTotal ? Math.round((debtPaid / debtTotal) * 100) : 0;
  document.getElementById('stat-debt').textContent = frmt(debtTotal - debtPaid);
  document.getElementById('stat-debt-sub').textContent = `${pct}% pagado de ${frmt(debtTotal)}`;

  const monthly = active.reduce((a, g) => a + suggestedMonthly(g), 0);
  document.getElementById('stat-monthly').textContent = frmt(Math.ceil(monthly));

  document.getElementById('stat-completed').textContent = goals.filter(g => g.status === 'completed').length;
  document.getElementById('stat-active').textContent = `${active.length} activas`;

  document.getElementById('count-active').textContent = active.length;
  document.getElementById('count-saving').textContent = savings.length;
  document.getElementById('count-debt').textContent = debts.length;
  document.getElementById('count-completed').textContent = goals.filter(g => g.status === 'completed').length;
  document.getElementById('count-cancelled').textContent = goals.filter(g => g.status === 'cancelled').length;
};

const filterGoals = () => {
  const q = document.getElementById('goal-search').value.trim().toLowerCase();
  const sort = document.getElementById('goal-sort').value;

  let list = goals.filter(g => {
    if (currentFilter === 'active') return g.status === 'active';
    if (currentFilter === 'saving') return g.status === 'active' && g.kind === 'saving';
    if (currentFilter === 'debt') return g.status === 'active' && g.kind === 'debt';
    return g.status === currentFilter;
  });
  if (q) list = list.filter(g => g.name.toLowerCase().includes(q));

  const sorters = {
    recent: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    deadline: (a, b) => (a.deadline ? parseDate(a.deadline) : Infinity) - (b.deadline ? parseDate(b.deadline) : Infinity),
    progress: (a, b) => b.progress - a.progress,
    remaining: (a, b) => remainingOf(b) - remainingOf(a),
    name: (a, b) => a.name.localeCompare(b.name, 'es'),
  };
  return list.sort(sorters[sort] || sorters.recent);
};

const goalCardHTML = (g) => {
  const p = PAL[colorOf(g)];
  const isDebt = g.kind === 'debt';
  const st = goalStatus(g);
  const acc = accountName(g.accountId);
  const remaining = remainingOf(g);
  const monthly = suggestedMonthly(g);
  const last = [...g.contributions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 2);

  const history = last.length
    ? last.map(c => `
        <li><span>${fmtDayMonth(c.date)}${accountName(c.accountId) ? ` · <em>${esc(accountName(c.accountId))}</em>` : ''}</span>
        <strong class="text-income">+${frmt(c.amount)}</strong></li>`).join('')
    : `<li><span>Aún no hay ${isDebt ? 'pagos' : 'abonos'}</span></li>`;

  let actionBtn = '';
  if (g.status === 'active') {
    actionBtn = `<button class="btn btn-gold-primary w-100 mt-auto" onclick="openAbonoModal('${g._id}')">${isDebt ? 'Registrar pago' : 'Abonar a la meta'}</button>`;
  } else {
    actionBtn = `<button class="btn btn-tx-secondary w-100 mt-auto justify-content-center" onclick="openDetail('${g._id}')">Ver detalle</button>`;
  }

  return `
    <div class="col-12 col-md-6 col-xl-4">
      <div class="goal-card${g.status === 'cancelled' ? ' goal-card-cancelled' : ''}">
        <div class="goal-card-header">
          <span class="goal-icon" style="background:${p.tint}; color:${p.color};"><i class="fa-solid ${isDebt ? 'fa-arrow-trend-down' : 'fa-bullseye'}"></i></span>
          <button type="button" class="flex-grow-1 goal-title-btn" onclick="openDetail('${g._id}')" aria-label="Ver detalle de ${esc(g.name)}">
            <span class="goal-name">${esc(g.name)}</span>
            <span class="goal-type">${isDebt ? 'Deuda' : 'Ahorro'}${acc ? ' · ' + esc(acc) : ''}</span>
          </button>
          <button class="tx-btn" aria-label="Editar ${esc(g.name)}" onclick="openEditModal('${g._id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="tx-btn tx-btn-danger" aria-label="Eliminar ${esc(g.name)}" onclick="openDeleteModal('${g._id}')"><i class="fa-regular fa-trash-can"></i></button>
        </div>

        <div class="goal-progress">
          <div class="goal-ring" style="--pct: ${g.progress}; --ring: ${p.color};">
            <span>${g.progress}%</span>
          </div>
          <div>
            <span class="goal-amount-label">${isDebt ? 'Saldo pendiente' : 'Ahorrado'}</span>
            <span class="goal-amount">${frmt(isDebt ? remaining : g.saved)}</span>
            <span class="goal-amount-sub">${isDebt ? `Pagado ${frmt(g.saved)} de ${frmt(g.targetAmount)}` : `de ${frmt(g.targetAmount)}`}</span>
            <span class="goal-status ${st.cls}">${st.text}</span>
          </div>
        </div>

        <div class="goal-details">
          <div><span>${isDebt ? 'Por pagar' : 'Te faltan'}</span><strong>${frmt(remaining)}</strong></div>
          <div><span>Fecha límite</span><strong>${g.deadline ? fmtMonthYear(g.deadline) : '—'}</strong></div>
          <div><span>Sugerido / mes</span><strong>${monthly ? frmt(Math.ceil(monthly)) : '—'}</strong></div>
        </div>

        <span class="goal-section-label">${isDebt ? 'Últimos pagos' : 'Últimos abonos'}</span>
        <ul class="goal-history list-unstyled">${history}</ul>

        ${actionBtn}
      </div>
    </div>`;
};

const render = () => {
  renderStats();
  const grid = document.getElementById('goal-grid');
  const list = filterGoals();
  const q = document.getElementById('goal-search').value.trim();

  grid.innerHTML = list.map(goalCardHTML).join('');

  // tarjeta para crear meta solo en las vistas de activas
  if (['active', 'saving', 'debt'].includes(currentFilter) && !q) {
    grid.insertAdjacentHTML('beforeend', `
      <div class="col-12 col-md-6 col-xl-4">
        <button type="button" class="goal-card goal-card-new" onclick="openNewModal()">
          <span class="goal-new-icon"><i class="fa-solid fa-plus"></i></span>
          <span>Crear meta de ahorro o deuda</span>
        </button>
      </div>`);
  }

  const empty = document.getElementById('goal-empty');
  empty.hidden = list.length > 0 || (['active', 'saving', 'debt'].includes(currentFilter) && !q);
  document.getElementById('goal-empty-text').textContent = q
    ? `No hay metas que coincidan con "${q}".`
    : 'No hay metas en esta sección.';
};

window.setFilter = (filter) => {
  currentFilter = filter;
  document.querySelectorAll('.goal-tabs .type-tab').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
  render();
};

// ===== selects de cuentas =====
const fillAccountSelect = (select, selected = '') => {
  select.innerHTML = '<option value="">Sin cuenta</option>' +
    accounts.map(a => `<option value="${a._id}" ${a._id === selected ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
};

// ===== crear / editar =====
const clearValidation = (form) => form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

window.selectKind = (btn) => {
  document.querySelectorAll('#meta-kind-wrap .btn-type').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentKind = btn.dataset.kind;
  document.getElementById('meta-monto-label').textContent = currentKind === 'debt' ? 'Saldo de la deuda' : 'Monto objetivo';
  document.getElementById('meta-nombre').placeholder = currentKind === 'debt' ? 'Ej. Liquidar tarjeta' : 'Ej. Fondo de emergencia';
};

window.openNewModal = () => {
  const form = document.getElementById('meta-form');
  form.reset();
  clearValidation(form);
  document.getElementById('meta-edit-id').value = '';
  document.getElementById('metaModalTitle').textContent = 'Nueva meta';
  document.getElementById('meta-save-btn').textContent = 'Guardar meta';
  document.getElementById('meta-kind-wrap').hidden = false;
  document.getElementById('meta-fecha').min = todayStr();
  fillAccountSelect(document.getElementById('meta-cuenta'));

  const kind = currentFilter === 'debt' ? 'debt' : 'saving';
  selectKind(document.querySelector(`#meta-kind-wrap [data-kind="${kind}"]`));

  showModal('nuevaMetaModal');
};

window.openEditModal = (id) => {
  const g = goals.find(x => x._id === id);
  if (!g) return;
  const form = document.getElementById('meta-form');
  clearValidation(form);

  document.getElementById('meta-edit-id').value = id;
  document.getElementById('metaModalTitle').textContent = 'Editar meta';
  document.getElementById('meta-save-btn').textContent = 'Guardar cambios';
  // el tipo no se cambia al editar
  document.getElementById('meta-kind-wrap').hidden = true;
  selectKind(document.querySelector(`#meta-kind-wrap [data-kind="${g.kind}"]`));

  document.getElementById('meta-nombre').value = g.name;
  document.getElementById('meta-monto').value = g.targetAmount;
  document.getElementById('meta-fecha').value = toDateInput(g.deadline);
  document.getElementById('meta-fecha').min = '';
  fillAccountSelect(document.getElementById('meta-cuenta'), g.accountId || '');

  showModal('nuevaMetaModal');
};

const validateGoalForm = (id) => {
  const nameEl = document.getElementById('meta-nombre');
  const amountEl = document.getElementById('meta-monto');
  const dateEl = document.getElementById('meta-fecha');
  let valid = true;

  const name = nameEl.value.trim();
  const nameTaken = goals.some(g => g._id !== id && g.name.toLowerCase() === name.toLowerCase());
  nameEl.nextElementSibling.textContent = nameTaken ? 'Ya tienes una meta con ese nombre.' : 'Escribe un nombre (máx. 40 caracteres).';
  const nameOk = name.length > 0 && name.length <= 40 && !nameTaken;
  nameEl.classList.toggle('is-invalid', !nameOk);
  valid = valid && nameOk;

  const amount = Number(amountEl.value);
  const amountOk = amountEl.value !== '' && amount >= 1;
  amountEl.classList.toggle('is-invalid', !amountOk);
  valid = valid && amountOk;

  // al crear no se permite una fecha pasada
  const dateOk = !dateEl.value || !!id || dateEl.value >= todayStr();
  dateEl.classList.toggle('is-invalid', !dateOk);
  valid = valid && dateOk;

  return valid;
};

window.saveGoal = async () => {
  const id = document.getElementById('meta-edit-id').value;
  if (!validateGoalForm(id)) return;

  const body = {
    name: document.getElementById('meta-nombre').value.trim(),
    targetAmount: Number(document.getElementById('meta-monto').value),
    accountId: document.getElementById('meta-cuenta').value || null,
    deadline: document.getElementById('meta-fecha').value || null,
  };
  if (!id) body.kind = currentKind;

  const btn = document.getElementById('meta-save-btn');
  setBtnLoading(btn, true);
  const { ok, data } = await api(id ? `/api/goals/${id}` : '/api/goals', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(body),
  });
  setBtnLoading(btn, false);
  if (!ok) return;

  bootstrap.Modal.getInstance(document.getElementById('nuevaMetaModal')).hide();
  showToast(id ? 'Meta actualizada' : 'Meta creada');
  await loadGoals();
  if (id && data.completed) showCompleted(data.goal);
};

// ===== abonos =====
window.openAbonoModal = (goalId = '') => {
  const active = goals.filter(g => g.status === 'active');
  if (!active.length) {
    showToast('Primero crea una meta activa para poder abonar', 'error');
    return;
  }
  const form = document.getElementById('abono-form');
  form.reset();
  clearValidation(form);

  const select = document.getElementById('abono-meta');
  select.innerHTML = active.map(g =>
    `<option value="${g._id}" ${g._id === goalId ? 'selected' : ''}>${esc(g.name)} (${g.kind === 'debt' ? 'Deuda' : 'Ahorro'})</option>`
  ).join('');

  fillAccountSelect(document.getElementById('abono-cuenta'));
  const fecha = document.getElementById('abono-fecha');
  fecha.value = todayStr();
  fecha.max = todayStr();
  updateAbonoHint();

  showModal('abonarModal');
};

window.updateAbonoHint = () => {
  const g = goals.find(x => x._id === document.getElementById('abono-meta').value);
  if (!g) return;
  const rem = remainingOf(g);
  document.getElementById('abono-hint').textContent = g.kind === 'debt'
    ? `Deuda pendiente: ${frmt(rem)}`
    : `Te faltan ${frmt(rem)} para llegar a ${frmt(g.targetAmount)}`;
  document.getElementById('abonoModalTitle').textContent = g.kind === 'debt' ? 'Registrar pago' : 'Abonar a una meta';
  document.getElementById('abono-monto').max = g.kind === 'debt' ? rem : '';
};

window.saveContribution = async () => {
  const goalId = document.getElementById('abono-meta').value;
  const amountEl = document.getElementById('abono-monto');
  const dateEl = document.getElementById('abono-fecha');
  const g = goals.find(x => x._id === goalId);

  const amount = Number(amountEl.value);
  let amountMsg = '';
  if (!amountEl.value || amount <= 0) amountMsg = 'El monto debe ser mayor a 0.';
  else if (g && g.kind === 'debt' && amount > remainingOf(g)) amountMsg = `El pago no puede ser mayor a la deuda pendiente (${frmt(remainingOf(g))}).`;
  document.getElementById('abono-monto-error').textContent = amountMsg;
  amountEl.classList.toggle('is-invalid', !!amountMsg);

  const dateOk = dateEl.value && dateEl.value <= todayStr();
  dateEl.classList.toggle('is-invalid', !dateOk);
  document.getElementById('abono-meta').classList.toggle('is-invalid', !g);
  if (amountMsg || !dateOk || !g) return;

  const btn = document.getElementById('abono-save-btn');
  setBtnLoading(btn, true);
  const { ok, data } = await api(`/api/goals/${goalId}/contributions`, {
    method: 'POST',
    body: JSON.stringify({
      amount,
      date: dateEl.value,
      accountId: document.getElementById('abono-cuenta').value || null,
    }),
  });
  setBtnLoading(btn, false);
  if (!ok) return;

  bootstrap.Modal.getInstance(document.getElementById('abonarModal')).hide();
  showToast(g.kind === 'debt' ? 'Pago registrado' : 'Abono guardado');
  await loadGoals();
  if (data.completed) showCompleted(data.goal);
};

window.deleteContribution = async (goalId, contributionId, btn) => {
  setBtnLoading(btn, true, '');
  const { ok } = await api(`/api/goals/${goalId}/contributions/${contributionId}`, { method: 'DELETE' });
  if (!ok) { setBtnLoading(btn, false); return; }
  showToast('Abono eliminado');
  await loadGoals();
  openDetail(goalId);
};

const showCompleted = (g) => {
  const isDebt = g.kind === 'debt';
  document.getElementById('metaCompletadaTitle').textContent = isDebt ? '¡Deuda liquidada!' : '¡Meta completada!';
  document.getElementById('completada-text').innerHTML = isDebt
    ? `Terminaste de pagar <strong style="color:var(--c-white);">${esc(g.name)}</strong>.`
    : `Alcanzaste tu meta <strong style="color:var(--c-white);">${esc(g.name)}</strong>.`;
  document.getElementById('completada-label').textContent = isDebt ? 'Pagado' : 'Ahorrado';
  document.getElementById('completada-monto').textContent = frmt(g.saved);
  showModal('metaCompletadaModal');
};

// ===== detalle =====
window.openDetail = (id) => {
  const g = goals.find(x => x._id === id);
  if (!g) return;
  const isDebt = g.kind === 'debt';
  const st = goalStatus(g);
  const acc = accountName(g.accountId);
  const list = [...g.contributions].sort((a, b) => new Date(b.date) - new Date(a.date));

  document.getElementById('detalleTitle').textContent = g.name;
  document.getElementById('detalle-body').innerHTML = `
    <div class="d-flex flex-wrap gap-2 mb-3">
      <span class="goal-status ${st.cls}">${st.text}</span>
      <span class="goal-type">${isDebt ? 'Deuda' : 'Ahorro'}${acc ? ' · ' + esc(acc) : ''}</span>
    </div>
    <div class="goal-details mb-3">
      <div><span>${isDebt ? 'Pagado' : 'Ahorrado'}</span><strong>${frmt(g.saved)}</strong></div>
      <div><span>${isDebt ? 'Deuda inicial' : 'Objetivo'}</span><strong>${frmt(g.targetAmount)}</strong></div>
      <div><span>Fecha límite</span><strong>${g.deadline ? fmtMonthYear(g.deadline) : '—'}</strong></div>
    </div>
    <div class="detail-bar mb-3"><div style="width:${g.progress}%"></div></div>
    <span class="goal-section-label">${isDebt ? 'Pagos' : 'Abonos'} (${list.length})</span>
    <ul class="goal-history list-unstyled detail-history">
      ${list.length ? list.map(c => `
        <li>
          <span>${fmtDayMonth(c.date)} ${parseDate(c.date).getFullYear()}${accountName(c.accountId) ? ` · <em>${esc(accountName(c.accountId))}</em>` : ''}</span>
          <span class="d-flex align-items-center gap-2">
            <strong class="text-income">+${frmt(c.amount)}</strong>
            <button class="tx-btn tx-btn-danger" aria-label="Eliminar abono" onclick="deleteContribution('${g._id}', '${c._id}', this)"><i class="fa-regular fa-trash-can"></i></button>
          </span>
        </li>`).join('') : `<li><span>Aún no hay ${isDebt ? 'pagos' : 'abonos'}</span></li>`}
    </ul>`;

  let actions = '';
  if (g.status === 'active') {
    actions = `
      <button class="btn btn-secondary" onclick="changeStatus('${g._id}', 'cancelled', this)">Cancelar meta</button>
      <button class="btn btn-tx-secondary" onclick="changeStatus('${g._id}', 'completed', this)">Marcar completada</button>
      <button class="btn btn-gold-primary" onclick="openAbonoModal('${g._id}')">${isDebt ? 'Registrar pago' : 'Abonar'}</button>`;
  } else if (g.status === 'cancelled') {
    actions = `<button class="btn btn-gold-primary" onclick="changeStatus('${g._id}', 'active', this)">Reactivar meta</button>`;
  } else {
    actions = `<button class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>`;
  }
  document.getElementById('detalle-footer').innerHTML = actions;

  showModal('detalleModal');
};

window.changeStatus = async (id, status, btn) => {
  setBtnLoading(btn, true);
  const { ok, data } = await api(`/api/goals/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
  setBtnLoading(btn, false);
  if (!ok) return;

  const msgs = { cancelled: 'Meta cancelada', active: 'Meta reactivada', completed: 'Meta marcada como completada' };
  showToast(msgs[status]);
  await loadGoals();
  if (status === 'completed') showCompleted(data.goal);
  else bootstrap.Modal.getInstance(document.getElementById('detalleModal'))?.hide();
};

// ===== eliminar =====
window.openDeleteModal = (id) => {
  const g = goals.find(x => x._id === id);
  if (!g) return;
  pendingDeleteId = id;
  document.getElementById('delete-title').textContent = `¿Eliminar "${g.name}"?`;
  document.getElementById('delete-desc').textContent = g.contributions.length
    ? `Sus ${g.contributions.length} abono(s) se quedan en tus transacciones, pero sin meta. Esta acción no se puede deshacer.`
    : 'Esta acción no se puede deshacer.';
  showModal('deleteModal');
};

window.confirmDelete = async () => {
  if (!pendingDeleteId) return;
  const btn = document.getElementById('delete-confirm-btn');
  setBtnLoading(btn, true, 'Eliminando…');
  const { ok } = await api(`/api/goals/${pendingDeleteId}`, { method: 'DELETE' });
  setBtnLoading(btn, false);
  if (!ok) return;
  bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
  pendingDeleteId = null;
  showToast('Meta eliminada');
  await loadGoals();
};

// ===== listeners =====
document.querySelectorAll('.goal-tabs .type-tab').forEach(btn => {
  btn.addEventListener('click', () => setFilter(btn.dataset.filter));
});

// quitar el error al escribir
document.querySelectorAll('#meta-form input, #abono-form input, #abono-form select').forEach(el => {
  el.addEventListener('input', () => el.classList.remove('is-invalid'));
});

// enter en los formularios
document.getElementById('meta-form').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveGoal(); } });
document.getElementById('abono-form').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveContribution(); } });

(async () => {
  await loadAccounts();
  await loadGoals();
})();