const { Schema, model } = require('mongoose');

const TYPES = ['expense', 'income', 'transfer'];

const transactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String, required: [true, 'Type is required'],
    enum: { values: TYPES, message: 'Invalid type' },
  },
  // En centavos: $1,234.50 se guarda como 123450 (evita errores de punto flotante)
  amount: {
    type: Number, required: [true, 'Amount is required'],
    min: [1, 'Amount must be greater than 0'],
    validate: { validator: Number.isInteger, message: 'Amount must be an integer (cents)' },
  },
  accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: [true, 'Account is required'] },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
  toAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  goalId: { type: Schema.Types.ObjectId, ref: 'Goal', default: null },
  date: { type: Date, default: Date.now },
  description: { type: String, trim: true, maxlength: [100, 'Description is too long'], default: '' },
}, { timestamps: true, collection: 'transactions' });

// Reglas que dependen del tipo:
//  - expense/income: requieren categoría, no llevan cuenta destino
//  - transfer: requiere cuenta destino distinta a la de origen, no lleva categoría
//  - abono a meta (trae goalId): el destino es la meta, no exige categoría ni cuenta destino
transactionSchema.pre('validate', function () {
  if (this.goalId) return;
  if (this.type === 'transfer') {
    this.categoryId = null;
    if (!this.toAccountId) {
      this.invalidate('toAccountId', 'Destination account is required for transfers');
    } else if (this.accountId && this.toAccountId.equals(this.accountId)) {
      this.invalidate('toAccountId', 'Destination account must be different from origin');
    }
  } else if (this.type) {
    this.toAccountId = null;
    if (!this.categoryId) this.invalidate('categoryId', 'Category is required');
  }
});

transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, accountId: 1 });
transactionSchema.index({ userId: 1, categoryId: 1 });

transactionSchema.statics.TYPES = TYPES;

module.exports = model('Transaction', transactionSchema);
