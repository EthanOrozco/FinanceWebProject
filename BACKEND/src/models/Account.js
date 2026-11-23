const { Schema, model } = require('mongoose');

const accountSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: {
    type: String,
    required: [true, 'El nombre de la cuenta es obligatorio'],
    trim: true,
    maxlength: [40, 'El nombre no puede pasar de 40 caracteres'],
  },
  type: {
    type: String,
    required: true,
    enum: {
      values: ['debito', 'ahorro', 'efectivo', 'credito'],
      message: 'Tipo de cuenta inválido',
    },
  },
  // Montos en centavos (igual que transacciones y metas): $1,234.50 se guarda como 123450
  // En crédito, balance es la deuda pendiente
  balance: {
    type: Number,
    default: 0,
    min: [0, 'El saldo o deuda no puede ser negativo'],
    validate: { validator: Number.isInteger, message: 'El saldo debe ser un entero (centavos)' },
  },
  creditLimit: {
    type: Number,
    default: 0,
    min: [0, 'El límite de crédito no puede ser negativo'],
    validate: { validator: Number.isInteger, message: 'El límite debe ser un entero (centavos)' },
  },
  cutoffDay: {
    type: Number,
    min: [1, 'Día de corte inválido'],
    max: [31, 'Día de corte inválido'],
    default: null,
  },
  dueDay: {
    type: Number,
    min: [1, 'Día de pago inválido'],
    max: [31, 'Día de pago inválido'],
    default: null,
  },
  color: {
    type: String,
    default: 'gold',
  },
}, { timestamps: true, collection: 'accounts' });

accountSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = model('Account', accountSchema);