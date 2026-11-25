const Category = require('../models/Category');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');

// estadísticas por categoría 
// Las fechas se guardan como medianoche UTC del día elegido,
// los límites de mes también se arman en UTC (con el año/mes local de hoy).
const monthRange = (offset = 0) => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset + 1, 1));
  return { start, end };
};

const emptyStats = () => ({ amount: 0, txMonth: 0, prevAmount: 0, txCount: 0, delta: null });

// amount/prevAmount en centavos (este mes / mes pasado),
// txCount = movimientos de siempre, delta = % de cambio vs el mes pasado (null si el mes pasado fue 0)
const statsByCategory = async (userId, ids) => {
  const cur = monthRange(0);
  const prev = monthRange(-1);
  const inRange = (r) => ({ $and: [{ $gte: ['$date', r.start] }, { $lt: ['$date', r.end] }] });

  const rows = await Transaction.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), categoryId: { $in: ids } } },
    { $group: {
      _id: '$categoryId',
      amount: { $sum: { $cond: [inRange(cur), '$amount', 0] } },
      txMonth: { $sum: { $cond: [inRange(cur), 1, 0] } },
      prevAmount: { $sum: { $cond: [inRange(prev), '$amount', 0] } },
      txCount: { $sum: 1 },
    } },
  ]);

  return new Map(rows.map(r => [String(r._id), {
    amount: r.amount,
    txMonth: r.txMonth,
    prevAmount: r.prevAmount,
    txCount: r.txCount,
    delta: r.prevAmount ? Math.round(((r.amount - r.prevAmount) / r.prevAmount) * 100) : null,
  }]));
};

const getCategories = async (req, res) => {
  const { kind, search, sort } = req.query;

  const filter = { userId: req.userId };
  if (kind) filter.kind = kind;
  if (search) filter.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

  const sortBy = sort === 'name' ? { name: 1 } : { createdAt: -1 };

  const categories = await Category.find(filter).sort(sortBy).lean();
  const stats = await statsByCategory(req.userId, categories.map(c => c._id));
  res.json(categories.map(c => ({ ...c, ...(stats.get(String(c._id)) ?? emptyStats()) })));
};

const getCategoryById = async (req, res) => {
  const { id } = req.params;
  const category = await Category.findOne({ _id: id, userId: req.userId });
  if (!category) return res.status(404).json({ message: "Categoría no encontrada"})
  res.json(category);
};

const createCategory = async (req, res) => {
  const { name, kind, color, icon } = req.body ?? {};
  const category = await Category.create({
    name, kind, color, icon,
    userId: req.userId,
  });
  res.status(201).json(category);
};

const updateCategory = async (req, res) => {
  const { id } = req.params;
  const category = await Category.findOne({ _id: id, userId: req.userId });
  if (!category) return res.status(404).json({ message: "Categoría no encontrada" });
  const { name, color, icon } = req.body ?? {}
  if (name !== undefined) category.name = name;
  if (color !== undefined) category.color = color;
  if (icon !== undefined) category.icon = icon;

  await category.save();
  res.json(category);
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;
  const category = await Category.findOne({ _id: id, userId: req.userId });
  if (!category) return res.status(404).json({ message: "Categoría no encontrada" });

  // Si tiene movimientos, hay que mandarlos a otra categoría (?moveTo=<id>) para no dejarlos huérfanos
  const txCount = await Transaction.countDocuments({ userId: req.userId, categoryId: category._id });
  if (txCount > 0) {
    const { moveTo } = req.query;
    if (!moveTo) {
      return res.status(409).json({ message: "La categoría tiene movimientos, elige a dónde moverlos", txCount });
    }
    const target = await Category.findOne({ _id: moveTo, userId: req.userId });
    if (!target || target._id.equals(category._id)) return res.status(400).json({ message: "Categoría destino inválida" });
    if (target.kind !== category.kind) return res.status(400).json({ message: "La categoría destino debe ser del mismo tipo" });
    await Transaction.updateMany({ userId: req.userId, categoryId: category._id }, { categoryId: target._id });
  }

  await category.deleteOne();
  res.json({ message: "Categoría eliminada", category, moved: txCount });
};

module.exports = { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory };
