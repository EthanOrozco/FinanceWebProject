// Llena la cuenta de un usuario con datos de ejemplo (cuentas, categorías, metas y ~7 meses de movimientos).
//
//   node scripts/seed-demo.js --email tu@correo.com --dry-run   # solo simula e imprime el resumen
//   node scripts/seed-demo.js --email tu@correo.com --yes       # BORRA los datos de ese usuario y siembra
//
// Solo toca documentos con el userId de ese usuario. Los saldos de las cuentas se calculan
// reproduciendo los movimientos, así que siempre cuadran con el historial.
// Usa una semilla fija: correrlo dos veces el mismo día da los mismos datos (--seed N para variar).

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Account = require('../src/models/Account');
const Category = require('../src/models/Category');
const Goal = require('../src/models/Goal');
const Transaction = require('../src/models/Transaction');

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const EMAIL = arg('email');
const DRY_RUN = args.includes('--dry-run');
const CONFIRMED = args.includes('--yes');
const SEED = Number(arg('seed') || 2026);
const MONTHS = 7;

if (!EMAIL || (!DRY_RUN && !CONFIRMED)) {
  console.error('Uso: node scripts/seed-demo.js --email <correo> (--dry-run | --yes) [--seed N]');
  process.exit(1);
}

// PRNG con semilla (mulberry32) para que los datos sean reproducibles
let state = SEED;
const rand = () => {
  state |= 0; state = (state + 0x6D2B79F5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (min, max) => min + rand() * (max - min);
const chance = (p) => rand() < p;
const pick = (list) => list[Math.floor(rand() * list.length)];
const pesos = (min, max, step = 1) => Math.round(Math.round(between(min, max) / step) * step * 100); // -> centavos (entero)

// fechas como medianoche UTC del día local (igual que las guarda el front)
const now = new Date();
const TODAY = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
const START = new Date(Date.UTC(now.getFullYear(), now.getMonth() - MONTHS + 1, 1));
const DAY = 24 * 60 * 60 * 1000;
const lastDayOf = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
const clampDay = (d, day) => Math.min(day, lastDayOf(d));
const fmt = (cents) => (cents / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

// día de pago de la Nu: en 3 días, para que el dashboard muestre la alerta
const NU_DUE = ((now.getDate() + 3 - 1) % 28) + 1;

const ACCOUNTS = [
  { key: 'bbva', name: 'BBVA Débito', type: 'debito', opening: 18000, color: 'blue' },
  { key: 'hey', name: 'Ahorro Hey', type: 'ahorro', opening: 22000, color: 'teal' },
  { key: 'cash', name: 'Efectivo', type: 'efectivo', opening: 1200, color: 'gold' },
  { key: 'nu', name: 'Tarjeta Nu', type: 'credito', creditLimit: 30000, cutoffDay: ((NU_DUE + 7) % 28) + 1, dueDay: NU_DUE, color: 'purple' },
  { key: 'oro', name: 'Tarjeta Oro', type: 'credito', creditLimit: 45000, cutoffDay: 10, dueDay: 2, color: 'gold' },
];

const CATEGORIES = [
  { key: 'comida', name: 'Comida', kind: 'expense', color: 'gold', icon: 'fa-utensils' },
  { key: 'transporte', name: 'Transporte', kind: 'expense', color: 'blue', icon: 'fa-car' },
  { key: 'hogar', name: 'Hogar', kind: 'expense', color: 'purple', icon: 'fa-house' },
  { key: 'subs', name: 'Suscripciones', kind: 'expense', color: 'teal', icon: 'fa-rotate' },
  { key: 'ocio', name: 'Ocio', kind: 'expense', color: 'coral', icon: 'fa-gamepad' },
  { key: 'salud', name: 'Salud', kind: 'expense', color: 'pink', icon: 'fa-heart' },
  { key: 'compras', name: 'Compras', kind: 'expense', color: 'slate', icon: 'fa-bag-shopping' },
  { key: 'educacion', name: 'Educación', kind: 'expense', color: 'blue', icon: 'fa-graduation-cap' },
  { key: 'nomina', name: 'Nómina', kind: 'income', color: 'teal', icon: 'fa-briefcase' },
  { key: 'freelance', name: 'Freelance', kind: 'income', color: 'blue', icon: 'fa-laptop' },
  { key: 'otrosIng', name: 'Otros ingresos', kind: 'income', color: 'slate', icon: 'fa-tag' },
];

const y = now.getFullYear();
const GOALS = [
  { key: 'emergencia', name: 'Fondo de emergencia', kind: 'saving', target: 60000, deadline: `${y + 1}-06-30`, account: 'hey', monthly: 1500, day: 17 },
  { key: 'japon', name: 'Viaje a Japón', kind: 'saving', target: 45000, deadline: `${y + 1}-04-01`, account: 'bbva', monthly: 1800, day: 20 },
  { key: 'laptop', name: 'Laptop nueva', kind: 'saving', target: 28000, deadline: null, account: 'bbva', monthly: 900, day: 25 },
  { key: 'coche', name: 'Préstamo del coche', kind: 'debt', target: 85000, deadline: `${y + 2}-01-31`, account: 'bbva', monthly: 3200, day: 3 },
];

// simulación
const bal = Object.fromEntries(ACCOUNTS.map(a => [a.key, a.type === 'credito' ? 0 : a.opening * 100]));
const stmt = { nu: 0, oro: 0 }; // saldo al último corte, lo que se paga en la fecha límite
const byKey = Object.fromEntries(ACCOUNTS.map(a => [a.key, a]));
const txs = [];
let skipped = 0;

// aplica el movimiento solo si cabe (saldo suficiente / dentro del límite), como lo haría la API
const record = (date, tx) => {
  const flows = [];
  if (tx.type === 'income') flows.push([tx.account, tx.amount]);
  else if (tx.type === 'expense') flows.push([tx.account, -tx.amount]);
  else { flows.push([tx.account, -tx.amount]); if (tx.to) flows.push([tx.to, tx.amount]); }

  const next = { ...bal };
  for (const [k, flow] of flows) {
    const acc = byKey[k];
    next[k] += acc.type === 'credito' ? -flow : flow;
    if (next[k] < 0 || (acc.type === 'credito' && next[k] > acc.creditLimit * 100)) { skipped++; return false; }
  }
  Object.assign(bal, next);
  txs.push({ ...tx, date: new Date(date) });
  return true;
};

const spend = (date, category, account, min, max, descriptions, step = 1) =>
  record(date, { type: 'expense', category, account, amount: pesos(min, max, step), description: pick(descriptions) });

for (let d = new Date(START); d <= TODAY; d = new Date(d.getTime() + DAY)) {
  const day = d.getUTCDate();
  const dow = d.getUTCDay(); // 0 domingo
  const last = lastDayOf(d);
  const weekend = dow === 0 || dow === 6;

  // ingresos
  if (day === 15 || day === last) record(d, { type: 'income', category: 'nomina', account: 'bbva', amount: 14200 * 100, description: 'Nómina quincenal' });
  if (day === 8 && chance(0.75)) record(d, { type: 'income', category: 'freelance', account: 'bbva', amount: pesos(2500, 7000, 50), description: pick(['Proyecto web freelance', 'Diseño de logo', 'Landing page cliente', 'Mantenimiento sitio']) });
  if (chance(0.02)) record(d, { type: 'income', category: 'otrosIng', account: pick(['bbva', 'cash']), amount: pesos(200, 1500, 50), description: pick(['Venta en Marketplace', 'Reembolso', 'Regalo de cumpleaños']) });

  // cortes y pagos de tarjetas
  for (const k of ['nu', 'oro']) {
    const acc = byKey[k];
    if (day === clampDay(d, acc.cutoffDay)) stmt[k] = bal[k];
    if (day === clampDay(d, acc.dueDay) && stmt[k] > 0) {
      const amount = Math.min(stmt[k], bal[k]);
      if (amount > 0) record(d, { type: 'transfer', account: 'bbva', to: k, amount, description: `Pago ${acc.name}` });
      stmt[k] = 0;
    }
  }

  // fijos del mes
  if (day === 1) record(d, { type: 'expense', category: 'hogar', account: 'bbva', amount: 5800 * 100, description: 'Renta departamento' });
  if (day === clampDay(d, 6)) record(d, { type: 'expense', category: 'hogar', account: 'bbva', amount: 549 * 100, description: 'Internet Totalplay' });
  if (day === clampDay(d, 12) && d.getUTCMonth() % 2 === 0) spend(d, 'hogar', 'bbva', 380, 720, ['Recibo de luz CFE']);
  if (day === 5) record(d, { type: 'expense', category: 'subs', account: 'nu', amount: 129 * 100, description: 'Spotify Premium' });
  if (day === 12) record(d, { type: 'expense', category: 'subs', account: 'nu', amount: 299 * 100, description: 'Netflix' });
  if (day === 20) record(d, { type: 'expense', category: 'subs', account: 'oro', amount: 49 * 100, description: 'iCloud 200 GB' });
  if (day === 22) record(d, { type: 'expense', category: 'subs', account: 'oro', amount: 499 * 100, description: 'Gimnasio Smart Fit' });
  if (day === 16) record(d, { type: 'transfer', account: 'bbva', to: 'hey', amount: 2500 * 100, description: 'Ahorro quincenal' });
  if (day === 4 && [0, 7].includes(d.getUTCMonth())) spend(d, 'educacion', 'bbva', 2800, 3500, ['Libros del semestre', 'Colegiatura curso inglés'], 10);

  // metas
  for (const g of GOALS) {
    if (day !== clampDay(d, g.day)) continue;
    record(d, {
      type: g.kind === 'debt' ? 'expense' : 'transfer',
      account: g.account, goal: g.key, amount: g.monthly * 100,
      description: `${g.kind === 'debt' ? 'Pago' : 'Abono'} a ${g.name}`,
    });
  }

  // día a día
  if (dow === 6) spend(d, 'comida', 'nu', 850, 1700, ['Despensa Soriana', 'Despensa Walmart', 'Súper Chedraui', 'Costco'], 0.1);
  if (chance(weekend ? 0.6 : 0.45)) spend(d, 'comida', pick(['nu', 'bbva', 'cash', 'cash']), 70, 320, ['Tacos al pastor', 'Comida corrida', 'Café Starbucks', 'Oxxo', 'Torta y agua', 'Sushi', 'Pizza', 'Panadería'], 0.5);
  if (!weekend && chance(0.45)) spend(d, 'transporte', 'oro', 85, 230, ['Uber al trabajo', 'Uber a la uni', 'DiDi', 'Uber de regreso'], 0.5);
  if (dow === 1 && chance(0.6)) spend(d, 'transporte', 'bbva', 700, 1050, ['Gasolina Pemex', 'Gasolina Shell'], 10);
  if (weekend && chance(0.3)) spend(d, 'ocio', pick(['oro', 'nu']), 250, 1400, ['Cine Cinépolis', 'Bar con amigos', 'Concierto', 'Boliche', 'Steam', 'Cena fuera'], 10);
  if (chance(0.03)) spend(d, 'salud', pick(['bbva', 'oro']), 180, 1200, ['Farmacia Guadalajara', 'Consulta médica', 'Dentista'], 10);
  if (chance(0.03)) spend(d, 'compras', pick(['oro', 'nu']), 300, 2200, ['Amazon', 'Mercado Libre', 'Liverpool', 'Zara', 'Uniqlo'], 10);

  // retiro de efectivo cuando se acaba
  if (bal.cash < 300 * 100) record(d, { type: 'transfer', account: 'bbva', to: 'cash', amount: 1500 * 100, description: 'Retiro cajero' });
}

// resumen
const sum = (list) => list.reduce((s, t) => s + t.amount, 0);
console.log(`Simulación ${START.toISOString().slice(0, 10)} → ${TODAY.toISOString().slice(0, 10)} (semilla ${SEED})`);
console.log(`  ${txs.length} movimientos (${skipped} descartados por falta de saldo/límite)`);
console.log(`  ingresos ${fmt(sum(txs.filter(t => t.type === 'income')))} · gastos ${fmt(sum(txs.filter(t => t.type === 'expense')))}`);
for (const a of ACCOUNTS) console.log(`  ${a.name.padEnd(14)} ${a.type === 'credito' ? 'deuda' : 'saldo'} ${fmt(bal[a.key])}`);
for (const g of GOALS) {
  const saved = sum(txs.filter(t => t.goal === g.key));
  console.log(`  meta ${g.name.padEnd(22)} ${fmt(saved)} / ${fmt(g.target * 100)} (${Math.round((saved / (g.target * 100)) * 100)}%)`);
}

const main = async () => {
  if (DRY_RUN) return;

  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: EMAIL.toLowerCase() });
  if (!user) throw new Error(`No existe un usuario con el correo ${EMAIL}`);
  const userId = user._id;
  console.log(`\nUsuario: ${user.name} (${userId})`);

  const filter = { userId };
  const [t, a, c, g] = await Promise.all([
    Transaction.deleteMany(filter), Account.deleteMany(filter), Category.deleteMany(filter), Goal.deleteMany(filter),
  ]);
  console.log(`Borrado: ${t.deletedCount} movimientos, ${a.deletedCount} cuentas, ${c.deletedCount} categorías, ${g.deletedCount} metas`);

  const accountDocs = await Account.insertMany(ACCOUNTS.map(acc => ({
    userId, name: acc.name, type: acc.type, color: acc.color, balance: bal[acc.key],
    creditLimit: (acc.creditLimit || 0) * 100, cutoffDay: acc.cutoffDay || null, dueDay: acc.dueDay || null,
  })));
  const categoryDocs = await Category.insertMany(CATEGORIES.map(({ key, ...cat }) => ({ userId, ...cat })));
  const accountId = Object.fromEntries(ACCOUNTS.map((acc, i) => [acc.key, accountDocs[i]._id]));
  const goalDocs = await Goal.insertMany(GOALS.map(goal => ({
    userId, name: goal.name, kind: goal.kind, targetAmount: goal.target * 100,
    deadline: goal.deadline ? new Date(`${goal.deadline}T00:00:00Z`) : null,
    accountId: accountId[goal.account],
  })));

  const categoryId = Object.fromEntries(CATEGORIES.map((cat, i) => [cat.key, categoryDocs[i]._id]));
  const goalId = Object.fromEntries(GOALS.map((goal, i) => [goal.key, goalDocs[i]._id]));

  // createdAt escalonado dentro del día para que el orden de "recientes" sea estable
  await Transaction.insertMany(txs.map((tx, i) => ({
    userId,
    type: tx.type,
    amount: tx.amount,
    accountId: accountId[tx.account],
    toAccountId: tx.to ? accountId[tx.to] : null,
    categoryId: tx.category ? categoryId[tx.category] : null,
    goalId: tx.goal ? goalId[tx.goal] : null,
    date: tx.date,
    description: tx.description,
    createdAt: new Date(tx.date.getTime() + 8 * 3600 * 1000 + i * 1000),
  })));

  console.log(`Sembrado: ${accountDocs.length} cuentas, ${categoryDocs.length} categorías, ${goalDocs.length} metas, ${txs.length} movimientos`);
};

main()
  .catch((err) => { console.error('Error:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
