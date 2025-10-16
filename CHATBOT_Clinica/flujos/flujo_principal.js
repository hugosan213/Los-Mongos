const { flujoReservarTurno} = require('./flujo_reservar_clinica');
const { flujoEliminarReservaClinica } = require('./flujoEliminarReservaClinica');

const estadosUsuario = {}; // Estado global de usuarios

// --- Configuraciones ---
const TIEMPO_MAXIMO_INACTIVIDAD = 1000 * 60 * 60 * 24; // 24 horas
const saludos = ["hola", "buenas", "buen dia", "buenas tardes", "buenas noches"];

// --- Manejo de saludo ---
async function manejarSaludo(client, user, estado, texto) {
    const textoNormalizado = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
    const esSaludo = saludos.some(p => textoNormalizado.includes(p));
    if (!esSaludo) return false;

    // Si hay reserva provisional, preguntar si desea reiniciar
    if (estado.datos?.idReserva) {
        await client.sendMessage(user, {
            text: '⚠️ Tienes una reserva provisional en curso. ¿Deseas reiniciarla y empezar de nuevo? Responde "sí" o "no".'
        });
        estado.pasoReinicioConfirmacion = true;
        return true;
    }

    // Si no hay reserva provisional, reiniciar flujo
    estado.paso = 0;
    estado.datos = { rubro: 'Clinica' };
    estado.flujoActual = null;

    await client.sendMessage(user, { 
        // 🔹 NUEVO: agrego opción 3 de ayuda
        text: "👋 ¡Hola! Bienvenido al sistema de turnos de la clínica 🏥\nEscribe:\n1️⃣ Para iniciar reserva\n2️⃣ Para eliminar reserva\n3️⃣ Para recibir ayuda"
    }); 

    return true;
}

// --- Flujo principal ---
async function flujoPrincipal(client, message) {
    const user = message.key?.remoteJid || message.from;
    if (!user) return;

    // ❌ Ignorar grupos o difusiones
    if (user.includes('@g.us') || user.includes('@broadcast')) return;

    // Obtener texto normalizado
    let texto = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').toLowerCase().trim();

    // Inicializar estado si no existe
    if (!estadosUsuario[user]) {
        estadosUsuario[user] = { paso: 0, datos: { rubro: 'Clinica' }, ultimaActualizacion: Date.now(), flujoActual: null };
    }

    // Actualizar timestamp de última interacción
    estadosUsuario[user].ultimaActualizacion = Date.now();

    const estado = estadosUsuario[user];

    try {
        // --- Manejar saludo ---
        const saludoDetectado = await manejarSaludo(client, user, estado, texto);
        if (saludoDetectado) return;

        // --- Selección principal ---
        if (estado.paso === 0) {
            if (texto === '1') {
                // Iniciar reserva
                estado.flujoActual = 'reservar';
                estado.paso = 1;
                await flujoReservarTurno(client, message, estado);
                return;

            } else if (texto === '2') {
                // Eliminar reserva
                estado.flujoActual = 'eliminar';
                await flujoEliminarReservaClinica(client, message, estado);
                return;

            // 🔹 NUEVO: opción 3 - Ayuda
            } else if (texto === '3') {
                await client.sendMessage(user, { 
                    text: "ℹ️ Ayuda del sistema de turnos\n\n" +
                          "✅ Opción 1: Iniciar una nueva reserva. El sistema te guiará paso a paso para elegir especialidad, médico, día y horario.\n\n" +
                          "🗑 Opción 2: Eliminar una reserva existente. Solo necesitarás ingresar tu DNI o los datos de tu turno.\n\n" +
                          "💬 Opción 3: Mostrar este mensaje de ayuda.\n\n" +
                          "💡 En cualquier momento puedes escribir 'hola' para volver al menú principal."
                });
                return;

            } else {
                await client.sendMessage(user, { text: '❌ Opción inválida. Escribe 1, 2 o 3.' });
                return;
            }
        }

        // --- Continuar flujo según flujoActual ---
        if (estado.flujoActual === 'reservar') {
            await flujoReservarTurno(client, message, estado);
        } else if (estado.flujoActual === 'eliminar') {
            await flujoEliminarReservaClinica(client, message, estado);
        } else {
            // Por si el estado quedó desincronizado
            estado.paso = 0;
            estado.flujoActual = null;
            await client.sendMessage(user, { text: '❌ Error de estado. Escribe "hola" para reiniciar.' });
        }

    } catch (err) {
        console.error(`❌ Error en flujoPrincipal para ${user}:`, err);
        await client.sendMessage(user, { text: '❌ Ocurrió un error. Intenta nuevamente más tarde.' });
    }
}

// --- Función para limpiar usuarios inactivos ---
function limpiarUsuariosInactivos() {
    const ahora = Date.now();
    for (const user in estadosUsuario) {
        if (ahora - estadosUsuario[user].ultimaActualizacion > TIEMPO_MAXIMO_INACTIVIDAD) {
            delete estadosUsuario[user];
            console.log(`🗑 Eliminado estado de usuario inactivo: ${user}. Usuarios activos: ${Object.keys(estadosUsuario).length}`);
        }
    }
}

// Ejecutar limpieza cada hora
setInterval(limpiarUsuariosInactivos, 1000 * 60 * 60);

module.exports = { flujoPrincipal, estadosUsuario };