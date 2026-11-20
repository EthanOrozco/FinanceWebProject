module.exports = (err, req, res, next) => {
  if (err.name === 'ValidationError') { //fallo en una de las reglass del schema
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ message: errors[0], errors });
  }
  if (err.name === 'CastError') { //id invalido (formato)
    return res.status(400).json({ message: 'ID inválido' });
  }
  if (err.code === 11000) { //violación del índice único
    return res.status(409).json({ message: 'Ya existe registro con estos datos' });
  }
  console.error(err);
  res.status(500).json({ message: 'Error interno del servidor' });
}
