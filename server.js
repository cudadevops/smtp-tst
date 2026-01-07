import dotenv from 'dotenv';
import express from 'express';
import nodemailer from 'nodemailer';

dotenv.config();

const LISTEN_PORT = Number.parseInt(process.env.API_PORT ?? '7522', 10);
const LISTEN_HOST = process.env.API_HOST ?? '127.0.0.1';
const EXTRA_FIELD_LIMIT = Number.parseInt(process.env.EXTRA_FIELD_LIMIT ?? '30', 10);

const DEFAULT_MESSAGES = {
  successBrevo: 'Correo enviado mediante Brevo.',
  successSmtp: 'Correo enviado mediante SMTP.',
  missingRequired: 'Faltan campos obligatorios: %fields%',
  invalidType: 'Todos los campos deben ser cadenas de texto.',
  extraLimit: 'Solo se permiten %limit% campos adicionales.',
  sendError: 'No se pudo enviar el correo electrónico.',
  notFound: 'Ruta no encontrada.',
};

const RESPONSE_MESSAGES = {
  successBrevo: process.env.MESSAGE_SUCCESS_BREVO?.trim() || DEFAULT_MESSAGES.successBrevo,
  successSmtp: process.env.MESSAGE_SUCCESS_SMTP?.trim() || DEFAULT_MESSAGES.successSmtp,
  missingRequired:
    process.env.MESSAGE_ERROR_MISSING_REQUIRED?.trim() || DEFAULT_MESSAGES.missingRequired,
  invalidType: process.env.MESSAGE_ERROR_INVALID_TYPE?.trim() || DEFAULT_MESSAGES.invalidType,
  extraLimit: process.env.MESSAGE_ERROR_EXTRA_LIMIT?.trim() || DEFAULT_MESSAGES.extraLimit,
  sendError: process.env.MESSAGE_ERROR_SEND?.trim() || DEFAULT_MESSAGES.sendError,
  notFound: process.env.MESSAGE_ERROR_NOT_FOUND?.trim() || DEFAULT_MESSAGES.notFound,
};

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

const brevoApiKey = process.env.BREVO_API_KEY?.trim() ?? '';

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

const allowedOrigin = process.env.CORS_ALLOW_ORIGIN?.trim() ?? '*';

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

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

function stripQuotes(text) {
  return text.replace(/^['\"]+|['\"]+$/g, '').trim();
}

function parseAddress(value) {
  if (typeof value !== 'string') {
    return { email: '', name: '' };
  }

  const trimmed = value.trim();
  const angleMatch = trimmed.match(/^(.*)<([^<>]+)>$/);

  if (angleMatch) {
    const name = stripQuotes(angleMatch[1].trim());
    const email = angleMatch[2].trim();
    return {
      email,
      name,
    };
  }

  const emailOnly = stripQuotes(trimmed.replace(/[<>]/g, ''));
  return { email: emailOnly, name: '' };
}

function parseAddressList(value) {
  if (!value) {
    return [];
  }

  const parts = Array.isArray(value) ? value : String(value).split(',');
  return parts
    .map((part) => parseAddress(part))
    .filter((address) => address.email.length > 0)
    .map((address) => ({
      email: address.email,
      ...(address.name ? { name: address.name } : {}),
    }));
}

function formatMessage(template, replacements = {}) {
  return Object.entries(replacements).reduce((acc, [key, value]) => {
    const token = `%${key}%`;
    return acc.split(token).join(String(value));
  }, template);
}

async function sendViaBrevo(mailOptions) {
  if (!brevoApiKey) {
    throw new Error('Brevo API key no configurada');
  }

  if (typeof fetch !== 'function') {
    throw new Error('fetch no está disponible en este entorno de ejecución');
  }

  const sender = parseAddress(mailOptions.from);
  if (!sender.email) {
    throw new Error('No se pudo determinar el remitente para Brevo.');
  }

  const to = parseAddressList(mailOptions.to);
  if (to.length === 0) {
    throw new Error('No se encontraron destinatarios válidos para Brevo.');
  }

  const payload = {
    sender: {
      email: sender.email,
      ...(sender.name ? { name: sender.name } : {}),
    },
    to,
    subject: mailOptions.subject ?? '',
    htmlContent: mailOptions.html ?? '',
    ...(mailOptions.text ? { textContent: mailOptions.text } : {}),
  };

  const replyTo = parseAddress(mailOptions.replyTo);
  if (replyTo.email) {
    payload.replyTo = {
      email: replyTo.email,
      ...(replyTo.name ? { name: replyTo.name } : {}),
    };
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': brevoApiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Brevo API respondió ${response.status}: ${errorBody}`);
  }

  let parsedBody;
  try {
    parsedBody = await response.json();
  } catch (error) {
    parsedBody = undefined;
  }

  const messageId = parsedBody?.messageId ?? parsedBody?.messageIds?.[0] ?? null;

  return {
    method: 'brevo',
    messageId,
    message: RESPONSE_MESSAGES.successBrevo,
  };
}

async function sendEmail(mailOptions) {
  if (brevoApiKey) {
    try {
      return await sendViaBrevo(mailOptions);
    } catch (error) {
      console.error('Error al enviar con Brevo, intentando SMTP como respaldo.', error);
    }
  }

  const info = await transporter.sendMail(mailOptions);

  if (!info?.accepted || info.accepted.length === 0) {
    throw new Error('El servidor SMTP no aceptó ningún destinatario.');
  }

  return {
    method: 'smtp',
    accepted: info.accepted,
    messageId: info.messageId ?? null,
    message: RESPONSE_MESSAGES.successSmtp,
  };
}

app.post('/api/email', async (req, res) => {
  const payload = req.body ?? {};

  const missingRequired = orderedFieldNames.filter((field) => !isValidString(payload[field]));
  if (missingRequired.length) {
    return res.status(400).json({
      error: formatMessage(RESPONSE_MESSAGES.missingRequired, {
        fields: missingRequired.join(', '),
      }),
    });
  }

  const entries = Object.entries(payload);

  if (entries.some(([, value]) => typeof value !== 'string')) {
    return res.status(400).json({
      error: RESPONSE_MESSAGES.invalidType,
    });
  }

  const reservedKeys = new Set([
    ...orderedFieldNames,
    'name',
    'phone',
    'email',
    'message',
  ]);

  const orderedEntries = orderedFieldNames.map((name) => [name, payload[name].trim()]);
  const additionalEntries = entries.filter(([key]) => !reservedKeys.has(key));

  if (additionalEntries.length > EXTRA_FIELD_LIMIT) {
    return res.status(400).json({
      error: formatMessage(RESPONSE_MESSAGES.extraLimit, {
        limit: EXTRA_FIELD_LIMIT,
      }),
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
    const deliveryResult = await sendEmail(mailOptions);
    return res.json({
      success: true,
      method: deliveryResult.method,
      message: deliveryResult.message,
      ...(deliveryResult.messageId ? { messageId: deliveryResult.messageId } : {}),
      ...(deliveryResult.accepted ? { accepted: deliveryResult.accepted } : {}),
    });
  } catch (error) {
    console.error('Error al enviar el correo', error);
    return res.status(500).json({ error: RESPONSE_MESSAGES.sendError });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: RESPONSE_MESSAGES.notFound });
});

app.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`API escuchando en http://${LISTEN_HOST}:${LISTEN_PORT}`);
});
