import express from 'express';
import User from '../../models/User.js';
import { verificarToken } from '../../middlewares/auth.js';
import { verificarRol } from '../../middlewares/roles.js';
import { registrarLog } from '../../utils/logger.js';

const router = express.Router();

router.put('/:id', verificarToken, verificarRol(['admin', 'moderador']), async (req, res) => {
  try {
    const { nuevoEstado } = req.body;
    if (!['activo', 'suspendido', 'bloqueado'].includes(nuevoEstado)) return res.status(400).json({ mensaje: 'Estado no válido' });

    if (req.params.id === req.usuario.id) return res.status(400).json({ mensaje: 'No puedes cambiar el estado de tu propia cuenta' });
    const usuarioObjetivo = await User.findById(req.params.id);
    if (!usuarioObjetivo) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    if (usuarioObjetivo.rol !== 'usuario') {
      return res.status(403).json({ mensaje: 'Solo se pueden suspender cuentas con rol de usuario' });
    }
    usuarioObjetivo.estado = nuevoEstado;
    await usuarioObjetivo.save();
    await registrarLog('ESTADO_CUENTA_CAMBIADO', `Estado de ${usuarioObjetivo.nombreUsuario} cambiado a ${nuevoEstado} por ${req.usuario.rol}`, req, usuarioObjetivo._id);
    const usuarioSancionado = usuarioObjetivo.toObject();
    delete usuarioSancionado.password;

    res.status(200).json({ mensaje: `Usuario cambiado a estado: ${nuevoEstado}`, usuario: usuarioSancionado });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al aplicar sanción' });
  }
});

export default router;
