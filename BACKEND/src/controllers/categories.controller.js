const Category = require('../models/Category');

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
    isDefault: false
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
  await category.deleteOne();
  res.json({ message: "Categoría eliminada", category });
  //TODO: Cuando existan las transacciones, mover sus movimientos
  // Transaction.updateMany({ categoryId: category._id }, { categoryId: req.query.moveTo });
};

module.exports = { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory };
