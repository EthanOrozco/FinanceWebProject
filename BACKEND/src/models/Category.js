const { Schema, model } = require('mongoose');

const categorySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 30 },
  kind: { type: String, required: true, enum: { values: ['expense', 'income'], message: 'Invalid Type' } },
  color: { type: String, default: 'slate' },
  icon: { type: String, default: 'fa-tag' },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true, collection: 'categories' });

categorySchema.index({ userId: 1, name: 1, kind: 1 }, { unique: true });

module.exports = model('Category', categorySchema);
