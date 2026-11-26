const crypto = require("crypto");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const { setSessionCookie, clearSessionCookie } = require("../utils/session");

const BCRYPT_ROUNDS = 12;

//dummy hash so the do NOT know which emails are registered based on the timings
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", BCRYPT_ROUNDS);

const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);

//bcrypt hashes start with "$2a$"/"$2b$". Anything else is old hash
const isLegacyHash = (hash) => !hash.startsWith("$2");
// ^^^^^ remove ASAP (prob can do it now but better to leave it be a while)
const verifyPassword = async (password, storedHash) => {
  if (!isLegacyHash(storedHash)) return bcrypt.compare(password, storedHash);

  const stored = Buffer.from(storedHash, "hex");
  const given = crypto.createHash("sha256").update(password).digest();

  return stored.length && crypto.timingSafeEqual(stored, given);
};

const validatePassword = (password) => {
  if (typeof password !== "string" || password.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres";
  }
  if (Buffer.byteLength(password) > 72) {
    return "La contraseña es demasiado larga";
  }
  return null;
};

const registerUser = async (req, res) => {
  const { name, email, password } = req.body ?? {};
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ message: pwError });

  const user = await User.create({
    name,
    email,
    passwordHash: await hashPassword(password),
  });

  setSessionCookie(res, user._id);

  res.status(201).json({
    message: "Usuario registrado exitosamente",
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
    return res.status(400).json({ message: "Ingresa correo y contraseña" });
  }

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email ||
    !password
  ) {
    return res.status(400).json({ message: "Ingresa correo y contraseña" });
  }
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    "+passwordHash",
  );

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH); //same timing as a real check
    return res.status(401).json({ message: "Correo o contraseña incorrectos" });
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ message: "Correo o contraseña incorrectos" });
  }

  // Upgrade old SHA-256 hashes to bcrypt now that we have the plain text
  if (isLegacyHash(user.passwordHash)) {
    await User.updateOne(
      { _id: user._id },
      { passwordHash: await hashPassword(password) },
    );
  }

  setSessionCookie(res, user._id);

  res.json({
    message: "Inicio de sesión exitoso",
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
  });
};

// changed routes to only let user see/edit/delete itself
const getMe = async (req, res) => {
  const user = await User.findById(req.userId); //get id from token thus preventing IDOR

  if (!user) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }

  res.json(user);
};

const updateMe = async (req, res) => {
  const { name, email, password, currentPassword } = req.body ?? {};

  const user = await User.findById(req.userId).select("+passwordHash");
  if (!user) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }

  const changingEmail =
    email !== undefined && email.toLowerCase().trim() !== user.email;
  const changingPassword = password !== undefined && password !== "";

  if (changingEmail || changingPassword) {
    if (typeof currentPassword !== "string" || !currentPassword) {
      return res.status(400).json({ message: "Ingresa tu contraseña actual" });
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return res
        .status(403)
        .json({ message: "La contraseña actual es incorrecta" });
    }
  }

  if (name !== undefined) user.name = name;
  if (changingEmail) user.email = email;
  if (changingPassword) {
    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ message: pwError });
    user.passwordHash = await hashPassword(password);
  }

  await user.save();

  res.json({
    message: "Perfil actualizado correctamente",
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
  });
};

const deleteMe = async (req, res) => {
  const user = await User.findById(req.userId).select("+passwordHash");
  const { currentPassword } = req.body ?? {};

  if (!user) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }

  if (typeof currentPassword !== "string" || !currentPassword) {
    return res.status(400).json({ message: "Ingresa tu contraseña actual" });
  }

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return res
      .status(403)
      .json({ message: "La contraseña actual es incorrecta" });
  }

  await user.deleteOne();
  clearSessionCookie(res);
  res.json({ message: "Cuenta eliminada correctamente" });
};

const logoutUser = (req, res) => {
  clearSessionCookie(res);
  res.json({ message: "Sesión cerrada" });
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateMe,
  deleteMe,
  logoutUser,
};
