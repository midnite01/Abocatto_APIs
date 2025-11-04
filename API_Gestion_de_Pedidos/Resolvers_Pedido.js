const Pedido = require('./Modelo_Pedido');

const pedidoResolvers = {
  Query: {
    obtenerPedidos: async (_, { usuarioId }) => {
      try {
        let filtro = {};
        
        // Si se proporciona usuarioId, filtrar por usuario
        // Si no, devolver todos (para admin)
        if (usuarioId) {
          filtro.usuarioId = usuarioId;
        }
        
        const pedidos = await Pedido.find(filtro)
          .sort({ createdAt: -1 })
          .limit(100); // Limitar para no sobrecargar
        
        return pedidos;
        
      } catch (error) {
        throw new Error('Error obteniendo pedidos: ' + error.message);
      }
    },

    obtenerPedido: async (_, { id }) => {
      try {
        const pedido = await Pedido.findById(id);
        if (!pedido) {
          throw new Error('Pedido no encontrado');
        }
        return pedido;
        
      } catch (error) {
        throw new Error('Error obteniendo pedido: ' + error.message);
      }
    },

    obtenerPedidosUsuario: async (_, { usuarioId }) => {
      try {
        const pedidos = await Pedido.obtenerPorUsuario(usuarioId);
        return pedidos;
        
      } catch (error) {
        throw new Error('Error obteniendo pedidos del usuario: ' + error.message);
      }
    },

    obtenerPedidosPorEstado: async (_, { estado }) => {
      try {
        const pedidos = await Pedido.obtenerPorEstado(estado);
        return pedidos;
        
      } catch (error) {
        throw new Error('Error obteniendo pedidos por estado: ' + error.message);
      }
    },

    obtenerPedidosRecientes: async () => {
      try {
        const sieteDiasAtras = new Date();
        sieteDiasAtras.setDate(sieteDiasAtras.getDate() - 7);
        
        const pedidos = await Pedido.find({
          createdAt: { $gte: sieteDiasAtras }
        }).sort({ createdAt: -1 });
        
        return pedidos;
        
      } catch (error) {
        throw new Error('Error obteniendo pedidos recientes: ' + error.message);
      }
    }
  },

  Mutation: {
    crearPedido: async (_, { 
      usuarioId, 
      items, 
      tipoEntrega, 
      direccionEntrega, 
      metodoPago, 
      datosPago, 
      notas 
    }) => {
      try {
        // Validaciones básicas
        if (!items || items.length === 0) {
          throw new Error('El pedido debe contener al menos un item');
        }

        if (tipoEntrega === 'delivery' && !direccionEntrega) {
          throw new Error('La dirección de entrega es obligatoria para delivery');
        }

        // Crear nuevo pedido
        const nuevoPedido = new Pedido({
          usuarioId,
          items,
          tipoEntrega,
          direccionEntrega: tipoEntrega === 'delivery' ? direccionEntrega : undefined,
          metodoPago,
          datosPago,
          notas: notas || '',
          tiempoEstimado: tipoEntrega === 'delivery' ? 40 : 25 // Estimados por defecto
        });

        // Generar número de boleta automáticamente
        nuevoPedido.generarNumeroBoleta();

        await nuevoPedido.save();

        return {
          pedido: nuevoPedido,
          mensaje: 'Pedido creado exitosamente'
        };

      } catch (error) {
        throw new Error('Error creando pedido: ' + error.message);
      }
    },

    actualizarEstadoPedido: async (_, { id, estado }) => {
      try {
        // TODO: Verificar permisos (admin/repartidor)
        
        const estadosValidos = [
          'pendiente', 'confirmado', 'en_preparacion', 
          'en_camino', 'entregado', 'listo_retiro', 'retirado', 'cancelado'
        ];

        if (!estadosValidos.includes(estado)) {
          throw new Error('Estado no válido');
        }

        const pedido = await Pedido.findById(id);
        if (!pedido) {
          throw new Error('Pedido no encontrado');
        }

        // Validar transiciones de estado
        if (pedido.estado === 'cancelado') {
          throw new Error('No se puede modificar un pedido cancelado');
        }

        if (pedido.estado === 'entregado' || pedido.estado === 'retirado') {
          throw new Error('No se puede modificar un pedido finalizado');
        }

        const pedidoActualizado = await Pedido.findByIdAndUpdate(
          id,
          { estado },
          { new: true, runValidators: true }
        );

        return {
          pedido: pedidoActualizado,
          mensaje: `Estado del pedido actualizado a: ${estado}`
        };

      } catch (error) {
        throw new Error('Error actualizando estado del pedido: ' + error.message);
      }
    },

    cancelarPedido: async (_, { id }) => {
      try {
        const pedido = await Pedido.findById(id);
        if (!pedido) {
          throw new Error('Pedido no encontrado');
        }

        // Verificar si se puede cancelar
        if (!pedido.puedeCancelar()) {
          throw new Error('No se puede cancelar el pedido en su estado actual');
        }

        await Pedido.findByIdAndUpdate(id, { estado: 'cancelado' });

        return {
          success: true,
          message: 'Pedido cancelado exitosamente'
        };

      } catch (error) {
        return {
          success: false,
          message: 'Error cancelando pedido: ' + error.message
        };
      }
    },

    generarBoleta: async (_, { id }) => {
      try {
        const pedido = await Pedido.findById(id);
        if (!pedido) {
          throw new Error('Pedido no encontrado');
        }

        // Si ya tiene boleta, no generar otra
        if (pedido.numeroBoleta) {
          throw new Error('El pedido ya tiene un número de boleta asignado');
        }

        // Generar número de boleta
        pedido.generarNumeroBoleta();
        await pedido.save();

        const pedidoActualizado = await Pedido.findById(id);

        return {
          pedido: pedidoActualizado,
          mensaje: `Boleta generada: ${pedidoActualizado.numeroBoleta}`
        };

      } catch (error) {
        throw new Error('Error generando boleta: ' + error.message);
      }
    },

    actualizarTiempoEstimado: async (_, { id, tiempoEstimado }) => {
      try {
        // TODO: Verificar permisos (admin/repartidor)
        
        if (tiempoEstimado < 0) {
          throw new Error('El tiempo estimado no puede ser negativo');
        }

        const pedidoActualizado = await Pedido.findByIdAndUpdate(
          id,
          { tiempoEstimado },
          { new: true, runValidators: true }
        );

        if (!pedidoActualizado) {
          throw new Error('Pedido no encontrado');
        }

        return {
          pedido: pedidoActualizado,
          mensaje: `Tiempo estimado actualizado: ${tiempoEstimado} minutos`
        };

      } catch (error) {
        throw new Error('Error actualizando tiempo estimado: ' + error.message);
      }
    }
  }
};

module.exports = pedidoResolvers;