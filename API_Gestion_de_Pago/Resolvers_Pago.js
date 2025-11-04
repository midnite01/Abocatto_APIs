const { MetodoPago, TransaccionPago } = require('./Modelo_Pago');
const Pedido = require('../API_Gestion_de_Pedidos/Modelo_Pedido');
const Producto = require('../API_Gestion_de_Productos/Modelo_Producto');

const pagoResolvers = {
  Query: {
    obtenerMetodosPago: async (_, args, context) => {
      try {
        // TODO: Verificar autenticación (context.usuarioId)
        // Por ahora usamos un ID hardcodeado para pruebas
        const usuarioId = "68fa67079780398b05f4f0d1"; // ID de Juan Pérez
        
        const metodosPago = await MetodoPago.obtenerPorUsuario(usuarioId);
        return metodosPago;
        
      } catch (error) {
        throw new Error('Error obteniendo métodos de pago: ' + error.message);
      }
    },

    obtenerTransaccionesUsuario: async (_, args, context) => {
      try {
        // TODO: Verificar autenticación
        const usuarioId = "68fa67079780398b05f4f0d1";
        
        const transacciones = await TransaccionPago.obtenerPorUsuario(usuarioId);
        return transacciones;
        
      } catch (error) {
        throw new Error('Error obteniendo transacciones: ' + error.message);
      }
    },

    obtenerTransaccion: async (_, { id }) => {
      try {
        const transaccion = await TransaccionPago.findById(id);
        if (!transaccion) {
          throw new Error('Transacción no encontrada');
        }
        return transaccion;
        
      } catch (error) {
        throw new Error('Error obteniendo transacción: ' + error.message);
      }
    },

    obtenerTransaccionesPorPedido: async (_, { pedidoId }) => {
      try {
        const transacciones = await TransaccionPago.find({ pedidoId }).sort({ createdAt: -1 });
        return transacciones;
        
      } catch (error) {
        throw new Error('Error obteniendo transacciones del pedido: ' + error.message);
      }
    }
  },

  Mutation: {
    procesarPago: async (_, { pedidoId, metodoPago, datosTarjeta }) => {
      try {
        // 1. Validar que el pedido existe y está pendiente
        const pedido = await Pedido.findById(pedidoId);
        if (!pedido) {
          throw new Error('Pedido no encontrado');
        }

        if (pedido.estado !== 'pendiente') {
          throw new Error('El pedido ya ha sido procesado');
        }

        // 2. Validar método de pago
        if (metodoPago === 'tarjeta' && !datosTarjeta) {
          throw new Error('Datos de tarjeta requeridos para pago con tarjeta');
        }

        // 3. Crear transacción de pago
        const transaccion = new TransaccionPago({
          pedidoId,
          usuarioId: pedido.usuarioId,
          metodoPago,
          monto: pedido.total,
          estado: 'procesando'
        });

        // Generar código de transacción único
        transaccion.generarCodigoTransaccion();

        // 4. Procesar según método de pago
        if (metodoPago === 'tarjeta') {
          await procesarPagoTarjeta(transaccion, datosTarjeta, pedido);
        } else if (metodoPago === 'contraentrega') {
          await procesarPagoContraEntrega(transaccion, pedido);
        }

        await transaccion.save();

        return {
          transaccion,
          mensaje: 'Pago procesado exitosamente'
        };

      } catch (error) {
        throw new Error('Error procesando pago: ' + error.message);
      }
    },

    guardarMetodoPago: async (_, { datosTarjeta, alias }, context) => {
      try {
        // TODO: Verificar autenticación
        const usuarioId = "68fa67079780398b05f4f0d1";

        // Validar datos de tarjeta
        const { esValida, tipo, ultimosDigitos } = validarTarjeta(datosTarjeta);
        
        if (!esValida) {
          throw new Error('Datos de tarjeta inválidos');
        }

        // Verificar si ya existe esta tarjeta
        const tarjetaExistente = await MetodoPago.findOne({
          usuarioId,
          'datosTarjeta.ultimosDigitos': ultimosDigitos,
          activo: true
        });

        if (tarjetaExistente) {
          throw new Error('Esta tarjeta ya está guardada');
        }

        // Crear método de pago
        const metodoPago = new MetodoPago({
          usuarioId,
          alias: alias || 'Mi Tarjeta',
          datosTarjeta: {
            ultimosDigitos,
            tipo,
            mesVencimiento: datosTarjeta.mesVencimiento,
            anioVencimiento: datosTarjeta.anioVencimiento,
            nombreTitular: datosTarjeta.nombreTitular
          }
        });

        await metodoPago.save();

        return {
          metodoPago,
          mensaje: 'Método de pago guardado exitosamente'
        };

      } catch (error) {
        throw new Error('Error guardando método de pago: ' + error.message);
      }
    },

    eliminarMetodoPago: async (_, { id }, context) => {
      try {
        // TODO: Verificar que el usuario es propietario
        const usuarioId = "68fa67079780398b05f4f0d1";

        const metodoPago = await MetodoPago.findOne({ _id: id, usuarioId });
        if (!metodoPago) {
          throw new Error('Método de pago no encontrado');
        }

        // Soft delete - marcar como inactivo
        metodoPago.activo = false;
        await metodoPago.save();

        return {
          success: true,
          message: 'Método de pago eliminado exitosamente'
        };

      } catch (error) {
        return {
          success: false,
          message: 'Error eliminando método de pago: ' + error.message
        };
      }
    },

    simularProcesamientoPago: async (_, { transaccionId, aprobado, codigoAutorizacion }) => {
      try {
        // TODO: Solo para admin en producción
        const transaccion = await TransaccionPago.findById(transaccionId);
        if (!transaccion) {
          throw new Error('Transacción no encontrada');
        }

        if (transaccion.estado !== 'procesando') {
          throw new Error('La transacción ya ha sido procesada');
        }

        const pedido = await Pedido.findById(transaccion.pedidoId);

        if (aprobado) {
          // Pago aprobado
          transaccion.estado = 'aprobado';
          transaccion.datosTransaccion = {
            idTransaccion: `SIM_${Date.now()}`,
            codigoAutorizacion: codigoAutorizacion || `AUTH_${Math.random().toString(36).substr(2, 9)}`,
            fechaProcesamiento: new Date()
          };

          // Actualizar pedido a "confirmado"
          pedido.estado = 'confirmado';
          await pedido.save();

          // Reducir stock de productos
          await reducirStockPedido(pedido);

        } else {
          // Pago rechazado
          transaccion.estado = 'rechazado';
          transaccion.mensajeError = 'Pago rechazado en simulación';
        }

        await transaccion.save();

        return {
          transaccion,
          mensaje: `Pago ${aprobado ? 'aprobado' : 'rechazado'} en simulación`
        };

      } catch (error) {
        throw new Error('Error en simulación de pago: ' + error.message);
      }
    }
  }
};

