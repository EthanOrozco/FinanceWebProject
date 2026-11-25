const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Goal = require('../models/Goal');
const { planBalances } = require('../services/balances');

// para usar texto del usuario dentro de un $regex sin que truene con ( [ * etc.
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// fecha de hoy en hora local como "YYYY-MM-DD" (en-CA usa ese formato)
const todayStr = () => new Date().toLocaleDateString('en-CA');

// los montos van en centavos (enteros), solo se convierten a pesos para los mensajes
const pesos = (cents) => (cents / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

// agrega saved, progress y contributions a cada meta
const withProgress = async (goals) => {
  const ids = goals.map(g => g._id);
  const txs = await Transaction
    .find({ goalId: { $in: ids } })
    .sort({ date: -1 })
    .select('amount date accountId goalId description')
    .lean();

  return goals.map(g => {
    const contributions = txs.filter(t => String(t.goalId) === String(g._id));
    const saved = contributions.reduce((acc, t) => acc + t.amount, 0);
    return {
      ...g.toObject(),
      saved,
      progress: Math.min(100, Math.round((saved / g.targetAmount) * 100)),
      contributions,
    };
  });
};

const savedOf = async (goal) => {
  const [res] = await Transaction.aggregate([
    { $match: { goalId: goal._id } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return res ? res.total : 0;
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
  if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };

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
  if (deadline && String(deadline).slice(0, 10) < todayStr()) {
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
  const reactivated = status === 'active' && goal.status === 'cancelled';
  if (reactivated) goal.status = 'active';
  // completar manualmente
  if (status === 'completed') {
    goal.status = 'completed';
    goal.completedAt = new Date();
  }

  // se recalcula el estado si cambia el monto objetivo o si se reactiva (pudo ya estar cumplida)
  let completed = false;
  if ((targetAmount !== undefined || reactivated) && status !== 'completed') {
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
  await Transaction.updateMany({ goalId: goal._id }, { $set: { goalId: null } });
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
  if (!Number.isInteger(value) || value <= 0) return res.status(400).json({ message: 'El monto debe ser mayor a 0 (en centavos)' });
  if (!accountId) return res.status(400).json({ message: 'Elige la cuenta de donde sale el dinero' });
  if (!mongoose.isValidObjectId(accountId)) return res.status(400).json({ message: 'Cuenta inválida' });
  if (date && isNaN(new Date(date))) return res.status(400).json({ message: 'Fecha inválida' });
  if (date && new Date(date) > new Date()) {
    return res.status(400).json({ message: 'La fecha del abono no puede ser futura' });
  }

  const saved = await savedOf(goal);
  const remaining = goal.targetAmount - saved;
  if (goal.kind === 'debt' && value > remaining) {
    return res.status(400).json({ message: `El pago excede la deuda pendiente (${pesos(remaining)})` });
  }

  const tx = new Transaction({
    userId: req.userId,
    // pago de deuda = gasto real; abono de ahorro = el dinero se aparta de la cuenta, no se gasta
    // (en ambos casos el saldo de la cuenta baja, ver services/balances.js)
    type: goal.kind === 'debt' ? 'expense' : 'transfer',
    amount: value,
    accountId,
    goalId: goal._id,
    date: date || undefined,
    description: `${goal.kind === 'debt' ? 'Pago' : 'Abono'} a ${goal.name}`,
  });
  await tx.validate();

  const balances = await planBalances(req.userId, null, tx);
  if (balances.error) return res.status(400).json({ message: balances.error });

  await tx.save();
  await balances.apply();

  const completed = syncStatus(goal, saved + value);
  await goal.save();
  const [result] = await withProgress([goal]);
  res.status(201).json({ goal: result, completed });
};

const deleteContribution = async (req, res) => {
  const { id, contributionId } = req.params;
  const goal = await Goal.findOne({ _id: id, userId: req.userId });
  if (!goal) return res.status(404).json({ message: 'Meta no encontrada' });
  if (!mongoose.isValidObjectId(contributionId)) return res.status(400).json({ message: 'ID inválido' });

  const tx = await Transaction.findOne({ _id: contributionId, goalId: goal._id });
  if (!tx) return res.status(404).json({ message: 'Abono no encontrado' });

  // el dinero regresa a la cuenta de donde salió
  const balances = await planBalances(req.userId, tx, null);
  if (balances.error) return res.status(400).json({ message: balances.error });

  const wasReached = (await savedOf(goal)) >= goal.targetAmount;
  await tx.deleteOne();
  await balances.apply();

  // si se habia completado por los abonos y ya no alcanza, vuelve a activa
  if (wasReached) syncStatus(goal, await savedOf(goal));
  await goal.save();
  const [result] = await withProgress([goal]);
  res.json({ message: 'Abono eliminado', goal: result });
};

module.exports = { getGoals, getGoalById, createGoal, updateGoal, deleteGoal, addContribution, deleteContribution };