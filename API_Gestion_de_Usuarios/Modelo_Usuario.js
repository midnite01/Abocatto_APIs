const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'El email es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'La contraseña es obligatoria'],
    minlength: 6
  },
  rol: {
    type: String,
    enum: ['cliente', 'admin'],
    default: 'cliente'
  },
  telefono: {
    type: String,
    trim: true
  },
  run: { 
    type: String, 
    trim: true 
  },
  sexo: { 
    type: String, 
    enum: ['masculino', 'femenino', 'otro', 'prefiero_no_decir'] 
  },
  fechaNacimiento: { 
    type: Date 
  },
  region: { 
    type: String, 
    trim: true 
  },
  provincia: { 
    type: String, 
    trim: true 
  },
  direccion: {
    calle: String,
    comuna: String,
    ciudad: String
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // Crea createdAt y updatedAt automáticamente
});

// Crear el modelo
const Usuario = mongoose.model('Usuario', usuarioSchema);

module.exports = Usuario;