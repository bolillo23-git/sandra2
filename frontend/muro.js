const usuarioLocal = JSON.parse(localStorage.getItem('usuarioLogueado'));
const token = localStorage.getItem('tokenAutenticacion'); // Leemos el token

if (!usuarioLocal || !token) {
    window.location.href = 'login.html';
} else {
    document.getElementById('nombreUsuarioDisplay').innerText = usuarioLocal.nombreUsuario;
    document.getElementById('perfilNombre').innerText = usuarioLocal.nombreUsuario;

    const elementoRol = document.getElementById('perfilRol');
    if (usuarioLocal.rol.toLowerCase() === 'usuario') {
        elementoRol.style.display = 'none';
    } else {
        elementoRol.innerText = usuarioLocal.rol.toUpperCase();
        elementoRol.style.display = 'block';
    }

    fetch(`${API_URL}/api/perfil/${usuarioLocal.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(res => res.json())
        .then(datosUsuario => {
            const imgMuro = document.getElementById('imgPerfilMuroIzq');
            if (imgMuro && datosUsuario.fotoPerfil) {
                imgMuro.src = datosUsuario.fotoPerfil;
            }
        })
        .catch(err => console.error('Error al cargar la foto de perfil en el muro:', err));
}

function cerrarSesion() {
    localStorage.removeItem('usuarioLogueado');
    localStorage.removeItem('tokenAutenticacion');
    window.location.href = 'login.html';
}

const formularioPublicacion = document.getElementById('formularioPublicacion');
const contenedorPublicaciones = document.getElementById('contenedorPublicaciones');

async function cargarPublicaciones() {
    try {
        const resSocial = await fetch(`${API_URL}/api/amigos/mis-datos`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const misDatos = await resSocial.json();
        const misAmigosIds = misDatos.amigos.map(amigo => amigo._id);

        const respuesta = await fetch(`${API_URL}/api/publicaciones`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const publicaciones = await respuesta.json();

        // Older API responses may omit role and state in the populated author;
        // fetch the author's profile so account actions are based on DB data.
        const perfilesAutores = new Map();
        const idsAutores = [...new Set(publicaciones.map(pub => pub.autor?._id).filter(Boolean))];
        await Promise.all(idsAutores.map(async id => {
            try {
                const perfilRespuesta = await fetch(`${API_URL}/api/perfil/${id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (perfilRespuesta.ok) perfilesAutores.set(id, await perfilRespuesta.json());
            } catch (error) {
                console.warn('No se pudo consultar el perfil del autor:', id);
            }
        }));

        contenedorPublicaciones.innerHTML = '';

        publicaciones.forEach(pub => {
            const nombreAutor = pub.autor ? pub.autor.nombreUsuario : 'Usuario Eliminado';
            const fecha = new Date(pub.fechaCreacion).toLocaleString('es-MX');
            const esDeOtro = pub.autor && pub.autor._id !== usuarioLocal.id;
            const yaSomosAmigos = pub.autor && misAmigosIds.includes(pub.autor._id);
            const rolActual = (usuarioLocal.rol || '').toLowerCase();
            const perfilAutor = perfilesAutores.get(pub.autor?._id) || pub.autor;
            const rolAutor = (perfilAutor?.rol || '').toLowerCase();
            const estadoAutor = perfilAutor?.estado || 'activo';
            const puedeModerar = ['moderador', 'admin'].includes(rolActual);
            const esCuentaDeUsuario = rolAutor === 'usuario';
            const puedeGestionarCuenta = puedeModerar && pub.autor && pub.autor._id !== usuarioLocal.id && esCuentaDeUsuario;
            const botonSuspenderCuenta = puedeGestionarCuenta
                ? `<button class="btn btn-sm ${estadoAutor === 'activo' ? 'btn-outline-warning' : 'btn-outline-success'} ms-2"
                    onclick="cambiarEstadoCuenta('${pub.autor._id}', '${estadoAutor === 'activo' ? 'suspendido' : 'activo'}')"
                    title="${estadoAutor === 'activo' ? 'Suspender cuenta' : 'Reactivar cuenta'}">
                    <i class="bi ${estadoAutor === 'activo' ? 'bi-person-slash' : 'bi-person-check'}"></i>
                    ${estadoAutor === 'activo' ? 'Suspender cuenta' : 'Reactivar cuenta'}
                   </button>`
                : '';

            const botonAgregar = (esDeOtro && !yaSomosAmigos)
                ? `<button class="btn btn-light btn-sm text-primary ms-2" onclick="enviarSolicitud('${pub.autor._id}')" title="Agregar amigo"><i class="bi bi-person-plus"></i></button>`
                : '';
            const botonEliminarPublicacion = puedeModerar
                ? `<button class="btn btn-outline-danger btn-sm ms-2" onclick="eliminarPublicacionModerada('${pub._id}')" title="Eliminar publicación"><i class="bi bi-trash"></i></button>`
                : '';

            const div = document.createElement('div');
            div.className = 'card p-3 mb-3 shadow-sm border-0';
            div.innerHTML = `
                <div class="d-flex align-items-center mb-2">
                    <a href="perfil.html?id=${pub.autor._id}" class="text-decoration-none text-dark d-flex align-items-center me-2">
                        <i class="bi bi-person-circle fs-4 me-2 text-secondary"></i>
                        <h6 class="mb-0 fw-bold hover-primary text-decoration-underline-hover">${nombreAutor}</h6>
                    </a>
                    ${botonAgregar}
                    ${botonEliminarPublicacion}
                    ${botonSuspenderCuenta}
                    <small class="text-muted ms-auto">${fecha}</small>
                </div>
                <p class="mb-1">${pub.contenido}</p>
            `;
            contenedorPublicaciones.appendChild(div);
        });
    } catch (error) {
        console.error('Error al cargar publicaciones:', error);
    }
}

