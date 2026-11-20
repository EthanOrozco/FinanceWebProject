const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  name: { type: String, required: [true, 'A name is required'], trim: true, maxlength: 50 },
  email: {
    type: String, required: [true, 'Email is required'],
    unique: true, lowercase: true, trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
  },
  passwordHash: { type: String, required: true, select: false }
}, { timestamps: true, collection: 'users' });

module.exports = model('User', userSchema);
