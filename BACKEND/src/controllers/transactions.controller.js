const Transaction = require('../models/Transaction');
const Category = require('../models/Category');

const CATEGORY_FIELDS = 'name kind color icon';
const EDITABLE = ['type', 'amount', 'accountId', 'categoryId', 'toAccountId', 'goalId', 'date', 'description'];

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

  let query = Transaction.find(filter).sort(sortBy).populate('categoryId', CATEGORY_FIELDS);
  const n = parseInt(limit, 10); // 
  if (n > 0) query = query.limit(n);

  res.json(await query);
};

const getTransactionById = async (req, res) => {
  const tx = await Transaction.findOne({ _id: req.params.id, userId: req.userId })
    .populate('categoryId', CATEGORY_FIELDS);
  if (!tx) return res.status(404).json({ message: 'Transacción no encontrada' });
  res.json(tx);
};

const createTransaction = async (req, res) => {
  const body = req.body ?? {};
  const data = {};
  for (const k of EDITABLE) if (body[k] !== undefined) data[k] = body[k];
  // TEMPORAL: mientras no exista el CRUD de cuentas, se usa la cuenta de desarrollo del .env
  if (!data.accountId) data.accountId = process.env.DEV_ACCOUNT_ID;

  const tx = new Transaction({ ...data, userId: req.userId });
  await tx.validate();

  const error = await checkCategory(tx, req.userId);
  if (error) return res.status(400).json({ message: error });

  await tx.save();
  await tx.populate('categoryId', CATEGORY_FIELDS);
  res.status(201).json(tx);
};

const updateTransaction = async (req, res) => {
  const tx = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
  if (!tx) return res.status(404).json({ message: 'Transacción no encontrada' });

  const body = req.body ?? {};
  for (const k of EDITABLE) if (body[k] !== undefined) tx[k] = body[k];
  if (!tx.accountId) tx.accountId = process.env.DEV_ACCOUNT_ID; // TEMPORAL, ver createTransaction
  await tx.validate();

  const error = await checkCategory(tx, req.userId);
  if (error) return res.status(400).json({ message: error });

  await tx.save();
  await tx.populate('categoryId', CATEGORY_FIELDS);
  res.json(tx);
};

const deleteTransaction = async (req, res) => {
  const tx = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
  if (!tx) return res.status(404).json({ message: 'Transacción no encontrada' });
  await tx.deleteOne();
  res.json({ message: 'Transacción eliminada', transaction: tx });
};

module.exports = { getTransactions, getTransactionById, createTransaction, updateTransaction, deleteTransaction };