async function eliminarPublicacionModerada(idPublicacion) {
    if (!confirm('¿Eliminar esta publicación? Esta acción no se puede deshacer.')) return;
    try {
        const respuesta = await fetch(`${API_URL}/api/moderador/publicaciones/${idPublicacion}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) return alert(datos.mensaje || 'No se pudo eliminar la publicación');
        await cargarPublicaciones();
    } catch (error) {
        console.error('Error al eliminar publicación:', error);
        alert('Ocurrió un error de conexión.');
    }
}

async function cambiarEstadoCuenta(idUsuario, nuevoEstado) {
    const accion = nuevoEstado === 'suspendido' ? 'suspender' : 'reactivar';
    if (!confirm(`¿Quieres ${accion} este perfil?`)) return;
    try {
        const respuesta = await fetch(`${API_URL}/api/moderador/sanciones/${idUsuario}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ nuevoEstado })
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) return alert(datos.mensaje || 'No se pudo cambiar el estado del perfil');
        alert(datos.mensaje || (nuevoEstado === 'suspendido' ? 'Cuenta suspendida correctamente.' : 'Cuenta reactivada correctamente.'));
        await cargarPublicaciones();
    } catch (error) {
        console.error('Error al cambiar estado:', error);
        alert('Ocurrió un error de conexión.');
    }
}

