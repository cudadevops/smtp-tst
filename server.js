import dotenv from 'dotenv';
import express from 'express';
import nodemailer from 'nodemailer';

dotenv.config();

const LISTEN_PORT = Number.parseInt(process.env.API_PORT ?? '7522', 10);
const LISTEN_HOST = process.env.API_HOST ?? '127.0.0.1';
const EXTRA_FIELD_LIMIT = Number.parseInt(process.env.EXTRA_FIELD_LIMIT ?? '30', 10);

if (Number.isNaN(LISTEN_PORT) || LISTEN_PORT <= 0) {
  console.error('API_PORT debe ser un número de puerto válido.');
  process.exit(1);
}

if (Number.isNaN(EXTRA_FIELD_LIMIT) || EXTRA_FIELD_LIMIT < 0 || EXTRA_FIELD_LIMIT > 30) {
  console.error('EXTRA_FIELD_LIMIT debe ser un número entre 0 y 30.');
  process.exit(1);
}

const REQUIRED_ENV = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'SMTP_TO'];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);

if (missingEnv.length) {
  console.error(`Faltan variables de entorno requeridas: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number.parseInt(process.env.SMTP_PORT ?? '587', 10),
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    minVersion: 'TLSv1.2',
  },
});

const app = express();

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
    limit: '50kb',
  }),
);

const orderedFieldNames = ['remitente', 'nombre', 'correo', 'telefono', 'mensaje'];

function isValidString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtmlContent(entries) {
  const rows = entries
    .map(([key, value]) => {
      const safeKey = escapeHtml(key);
      const safeValue = escapeHtml(value);
      return (
        '<tr>' +
        `<th style="text-align:left;padding:4px 8px;background:#f6f6f6;">${safeKey}</th>` +
        `<td style="padding:4px 8px;">${safeValue}</td>` +
        '</tr>'
      );
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Nuevo mensaje de formulario</title>
  </head>
  <body style="font-family: Arial, sans-serif; background: #ffffff; color: #222;">
    <h2 style="color:#0a6cff;">Nuevo mensaje recibido</h2>
    <table style="border-collapse:collapse; min-width:320px;" cellspacing="0" cellpadding="0">
      ${rows}
    </table>
  </body>
</html>`;
}

function buildTextContent(entries) {
  return entries.map(([key, value]) => `${key}: ${value}`).join('\n');
}

app.post('/api/email', async (req, res) => {
  const payload = req.body ?? {};

  const missingRequired = orderedFieldNames.filter((field) => !isValidString(payload[field]));
  if (missingRequired.length) {
    return res.status(400).json({
      error: `Faltan campos obligatorios: ${missingRequired.join(', ')}`,
    });
  }

  const entries = Object.entries(payload);

  if (entries.some(([, value]) => typeof value !== 'string')) {
    return res.status(400).json({
      error: 'Todos los campos deben ser cadenas de texto.',
    });
  }

  const orderedEntries = orderedFieldNames.map((name) => [name, payload[name].trim()]);
  const additionalEntries = entries.filter(([key]) => !orderedFieldNames.includes(key));

  if (additionalEntries.length > EXTRA_FIELD_LIMIT) {
    return res.status(400).json({
      error: `Solo se permiten ${EXTRA_FIELD_LIMIT} campos adicionales.`,
    });
  }

  const sanitizedAdditional = additionalEntries.map(([key, value]) => [key, value.trim()]);

  const finalEntries = [...orderedEntries, ...sanitizedAdditional];

  const subjectPrefix = process.env.SUBJECT_PREFIX ?? 'Nuevo mensaje de formulario';
  const correo = payload.correo.trim();

  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: process.env.SMTP_TO,
    replyTo: correo,
    subject: `${subjectPrefix} - ${payload.nombre.trim()}`,
    html: buildHtmlContent(finalEntries),
    text: buildTextContent(finalEntries),
  };

  try {
    await transporter.sendMail(mailOptions);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error al enviar el correo', error);
    return res.status(500).json({ error: 'No se pudo enviar el correo electrónico.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

app.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`API escuchando en http://${LISTEN_HOST}:${LISTEN_PORT}`);
});
