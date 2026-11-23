const Account = require('../models/Account');
const getAccounts = async (req, res) => {
  const { type, search, sort } = req.query;

  const filter = { userId: req.userId };
  if (type && type !== 'all') filter.type = type;
  if (search) filter.name = { $regex: search, $options: 'i' };

  let sortBy = { createdAt: -1 };
  if (sort === 'name') sortBy = { name: 1 };
  if (sort === 'balance_desc') sortBy = { balance: -1 };
  if (sort === 'balance_asc') sortBy = { balance: 1 };

  const accounts = await Account.find(filter).sort(sortBy);
  res.json(accounts);
};

const getAccountById = async (req, res) => {
  const account = await Account.findOne({ _id: req.params.id, userId: req.userId });
  if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });
  res.json(account);
};

const createAccount = async (req, res) => {
  const { name, type, balance, creditLimit, cutoffDay, dueDay, color } = req.body ?? {};

  if (type === 'credito' && (!creditLimit || Number(creditLimit) <= 0)) {
    return res.status(400).json({ message: 'El límite de crédito debe ser mayor a 0' });
  }

  const account = await Account.create({
    userId: req.userId,
    name,
    type,
    balance: type === 'credito' ? 0 : Number(balance || 0),
    creditLimit: type === 'credito' ? Number(creditLimit) : 0,
    cutoffDay: type === 'credito' && cutoffDay ? Number(cutoffDay) : null,
    dueDay: type === 'credito' && dueDay ? Number(dueDay) : null,
    color: color || 'gold',
  });

  res.status(201).json(account);
};

const updateAccount = async (req, res) => {
  const account = await Account.findOne({ _id: req.params.id, userId: req.userId });
  if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

  const { name, type, balance, creditLimit, cutoffDay, dueDay, color } = req.body ?? {};

  if (name !== undefined) account.name = name;
  if (type !== undefined) account.type = type;
  if (balance !== undefined) account.balance = Number(balance);
  if (creditLimit !== undefined) account.creditLimit = Number(creditLimit);
  if (cutoffDay !== undefined) account.cutoffDay = cutoffDay ? Number(cutoffDay) : null;
  if (dueDay !== undefined) account.dueDay = dueDay ? Number(dueDay) : null;
  if (color !== undefined) account.color = color;

  await account.save();
  res.json(account);
};

const transferBetweenAccounts = async (req, res) => {
  const { fromId, toId, amount } = req.body ?? {};
  const monto = Number(amount);

  if (!fromId || !toId || fromId === toId) {
    return res.status(400).json({ message: 'Selecciona dos cuentas distintas para transferir' });
  }
  if (!monto || monto <= 0) {
    return res.status(400).json({ message: 'El monto a transferir debe ser mayor a 0' });
  }

  const fromAcc = await Account.findOne({ _id: fromId, userId: req.userId });
  const toAcc = await Account.findOne({ _id: toId, userId: req.userId });

  if (!fromAcc || !toAcc) {
    return res.status(404).json({ message: 'Una de las cuentas no existe' });
  }

  if (fromAcc.type === 'credito') {
    fromAcc.balance += monto;
  } else {
    if (fromAcc.balance < monto) {
      return res.status(400).json({ message: `Saldo insuficiente en ${fromAcc.name}` });
    }
    fromAcc.balance -= monto;
  }

  if (toAcc.type === 'credito') {
    toAcc.balance = Math.max(0, toAcc.balance - monto);
  } else {
    toAcc.balance += monto;
  }

  await fromAcc.save();
  await toAcc.save();

  res.json({ message: 'Transferencia realizada', from: fromAcc, to: toAcc });
};

// DELETE
const deleteAccount = async (req, res) => {
  const account = await Account.findOne({ _id: req.params.id, userId: req.userId });
  if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

  await account.deleteOne();
  res.json({ message: 'Cuenta eliminada', account });
};

module.exports = {
  getAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  transferBetweenAccounts,
  deleteAccount,
};