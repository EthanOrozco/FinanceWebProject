const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const User = require('../models/User');
require('../models/Goal'); // registra el modelo para el populate de goalId

// Todos los montos van en centavos.
// Las fechas de las transacciones se guardan como medianoche UTC del día elegido
// ("2026-11-07" -> 2026-11-07T00:00Z), así que los rangos se arman en UTC
// a partir del día de hoy en hora local, para que coincidan con lo que ve el usuario.

const DAY = 24 * 60 * 60 * 1000;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const PERIODS = ['week', 'month', 'year'];
const MAX_CATEGORIES = 5; // el resto se junta en "Otros"
const ALERT_DAYS = 7;     // avisar de pagos de tarjeta que vencen en esta ventana

const todayUTC = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

const addDays = (date, n) => new Date(date.getTime() + n * DAY);
const monthStart = (y, m) => new Date(Date.UTC(y, m, 1)); // ajustar el mes

// rango [start, end) del periodo actual y del anterior
const periodRange = (period, today) => {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  if (period === 'week') {
    const start = addDays(today, -((today.getUTCDay() + 6) % 7)); // lunes
    return { start, end: addDays(start, 7), prevStart: addDays(start, -7) };
  }
  if (period === 'year') {
    return { start: monthStart(y, 0), end: monthStart(y + 1, 0), prevStart: monthStart(y - 1, 0) };
  }
  return { start: monthStart(y, m), end: monthStart(y, m + 1), prevStart: monthStart(y, m - 1) };
};

// barras de la gráfica de flujo: 8 semanas, 6 meses o los 12 meses del año
const cashflowBuckets = (period, today, range) => {
  const buckets = [];
  if (period === 'week') {
    for (let i = 7; i >= 0; i--) {
      const start = addDays(range.start, -7 * i);
      buckets.push({ label: `${start.getUTCDate()} ${MESES[start.getUTCMonth()]}`, start, end: addDays(start, 7) });
    }
  } else {
    const y = today.getUTCFullYear();
    const first = period === 'year' ? 0 : today.getUTCMonth() - 5;
    const last = period === 'year' ? 11 : today.getUTCMonth();
    for (let m = first; m <= last; m++) {
      const start = monthStart(y, m);
      const label = MESES[start.getUTCMonth()];
      buckets.push({ label: label[0].toUpperCase() + label.slice(1), start, end: monthStart(y, m + 1) });
    }
  }
  return buckets;
};

const inRange = (tx, start, end) => tx.date >= start && tx.date < end;

// ingresos, gastos y cambio del patrimonio neto de una lista de transacciones
//  - abono a meta de ahorro = transfer sin cuenta destino: el dinero sale de las cuentas
//    pero no es gasto, por eso solo cuenta para el patrimonio
const summarize = (txs) => {
  let income = 0, expense = 0, toSavings = 0;
  for (const tx of txs) {
    if (tx.type === 'income') income += tx.amount;
    else if (tx.type === 'expense') expense += tx.amount;
    else if (tx.type === 'transfer' && !tx.toAccountId) toSavings += tx.amount;
  }
  return { income, expense, net: income - expense, netWorthChange: income - expense - toSavings };
};

const pctChange = (current, previous) =>
  previous ? Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10 : null;

// próxima fecha de pago de una tarjeta (si el mes no tiene ese día, el último del mes)
const nextDueDate = (dueDay, today) => {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const dateIn = (month) => {
    const lastDay = new Date(Date.UTC(y, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, month, Math.min(dueDay, lastDay)));
  };
  const thisMonth = dateIn(m);
  return thisMonth >= today ? thisMonth : dateIn(m + 1);
};

