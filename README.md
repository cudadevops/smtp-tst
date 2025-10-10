# smtp-tst

Aplicación mínima en Node.js que expone un formulario HTML y envía correos por SMTP usando STARTTLS (puerto 587).

## Configuración

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Copia el archivo `.env.example` y completa tus credenciales SMTP (los datos nunca se exponen al formulario):

   ```bash
   cp .env.example .env
   ```

   Variables requeridas:

   - `SMTP_HOST`: servidor SMTP.
   - `SMTP_PORT`: normalmente `587` para STARTTLS.
   - `SMTP_USER`: usuario de autenticación.
   - `SMTP_PASS`: contraseña.
   - `SMTP_FROM`: dirección remitente que aparecerá en los correos.
   - `SMTP_TO`: destinatario que recibirá el mensaje del formulario.

3. Inicia el servidor:

   ```bash
   npm start
   ```

4. Abre <http://localhost:3000> y completa el formulario.

El formulario realiza una petición `fetch` al endpoint `/send`, y todas las credenciales SMTP permanecen únicamente en el servidor Node.js.
