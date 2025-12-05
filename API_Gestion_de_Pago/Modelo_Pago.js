const mongoose = require('mongoose');

const datosTarjetaSchema = new mongoose.Schema({
  // Solo guardamos los últimos 4 dígitos por seguridad
  ultimosDigitos: {
    type: String,
    required: [true, 'Los últimos 4 dígitos son obligatorios'],
    match: [/^\d{4}$/, 'Deben ser exactamente 4 dígitos']
  },
  tipo: {
    type: String,
    required: [true, 'El tipo de tarjeta es obligatorio'],
    enum: {
      values: ['visa', 'mastercard', 'amex', 'diners', 'other'],
      message: 'Tipo de tarjeta {VALUE} no válido'
    }
  },
  mesVencimiento: {
    type: String,
    required: [true, 'El mes de vencimiento es obligatorio'],
    match: [/^(0[1-9]|1[0-2])$/, 'Mes de vencimiento debe ser entre 01 y 12']
  },
  anioVencimiento: {
    type: String,
    required: [true, 'El año de vencimiento es obligatorio'],
    match: [/^\d{2}$/, 'Año de vencimiento debe ser 2 dígitos']
  },
  nombreTitular: {
    type: String,
    required: [true, 'El nombre del titular es obligatorio'],
    trim: true,
    maxlength: [100, 'El nombre no puede tener más de 100 caracteres']
  },
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: [true, 'El ID del usuario es obligatorio']
  }
});

const metodoPagoSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: [true, 'El ID del usuario es obligatorio']
  },
  alias: {
    type: String,
    trim: true,
    maxlength: [50, 'El alias no puede tener más de 50 caracteres'],
    default: 'Mi Tarjeta'
  },
  datosTarjeta: {
    type: datosTarjetaSchema,
    required: [true, 'Los datos de la tarjeta son obligatorios']
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const transaccionPagoSchema = new mongoose.Schema({
  pedidoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pedido',
    required: [true, 'El ID del pedido es obligatorio']
  },
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: [true, 'El ID del usuario es obligatorio']
  },
  metodoPago: {
    type: String,
    required: [true, 'El método de pago es obligatorio'],
    enum: {
      values: ['tarjeta', 'contraentrega'],
      message: 'Método de pago {VALUE} no válido'
    }
  },
  // Solo para pagos con tarjeta
  metodoPagoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MetodoPago'
  },
  monto: {
    type: Number,
    required: [true, 'El monto es obligatorio'],
    min: [0, 'El monto no puede ser negativo']
  },
  estado: {
    type: String,
    required: [true, 'El estado del pago es obligatorio'],
    enum: {
      values: ['procesando', 'aprobado', 'rechazado'],
      message: 'Estado {VALUE} no válido'
    },
    default: 'procesando'
  },
  codigoTransaccion: {
    type: String,
    unique: true,
    sparse: true
  },
  mensajeError: {
    type: String,
    trim: true,
    maxlength: [500, 'El mensaje de error no puede tener más de 500 caracteres']
  },
  datosTransaccion: {
    // Para simular datos de respuesta del procesador de pago
    idTransaccion: String,
    codigoAutorizacion: String,
    fechaProcesamiento: Date
  }
}, {
  timestamps: true
});

// Índices para búsquedas eficientes
metodoPagoSchema.index({ usuarioId: 1 });
metodoPagoSchema.index({ activo: 1 });

transaccionPagoSchema.index({ pedidoId: 1 });
transaccionPagoSchema.index({ usuarioId: 1 });
transaccionPagoSchema.index({ estado: 1 });
transaccionPagoSchema.index({ codigoTransaccion: 1 });
transaccionPagoSchema.index({ createdAt: -1 });

// Método para verificar si la tarjeta está vencida
datosTarjetaSchema.methods.estaVencida = function() {
  const ahora = new Date();
  const anioActual = ahora.getFullYear() % 100; // Últimos 2 dígitos
  const mesActual = ahora.getMonth() + 1; // 1-12
  
  const anioVencimiento = parseInt(this.anioVencimiento);
  const mesVencimiento = parseInt(this.mesVencimiento);
  
  return (anioVencimiento < anioActual) || 
         (anioVencimiento === anioActual && mesVencimiento < mesActual);
};

// Método para generar código de transacción único
transaccionPagoSchema.methods.generarCodigoTransaccion = function() {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  this.codigoTransaccion = `TXN${timestamp}${random}`;
  return this.codigoTransaccion;
};

// Método estático para obtener métodos de pago de un usuario
metodoPagoSchema.statics.obtenerPorUsuario = function(usuarioId) {
  return this.find({ usuarioId, activo: true }).sort({ createdAt: -1 });
};

// Método estático para obtener transacciones por usuario
transaccionPagoSchema.statics.obtenerPorUsuario = function(usuarioId) {
  return this.find({ usuarioId }).sort({ createdAt: -1 });
};

//Metodo para tarjetas de usuario 
metodoPagoSchema.statics.obtenerTarjetasPorUsuario = function(usuarioId) {
  return this.find({ usuarioId, activo: true }).select('datosTarjeta alias createdAt').sort({ createdAt: -1 });
};

// Crear los modelos
const MetodoPago = mongoose.model('MetodoPago', metodoPagoSchema);
const TransaccionPago = mongoose.model('TransaccionPago', transaccionPagoSchema);



module.exports = {
  MetodoPago,
  TransaccionPago
};