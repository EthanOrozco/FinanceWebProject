const Account = require('../models/Account');

// Cuánto dinero entra (+) o sale (−) de cada cuenta por una transacción, en centavos.
//  - income: entra a accountId
//  - expense: sale de accountId (incluye pagos a metas de deuda)
//  - transfer: sale de accountId y entra a toAccountId
//    (un abono a meta de ahorro no tiene toAccountId: el dinero solo sale de la cuenta)
const moneyFlow = (tx) => {
  const flow = new Map();
  if (!tx) return flow;
  const add = (id, value) => {
    if (!id) return;
    const key = String(id);
    flow.set(key, (flow.get(key) || 0) + value);
  };
  if (tx.type === 'income') add(tx.accountId, tx.amount);
  else if (tx.type === 'expense') add(tx.accountId, -tx.amount);
  else if (tx.type === 'transfer') {
    add(tx.accountId, -tx.amount);
    add(tx.toAccountId, tx.amount);
  }
  return flow;
};

const planBalances = async (userId, before, after) => {
  const net = moneyFlow(after);
  for (const [id, value] of moneyFlow(before)) net.set(id, (net.get(id) || 0) - value);
  for (const [id, value] of net) if (value === 0) net.delete(id);
  if (!net.size) return { apply: async () => {} };

  const accounts = await Account.find({ _id: { $in: [...net.keys()] }, userId });
  const byId = new Map(accounts.map(a => [String(a._id), a]));

  // las cuentas de la transacción nueva tienen que existir y ser del usuario
  for (const id of moneyFlow(after).keys()) {
    if (!byId.has(id)) return { error: 'Cuenta no encontrada' };
  }

  const ops = [];
  for (const [id, flow] of net) {
    const acc = byId.get(id);
    if (!acc) continue; // cuenta vieja que ya no existe: no hay saldo que ajustar

    // en crédito el saldo es la deuda: si sale dinero la deuda sube
    const delta = acc.type === 'credito' ? -flow : flow;
    const next = acc.balance + delta;

    if (acc.type === 'credito') {
      if (next < 0) return { error: `El pago excede la deuda de ${acc.name}` };
      if (delta > 0 && next > acc.creditLimit) return { error: `Excede el límite de crédito de ${acc.name}` };
    } else if (next < 0) {
      return { error: `Saldo insuficiente en ${acc.name}` };
    }

    ops.push({ updateOne: { filter: { _id: acc._id }, update: { $inc: { balance: delta } } } });
  }

  return { apply: async () => { if (ops.length) await Account.bulkWrite(ops); } };
};

module.exports = { planBalances };