// ==================== FUNCIONES AUXILIARES ====================

async function procesarPagoTarjeta(transaccion, datosTarjeta, pedido) {
  // Validar tarjeta
  const { esValida, tipo, ultimosDigitos } = validarTarjeta(datosTarjeta);
  
  if (!esValida) {
    transaccion.estado = 'rechazado';
    transaccion.mensajeError = 'Datos de tarjeta inválidos';
    return;
  }

  // Simular procesamiento de pago (80% éxito, 20% rechazo)
  const exito = Math.random() < 0.8;

  if (exito) {
    transaccion.estado = 'aprobado';
    transaccion.datosTransaccion = {
      idTransaccion: `TXN_${Date.now()}`,
      codigoAutorizacion: `AUTH_${Math.random().toString(36).substr(2, 9)}`,
      fechaProcesamiento: new Date()
    };

    // Buscar método de pago existente o crear referencia
    const metodoPago = await MetodoPago.findOne({
      usuarioId: pedido.usuarioId,
      'datosTarjeta.ultimosDigitos': ultimosDigitos,
      activo: true
    });

    if (metodoPago) {
      transaccion.metodoPagoId = metodoPago._id;
    }

    // Actualizar pedido y reducir stock
    pedido.estado = 'confirmado';
    await pedido.save();
    await reducirStockPedido(pedido);

  } else {
    transaccion.estado = 'rechazado';
    transaccion.mensajeError = 'Pago rechazado por el procesador';
  }
}

async function procesarPagoContraEntrega(transaccion, pedido) {
  // Para contra entrega, siempre se aprueba (se cobra al recibir)
  transaccion.estado = 'aprobado';
  transaccion.datosTransaccion = {
    idTransaccion: `CONTRA_${Date.now()}`,
    codigoAutorizacion: 'PENDIENTE_COBRO',
    fechaProcesamiento: new Date()
  };

  // Actualizar pedido
  pedido.estado = 'confirmado';
  await pedido.save();
  await reducirStockPedido(pedido);
}

function validarTarjeta(datosTarjeta) {
  const { numero, mesVencimiento, anioVencimiento, cvv, nombreTitular } = datosTarjeta;

  // Validar número (16 dígitos)
  const numeroLimpio = numero.replace(/\s/g, '');
  if (!/^\d{16}$/.test(numeroLimpio)) {
    return { esValida: false };
  }

  // Validar fecha de vencimiento
  const ahora = new Date();
  const anioActual = ahora.getFullYear() % 100;
  const mesActual = ahora.getMonth() + 1;
  
  const mesVenc = parseInt(mesVencimiento);
  const anioVenc = parseInt(anioVencimiento);

  if (mesVenc < 1 || mesVenc > 12) {
    return { esValida: false };
  }

  if (anioVenc < anioActual || (anioVenc === anioActual && mesVenc < mesActual)) {
    return { esValida: false };
  }

  // Validar CVV (3-4 dígitos)
  if (!/^\d{3,4}$/.test(cvv)) {
    return { esValida: false };
  }

  // Validar nombre
  if (!nombreTitular || nombreTitular.trim().length < 2) {
    return { esValida: false };
  }

  // Detectar tipo de tarjeta por el primer dígito
  const primerDigito = numeroLimpio[0];
  let tipo = 'other';
  if (primerDigito === '4') tipo = 'visa';
  else if (primerDigito === '5') tipo = 'mastercard';
  else if (primerDigito === '3') tipo = 'amex';

  return {
    esValida: true,
    tipo,
    ultimosDigitos: numeroLimpio.slice(-4)
  };
}

async function reducirStockPedido(pedido) {
  for (const item of pedido.items) {
    await Producto.findByIdAndUpdate(
      item.productoId,
      { $inc: { stock: -item.cantidad } }
    );
  }
}

module.exports = pagoResolvers;