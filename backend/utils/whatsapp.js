// utils/whatsapp.js - Integración CallMeBot para WhatsApp
const fetch = require('node-fetch');
const { getDB } = require('../db/database');

/**
 * Envía mensaje de WhatsApp via CallMeBot
 * @param {string} telefono - Número con código de país: +50498765432
 * @param {string} mensaje - Texto del mensaje
 */
async function sendWhatsApp(telefono, mensaje) {
  try {
    const db = getDB();
    const apiKeyRow = db.prepare("SELECT valor FROM configuracion_hotel WHERE clave = 'callmebot_api_key'").get();
    const apiKey = apiKeyRow?.valor;

    if (!apiKey) {
      console.log('[WhatsApp] API Key de CallMeBot no configurada. Mensaje no enviado.');
      logNotificacion(db, 'WHATSAPP', telefono, mensaje, 'ERROR', 'Sin API key configurada');
      return;
    }

    // Formatear teléfono: quitar espacios y guiones
    const tel = telefono.replace(/[\s\-\(\)]/g, '');

    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(tel)}&text=${encodeURIComponent(mensaje)}&apikey=${apiKey}`;

    const response = await fetch(url, { timeout: 10000 });
    const texto = await response.text();

    const estado = response.ok ? 'ENVIADO' : 'ERROR';
    logNotificacion(db, 'WHATSAPP', telefono, mensaje, estado, texto);

    console.log(`[WhatsApp] ${estado} → ${tel}: ${texto}`);
  } catch (err) {
    console.error('[WhatsApp] Error al enviar:', err.message);
    try {
      const db = getDB();
      logNotificacion(db, 'WHATSAPP', telefono, mensaje, 'ERROR', err.message);
    } catch { /* */ }
  }
}

function logNotificacion(db, tipo, destinatario, mensaje, estado, respuesta) {
  try {
    db.prepare(`
      INSERT INTO notificaciones_log (tipo, destinatario, mensaje, canal, estado, respuesta)
      VALUES (?, ?, ?, 'WHATSAPP', ?, ?)
    `).run(tipo, destinatario, mensaje, estado, respuesta);
  } catch { /* no fallar por log */ }
}

module.exports = { sendWhatsApp };
