import User from '../models/User.js';

export const verificarRol = (rolesPermitidos) => {
    return async (req, res, next) => {
        try {
            if (!req.usuario) return res.status(401).json({ mensaje: 'Inicia sesión para continuar' });
            const usuario = await User.findById(req.usuario.id).select('rol estado');
            if (!usuario || usuario.estado !== 'activo') return res.status(403).json({ mensaje: 'La cuenta no está activa' });
            req.usuario.rol = usuario.rol;
            if (!rolesPermitidos.includes(usuario.rol)) {
            return res.status(403).json({ mensaje: 'Acceso denegado: No tienes los permisos necesarios' });
            }
            next();
        } catch (error) {
            return res.status(500).json({ mensaje: 'No se pudieron verificar los permisos' });
        }
    };
};
