const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const mongoose = require('mongoose');
const cors = require('cors');
const { readFileSync } = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// ==================== IMPORTAR TODAS LAS APIs ====================

// 1. API Gestión de Usuarios
const usuarioResolvers = require('./API_Gestion_de_Usuarios/Resolvers_Usuario');
const usuarioTypeDefs = readFileSync(
  path.join(__dirname, 'API_Gestion_de_Usuarios/Esquema_Usuario.graphql'),
  'utf-8'
);

// 2. API Gestión de Productos
const productoResolvers = require('./API_Gestion_de_Productos/Resolvers_Producto');
const productoTypeDefs = readFileSync(
  path.join(__dirname, 'API_Gestion_de_Productos/Esquema_Producto.graphql'),
  'utf-8'
);

// 3. API Gestión de Pedidos
const pedidoResolvers = require('./API_Gestion_de_Pedidos/Resolvers_Pedido');
const pedidoTypeDefs = readFileSync(
  path.join(__dirname, 'API_Gestion_de_Pedidos/Esquema_Pedido.graphql'),
  'utf-8'
);

// 4. API Gestión de Pago
const pagoResolvers = require('./API_Gestion_de_Pago/Resolvers_Pago');
const pagoTypeDefs = readFileSync(
  path.join(__dirname, 'API_Gestion_de_Pago/Esquema_Pago.graphql'),
  'utf-8'
);

// 5. API de Reporte de Ventas (NUEVA - ÚLTIMA API)
const reporteResolvers = require('./API_de_Reporte_Ventas/Resolvers_Reporte');
const reporteTypeDefs = readFileSync(
  path.join(__dirname, 'API_de_Reporte_Ventas/Esquema_Reporte.graphql'),
  'utf-8'
);

// ==================== CONFIGURACIÓN APOLLO SERVER ====================

// Unir todos los esquemas y resolvers
const typeDefs = [usuarioTypeDefs, productoTypeDefs, pedidoTypeDefs, pagoTypeDefs, reporteTypeDefs];
const resolvers = [usuarioResolvers, productoResolvers, pedidoResolvers, pagoResolvers, reporteResolvers];

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => {
    console.log('❌ Error conectando a MongoDB:', err.message);
    process.exit(1);
  });

// Configurar Apollo Server
async function startServer() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => {
      // Aquí podemos agregar autenticación después
      return { req };
    },
    formatError: (error) => {
      // Formatear errores para el cliente
      console.error('GraphQL Error:', error);
      return {
        message: error.message,
        code: error.extensions?.code || 'INTERNAL_ERROR'
      };
    }
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  // Ruta de salud
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'OK',
      servidor: 'Bocatto GraphQL API',
      base_datos: mongoose.connection.readyState === 1 ? 'Conectada' : 'Desconectada',
      graphql: 'http://localhost:3000/graphql',
      apis_activas: ['usuarios', 'productos', 'pedidos', 'pagos', 'reportes'],
      timestamp: new Date().toISOString()
    });
  });

  // Iniciar servidor
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🕸️  GraphQL Playground: http://localhost:${PORT}/graphql`);
    console.log(`📦 APIs activas: Usuarios, Productos, Pedidos, Pagos, Reportes`);
    console.log(`🎉 ¡BACKEND COMPLETO - 5/5 APIs IMPLEMENTADAS!`);
  });
}

startServer().catch(error => {
  console.error('❌ Error iniciando servidor:', error);
});