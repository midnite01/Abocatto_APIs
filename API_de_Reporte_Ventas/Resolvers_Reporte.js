const ReporteService = require('./Modelo_Reporte');

const reporteResolvers = {
  Query: {
    obtenerReporteConsolidado: async (_, { periodo = 'mes', fechaInicio, fechaFin }) => {
      try {
        // TODO: Verificar que el usuario es admin
        
        let periodoFinal = periodo;
        let fechasPersonalizadas = null;

        // Si se proporcionan fechas personalizadas
        if (fechaInicio && fechaFin) {
          periodoFinal = 'personalizado';
          fechasPersonalizadas = {
            inicio: fechaInicio,
            fin: fechaFin
          };
        }

        const reporte = await ReporteService.obtenerReporteConsolidado(periodoFinal, fechasPersonalizadas);
        
        return {
          reporte,
          mensaje: `Reporte consolidado generado para período: ${periodo}`
        };

      } catch (error) {
        throw new Error('Error obteniendo reporte consolidado: ' + error.message);
      }
    },

    obtenerDatosGraficos: async (_, { periodo = 'mes', fechaInicio, fechaFin }) => {
      try {
        // TODO: Verificar que el usuario es admin
        
        let periodoFinal = periodo;
        let fechasPersonalizadas = null;

        if (fechaInicio && fechaFin) {
          periodoFinal = 'personalizado';
          fechasPersonalizadas = {
            inicio: fechaInicio,
            fin: fechaFin
          };
        }

        const datos = await ReporteService.obtenerDatosGraficos(periodoFinal, fechasPersonalizadas);
        
        return {
          datos,
          mensaje: `Datos para gráficos generados para período: ${periodo}`
        };

      } catch (error) {
        throw new Error('Error obteniendo datos para gráficos: ' + error.message);
      }
    },

    obtenerTopProductos: async (_, { periodo = 'mes', limite = 10, fechaInicio, fechaFin }) => {
      try {
        // TODO: Verificar que el usuario es admin
        
        let periodoFinal = periodo;
        let fechasPersonalizadas = null;

        if (fechaInicio && fechaFin) {
          periodoFinal = 'personalizado';
          fechasPersonalizadas = {
            inicio: fechaInicio,
            fin: fechaFin
          };
        }

        const { inicio, fin } = ReporteService.obtenerFechasPorPeriodo(periodoFinal, fechasPersonalizadas);
        
        const Pedido = require('../API_Gestion_de_Pedidos/Modelo_Pedido');
        const pedidos = await Pedido.find({
          createdAt: { $gte: inicio, $lte: fin },
          estado: { $in: ['confirmado', 'en_preparacion', 'en_camino', 'entregado', 'retirado'] }
        });

        const topProductos = await ReporteService.calcularTopProductos(pedidos, limite);
        return topProductos;

      } catch (error) {
        throw new Error('Error obteniendo top productos: ' + error.message);
      }
    },

    obtenerDistribucionMetodosPago: async (_, { periodo = 'mes', fechaInicio, fechaFin }) => {
      try {
        // TODO: Verificar que el usuario es admin
        
        let periodoFinal = periodo;
        let fechasPersonalizadas = null;

        if (fechaInicio && fechaFin) {
          periodoFinal = 'personalizado';
          fechasPersonalizadas = {
            inicio: fechaInicio,
            fin: fechaFin
          };
        }

        const { inicio, fin } = ReporteService.obtenerFechasPorPeriodo(periodoFinal, fechasPersonalizadas);
        
        const Pedido = require('../API_Gestion_de_Pedidos/Modelo_Pedido');
        const pedidos = await Pedido.find({
          createdAt: { $gte: inicio, $lte: fin },
          estado: { $in: ['confirmado', 'en_preparacion', 'en_camino', 'entregado', 'retirado'] }
        });

        const distribucion = ReporteService.calcularDistribucionMetodosPago(pedidos);
        return distribucion;

      } catch (error) {
        throw new Error('Error obteniendo distribución de métodos de pago: ' + error.message);
      }
    },

    obtenerDistribucionTiposEntrega: async (_, { periodo = 'mes', fechaInicio, fechaFin }) => {
      try {
        // TODO: Verificar que el usuario es admin
        
        let periodoFinal = periodo;
        let fechasPersonalizadas = null;

        if (fechaInicio && fechaFin) {
          periodoFinal = 'personalizado';
          fechasPersonalizadas = {
            inicio: fechaInicio,
            fin: fechaFin
          };
        }

        const { inicio, fin } = ReporteService.obtenerFechasPorPeriodo(periodoFinal, fechasPersonalizadas);
        
        const Pedido = require('../API_Gestion_de_Pedidos/Modelo_Pedido');
        const pedidos = await Pedido.find({
          createdAt: { $gte: inicio, $lte: fin },
          estado: { $in: ['confirmado', 'en_preparacion', 'en_camino', 'entregado', 'retirado'] }
        });

        const distribucion = ReporteService.calcularDistribucionTiposEntrega(pedidos);
        return distribucion;

      } catch (error) {
        throw new Error('Error obteniendo distribución de tipos de entrega: ' + error.message);
      }
    }
  },

  Mutation: {
    exportarReporteExcel: async (_, { periodo = 'mes', fechaInicio, fechaFin }) => {
      try {
        // TODO: Verificar que el usuario es admin
        
        let periodoFinal = periodo;
        let fechasPersonalizadas = null;

        if (fechaInicio && fechaFin) {
          periodoFinal = 'personalizado';
          fechasPersonalizadas = {
            inicio: fechaInicio,
            fin: fechaFin
          };
        }

        const reporte = await ReporteService.obtenerReporteConsolidado(periodoFinal, fechasPersonalizadas);
        const csvData = ReporteService.generarCSVReporteConsolidado(reporte);

        const timestamp = new Date().toISOString().split('T')[0];
        const nombreArchivo = `reporte_ventas_${periodo}_${timestamp}.csv`;

        return {
          csvData,
          nombreArchivo,
          mensaje: `Reporte exportado exitosamente para período: ${periodo}`
        };

      } catch (error) {
        throw new Error('Error exportando reporte: ' + error.message);
      }
    },

    generarReportePersonalizado: async (_, { fechaInicio, fechaFin }) => {
      try {
        // TODO: Verificar que el usuario es admin
        
        // Validar fechas
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);

        if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
          throw new Error('Fechas inválidas');
        }

        if (inicio > fin) {
          throw new Error('La fecha de inicio debe ser anterior a la fecha de fin');
        }

        const fechasPersonalizadas = { inicio: fechaInicio, fin: fechaFin };
        const reporte = await ReporteService.obtenerReporteConsolidado('personalizado', fechasPersonalizadas);
        
        return {
          reporte,
          mensaje: `Reporte personalizado generado del ${fechaInicio} al ${fechaFin}`
        };

      } catch (error) {
        throw new Error('Error generando reporte personalizado: ' + error.message);
      }
    }
  }
};

module.exports = reporteResolvers;