const getDashboard = async (req, res) => {
  const period = PERIODS.includes(req.query.period) ? req.query.period : 'month';
  const today = todayUTC();
  const range = periodRange(period, today);
  const buckets = cashflowBuckets(period, today, range);

  const from = new Date(Math.min(range.prevStart, buckets[0].start));
  const to = new Date(Math.max(range.end, buckets[buckets.length - 1].end));

  const [user, accounts, txs, recent] = await Promise.all([
    User.findById(req.userId).select('name').lean(),
    Account.find({ userId: req.userId }).sort({ createdAt: 1 }).lean(),
    Transaction.find({ userId: req.userId, date: { $gte: from, $lt: to } })
      .select('type amount date categoryId toAccountId goalId')
      .lean(),
    Transaction.find({ userId: req.userId })
      .sort({ date: -1, createdAt: -1 })
      .limit(5)
      .populate('categoryId', 'name color')
      .populate('accountId', 'name')
      .populate('toAccountId', 'name')
      .populate('goalId', 'name kind')
      .lean(),
  ]);

  // saldos: en crédito el balance es deuda
  let assets = 0, debt = 0;
  for (const a of accounts) {
    if (a.type === 'credito') debt += a.balance;
    else assets += a.balance;
  }
  const netWorth = assets - debt;

  const current = txs.filter(tx => inRange(tx, range.start, range.end));
  const previous = txs.filter(tx => inRange(tx, range.prevStart, range.start));
  const cur = summarize(current);
  const prev = summarize(previous);
  const startNetWorth = netWorth - cur.netWorthChange;

  // gastos por categoría del periodo
  const byCategory = new Map();
  for (const tx of current) {
    if (tx.type !== 'expense') continue;
    const key = tx.categoryId ? String(tx.categoryId) : (tx.goalId ? 'debt' : 'none');
    byCategory.set(key, (byCategory.get(key) || 0) + tx.amount);
  }
  const catIds = [...byCategory.keys()].filter(k => k !== 'debt' && k !== 'none');
  const catDocs = await Category.find({ _id: { $in: catIds }, userId: req.userId }).select('name color').lean();
  const catById = new Map(catDocs.map(c => [String(c._id), c]));

  const categories = [...byCategory]
    .map(([key, amount]) => {
      if (key === 'debt') return { name: 'Pagos de deudas', color: 'gold', amount };
      const c = catById.get(key);
      return { name: c ? c.name : 'Sin categoría', color: c ? c.color : 'slate', amount };
    })
    .sort((a, b) => b.amount - a.amount);
  if (categories.length > MAX_CATEGORIES + 1) {
    const rest = categories.splice(MAX_CATEGORIES);
    categories.push({ name: 'Otros', color: 'slate', amount: rest.reduce((s, c) => s + c.amount, 0) });
  }

  // tarjetas con saldo que vencen pronto
  const alerts = accounts
    .filter(a => a.type === 'credito' && a.balance > 0 && a.dueDay)
    .map(a => {
      const dueDate = nextDueDate(a.dueDay, today);
      return {
        accountId: a._id,
        name: a.name,
        balance: a.balance,
        dueDate,
        daysLeft: Math.round((dueDate - today) / DAY),
      };
    })
    .filter(a => a.daysLeft <= ALERT_DAYS)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  res.json({
    user: { name: user?.name || '' },
    period: { type: period, start: range.start, end: range.end, prevStart: range.prevStart },
    balance: {
      netWorth,
      assets,
      debt,
      accountCount: accounts.length,
      change: startNetWorth ? pctChange(netWorth, startNetWorth) : null,
    },
    income: { amount: cur.income, change: pctChange(cur.income, prev.income) },
    expense: { amount: cur.expense, change: pctChange(cur.expense, prev.expense) },
    netSavings: cur.net,
    cashflow: buckets.map(b => {
      const s = summarize(txs.filter(tx => inRange(tx, b.start, b.end)));
      return { label: b.label, income: s.income, expense: s.expense };
    }),
    categories,
    accounts: accounts.map(a => ({
      _id: a._id, name: a.name, type: a.type, balance: a.balance,
      creditLimit: a.creditLimit, cutoffDay: a.cutoffDay, dueDay: a.dueDay, color: a.color,
    })),
    recent,
    alerts,
  });
};

module.exports = { getDashboard };
