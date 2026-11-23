const Category = require('../models/Category');
const Transaction = require('../models/Transaction');

const getCategories = async (req, res) => {
  const { kind, search, sort } = req.query;

  const filter = { userId: req.userId };
  if (kind) filter.kind = kind;
  if (search) filter.name = { $regex: search, $options: 'i' };

  const sortBy = sort === 'name' ? { name: 1 } : { createdAt: -1 };

  const categories = await Category.find(filter).sort(sortBy);
  res.json(categories);
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
