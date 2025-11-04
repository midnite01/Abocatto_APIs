const mongoose = require('mongoose');

const productoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre del producto es obligatorio'],
    trim: true,
    maxlength: [100, 'El nombre no puede tener más de 100 caracteres']
  },
  descripcion: {
    type: String,
    required: [true, 'La descripción del producto es obligatoria'],
    trim: true,
    maxlength: [500, 'La descripción no puede tener más de 500 caracteres']
  },
  precio: {
    type: Number,
    required: [true, 'El precio del producto es obligatorio'],
    min: [0, 'El precio no puede ser negativo'],
    validate: {
      validator: function(precio) {
        return precio > 0;
      },
      message: 'El precio debe ser mayor a 0'
    }
  },
  categoria: {
    type: String,
    required: [true, 'La categoría del producto es obligatoria'],
    enum: {
      values: ['sandwiches', 'paninis', 'acompañamientos', 'bebibles', 'promos'],
      message: 'La categoría {VALUE} no es válida. Use: sandwiches, paninis, acompañamientos, bebibles o promos'
    },
    lowercase: true
  },
  imagen: {
    type: String,
    default: '',
    validate: {
      validator: function(imagen) {
        // Validación opcional para URLs si quieres ser más estricto
        if (imagen === '') return true;
        return imagen.startsWith('http://') || imagen.startsWith('https://');
      },
      message: 'La imagen debe ser una URL válida'
    }
  },
  stock: {
    type: Number,
    required: [true, 'El stock del producto es obligatorio'],
    default: 10,
    min: [0, 'El stock no puede ser negativo'],
    validate: {
      validator: Number.isInteger,
      message: 'El stock debe ser un número entero'
    }
  },
  disponible: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // Crea createdAt y updatedAt automáticamente
});

// Índice para búsquedas más eficientes
productoSchema.index({ nombre: 'text', descripcion: 'text' });
productoSchema.index({ categoria: 1 });
productoSchema.index({ disponible: 1 });

// Método para reducir stock (se usará cuando se hagan pedidos)
productoSchema.methods.reducirStock = function(cantidad) {
  if (cantidad > this.stock) {
    throw new Error(`Stock insuficiente. Stock actual: ${this.stock}, cantidad solicitada: ${cantidad}`);
  }
  this.stock -= cantidad;
  
  // Si el stock llega a 0, marcar como no disponible automáticamente
  if (this.stock === 0) {
    this.disponible = false;
  }
  
  return this.save();
};

// Método para aumentar stock
productoSchema.methods.aumentarStock = function(cantidad) {
  this.stock += cantidad;
  
  // Si tenía stock 0 y ahora tiene stock, marcar como disponible
  if (this.stock > 0 && !this.disponible) {
    this.disponible = true;
  }
  
  return this.save();
};

// Método estático para obtener productos por categoría
productoSchema.statics.obtenerPorCategoria = function(categoria) {
  return this.find({ 
    categoria: categoria.toLowerCase(),
    disponible: true 
  });
};

// Método estático para buscar productos por nombre
productoSchema.statics.buscarPorNombre = function(nombre) {
  return this.find({
    nombre: { $regex: nombre, $options: 'i' },
    disponible: true
  });
};

// Crear el modelo
const Producto = mongoose.model('Producto', productoSchema);

module.exports = Producto;