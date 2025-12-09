const mongoose = require('mongoose');

const itemPedidoSchema = new mongoose.Schema({
  productoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto',
    required: [true, 'El ID del producto es obligatorio']
  },
  nombre: {
    type: String,
    required: [true, 'El nombre del producto es obligatorio'],
    trim: true,
    maxlength: [100, 'El nombre no puede tener más de 100 caracteres']
  },
  precio: {
    type: Number,
    required: [true, 'El precio del producto es obligatorio'],
    min: [0, 'El precio no puede ser negativo']
  },
  cantidad: {
    type: Number,
    required: [true, 'La cantidad es obligatoria'],
    min: [1, 'La cantidad debe ser al menos 1'],
    validate: {
      validator: Number.isInteger,
      message: 'La cantidad debe ser un número entero'
    }
  },
  imagen: {
    type: String,
    default: ''
  }
});

const direccionEntregaSchema = new mongoose.Schema({
  calle: {
    type: String,
    required: [true, 'La calle es obligatoria'],
    trim: true,
    maxlength: [200, 'La calle no puede tener más de 200 caracteres']
  },
  comuna: {
    type: String,
    required: [true, 'La comuna es obligatoria'],
    trim: true,
    maxlength: [100, 'La comuna no puede tener más de 100 caracteres']
  },
  ciudad: {
    type: String,
    required: [true, 'La ciudad es obligatoria'],
    trim: true,
    maxlength: [100, 'La ciudad no puede tener más de 100 caracteres']
  },
  notas: {
    type: String,
    trim: true,
    maxlength: [500, 'Las notas no pueden tener más de 500 caracteres']
  }
});

const datosPagoSchema = new mongoose.Schema({
  metodo: {
    type: String,
    required: [true, 'El método de pago es obligatorio'],
    enum: {
      values: ['tarjeta', 'contraentrega'],
      message: 'Método de pago {VALUE} no válido'
    }
  },
  ultimosDigitos: {
    type: String,
    maxlength: 4
  },
  transaccionId: {
    type: String,
    trim: true
  }
});

const pedidoSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: [true, 'El ID del usuario es obligatorio']
  },
  items: {
    type: [itemPedidoSchema],
    required: [true, 'Los items del pedido son obligatorios'],
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: 'El pedido debe tener al menos un item'
    }
  },
  total: {
    type: Number,
    required: [true, 'El total del pedido es obligatorio'],
    min: [0, 'El total no puede ser negativo']
  },
  estado: {
    type: String,
    required: [true, 'El estado del pedido es obligatorio'],
    enum: {
      values: [
        'pendiente',        // Creado, esperando confirmación
        'confirmado',       // Confirmado por el sistema
        'en_preparacion',   // En cocina/preparación
        'en_camino',        // En reparto (solo delivery)
        'entregado',        // Entregado al cliente (delivery)
        'listo_retiro',     // Listo para retirar (solo retiro)
        'retirado',         // Retirado por el cliente (retiro)
        'cancelado'         // Pedido cancelado
      ],
      message: 'Estado {VALUE} no válido'
    },
    default: 'pendiente'
  },
  tipoEntrega: {
    type: String,
    required: [true, 'El tipo de entrega es obligatorio'],
    enum: {
      values: ['delivery', 'retiro'],
      message: 'Tipo de entrega {VALUE} no válido'
    }
  },
  direccionEntrega: {
    type: direccionEntregaSchema,
    required: function() {
      return this.tipoEntrega === 'delivery';
    }
  },
  metodoPago: {
    type: String,
    required: [true, 'El método de pago es obligatorio'],
    enum: {
      values: ['tarjeta', 'contraentrega'],
      message: 'Método de pago {VALUE} no válido'
    }
  },
  datosPago: {
    type: datosPagoSchema,
    required: [true, 'Los datos de pago son obligatorios']
  },
  numeroBoleta: {
    type: String,
    unique: true,
    sparse: true // Permite null temporalmente
  },
  tiempoEstimado: {
    type: Number, // en minutos
    min: [0, 'El tiempo estimado no puede ser negativo'],
    default: 30
  },
  notas: {
    type: String,
    trim: true,
    maxlength: [500, 'Las notas no pueden tener más de 500 caracteres']
  }
}, {
  timestamps: true // Crea createdAt y updatedAt automáticamente
});

// Índices para búsquedas eficientes
pedidoSchema.index({ usuarioId: 1 });
pedidoSchema.index({ estado: 1 });
pedidoSchema.index({ createdAt: -1 });
pedidoSchema.index({ numeroBoleta: 1 });

// Método para calcular el total
pedidoSchema.methods.calcularTotal = function() {
  return this.items.reduce((sum, item) => {
    return sum + (item.precio * item.cantidad);
  }, 0);
};

// Middleware para calcular el total antes de validar y guardar
pedidoSchema.pre('save', function(next) {
  if (this.isModified('items')) {
    this.total = this.calcularTotal();
  }
  next();
});

pedidoSchema.pre('validate', function(next) {
  if (this.isNew || this.isModified('items')) {
    this.total = this.calcularTotal();
  }
  next();
});

// Método para generar número de boleta
pedidoSchema.methods.generarNumeroBoleta = function() {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  this.numeroBoleta = `B${timestamp}${random}`;
  return this.numeroBoleta;
};

// Método para verificar si se puede cancelar
pedidoSchema.methods.puedeCancelar = function() {
  const estadosCancelables = ['pendiente', 'confirmado', 'en_preparacion' ];
  return estadosCancelables.includes(this.estado);
};

// Método estático para obtener pedidos por usuario
pedidoSchema.statics.obtenerPorUsuario = function(usuarioId) {
  return this.find({ usuarioId }).sort({ createdAt: -1 });
};

// Método estático para obtener pedidos por estado
pedidoSchema.statics.obtenerPorEstado = function(estado) {
  return this.find({ estado }).sort({ createdAt: -1 });
};

// Método estático para obtener pedidos por estado con populate
pedidoSchema.statics.obtenerPorEstadoConUsuario = function(estado) {
  return this.find({ estado })
    .populate('usuarioId', 'nombre email telefono')
    .sort({ createdAt: -1 });
};

// Método estático para obtener todos los pedidos con usuario
pedidoSchema.statics.obtenerTodosConUsuario = function() {
  return this.find({})
    .populate('usuarioId', 'nombre email telefono')
    .sort({ createdAt: -1 });
};

// Crear el modelo
const Pedido = mongoose.model('Pedido', pedidoSchema);

module.exports = Pedido;