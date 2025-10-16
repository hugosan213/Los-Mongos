// flujoUtils.js
const estadosTurno = {};

// Función para reiniciar el flujo de un usuario
function reiniciarFlujo(user, rubro) {
  estadosTurno[user] = { paso: 0, datos: { rubro: rubro || '' } };
  return estadosTurno[user];
}

// Obtener el texto del mensaje (Baileys)
function getTextoMensaje(message) {
  if (message.message?.conversation) return message.message.conversation;
  if (message.message?.extendedTextMessage?.text) return message.message.extendedTextMessage.text;
  if (message.body) return message.body;
  return '';
}

module.exports = { estadosTurno, reiniciarFlujo, getTextoMensaje };