formularioPublicacion.addEventListener('submit', async (e) => {
    e.preventDefault();
    const contenido = document.getElementById('contenidoPost').value;

    try {
        const respuesta = await fetch(`${API_URL}/api/publicaciones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ contenido: contenido }) // Eliminado autorId
        });

        if (respuesta.status === 201) {
            document.getElementById('contenidoPost').value = '';
            cargarPublicaciones();
        } else {
            const datos = await respuesta.json();
            alert(datos.mensaje);
        }
    } catch (error) {
        console.error('Error al crear publicación:', error);
        alert('Ocurrió un error de conexión.');
    }
});

cargarPublicaciones();

async function cargarDatosSociales() {
    try {
        const respuesta = await fetch(`${API_URL}/api/amigos/mis-datos`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const datos = await respuesta.json();

        const listaSolicitudes = document.getElementById('listaSolicitudes');
        const listaAmigos = document.getElementById('listaAmigos');

        listaSolicitudes.innerHTML = '';
        listaAmigos.innerHTML = '';

        if (datos.solicitudes.length === 0) {
            listaSolicitudes.innerHTML = '<p class="text-muted small">No tienes solicitudes nuevas.</p>';
        } else {
            datos.solicitudes.forEach(solicitante => {
                listaSolicitudes.innerHTML += `
                    <div class="d-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded shadow-sm">
                        <span class="fw-semibold">${solicitante.nombreUsuario}</span>
                        <button class="btn btn-success btn-sm" onclick="aceptarSolicitud('${solicitante._id}')">
                            <i class="bi bi-check-lg"></i> Aceptar
                        </button>
                    </div>
                `;
            });
        }

        if (datos.amigos.length === 0) {
            listaAmigos.innerHTML = '<p class="text-muted small">Aún no has agregado amigos.</p>';
        } else {
            datos.amigos.forEach(amigo => {
                listaAmigos.innerHTML += `
                    <div class="d-flex justify-content-between align-items-center mb-2 p-2 border-bottom">
                        <span class="fw-bold"><i class="bi bi-person-circle text-secondary me-2"></i> ${amigo.nombreUsuario}</span>
                        <button class="btn btn-outline-primary btn-sm" onclick="abrirChat('${amigo._id}', '${amigo.nombreUsuario}')">
                            <i class="bi bi-chat-text"></i> Mensaje
                        </button>
                    </div>
                `;
            });
        }
    } catch (error) {
        console.error('Error al cargar datos sociales:', error);
    }
}

async function aceptarSolicitud(idSolicitante) {
    try {
        const respuesta = await fetch(`${API_URL}/api/amigos/aceptar/${idSolicitante}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const datos = await respuesta.json();
        alert(datos.mensaje);
        cargarDatosSociales();
    } catch (error) {
        console.error('Error al aceptar solicitud:', error);
    }
}

async function enviarSolicitud(idDestino) {
    try {
        const respuesta = await fetch(`${API_URL}/api/amigos/solicitar/${idDestino}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const datos = await respuesta.json();
        alert(datos.mensaje);
    } catch (error) {
        console.error('Error al enviar solicitud:', error);
    }
}

let amigoActualId = null;
let intervaloChat = null;

async function abrirChat(idAmigo, nombreAmigo) {
    amigoActualId = idAmigo;
    document.getElementById('nombreChatAmigo').innerText = nombreAmigo;

    const modalChat = new bootstrap.Modal(document.getElementById('modalChat'));
    modalChat.show();

    await cargarHistorialChat();

    if (intervaloChat) clearInterval(intervaloChat);
    intervaloChat = setInterval(cargarHistorialChat, 2000);
}

document.getElementById('modalChat').addEventListener('hidden.bs.modal', () => {
    if (intervaloChat) clearInterval(intervaloChat);
    amigoActualId = null;
});

async function cargarHistorialChat() {
    if (!amigoActualId) return;
    const cuerpoChat = document.getElementById('cuerpoChat');

    try {
        // La URL ahora solo pide el ID del amigo
        const respuesta = await fetch(`${API_URL}/api/mensajes/${amigoActualId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const mensajes = await respuesta.json();

        let htmlChat = '';

        if (mensajes.length === 0) {
            htmlChat = '<div class="text-center text-muted mt-3 bg-white p-2 rounded w-75 mx-auto shadow-sm">Di hola para iniciar la conversación 👋</div>';
        } else {
            mensajes.forEach(msg => {
                const esMio = msg.remitente === usuarioLocal.id;
                const alineacion = esMio ? 'text-end' : 'text-start';
                const colorBurbuja = esMio ? 'bg-primary text-white shadow-sm' : 'bg-white text-dark shadow-sm border';

                htmlChat += `
                    <div class="mb-3 ${alineacion}">
                        <div class="d-inline-block p-2 rounded-3 ${colorBurbuja}" style="max-width: 75%; text-align: left; word-wrap: break-word;">
                            ${msg.contenido}
                        </div>
                    </div>
                `;
            });
        }

        if (cuerpoChat.innerHTML !== htmlChat) {
            cuerpoChat.innerHTML = htmlChat;
            cuerpoChat.scrollTop = cuerpoChat.scrollHeight;
        }

    } catch (error) {
        console.error('Error al cargar chat:', error);
    }
}

const formEnviarMensaje = document.getElementById('formEnviarMensaje');
formEnviarMensaje.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputMensaje = document.getElementById('inputMensaje');
    const contenido = inputMensaje.value.trim();

    if (!contenido || !amigoActualId) return;

    try {
        const respuesta = await fetch(`${API_URL}/api/mensajes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                destinatario: amigoActualId,
                contenido: contenido // Eliminado remitente
            })
        });

        if (respuesta.status === 201) {
            inputMensaje.value = '';
            await cargarHistorialChat();
        }
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
    }
});

const formBuscarPersonas = document.getElementById('formBuscarPersonas');
const cuerpoResultados = document.getElementById('cuerpoResultados');

formBuscarPersonas.addEventListener('submit', async (e) => {
    e.preventDefault();
    const textoBuscado = document.getElementById('inputBuscarPersonas').value.trim();
    if (!textoBuscado) return;

    try {
        const resSocial = await fetch(`${API_URL}/api/amigos/mis-datos`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const misDatos = await resSocial.json();
        const misAmigosIds = misDatos.amigos.map(a => a._id);

        const respuesta = await fetch(`${API_URL}/api/usuarios/buscar?nombre=${textoBuscado}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const usuarios = await respuesta.json();

        cuerpoResultados.innerHTML = '';

        if (usuarios.length === 0) {
            cuerpoResultados.innerHTML = '<p class="text-center text-muted my-3">No se encontraron personas con ese nombre.</p>';
        } else {
            let hayResultados = false;

            usuarios.forEach(user => {
                if (user._id === usuarioLocal.id) return;

                hayResultados = true;
                const yaSomosAmigos = misAmigosIds.includes(user._id);

                const botonAccion = yaSomosAmigos
                    ? `<span class="badge bg-success"><i class="bi bi-check-lg"></i> Amigos</span>`
                    : `<button class="btn btn-outline-primary btn-sm" onclick="enviarSolicitud('${user._id}')">
                        <i class="bi bi-person-plus"></i> Agregar
                       </button>`;

                cuerpoResultados.innerHTML += `
                    <div class="d-flex justify-content-between align-items-center mb-3 p-2 border rounded shadow-sm">
                        <div class="fw-bold d-flex align-items-center">
                            <i class="bi bi-person-circle text-secondary me-2 fs-3"></i>
                            ${user.nombreUsuario}
                        </div>
                        ${botonAccion}
                    </div>
                `;
            });

            if (!hayResultados) {
                cuerpoResultados.innerHTML = '<p class="text-center text-muted my-3">No hay más resultados.</p>';
            }
        }

        const modalBuscador = new bootstrap.Modal(document.getElementById('modalResultados'));
        modalBuscador.show();

    } catch (error) {
        console.error('Error en la búsqueda:', error);
    }
});
