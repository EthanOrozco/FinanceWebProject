const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch(err) {
    console.error('Error al conectar a MongoDB: ', err);
    process.exit(1); //sin base de datos no hay app así que tiramos el server
  }
}

module.exports = connectDB;
