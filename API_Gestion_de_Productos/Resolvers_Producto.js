const Producto = require('./Modelo_Producto');

const productoResolvers = {
  Query: {
    obtenerProductos: async (_, { categoria, disponible }) => {
      try {
        let filtro = {};
        
        // Aplicar filtros si se proporcionan
        if (categoria) {
          filtro.categoria = categoria.toLowerCase();
        }
        
        if (disponible !== undefined) {
          filtro.disponible = disponible;
        } else {
          // Por defecto, mostrar solo productos disponibles
          filtro.disponible = true;
        }

        const productos = await Producto.find(filtro).sort({ createdAt: -1 });
        return productos;
        
      } catch (error) {
        throw new Error('Error obteniendo productos: ' + error.message);
      }
    },

    obtenerProducto: async (_, { id }) => {
      try {
        const producto = await Producto.findById(id);
        if (!producto) {
          throw new Error('Producto no encontrado');
        }
        return producto;
        
      } catch (error) {
        throw new Error('Error obteniendo producto: ' + error.message);
      }
    },

    buscarProductos: async (_, { nombre }) => {
      try {
        const productos = await Producto.buscarPorNombre(nombre);
        return productos;
        
      } catch (error) {
        throw new Error('Error buscando productos: ' + error.message);
      }
    },

    obtenerProductosPorCategoria: async (_, { categoria }) => {
      try {
        const productos = await Producto.obtenerPorCategoria(categoria);
        return productos;
        
      } catch (error) {
        throw new Error('Error obteniendo productos por categoría: ' + error.message);
      }
    }
  },

  Mutation: {
    crearProducto: async (_, { nombre, descripcion, precio, categoria, imagen, stock }) => {
      try {
        // TODO: Verificar que el usuario sea admin (context.usuario.rol === 'admin')
        
        // Verificar si el producto ya existe
        const productoExistente = await Producto.findOne({ 
          nombre: { $regex: new RegExp(nombre, 'i') } 
        });
        
        if (productoExistente) {
          throw new Error('Ya existe un producto con ese nombre');
        }

        // Crear nuevo producto
        const nuevoProducto = new Producto({
          nombre,
          descripcion,
          precio,
          categoria: categoria.toLowerCase(),
          imagen: imagen || '',
          stock: stock || 10
        });

        await nuevoProducto.save();

        return {
          producto: nuevoProducto,
          mensaje: 'Producto creado exitosamente'
        };

      } catch (error) {
        throw new Error('Error creando producto: ' + error.message);
      }
    },

    actualizarProducto: async (_, { id, nombre, descripcion, precio, categoria, imagen, stock, disponible }) => {
      try {
        // TODO: Verificar que el usuario sea admin
        
        const producto = await Producto.findById(id);
        if (!producto) {
          throw new Error('Producto no encontrado');
        }

        // Verificar nombre único si se está actualizando
        if (nombre && nombre !== producto.nombre) {
          const productoConMismoNombre = await Producto.findOne({
            nombre: { $regex: new RegExp(nombre, 'i') },
            _id: { $ne: id } // Excluir el producto actual
          });
          
          if (productoConMismoNombre) {
            throw new Error('Ya existe otro producto con ese nombre');
          }
        }

        // Actualizar campos
        const camposActualizar = {};
        if (nombre) camposActualizar.nombre = nombre;
        if (descripcion) camposActualizar.descripcion = descripcion;
        if (precio !== undefined) camposActualizar.precio = precio;
        if (categoria) camposActualizar.categoria = categoria.toLowerCase();
        if (imagen !== undefined) camposActualizar.imagen = imagen;
        if (stock !== undefined) camposActualizar.stock = stock;
        if (disponible !== undefined) camposActualizar.disponible = disponible;

        const productoActualizado = await Producto.findByIdAndUpdate(
          id,
          camposActualizar,
          { new: true, runValidators: true }
        );

        return {
          producto: productoActualizado,
          mensaje: 'Producto actualizado exitosamente'
        };

      } catch (error) {
        throw new Error('Error actualizando producto: ' + error.message);
      }
    },

    eliminarProducto: async (_, { id }) => {
      try {
        // TODO: Verificar que el usuario sea admin
        
        const producto = await Producto.findById(id);
        if (!producto) {
          throw new Error('Producto no encontrado');
        }

        await Producto.findByIdAndDelete(id);

        return {
          success: true,
          message: 'Producto eliminado exitosamente'
        };

      } catch (error) {
        return {
          success: false,
          message: 'Error eliminando producto: ' + error.message
        };
      }
    },

    actualizarStock: async (_, { id, cantidad }) => {
      try {
        const producto = await Producto.findById(id);
        if (!producto) {
          throw new Error('Producto no encontrado');
        }

        if (cantidad < 0) {
          // Reducir stock
          await producto.reducirStock(Math.abs(cantidad));
        } else {
          // Aumentar stock
          await producto.aumentarStock(cantidad);
        }

        const productoActualizado = await Producto.findById(id);

        return {
          producto: productoActualizado,
          mensaje: `Stock actualizado exitosamente. Nuevo stock: ${productoActualizado.stock}`
        };

      } catch (error) {s
        throw new Error('Error actualizando stock: ' + error.message);
      }
    }
  }
};

module.exports = productoResolvers;