const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Goal = require('../models/Goal');

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

// Las transferencias entre cuentas se crean como transacciones (POST /api/transactions
// con type 'transfer'), así quedan en el historial y services/balances.js mueve los saldos.

// DELETE
const deleteAccount = async (req, res) => {
  const account = await Account.findOne({ _id: req.params.id, userId: req.userId });
  if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

  // no se borra si tiene movimientos (como origen o destino de una transferencia):
  // quedarían transacciones apuntando a una cuenta que no existe
  const txCount = await Transaction.countDocuments({
    userId: req.userId,
    $or: [{ accountId: account._id }, { toAccountId: account._id }],
  });
  if (txCount) {
    const n = txCount === 1 ? '1 movimiento' : `${txCount} movimientos`;
    return res.status(409).json({
      message: `${account.name} tiene ${n}. Bórralos o cámbialos de cuenta en Transacciones antes de eliminarla.`,
      txCount,
    });
  }

  // las metas que la tenían como cuenta asociada se quedan "Sin cuenta"
  await Goal.updateMany({ userId: req.userId, accountId: account._id }, { $set: { accountId: null } });
  await account.deleteOne();
  res.json({ message: 'Cuenta eliminada', account });
};

module.exports = {
  getAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
};