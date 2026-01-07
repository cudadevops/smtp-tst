# smtp-tst

Servicio API mínimo en Node.js que recibe datos de formularios y los envía como correo electrónico. Cuando se define una clave `BREVO_API_KEY`, la API intenta primero enviar el mensaje mediante Brevo y, si falla, recurre al servidor SMTP configurado con STARTTLS (puerto 587). El servidor solo escucha en `127.0.0.1:7522` por defecto para evitar accesos remotos accidentales.

## Requisitos previos

- Node.js 18 o superior.
- Un servidor SMTP accesible mediante TLS en el puerto 587.

## Configuración

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Copia el archivo `.env.example` y completa tus credenciales reales únicamente en `.env` (el archivo está en `.gitignore`):

   ```bash
   cp .env.example .env
   ```

   Variables obligatorias:

   - `SMTP_HOST`: host del servidor SMTP.
   - `SMTP_PORT`: puerto del servidor SMTP (usar `587` para STARTTLS).
   - `SMTP_USER`: usuario para autenticación SMTP.
   - `SMTP_PASS`: contraseña del usuario SMTP.
   - `SMTP_FROM`: remitente visible del correo.
   - `SMTP_TO`: destinatario que recibirá los mensajes agregados por la API.

   Variables opcionales:

   - `BREVO_API_KEY`: clave de API de Brevo (Sendinblue). Si se establece, la API intentará usar Brevo antes de pasar al SMTP.
   - `API_PORT`: puerto local para la API (por defecto `7522`).
   - `API_HOST`: interfaz de red para escuchar (por defecto `127.0.0.1`).
   - `EXTRA_FIELD_LIMIT`: límite de campos adicionales permitidos (por defecto `30`).
   - `SUBJECT_PREFIX`: prefijo para el asunto del correo (por defecto `Nuevo mensaje de formulario`).
   - `CORS_ALLOW_ORIGIN`: origen permitido para peticiones del navegador. Usa `*` para aceptar cualquier origen local (por defecto `*`).
   - `MESSAGE_SUCCESS_BREVO`: mensaje de éxito cuando Brevo entrega el correo (por defecto `Correo enviado mediante Brevo.`).
   - `MESSAGE_SUCCESS_SMTP`: mensaje de éxito cuando el SMTP entrega el correo (por defecto `Correo enviado mediante SMTP.`).
   - `MESSAGE_ERROR_MISSING_REQUIRED`: plantilla para campos obligatorios faltantes. Usa `%fields%` como marcador del listado.
   - `MESSAGE_ERROR_INVALID_TYPE`: mensaje cuando algún campo no es una cadena de texto.
   - `MESSAGE_ERROR_EXTRA_LIMIT`: plantilla para exceder el límite de campos adicionales. Usa `%limit%` como marcador.
   - `MESSAGE_ERROR_SEND`: mensaje de error general al intentar enviar el correo.
   - `MESSAGE_ERROR_NOT_FOUND`: mensaje para rutas inexistentes.

## Ejecución

Inicia la API con:

```bash
npm start
```

La API quedará escuchando en `http://127.0.0.1:7522`.

## Uso de la API

Envía una petición `POST` a `/api/email` con los datos del formulario en formato `application/json` o `application/x-www-form-urlencoded`.

Los primeros campos son obligatorios y deben ser cadenas de texto no vacías:

1. `remitente`
2. `nombre`
3. `correo`
4. `telefono`
5. `mensaje`

Además puedes adjuntar hasta `EXTRA_FIELD_LIMIT` campos adicionales (cualquier nombre) siempre que todos sus valores sean cadenas.

### Ejemplo con `curl`

```bash
curl -X POST http://127.0.0.1:7522/api/email \
  -H "Content-Type: application/json" \
  -d '{
    "remitente": "Landing Page",
    "nombre": "Ada Lovelace",
    "correo": "ada@example.com",
    "telefono": "+52 55 1234 5678",
    "mensaje": "Me interesa recibir más información.",
    "empresa": "Analytical Engines",
    "presupuesto": "10000"
  }'
```

La API genera un correo con todo el contenido recibido convertido a una tabla HTML y adjunta una versión de texto plano para compatibilidad.

Si el envío se completa correctamente, la API responderá con un JSON que indica el método usado (`brevo` o `smtp`), junto con un mensaje descriptivo y, cuando esté disponible, el identificador del mensaje o la lista de destinatarios aceptados. Ejemplo:

```json
{
  "success": true,
  "method": "smtp",
  "message": "Correo enviado mediante SMTP.",
  "accepted": ["destinatario@example.com"],
  "messageId": "<abc123@servidor>"
}
```

Si ocurre un error, la API devolverá un código de estado `4xx` o `5xx` con un objeto JSON que describe el problema.
