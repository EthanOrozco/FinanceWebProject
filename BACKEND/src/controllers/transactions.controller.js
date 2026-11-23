const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const { planBalances } = require('../services/balances');
require('../models/Goal'); // registra el modelo para el populate de goalId

const CATEGORY_FIELDS = 'name kind color icon';
const GOAL_FIELDS = 'name kind';
const GOAL_LOCKED = 'Este movimiento es un abono a una meta, adminístralo desde Metas';
const EDITABLE = ['type', 'amount', 'accountId', 'categoryId', 'toAccountId', 'date', 'description'];

const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// La categoría tiene que ser del usuario y del mismo tipo que la transacción
const checkCategory = async (tx, userId) => {
  if (tx.type === 'transfer' || !tx.categoryId) return null;
  const category = await Category.findOne({ _id: tx.categoryId, userId });
  if (!category) return 'Categoría no encontrada';
  if (category.kind !== tx.type) return 'La categoría no corresponde al tipo de transacción';
  return null;
};

const getTransactions = async (req, res) => {
  const { type, accountId, categoryId, goalId, from, to, search, sort, limit } = req.query;

  const filter = { userId: req.userId };
  if (type) filter.type = type;
  // Una cuenta aparece tanto si es origen como destino de una transferencia
  if (accountId) filter.$or = [{ accountId }, { toAccountId: accountId }];
  if (categoryId) filter.categoryId = categoryId;
  if (goalId) filter.goalId = goalId;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  if (search) filter.description = { $regex: escapeRegex(search), $options: 'i' };

  const sortBy = sort === 'amount' ? { amount: -1, date: -1 }
    : sort === 'oldest' ? { date: 1, createdAt: 1 }
    : { date: -1, createdAt: -1 };

  let query = Transaction.find(filter).sort(sortBy)
    .populate('categoryId', CATEGORY_FIELDS)
    .populate('goalId', GOAL_FIELDS);
  const n = parseInt(limit, 10); // 
  if (n > 0) query = query.limit(n);

  res.json(await query);
};

const getTransactionById = async (req, res) => {
  const tx = await Transaction.findOne({ _id: req.params.id, userId: req.userId })
    .populate('categoryId', CATEGORY_FIELDS)
    .populate('goalId', GOAL_FIELDS);
  if (!tx) return res.status(404).json({ message: 'Transacción no encontrada' });
  res.json(tx);
};

const createTransaction = async (req, res) => {
  const body = req.body ?? {};
  const data = {};
  for (const k of EDITABLE) if (body[k] !== undefined) data[k] = body[k];

  const tx = new Transaction({ ...data, userId: req.userId });
  await tx.validate();

  const error = await checkCategory(tx, req.userId);
  if (error) return res.status(400).json({ message: error });

  const balances = await planBalances(req.userId, null, tx);
  if (balances.error) return res.status(400).json({ message: balances.error });

  await tx.save();
  await balances.apply();
  await tx.populate('categoryId', CATEGORY_FIELDS);
  res.status(201).json(tx);
};

const updateTransaction = async (req, res) => {
  const tx = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
  if (!tx) return res.status(404).json({ message: 'Transacción no encontrada' });
  if (tx.goalId) return res.status(400).json({ message: GOAL_LOCKED });

  const before = tx.toObject(); // para revertir su efecto en los saldos
  const body = req.body ?? {};
  for (const k of EDITABLE) if (body[k] !== undefined) tx[k] = body[k];
  await tx.validate();

  const error = await checkCategory(tx, req.userId);
  if (error) return res.status(400).json({ message: error });

  const balances = await planBalances(req.userId, before, tx);
  if (balances.error) return res.status(400).json({ message: balances.error });

  await tx.save();
  await balances.apply();
  await tx.populate('categoryId', CATEGORY_FIELDS);
  res.json(tx);
};

const deleteTransaction = async (req, res) => {
  const tx = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
  if (!tx) return res.status(404).json({ message: 'Transacción no encontrada' });
  if (tx.goalId) return res.status(400).json({ message: GOAL_LOCKED });

  const balances = await planBalances(req.userId, tx, null);
  if (balances.error) return res.status(400).json({ message: balances.error });

  await tx.deleteOne();
  await balances.apply();
  res.json({ message: 'Transacción eliminada', transaction: tx });
};

module.exports = { getTransactions, getTransactionById, createTransaction, updateTransaction, deleteTransaction };
