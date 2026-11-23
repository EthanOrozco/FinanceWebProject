module.exports = {}
const crypto = require('crypto');
const User = require('../models/User');

const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

const registerUser = async (req, res) => {
  const { name, email, password } = req.body ?? {};

  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const user = await User.create({
    name,
    email,
    passwordHash: hashPassword(password),
  });

  res.status(201).json({
    message: 'Usuario registrado exitosamente',
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
  });
};

const loginUser = async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Ingresa correo y contraseña' });
  }
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');

  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ message: 'Correo o contraseña incorrectos' });
  }

  res.json({
    message: 'Inicio de sesión exitoso',
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
  });
};

// 3. VER PERFIL (GET /api/users/:id)
const getUserById = async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);

  if (!user) {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  res.json(user);
};

// 4. ACTUALIZAR PERFIL
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, password } = req.body ?? {};

  const user = await User.findById(id).select('+passwordHash');
  if (!user) {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (password !== undefined && password.trim() !== '') {
    if (password.length < 6) {
      return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }
    user.passwordHash = hashPassword(password);
  }

  await user.save();

  res.json({
    message: 'Perfil actualizado correctamente',
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
  });
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);

  if (!user) {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  await user.deleteOne();
  res.json({ message: 'Cuenta eliminada correctamente' });
};

module.exports = {
  registerUser,
  loginUser,
  getUserById,
  updateUser,
  deleteUser,
};