const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { flujoPrincipal } = require('./flujos/flujo_principal');
const pool = require('./conexion/conexion');

async function startBaileys() {
  try {
    console.log('🗑 Iniciando sesión con Baileys...');
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('🔄 Conexión cerrada. Reintentando:', shouldReconnect);
        if (shouldReconnect) {
          setTimeout(startBaileys, 5000);
        } else {
          console.log('❌ Sesión cerrada permanentemente. Elimina la carpeta baileys_auth para reiniciar.');
        }
      } else if (connection === 'open') {
        console.log('📌 Sesión conectada correctamente con Baileys.');
      }
      if (qr) {
        console.log('📱 Escanea este QR para iniciar sesión:');
        qrcode.generate(qr, { small: true });
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify' || !messages || messages.length === 0) return;

      for (const msg of messages) {
        try {
          const user = msg.key?.remoteJid || msg.from;
          // Ignorar mensajes propios, de grupos o broadcasts
          if (!user || msg.key?.fromMe || user.includes('@g.us') || user.includes('@broadcast')) continue;
          if (!msg.message) continue;

          await flujoPrincipal(sock, msg, pool);
        } catch (err) {
          console.error('❌ Error procesando mensaje:', err);
        }
      }
    });

  } catch (err) {
    console.error('❌ Error al iniciar Baileys:', err);
    setTimeout(startBaileys, 5000);
  }
}

startBaileys();
