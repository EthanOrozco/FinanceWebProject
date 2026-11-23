const { Schema, model } = require('mongoose');

const goalSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: [true, 'El nombre es obligatorio'], trim: true, maxlength: [40, 'El nombre no puede pasar de 40 caracteres'] },
  kind: { type: String, required: true, enum: { values: ['saving', 'debt'], message: 'Tipo de meta inválido' } },
  // ahorro: monto objetivo / deuda: saldo inicial de la deuda
  targetAmount: { type: Number, required: [true, 'El monto objetivo es obligatorio'], min: [1, 'El monto objetivo debe ser al menos 1'] },
  deadline: { type: Date, default: null },
  accountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  status: { type: String, enum: { values: ['active', 'completed', 'cancelled'], message: 'Estado inválido' }, default: 'active' },
  completedAt: { type: Date, default: null },
}, { timestamps: true, collection: 'goals' });

goalSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = model('Goal', goalSchema);