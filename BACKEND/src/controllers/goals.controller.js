const mongoose = require('mongoose');
const Goal = require('../models/Goal');

// los abonos son transacciones con goalId (ver diagrama).
// se usa la coleccion directo para no chocar con el modelo Transaction de transacciones
const transactions = () => mongoose.connection.collection('transactions');
const toId = (id) => new mongoose.Types.ObjectId(id);

// tipo de transaccion que se guarda al abonar
const CONTRIBUTION_TYPE = 'expense';

const round = (n) => Math.round(n * 100) / 100;

// agrega saved, progress y contributions a cada meta
const withProgress = async (goals) => {
  const ids = goals.map(g => g._id);
  const txs = await transactions()
    .find({ goalId: { $in: ids } })
    .sort({ date: -1 })
    .project({ amount: 1, date: 1, accountId: 1, goalId: 1, description: 1 })
    .toArray();

  return goals.map(g => {
    const contributions = txs.filter(t => String(t.goalId) === String(g._id));
    const saved = round(contributions.reduce((acc, t) => acc + t.amount, 0));
    return {
      ...g.toObject(),
      saved,
      progress: Math.min(100, Math.round((saved / g.targetAmount) * 100)),
      contributions,
    };
  });
};

const savedOf = async (goal) => {
  const [res] = await transactions().aggregate([
    { $match: { goalId: goal._id } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]).toArray();
  return round(res ? res.total : 0);
};

// actualiza el estado segun lo abonado (completa o reactiva la meta)
const syncStatus = (goal, saved) => {
  if (goal.status === 'cancelled') return false;
  if (saved >= goal.targetAmount && goal.status !== 'completed') {
    goal.status = 'completed';
    goal.completedAt = new Date();
    return true;
  }
  if (saved < goal.targetAmount && goal.status === 'completed') {
    goal.status = 'active';
    goal.completedAt = null;
  }
  return false;
};

const getGoals = async (req, res) => {
  const { kind, status, search, sort } = req.query;

  const filter = { userId: req.userId };
  if (kind) filter.kind = kind;
  if (status) filter.status = status;
  if (search) filter.name = { $regex: search, $options: 'i' };

  let sortBy = { createdAt: -1 };
  if (sort === 'name') sortBy = { name: 1 };
  if (sort === 'deadline') sortBy = { deadline: 1 };
  if (sort === 'amount') sortBy = { targetAmount: -1 };

  const goals = await Goal.find(filter).sort(sortBy);
  res.json(await withProgress(goals));
};

const getGoalById = async (req, res) => {
  const { id } = req.params;
  const goal = await Goal.findOne({ _id: id, userId: req.userId });
  if (!goal) return res.status(404).json({ message: 'Meta no encontrada' });
  const [result] = await withProgress([goal]);
  res.json(result);
};

const createGoal = async (req, res) => {
  const { name, kind, targetAmount, accountId, deadline } = req.body ?? {};
  if (deadline && new Date(deadline) < new Date(new Date().toDateString())) {
    return res.status(400).json({ message: 'La fecha límite no puede ser en el pasado' });
  }
  const goal = await Goal.create({
    name, kind, targetAmount,
    accountId: accountId || null,
    deadline: deadline || null,
    userId: req.userId,
  });
  const [result] = await withProgress([goal]);
  res.status(201).json(result);
};

const updateGoal = async (req, res) => {
  const { id } = req.params;
  const goal = await Goal.findOne({ _id: id, userId: req.userId });
  if (!goal) return res.status(404).json({ message: 'Meta no encontrada' });

  const { name, targetAmount, accountId, deadline, status } = req.body ?? {};
  if (name !== undefined) goal.name = name;
  if (targetAmount !== undefined) goal.targetAmount = targetAmount;
  if (accountId !== undefined) goal.accountId = accountId || null;
  if (deadline !== undefined) goal.deadline = deadline || null;

  // cancelar / reactivar
  if (status === 'cancelled') goal.status = 'cancelled';
  if (status === 'active' && goal.status === 'cancelled') goal.status = 'active';
  // completar manualmente
  if (status === 'completed') {
    goal.status = 'completed';
    goal.completedAt = new Date();
  }

  // solo se recalcula el estado si cambia el monto objetivo
  let completed = false;
  if (targetAmount !== undefined && status !== 'completed') {
    completed = syncStatus(goal, await savedOf(goal));
  }
  await goal.save();
  const [result] = await withProgress([goal]);
  res.json({ goal: result, completed });
};

const deleteGoal = async (req, res) => {
  const { id } = req.params;
  const goal = await Goal.findOne({ _id: id, userId: req.userId });
  if (!goal) return res.status(404).json({ message: 'Meta no encontrada' });
  // las transacciones se quedan (ya movieron dinero), solo se desligan de la meta
  await transactions().updateMany({ goalId: goal._id }, { $set: { goalId: null } });
  await goal.deleteOne();
  res.json({ message: 'Meta eliminada', goal });
};

const addContribution = async (req, res) => {
  const { id } = req.params;
  const goal = await Goal.findOne({ _id: id, userId: req.userId });
  if (!goal) return res.status(404).json({ message: 'Meta no encontrada' });
  if (goal.status !== 'active') return res.status(400).json({ message: 'Solo puedes abonar a metas activas' });

  const { amount, date, accountId } = req.body ?? {};
  const value = Number(amount);
  if (!value || value <= 0) return res.status(400).json({ message: 'El monto debe ser mayor a 0' });
  if (accountId && !mongoose.isValidObjectId(accountId)) return res.status(400).json({ message: 'Cuenta inválida' });
  if (date && isNaN(new Date(date))) return res.status(400).json({ message: 'Fecha inválida' });
  if (date && new Date(date) > new Date()) {
    return res.status(400).json({ message: 'La fecha del abono no puede ser futura' });
  }

  const saved = await savedOf(goal);
  const remaining = round(goal.targetAmount - saved);
  if (goal.kind === 'debt' && value > remaining) {
    return res.status(400).json({ message: `El pago excede la deuda pendiente ($${remaining})` });
  }

  const now = new Date();
  await transactions().insertOne({
    userId: toId(req.userId),
    type: CONTRIBUTION_TYPE,
    amount: value,
    accountId: accountId ? toId(accountId) : null,
    categoryId: null,
    toAccountId: null,
    goalId: goal._id,
    date: date ? new Date(date) : now,
    description: `${goal.kind === 'debt' ? 'Pago' : 'Abono'} a ${goal.name}`,
    createdAt: now,
    updatedAt: now,
  });

  const completed = syncStatus(goal, round(saved + value));
  await goal.save();
  const [result] = await withProgress([goal]);
  res.status(201).json({ goal: result, completed });
};

const deleteContribution = async (req, res) => {
  const { id, contributionId } = req.params;
  const goal = await Goal.findOne({ _id: id, userId: req.userId });
  if (!goal) return res.status(404).json({ message: 'Meta no encontrada' });
  if (!mongoose.isValidObjectId(contributionId)) return res.status(400).json({ message: 'ID inválido' });

  const wasReached = (await savedOf(goal)) >= goal.targetAmount;
  const { deletedCount } = await transactions().deleteOne({ _id: toId(contributionId), goalId: goal._id });
  if (!deletedCount) return res.status(404).json({ message: 'Abono no encontrado' });

  // si se habia completado por los abonos y ya no alcanza, vuelve a activa
  if (wasReached) syncStatus(goal, await savedOf(goal));
  await goal.save();
  const [result] = await withProgress([goal]);
  res.json({ message: 'Abono eliminado', goal: result });
};

module.exports = { getGoals, getGoalById, createGoal, updateGoal, deleteGoal, addContribution, deleteContribution };