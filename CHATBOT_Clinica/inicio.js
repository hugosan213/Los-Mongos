const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { flujoPrincipal } = require('./flujos/flujo_principal');

let reconexiones = 0;
const MAX_RECONEXIONES = 5;

async function startBaileys() {
  try {
    console.log('🗑 Iniciando sesión con Baileys...');
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth');
    const { version } = await fetchLatestBaileysVersion();
    console.log(`📌 Usando versión de WhatsApp: ${version.join('.')}`);

    const sock = makeWASocket({
      version,
      auth: state,
      syncFullHistory: false,
      printQRInTerminal: false, // QR manejado manualmente
    });

    sock.ev.on('creds.update', saveCreds);

    // Manejo de conexión
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('🔄 Conexión cerrada. Reintentando:', shouldReconnect, 'Error:', lastDisconnect?.error?.message);
        if (shouldReconnect && reconexiones < MAX_RECONEXIONES) {
          reconexiones++;
          const delay = 2000 * reconexiones; // backoff exponencial
          console.log(`⏱ Reintentando en ${delay / 1000} segundos...`);
          setTimeout(startBaileys, delay);
        } else {
          console.log('❌ Sesión cerrada permanentemente o máximo de reintentos alcanzado. Elimina la carpeta baileys_auth para reiniciar.');
        }
      } else if (connection === 'open') {
        console.log('✅ Sesión conectada correctamente con Baileys.');
        reconexiones = 0; // reset reconexiones al conectar
      }

      if (qr) {
        console.log('📱 Escanea este QR para iniciar sesión:');
        qrcode.generate(qr, { small: true });
      }
    });

    // Manejo de mensajes entrantes
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify' || !messages || messages.length === 0) return;

      for (const msg of messages) {
        try {
          // Ignorar mensajes propios, grupos o difusiones
          const user = msg.key?.remoteJid || msg.from;
          if (!user || msg.key.fromMe || user.includes('@g.us') || user.includes('@broadcast')) continue;
          if (!msg.message) continue;

          await flujoPrincipal(sock, msg);
        } catch (err) {
          console.error('❌ Error en flujoPrincipal:', err);
        }
      }
    });

    console.log('✅ Bot listo y escuchando mensajes...');

  } catch (err) {
    console.error('❌ Error al iniciar Baileys:', err.message);
    if (reconexiones < MAX_RECONEXIONES) {
      reconexiones++;
      const delay = 2000 * reconexiones;
      console.log(`⏱ Reintentando iniciar en ${delay / 1000} segundos...`);
      setTimeout(startBaileys, delay);
    } else {
      console.log('❌ Máximo de reintentos alcanzado. Detener proceso.');
    }
  }
}

startBaileys();
