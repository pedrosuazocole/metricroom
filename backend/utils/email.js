// utils/email.js - Notificaciones por correo electrónico (SMTP)
// Configuración vía variables de entorno: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
// También se puede configurar desde Configuración → Hotel → Email (tabla configuracion_hotel)
const nodemailer = require('nodemailer');
const { getDB } = require('../db/database');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const db = getDB();
  const cfg = {};
  db.prepare("SELECT clave, valor FROM configuracion_hotel WHERE clave LIKE 'smtp_%'").all()
    .forEach(r => cfg[r.clave] = r.valor);

  const host = cfg.smtp_host || process.env.SMTP_HOST;
  const port = parseInt(cfg.smtp_port || process.env.SMTP_PORT || '587');
  const user = cfg.smtp_user || process.env.SMTP_USER;
  const pass = cfg.smtp_pass || process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log('[Email] SMTP no configurado. Configure en Configuración → Hotel → Email.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host, port, secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

function getFromAddress() {
  const db = getDB();
  const cfg = db.prepare("SELECT valor FROM configuracion_hotel WHERE clave = 'smtp_from'").get();
  return cfg?.valor || process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@metricroom.com';
}

function getHotelNombre() {
  const db = getDB();
  const cfg = db.prepare("SELECT valor FROM configuracion_hotel WHERE clave = 'hotel_nombre'").get();
  return cfg?.valor || 'MetricRoom';
}

async function enviarCorreo(destinatario, asunto, html) {
  try {
    const t = getTransporter();
    if (!t || !destinatario) {
      logNotificacion(destinatario, asunto, 'ERROR', 'SMTP no configurado o sin destinatario');
      return false;
    }
    await t.sendMail({
      from: `"${getHotelNombre()}" <${getFromAddress()}>`,
      to: destinatario,
      subject: asunto,
      html,
    });
    logNotificacion(destinatario, asunto, 'ENVIADO', 'OK');
    console.log(`[Email] Enviado a ${destinatario}: ${asunto}`);
    return true;
  } catch (err) {
    console.error('[Email] Error al enviar:', err.message);
    logNotificacion(destinatario, asunto, 'ERROR', err.message);
    return false;
  }
}

function logNotificacion(destinatario, asunto, estado, respuesta) {
  try {
    const db = getDB();
    db.prepare(`
      INSERT INTO notificaciones_log (tipo, destinatario, mensaje, canal, estado, respuesta)
      VALUES ('EMAIL', ?, ?, 'EMAIL', ?, ?)
    `).run(destinatario, asunto, estado, respuesta);
  } catch { /* no fallar por log */ }
}

// ── Plantillas ──

async function sendReservaEmail(email, datos) {
  const { codigo, huesped, habitacionNumero, fechaEntrada, fechaSalida } = datos;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
      <h2 style="color:#1B3A6B">🏨 ${getHotelNombre()}</h2>
      <p>Hola <b>${huesped}</b>, tu reserva ha sido confirmada.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px;color:#666">Código</td><td style="padding:6px;font-weight:bold">${codigo}</td></tr>
        <tr><td style="padding:6px;color:#666">Habitación</td><td style="padding:6px;font-weight:bold">${habitacionNumero}</td></tr>
        <tr><td style="padding:6px;color:#666">Check-In</td><td style="padding:6px;font-weight:bold">${fechaEntrada}</td></tr>
        <tr><td style="padding:6px;color:#666">Check-Out</td><td style="padding:6px;font-weight:bold">${fechaSalida}</td></tr>
      </table>
      <p>¡Te esperamos!</p>
    </div>
  `;
  return enviarCorreo(email, `Reserva Confirmada — ${codigo}`, html);
}

async function sendCheckinEmail(email, datos) {
  const { huesped, habitacionNumero, fechaSalida } = datos;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
      <h2 style="color:#1B3A6B">🏨 ${getHotelNombre()}</h2>
      <p>Bienvenido/a <b>${huesped}</b>! 🎉</p>
      <p>Tu check-in en la habitación <b>${habitacionNumero}</b> fue exitoso.</p>
      <p>Fecha de salida prevista: <b>${fechaSalida}</b></p>
      <p>Cualquier necesidad, estamos a tu servicio.</p>
    </div>
  `;
  return enviarCorreo(email, `Check-In Confirmado — Hab. ${habitacionNumero}`, html);
}

async function sendFacturaEmail(email, numeroFactura, total, nombreCliente) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
      <h2 style="color:#1B3A6B">🏨 ${getHotelNombre()}</h2>
      <p>Gracias <b>${nombreCliente}</b> por su preferencia.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px;color:#666">Factura</td><td style="padding:6px;font-weight:bold">${numeroFactura}</td></tr>
        <tr><td style="padding:6px;color:#666">Total</td><td style="padding:6px;font-weight:bold">L. ${parseFloat(total).toFixed(2)}</td></tr>
      </table>
      <p>¡Esperamos verte pronto!</p>
    </div>
  `;
  return enviarCorreo(email, `Factura Electrónica — ${numeroFactura}`, html);
}

module.exports = { sendReservaEmail, sendCheckinEmail, sendFacturaEmail, enviarCorreo };
