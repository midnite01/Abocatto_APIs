const Usuario = require('./Modelo_Usuario');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/* ====================================== RESOLVERS DE USUARIO =============================================
Este archivo contiene la lógica para manejar usuarios: Registro, Login, Perfil y Actualización de datos.
Conecta las peticiones GraphQL con la base de datos MongoDB.
=======================================================================================================
*/

const usuarioResolvers = {
  Query: {
    // Obtener el perfil del usuario que está logueado actualmente
    obtenerPerfil: async (_, args, context) => {
      try {
        // CORREGIDO: Verificar autenticación real usando el token del contexto
        if (!context.usuario) throw new Error('No autenticado');
        
        const usuario = await Usuario.findById(context.usuario.id);
        if (!usuario) {
          throw new Error('Usuario no encontrado');
        }
        return usuario;
      } catch (error) {
        throw new Error('Error obteniendo perfil: ' + error.message);
      }
    },
    
    // Obtener lista de todos los usuarios (Generalmente para uso interno/admin)
    obtenerUsuarios: async () => {
      try {
        return await Usuario.find().select('-password');
      } catch (error) {
        throw new Error('Error obteniendo usuarios: ' + error.message);
      }
    }
  },

  Mutation: {

    // Crear una cuenta nueva en la base de datos
    registrarUsuario: async (_, { nombre, email, password, telefono, run, sexo, fechaNacimiento, direccion, region, provincia }) => {
      try {
        const usuarioExistente = await Usuario.findOne({ email });
        if (usuarioExistente) throw new Error('El usuario ya está registrado');

        // Encriptar la contraseña antes de guardarla
        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(password, salt);

        const nuevoUsuario = new Usuario({
          nombre, email, password: passwordEncriptada, telefono,
          run, sexo, fechaNacimiento, direccion, region, provincia
        });

        await nuevoUsuario.save();

        // Generar token inmediato para auto-login
        const token = jwt.sign({ id: nuevoUsuario._id, rol: nuevoUsuario.rol }, process.env.JWT_SECRET, { expiresIn: '7d' });

        return { token, usuario: nuevoUsuario };
      } catch (error) {
        throw new Error('Error en registro: ' + error.message);
      }
    },

    // Autenticar usuario y devolver token JWT
    loginUsuario: async (_, { email, password }) => {
      try {
        // 1. Buscar usuario por email
        const usuario = await Usuario.findOne({ email });
        if (!usuario) {
          throw new Error('Credenciales incorrectas');
        }

        // 2. Comparar contraseñas
        const passwordValida = await bcrypt.compare(password, usuario.password);
        if (!passwordValida) {
          throw new Error('Credenciales incorrectas');
        }

        // 3. Generar Token
        const token = jwt.sign(
          { id: usuario._id, rol: usuario.rol },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        return {
          token,
          usuario
        };

      } catch (error) {
        throw new Error('Error en login: ' + error.message);
      }
    },

    // Cambiar contraseña del usuario autenticado
    cambiarPassword: async (_, { passwordActual, nuevoPassword }, context) => {
      try {
        // CORREGIDO: Usar usuario real del token (contexto)
        if (!context.usuario) throw new Error('No autenticado');
        const usuarioId = context.usuario.id;
        
        const usuario = await Usuario.findById(usuarioId);
        if (!usuario) {
          throw new Error('Usuario no encontrado');
        }

        // Verificar contraseña actual antes de cambiarla
        const passwordValida = await bcrypt.compare(passwordActual, usuario.password);
        if (!passwordValida) {
          throw new Error('Contraseña actual incorrecta');
        }

        if (nuevoPassword.length < 6) {
          throw new Error('La nueva contraseña debe tener al menos 6 caracteres');
        }

        // Encriptar y guardar nueva contraseña
        const salt = await bcrypt.genSalt(10);
        const nuevoPasswordEncriptado = await bcrypt.hash(nuevoPassword, salt);

        usuario.password = nuevoPasswordEncriptado;
        await usuario.save();

        return {
          success: true,
          message: 'Contraseña actualizada correctamente'
        };

      } catch (error) {
        return {
          success: false,
          message: 'Error cambiando contraseña: ' + error.message
        };
      }
    },

    // Actualizar datos del perfil (nombre, teléfono, dirección)
    actualizarUsuario: async (_, { nombre, email, telefono, direccion }, context) => {
      try {
        // CORREGIDO: Usar usuario real del token (contexto)
        if (!context.usuario) throw new Error('No autenticado');
        const usuarioId = context.usuario.id;

        if (email) {
            const emailOcupado = await Usuario.findOne({ email, _id: { $ne: usuarioId } });
            if (emailOcupado) throw new Error('Este correo electrónico ya está en uso por otro usuario');
        }
        
        const usuarioActualizado = await Usuario.findByIdAndUpdate(
          usuarioId,
          {
            ...(nombre && { nombre }),
            ...(email && { email }),
            ...(telefono && { telefono }),
            ...(direccion && { direccion })
          },
          { new: true, runValidators: true }
        ).select('-password');

        if (!usuarioActualizado) {
          throw new Error('Usuario no encontrado');
        }

        return usuarioActualizado;
      } catch (error) {
        throw new Error('Error actualizando perfil: ' + error.message);
      }
    }
  }
};

module.exports = usuarioResolvers;