const Usuario = require('./Modelo_Usuario');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const usuarioResolvers = {
  Query: {
    obtenerPerfil: async (_, args, context) => {
      try {
        // TODO: Implementar verificación de token
        const usuario = await Usuario.findById(context.usuarioId);
        if (!usuario) {
          throw new Error('Usuario no encontrado');
        }
        return usuario;
      } catch (error) {
        throw new Error('Error obteniendo perfil: ' + error.message);
      }
    },
    
    obtenerUsuarios: async () => {
      try {
        return await Usuario.find().select('-password');
      } catch (error) {
        throw new Error('Error obteniendo usuarios: ' + error.message);
      }
    }
  },

  Mutation: {

    registrarUsuario: async (_, { nombre, email, password, telefono, run, sexo, fechaNacimiento, direccion, region, provincia }) => {
      try {
        const usuarioExistente = await Usuario.findOne({ email });
        if (usuarioExistente) throw new Error('El usuario ya está registrado');

        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(password, salt);

        const nuevoUsuario = new Usuario({
          nombre, email, password: passwordEncriptada, telefono,
          run, sexo, fechaNacimiento, direccion, region, provincia // <--- Agregamos los nuevos
        });

        await nuevoUsuario.save();

        const token = jwt.sign({ id: nuevoUsuario._id, rol: nuevoUsuario.rol }, process.env.JWT_SECRET, { expiresIn: '7d' });

        return { token, usuario: nuevoUsuario };
      } catch (error) {
        throw new Error('Error en registro: ' + error.message);
      }
    },

    loginUsuario: async (_, { email, password }) => {
      try {
        // Verificar si el usuario existe
        const usuario = await Usuario.findOne({ email });
        if (!usuario) {
          throw new Error('Credenciales incorrectas');
        }

        // Verificar contraseña
        const passwordValida = await bcrypt.compare(password, usuario.password);
        if (!passwordValida) {
          throw new Error('Credenciales incorrectas');
        }

        // Crear token JWT
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

    // =================== NUEVA MUTATION: CAMBIAR PASSWORD ===================
    cambiarPassword: async (_, { passwordActual, nuevoPassword }, context) => {
      try {
        // TODO: Verificar autenticación (context.usuarioId)
        // Por ahora usamos un ID hardcodeado para pruebas
        const usuarioId = "68fa67079780398b05f4f0d1"; // ID de Juan Pérez
        
        const usuario = await Usuario.findById(usuarioId);
        if (!usuario) {
          throw new Error('Usuario no encontrado');
        }

        // Verificar contraseña actual
        const passwordValida = await bcrypt.compare(passwordActual, usuario.password);
        if (!passwordValida) {
          throw new Error('Contraseña actual incorrecta');
        }

        // Validar nueva contraseña
        if (nuevoPassword.length < 6) {
          throw new Error('La nueva contraseña debe tener al menos 6 caracteres');
        }

        // Encriptar nueva contraseña
        const salt = await bcrypt.genSalt(10);
        const nuevoPasswordEncriptado = await bcrypt.hash(nuevoPassword, salt);

        // Actualizar contraseña
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
    // ========================================================================

    actualizarUsuario: async (_, { nombre, telefono, direccion }, context) => {
      try {
        // TODO: Verificar autenticación (context.usuarioId)
        // Por ahora usamos un ID hardcodeado para pruebas
        const usuarioId = "68fa67079780398b05f4f0d1"; // ID de Juan Pérez
        
        const usuarioActualizado = await Usuario.findByIdAndUpdate(
          usuarioId,
          {
            ...(nombre && { nombre }),
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