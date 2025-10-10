import dotenv from 'dotenv';
import express from 'express';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const requiredEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'SMTP_TO'];
const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    ciphers: 'TLSv1.2',
  },
});

app.use(express.static('public'));
app.use(express.json());

app.post('/send', async (req, res) => {
  const { name, email, subject, message } = req.body || {};

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: process.env.SMTP_TO,
    replyTo: email,
    subject: `[Formulario] ${subject}`,
    text: `Nombre: ${name}\nCorreo: ${email}\n\n${message}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending email', error);
    res.status(500).json({ error: 'No se pudo enviar el correo.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
