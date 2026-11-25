VectorAuth.requireAuth();

(() => {
  // colores guardados en categorías/cuentas -> token CSS
  const PAL = {
    gold: '--c-gold-dark',
    blue: '--c-blue',
    teal: '--c-teal',
    purple: '--c-purple',
    coral: '--c-coral',
    pink: '--c-pink',
    slate: '--c-slate',
  };
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const ACCOUNT_TYPE = { debito: 'Débito', ahorro: 'Ahorro', efectivo: 'Efectivo', credito: 'Crédito' };
  const TYPE_LABEL = { expense: 'gasto', income: 'ingreso', transfer: 'transferencia' };
  const MAX_ACCOUNTS = 4;
  const NO_ACCOUNTS_MSG = 'Primero crea una cuenta en la sección Cuentas';

  let period = 'month';
  let dashboard = null;
  let categories = [];
  let movType = 'expense';
  let cashChart = null;
  let catChart = null;

  // helpers
  const $ = (id) => document.getElementById(id);

  // montos en centavos
  const frmt = (cents) => '$' + (Math.abs(Number(cents)) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const frmtShort = (cents) => '$' + Math.round(Number(cents) / 100).toLocaleString('es-MX');
  const toCents = (value) => Math.round(Number(value) * 100);

  const esc = (str) => String(str ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // las fechas vienen en UTC: solo se usa la parte YYYY-MM-DD para no recorrer un día
  const ymd = (iso) => iso.slice(0, 10).split('-').map(Number);

  const relativeDay = (iso) => {
    const key = iso.slice(0, 10);
    const today = todayStr();
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    if (key === today) return 'Hoy';
    if (key === yesterday) return 'Ayer';
    const [yy, m, d] = ymd(iso);
    return `${d} ${MESES[m - 1]}${yy !== new Date().getFullYear() ? ` ${yy}` : ''}`;
  };

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  };

  const periodText = () => {
    const [y, m, d] = ymd(dashboard.period.start);
    if (period === 'week') return { title: `Semana del ${d} de ${MESES_LARGOS[m - 1]}`, of: 'de la semana', vs: 'vs semana pasada' };
    if (period === 'year') return { title: `Resumen de ${y}`, of: `de ${y}`, vs: `vs ${y - 1}` };
    const prev = MESES[(m + 10) % 12];
    return { title: `Resumen de ${MESES_LARGOS[m - 1]} ${y}`, of: `de ${MESES_LARGOS[m - 1]}`, vs: `vs ${prev}` };
  };

  // badge de % de cambio; goodWhenUp define si subir es bueno (ingresos) o malo (gastos)
  const changeBadge = (pct, vs, goodWhenUp = true) => {
    if (pct === null || pct === undefined) return '';
    const up = pct >= 0;
    const good = up === goodWhenUp;
    const color = good ? 'teal' : 'coral';
    const sign = up ? '+' : '−';
    return `<span class="badge" style="background: var(--c-${color}-tint); color: var(--c-${color}); font-weight: 600;" title="${esc(vs)}">
      <i class="fa-solid fa-arrow-trend-${up ? 'up' : 'down'} me-1"></i>${sign}${Math.abs(pct)}%</span>`;
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
    $('toast-area').append(el);
    const t = new bootstrap.Toast(el, { delay: 3500 });
    el.addEventListener('hidden.bs.toast', () => el.remove());
    t.show();
  };

  // fetch que regresa { ok, data }; manda a login si la sesión expiró
  const api = async (url, options = {}) => {
    try {
      const res = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        VectorAuth.logout();
        return { ok: false, data };
      }
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

  // render
  const renderHeader = () => {
    const name = (dashboard.user.name || VectorAuth.getUser()?.name || '').split(' ')[0];
    $('dash-greeting').textContent = name ? `${greeting()}, ${name}` : greeting();
    $('dash-period-label').textContent = periodText().title;
  };

  const renderAlerts = () => {
    $('dash-alerts').innerHTML = dashboard.alerts.map(a => {
      const [y, m, d] = ymd(a.dueDate);
      const date = new Date(y, m - 1, d);
      const weekday = date.toLocaleDateString('es-MX', { weekday: 'long' });
      const when = a.daysLeft === 0 ? 'vence hoy' : a.daysLeft === 1 ? 'vence mañana' : `vence en ${a.daysLeft} días`;
      return `
        <div class="alert-payment d-flex align-items-center gap-3 p-3" role="alert">
          <i class="fa-solid fa-credit-card fa-lg" style="color: var(--c-gold-text); flex-shrink: 0;"></i>
          <div class="flex-grow-1">
            <strong>Tu ${esc(a.name)} ${when}</strong>
            <p class="mb-0" style="font-size: 13px;">Fecha límite: ${weekday} ${d} de ${MESES_LARGOS[m - 1]} · Saldo a pagar ${frmt(a.balance)}</p>
          </div>
          <button class="btn btn-gold-primary btn-sm" data-pay="${a.accountId}">Registrar pago</button>
          <button type="button" class="btn btn-sm" style="color: var(--c-text-muted);" data-dismiss-alert aria-label="Cerrar">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>`;
    }).join('');
  };

  const renderBalance = () => {
    const b = dashboard.balance;
    const p = periodText();
    const n = b.accountCount;
    $('dash-account-count').textContent = `${n} ${n === 1 ? 'cuenta' : 'cuentas'} · MXN`;
    $('dash-balance-change').innerHTML = changeBadge(b.change, 'Cambio desde el inicio del periodo', true);
    $('dash-net-worth').textContent = (b.netWorth < 0 ? '−' : '') + frmt(b.netWorth);
    $('dash-assets').textContent = frmt(b.assets);
    $('dash-debt').textContent = b.debt ? `−${frmt(b.debt)}` : frmt(0);

    const s = dashboard.netSavings;
    $('dash-savings-label').textContent = `Ahorro neto ${p.of}`;
    $('dash-savings').textContent = (s > 0 ? '+' : s < 0 ? '−' : '') + frmt(s);
    $('dash-savings').className = `balance-stat-value ${s > 0 ? 'text-income' : s < 0 ? 'text-expense' : ''}`;

    $('dash-income-label').textContent = `Ingresos ${p.of}`;
    $('dash-income').textContent = frmt(dashboard.income.amount);
    $('dash-income-change').innerHTML = changeBadge(dashboard.income.change, p.vs, true);
    $('dash-expense-label').textContent = `Gastos ${p.of}`;
    $('dash-expense').textContent = frmt(dashboard.expense.amount);
    $('dash-expense-change').innerHTML = changeBadge(dashboard.expense.change, p.vs, false);
  };

  const renderCharts = () => {
    const sub = { week: 'Ingresos vs gastos por semana', month: 'Ingresos vs gastos por mes', year: 'Ingresos vs gastos por mes' };
    $('dash-cashflow-sub').textContent = sub[period];
    $('dash-cat-sub').textContent = periodText().title.replace('Resumen de ', '').replace(/^./, c => c.toUpperCase());

    const cf = dashboard.cashflow;
    cashChart.data.labels = cf.map(b => b.label);
    cashChart.data.datasets[0].data = cf.map(b => b.income / 100);
    cashChart.data.datasets[1].data = cf.map(b => b.expense / 100);

    const cats = dashboard.categories;
    const total = cats.reduce((s, c) => s + c.amount, 0);
    catChart.$total = total;
    if (cats.length) {
      catChart.data.labels = cats.map(c => c.name);
      catChart.data.datasets[0].data = cats.map(c => c.amount / 100);
    } else {
      // dona vacía en gris
      catChart.data.labels = [];
      catChart.data.datasets[0].data = [1];
    }

    $('dash-cat-legend').innerHTML = cats.length
      ? cats.map(c => `
          <li><span class="cat-dot" style="background:var(${PAL[c.color] || PAL.slate})"></span><span class="cat-name">${esc(c.name)}</span><span class="cat-pct">${Math.round((c.amount / total) * 100)}%</span><span class="cat-amount">${frmtShort(c.amount)}</span></li>`).join('')
      : '<li class="dash-empty">Sin gastos en este periodo</li>';

    paintCharts();
  };

  const renderAccounts = () => {
    const list = $('dash-accounts');
    const accounts = dashboard.accounts;
    if (!accounts.length) {
      list.innerHTML = '<li class="dash-empty">Aún no tienes cuentas. <a href="/cuentas">Crear una</a></li>';
      return;
    }
    const shown = [...accounts].sort((a, b) => b.balance - a.balance).slice(0, MAX_ACCOUNTS);
    list.innerHTML = shown.map(a => {
      const isCredit = a.type === 'credito';
      const sub = isCredit && a.cutoffDay ? `Crédito · corte día ${a.cutoffDay}` : ACCOUNT_TYPE[a.type];
      return `
        <li class="card-list-item">
          <div>
            <p class="item-name">${esc(a.name)}</p>
            <p class="item-sub">${sub}</p>
          </div>
          <p class="item-value ${isCredit && a.balance ? 'text-expense' : ''}">${isCredit && a.balance ? '−' : ''}${frmt(a.balance)}</p>
        </li>`;
    }).join('') + (accounts.length > MAX_ACCOUNTS
      ? `<li class="dash-empty pb-0"><a href="/cuentas">y ${accounts.length - MAX_ACCOUNTS} más</a></li>`
      : '');
  };

  const txTitle = (t) => {
    if (t.description) return t.description;
    if (t.goalId) return `Abono a ${t.goalId.name}`;
    if (t.type === 'transfer') return 'Transferencia';
    return t.categoryId?.name || (t.type === 'income' ? 'Ingreso' : 'Gasto');
  };

  const renderRecent = () => {
    const list = $('dash-recent');
    const recent = dashboard.recent;
    if (!recent.length) {
      list.innerHTML = '<li class="dash-empty">Aún no hay movimientos.</li>';
      return;
    }
    list.innerHTML = recent.map(t => {
      const account = t.accountId?.name || 'Cuenta eliminada';
      const parts = [relativeDay(t.date)];
      if (t.type === 'transfer') parts.push(t.toAccountId ? `${account} → ${t.toAccountId.name}` : account);
      else parts.push(account);
      if (t.categoryId && t.description) parts.push(t.categoryId.name);

      const cls = t.type === 'income' ? 'text-income' : t.type === 'expense' ? 'text-expense' : '';
      const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';
      return `
        <li class="card-list-item">
          <div>
            <p class="item-name">${esc(txTitle(t))}</p>
            <p class="item-sub">${esc(parts.join(' · '))}</p>
          </div>
          <p class="item-value ${cls}">${sign}${frmt(t.amount)}</p>
        </li>`;
    }).join('');
  };

  const render = () => {
    renderHeader();
    renderAlerts();
    renderBalance();
    renderCharts();
    renderAccounts();
    renderRecent();
  };

  // gráficas
  const centerTextPlugin = {
    id: 'centerText',
    beforeDraw(chart) {
      if (chart.config.type !== 'doughnut') return;
      const { ctx, chartArea: { left, right, top, bottom } } = chart;
      const cx = (left + right) / 2;
      const cy = (top + bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = cssVar('--c-text-4');
      ctx.font = '500 12px Inter, sans-serif';
      ctx.fillText('Total', cx, cy - 11);
      ctx.fillStyle = cssVar('--c-text-strong');
      ctx.font = '600 18px Inter, sans-serif';
      ctx.fillText(frmt(chart.$total || 0), cx, cy + 11);
      ctx.restore();
    },
  };

  const initCharts = () => {
    cashChart = new Chart($('cashFlowChart'), {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          { label: 'Ingresos', data: [], borderRadius: 4 },
          { label: 'Gastos', data: [], borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top', labels: {} },
          tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${frmt(c.raw * 100)}` } },
        },
        scales: {
          x: { ticks: {}, grid: {} },
          y: { beginAtZero: true, ticks: { callback: (v) => '$' + Number(v).toLocaleString('es-MX') }, grid: {} },
        },
      },
    });

    catChart = new Chart($('catChart'), {
      type: 'doughnut',
      data: { labels: [], datasets: [{ data: [], borderWidth: 0, hoverOffset: 6, cutout: '72%' }] },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            filter: () => dashboard?.categories.length > 0,
            callbacks: { label: (c) => ` ${frmt(c.raw * 100)}` },
          },
        },
      },
      plugins: [centerTextPlugin],
    });
  };

  // Canvas can't resolve var(), so pull token values and repaint on theme change.
  const paintCharts = () => {
    if (!cashChart) return;
    const muted = cssVar('--c-text-muted'), grid = cssVar('--c-grid');
    const [inc, exp] = cashChart.data.datasets;
    inc.backgroundColor = cssVar('--c-teal');
    exp.backgroundColor = cssVar('--c-coral');
    cashChart.options.plugins.legend.labels.color = muted;
    for (const axis of ['x', 'y']) {
      cashChart.options.scales[axis].ticks.color = muted;
      cashChart.options.scales[axis].grid.color = grid;
    }
    const cats = dashboard?.categories || [];
    catChart.data.datasets[0].backgroundColor = cats.length
      ? cats.map(c => cssVar(PAL[c.color] || PAL.slate))
      : [cssVar('--c-input-bg') || grid];
    cashChart.update('none');
    catChart.update('none');
  };
  window.addEventListener('themechange', paintCharts);

  // carga
  const loadDashboard = async () => {
    const { ok, data } = await api(`/api/dashboard?period=${period}`);
    if (!ok) {
      ['dash-accounts', 'dash-recent'].forEach(id => {
        $(id).innerHTML = '<li class="dash-empty" style="color: var(--c-coral);">No se pudo cargar la información.</li>';
      });
      return;
    }
    dashboard = data;
    render();
  };

  const loadCategories = async () => {
    const { ok, data } = await api('/api/categories?sort=name');
    categories = ok ? data : [];
  };

  // modal nuevo movimiento
  const accounts = () => dashboard?.accounts || [];

  const fillAccountSelect = (select, selected = '') => {
    select.innerHTML = accounts()
      .map(a => `<option value="${a._id}" ${a._id === selected ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
  };

  const fillCategorySelect = () => {
    const list = categories.filter(c => c.kind === movType);
    $('mov-categoria').innerHTML = list.length
      ? '<option value="">Elige una categoría</option>' + list.map(c => `<option value="${c._id}">${esc(c.name)}</option>`).join('')
      : `<option value="">No tienes categorías de ${TYPE_LABEL[movType]}</option>`;
    $('mov-categoria-error').textContent = list.length
      ? 'Elige una categoría.'
      : `Primero crea una categoría de ${TYPE_LABEL[movType]} en Categorías.`;
  };

  const clearValidation = () => {
    document.querySelectorAll('#mov-form .is-invalid').forEach(el => el.classList.remove('is-invalid'));
  };

  const applyType = (type) => {
    movType = type;
    document.querySelectorAll('#mov-type-wrap .btn-type').forEach(b => b.classList.toggle('active', b.dataset.type === type));
    const isTransfer = type === 'transfer';
    $('mov-categoria-wrap').hidden = isTransfer;
    $('mov-destino-wrap').hidden = !isTransfer;
    $('mov-cuenta-label').textContent = isTransfer ? 'Cuenta origen' : 'Cuenta';
    if (!isTransfer) fillCategorySelect();
    clearValidation();
  };

  // toAccountId preselecciona la cuenta destino (para "Registrar pago" de una tarjeta)
  const openNewModal = (type = 'expense', toAccountId = '') => {
    if (!dashboard) return;
    if (!accounts().length) return showToast(NO_ACCOUNTS_MSG, 'error');
    if (type === 'transfer' && accounts().length < 2) {
      return showToast('Necesitas al menos dos cuentas para hacer una transferencia', 'error');
    }
    $('mov-form').reset();
    $('mov-fecha').value = todayStr();
    const from = accounts().find(a => a._id !== toAccountId && a.type !== 'credito') || accounts().find(a => a._id !== toAccountId);
    fillAccountSelect($('mov-cuenta'), type === 'transfer' ? from?._id : '');
    fillAccountSelect($('mov-destino'), toAccountId);
    applyType(type);
    if (toAccountId) {
      const alert = dashboard.alerts.find(a => a.accountId === toAccountId);
      if (alert) $('mov-monto').value = (alert.balance / 100).toFixed(2);
      $('mov-descripcion').value = `Pago de ${alert?.name || 'tarjeta'}`;
    }
    bootstrap.Modal.getOrCreateInstance($('nuevoMovimientoModal')).show();
  };

  const validateForm = () => {
    const amountEl = $('mov-monto'), catEl = $('mov-categoria');
    const fromEl = $('mov-cuenta'), toEl = $('mov-destino'), dateEl = $('mov-fecha');

    const amountOk = amountEl.value !== '' && toCents(amountEl.value) >= 1;
    const fromOk = !!fromEl.value;
    const catOk = movType === 'transfer' || !!catEl.value;
    const destOk = movType !== 'transfer' || (!!toEl.value && toEl.value !== fromEl.value);
    const dateOk = !!dateEl.value;

    amountEl.classList.toggle('is-invalid', !amountOk);
    fromEl.classList.toggle('is-invalid', !fromOk);
    catEl.classList.toggle('is-invalid', !catOk);
    toEl.classList.toggle('is-invalid', !destOk);
    dateEl.classList.toggle('is-invalid', !dateOk);
    return amountOk && fromOk && catOk && destOk && dateOk;
  };

  const saveTransaction = async () => {
    if (!validateForm()) return;
    const isTransfer = movType === 'transfer';
    const body = {
      type: movType,
      amount: toCents($('mov-monto').value),
      accountId: $('mov-cuenta').value,
      categoryId: isTransfer ? null : $('mov-categoria').value,
      toAccountId: isTransfer ? $('mov-destino').value : null,
      description: $('mov-descripcion').value.trim(),
      date: $('mov-fecha').value,
    };

    const btn = $('mov-save-btn');
    const html = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Guardando…';
    const { ok } = await api('/api/transactions', { method: 'POST', body: JSON.stringify(body) });
    btn.disabled = false;
    btn.innerHTML = html;
    if (!ok) return;

    bootstrap.Modal.getInstance($('nuevoMovimientoModal')).hide();
    showToast('Movimiento guardado');
    await loadDashboard();
  };

  // listeners
  document.querySelectorAll('#dash-period .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.period === period) return;
      document.querySelectorAll('#dash-period .btn').forEach(b => b.classList.toggle('active', b === btn));
      period = btn.dataset.period;
      loadDashboard();
    });
  });

  $('dash-new-btn').addEventListener('click', () => openNewModal());

  $('dash-alerts').addEventListener('click', (e) => {
    const pay = e.target.closest('[data-pay]');
    if (pay) return openNewModal('transfer', pay.dataset.pay);
    const close = e.target.closest('[data-dismiss-alert]');
    if (close) close.closest('.alert-payment').remove();
  });

  document.querySelectorAll('#mov-type-wrap .btn-type').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (type === 'transfer' && accounts().length < 2) {
        return showToast('Necesitas al menos dos cuentas para hacer una transferencia', 'error');
      }
      applyType(type);
    });
  });

  $('mov-save-btn').addEventListener('click', saveTransaction);
  document.querySelectorAll('#mov-form input, #mov-form select').forEach(el => {
    el.addEventListener('input', () => el.classList.remove('is-invalid'));
  });
  $('mov-form').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveTransaction(); }
  });

  initCharts();
  loadDashboard();
  loadCategories();
})();
