const mongoose = require('mongoose');
const Pedido = require('../API_Gestion_de_Pedidos/Modelo_Pedido');
const Producto = require('../API_Gestion_de_Productos/Modelo_Producto');

class ReporteService {
  
  // ==================== MÉTODOS PARA FILTRAR POR PERIODO ====================
  
  static obtenerFechasPorPeriodo(periodo, fechaPersonalizada = null) {
    const ahora = new Date();
    let inicio, fin;

    switch (periodo) {
      case 'hoy':
        inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
        break;
        
      case 'ayer':
        inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1);
        fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        break;
        
      case 'semana':
        inicio = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
        fin = new Date();
        break;
        
      case 'mes':
        inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);
        break;
        
      case 'anio':
        inicio = new Date(ahora.getFullYear(), 0, 1);
        fin = new Date(ahora.getFullYear(), 11, 31);
        break;
        
      case 'personalizado':
        if (!fechaPersonalizada) {
          throw new Error('Se requiere fecha personalizada');
        }
        inicio = new Date(fechaPersonalizada.inicio);
        fin = new Date(fechaPersonalizada.fin);
        break;
        
      default:
        throw new Error('Período no válido');
    }

    return { inicio, fin };
  }

  // ==================== REPORTES PRINCIPALES ====================

  static async obtenerReporteConsolidado(periodo = 'mes') {
    try {
      const { inicio, fin } = this.obtenerFechasPorPeriodo(periodo);
      
      // Obtener pedidos del período
      const pedidos = await Pedido.find({
        createdAt: { $gte: inicio, $lte: fin },
        estado: { $in: ['confirmado', 'en_preparacion', 'en_camino', 'entregado', 'retirado'] }
      });

      return this.calcularReporteConsolidado(pedidos, periodo);
    } catch (error) {
      throw new Error(`Error obteniendo reporte consolidado: ${error.message}`);
    }
  }

  static async obtenerDatosGraficos(periodo = 'mes') {
    try {
      const { inicio, fin } = this.obtenerFechasPorPeriodo(periodo);
      
      const pedidos = await Pedido.find({
        createdAt: { $gte: inicio, $lte: fin },
        estado: { $in: ['confirmado', 'en_preparacion', 'en_camino', 'entregado', 'retirado'] }
      });

      const datosGraficos = {
        ventasPorDia: await this.calcularVentasPorDia(pedidos, inicio, fin),
        topProductos: await this.calcularTopProductos(pedidos),
        metodosPago: this.calcularDistribucionMetodosPago(pedidos),
        tiposEntrega: this.calcularDistribucionTiposEntrega(pedidos)
      };

      return datosGraficos;
    } catch (error) {
      throw new Error(`Error obteniendo datos para gráficos: ${error.message}`);
    }
  }

  // ==================== CÁLCULOS DE REPORTES ====================

  static calcularReporteConsolidado(pedidos, periodo) {
    if (pedidos.length === 0) {
      return this.reporteVacio(periodo);
    }

    const totalVentas = pedidos.reduce((sum, pedido) => sum + pedido.total, 0);
    const cantidadPedidos = pedidos.length;
    const ticketPromedio = totalVentas / cantidadPedidos;

    // Calcular crecimiento vs período anterior (simplificado)
    const crecimiento = this.calcularCrecimiento(pedidos, periodo);

    return {
      periodo,
      totalVentas,
      cantidadPedidos,
      ticketPromedio: Math.round(ticketPromedio),
      crecimiento,
      resumenProductos: this.calcularResumenProductos(pedidos),
      resumenMetodosPago: this.calcularResumenMetodosPago(pedidos),
      resumenTiposEntrega: this.calcularResumenTiposEntrega(pedidos)
    };
  }

  static async calcularTopProductos(pedidos, limite = 10) {
    const productosMap = new Map();

    // Contar productos vendidos
    pedidos.forEach(pedido => {
      pedido.items.forEach(item => {
        const key = item.productoId.toString();
        if (productosMap.has(key)) {
          const existente = productosMap.get(key);
          existente.cantidadVendida += item.cantidad;
          existente.totalVentas += item.precio * item.cantidad;
        } else {
          productosMap.set(key, {
            productoId: item.productoId,
            nombre: item.nombre,
            cantidadVendida: item.cantidad,
            totalVentas: item.precio * item.cantidad
          });
        }
      });
    });

    // Ordenar por total de ventas y limitar
    const productosArray = Array.from(productosMap.values());
    productosArray.sort((a, b) => b.totalVentas - a.totalVentas);
    
    const topProductos = productosArray.slice(0, limite);
    
    // Calcular porcentajes
    const totalVentasPeriodo = pedidos.reduce((sum, pedido) => sum + pedido.total, 0);
    topProductos.forEach(producto => {
      producto.porcentajeDelTotal = totalVentasPeriodo > 0 
        ? (producto.totalVentas / totalVentasPeriodo) * 100 
        : 0;
    });

    return topProductos;
  }

  static calcularDistribucionMetodosPago(pedidos) {
    const distribucion = {};
    
    pedidos.forEach(pedido => {
      const metodo = pedido.metodoPago;
      distribucion[metodo] = (distribucion[metodo] || 0) + 1;
    });

    return Object.entries(distribucion).map(([metodo, cantidad]) => ({
      metodo,
      cantidad,
      porcentaje: (cantidad / pedidos.length) * 100
    }));
  }

  static calcularDistribucionTiposEntrega(pedidos) {
    const distribucion = {};
    
    pedidos.forEach(pedido => {
      const tipo = pedido.tipoEntrega;
      distribucion[tipo] = (distribucion[tipo] || 0) + 1;
    });

    return Object.entries(distribucion).map(([tipo, cantidad]) => ({
      tipo,
      cantidad,
      porcentaje: (cantidad / pedidos.length) * 100
    }));
  }

  static async calcularVentasPorDia(pedidos, inicio, fin) {
    const ventasPorDia = {};
    const currentDate = new Date(inicio);
    
    // Inicializar todos los días del período
    while (currentDate <= fin) {
      const fechaStr = currentDate.toISOString().split('T')[0];
      ventasPorDia[fechaStr] = 0;
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Sumar ventas por día
    pedidos.forEach(pedido => {
      const fechaStr = pedido.createdAt.toISOString().split('T')[0];
      if (ventasPorDia[fechaStr] !== undefined) {
        ventasPorDia[fechaStr] += pedido.total;
      }
    });

    return Object.entries(ventasPorDia).map(([fecha, ventas]) => ({
      fecha,
      ventas
    }));
  }

  // ==================== MÉTODOS AUXILIARES ====================

  static calcularCrecimiento(pedidos, periodo) {
    // Simulación simple - en producción calcularíamos vs período anterior real
    return {
      porcentaje: Math.random() * 20 - 5, // Entre -5% y +15%
      tendencia: Math.random() > 0.5 ? 'positiva' : 'negativa'
    };
  }

  static calcularResumenProductos(pedidos) {
    const totalProductos = pedidos.reduce((sum, pedido) => 
      sum + pedido.items.reduce((itemSum, item) => itemSum + item.cantidad, 0), 0
    );
    
    return {
      totalProductosVendidos: totalProductos,
      productosUnicos: new Set(pedidos.flatMap(p => p.items.map(i => i.productoId.toString()))).size
    };
  }

  static calcularResumenMetodosPago(pedidos) {
    const metodos = {};
    pedidos.forEach(pedido => {
      metodos[pedido.metodoPago] = (metodos[pedido.metodoPago] || 0) + 1;
    });
    
    const metodoMasUsado = Object.entries(metodos).sort((a, b) => b[1] - a[1])[0];
    
    return {
      metodoMasUsado: metodoMasUsado ? metodoMasUsado[0] : 'N/A',
      porcentajeMetodoMasUsado: metodoMasUsado ? (metodoMasUsado[1] / pedidos.length) * 100 : 0
    };
  }

  static calcularResumenTiposEntrega(pedidos) {
    const tipos = {};
    pedidos.forEach(pedido => {
      tipos[pedido.tipoEntrega] = (tipos[pedido.tipoEntrega] || 0) + 1;
    });
    
    const tipoMasUsado = Object.entries(tipos).sort((a, b) => b[1] - a[1])[0];
    
    return {
      tipoMasUsado: tipoMasUsado ? tipoMasUsado[0] : 'N/A',
      porcentajeTipoMasUsado: tipoMasUsado ? (tipoMasUsado[1] / pedidos.length) * 100 : 0
    };
  }

  static reporteVacio(periodo) {
    return {
      periodo,
      totalVentas: 0,
      cantidadPedidos: 0,
      ticketPromedio: 0,
      crecimiento: { porcentaje: 0, tendencia: 'neutral' },
      resumenProductos: { totalProductosVendidos: 0, productosUnicos: 0 },
      resumenMetodosPago: { metodoMasUsado: 'N/A', porcentajeMetodoMasUsado: 0 },
      resumenTiposEntrega: { tipoMasUsado: 'N/A', porcentajeTipoMasUsado: 0 }
    };
  }

  // ==================== EXPORTACIÓN A EXCEL ====================

  static generarCSVReporteConsolidado(reporte) {
    const lines = [];
    
    // Encabezado
    lines.push('Reporte de Ventas Bocatto');
    lines.push(`Período: ${reporte.periodo}`);
    lines.push('');
    
    // Métricas principales
    lines.push('MÉTRICAS PRINCIPALES');
    lines.push('Total Ventas,Cantidad Pedidos,Ticket Promedio,Crecimiento');
    lines.push(`${reporte.totalVentas},${reporte.cantidadPedidos},${reporte.ticketPromedio},${reporte.crecimiento.porcentaje.toFixed(2)}%`);
    lines.push('');
    
    // Resumen de productos
    lines.push('RESUMEN PRODUCTOS');
    lines.push('Total Productos Vendidos,Productos Únicos');
    lines.push(`${reporte.resumenProductos.totalProductosVendidos},${reporte.resumenProductos.productosUnicos}`);
    lines.push('');
    
    // Métodos de pago
    lines.push('MÉTODOS DE PAGO');
    lines.push('Método Más Usado,Porcentaje');
    lines.push(`${reporte.resumenMetodosPago.metodoMasUsado},${reporte.resumenMetodosPago.porcentajeMetodoMasUsado.toFixed(2)}%`);
    lines.push('');
    
    // Tipos de entrega
    lines.push('TIPOS DE ENTREGA');
    lines.push('Tipo Más Usado,Porcentaje');
    lines.push(`${reporte.resumenTiposEntrega.tipoMasUsado},${reporte.resumenTiposEntrega.porcentajeTipoMasUsado.toFixed(2)}%`);

    return lines.join('\n');
  }
}

module.exports = ReporteService;