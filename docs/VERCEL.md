# Despliegue en Vercel con Supabase

## Por qué fallaba

El proyecto inicial compilaba con Vinext y producía un Worker de Cloudflare en `dist/`. Vercel detectaba la dependencia Next.js y buscaba `.next/routes-manifest.json`, que ese compilador no genera. Cambiar únicamente Output Directory no convierte un Worker de Cloudflare en una aplicación Next.js.

Esta revisión incorpora un modo Next.js real para Vercel, un repositorio PostgreSQL y sesiones verificadas con Supabase Auth. El modo Sites/D1 se conserva en sus scripts y Worker. Los datos no se copian automáticamente entre las dos instalaciones.

## 1. Crear Supabase

1. Crea un proyecto nuevo en Supabase y conserva la contraseña de la base de datos.
2. En **SQL Editor**, ejecuta una vez el archivo `supabase/migrations/202611050001_ritual.sql` completo. Crea el esquema privado `ritual`, sus tablas, claves compuestas y protecciones de turnos/reservas. No crea negocios ni usuarios de ejemplo durante la migración.
3. En **Authentication → Users**, crea tu usuario de administración con correo confirmado y contraseña. El correo debe coincidir con `RITUAL_OWNER_EMAIL`.
4. Obtén la URL del proyecto y su **publishable key**. No se necesita la `service_role` para autenticar usuarios.
5. En **Connect → Transaction pooler**, copia la cadena PostgreSQL exacta y sustituye la contraseña. No construyas el hostname del pooler a partir de la región. Usa la conexión del backend, no una URL de la API REST.

### Si aparece `relation "app_state" does not exist`

Usa la versión actualizada del archivo de migración: las tablas, los índices y las referencias indican explícitamente el esquema `ritual`, sin depender del `search_path` de la sesión. En una instalación nueva cuyo primer intento falló, reemplaza el contenido del SQL Editor por el archivo completo y ejecútalo desde `BEGIN` hasta `COMMIT`, sin seleccionar solo una parte. La migración completa es transaccional; un error revierte ese intento.

Después verifica:

```sql
SELECT to_regclass('ritual.app_state') AS tabla;
```

Debe devolver `ritual.app_state`. Si el esquema ya se instaló correctamente, no vuelvas a ejecutar la migración inicial. No borres tablas para resolver este error.

## 2. Variables de entorno en Vercel

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | Cadena PostgreSQL del Transaction pooler. Es un secreto del servidor. |
| `SUPABASE_URL` | URL HTTPS del proyecto Supabase. |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key del mismo proyecto. |
| `RITUAL_OWNER_EMAIL` | Tu correo de administración confirmado. |
| `SUPABASE_SECRET_KEY` | Secret key del servidor de Supabase, necesaria para enviar invitaciones y cargar portadas. Se obtiene en Settings → API Keys. |
| `RITUAL_APP_URL` | URL pública de la aplicación, por ejemplo `https://barber-appointment-two.vercel.app`. Se usa para los enlaces de invitación. |
| `DATABASE_CA_CERT` | Contenido PEM completo del certificado raíz de Supabase. Necesario si la conexión muestra `self-signed certificate in certificate chain`. |

La plantilla `.env.example` contiene solo ejemplos. No subas `.env.local` ni contraseñas al repositorio. No pongas `DATABASE_URL` bajo un nombre `NEXT_PUBLIC_*`.

El adaptador usa una conexión por instancia de servidor, consultas parametrizadas sin prepared statements con nombre, TLS verificado para servidores remotos y transacciones para los lotes de escrituras.

### Error `self-signed certificate in certificate chain`

Este error indica que el servidor no puede verificar la cadena TLS de PostgreSQL con las autoridades certificadoras disponibles. El adaptador ya admite la CA mediante `DATABASE_CA_CERT`.

1. En el proyecto Supabase, abre **Database → Settings → SSL Configuration** y pulsa **Download Certificate**. Consulta la [guía oficial de Supabase](https://supabase.com/docs/guides/platform/ssl-enforcement).
2. Abre el certificado descargado con un editor de texto. Copia el contenido PEM completo, incluyendo las líneas `-----BEGIN CERTIFICATE-----` y `-----END CERTIFICATE-----`.
3. En Vercel, abre **Settings → Environment Variables** y añade `DATABASE_CA_CERT` para **Production**. Pega el contenido completo del certificado como valor, conservando sus saltos de línea y sin comillas. El valor es el contenido del archivo, no su nombre ni una ruta local. El adaptador también admite saltos de línea escritos como `\n`.
4. Guarda la variable y ejecuta **Redeploy**. Si también pruebas despliegues Preview contra esta base de datos, configura allí la misma CA.
5. Abre `/api/public`: debe responder con estado 200. Antes de inicializar el espacio de trabajo, la respuesta esperada es `{"tenants":[],"initialized":false}`.

El adaptador mantiene la verificación TLS del certificado y del hostname. Gestiona SSL desde el código, por lo que los parámetros SSL de `DATABASE_URL` no sustituyen a `DATABASE_CA_CERT`.

## 3. Configuración del proyecto Vercel

El archivo `vercel.json` ya declara:

- **Framework Preset:** Next.js.
- **Build Command:** `npm run build:vercel`.
- **Output Directory:** `.next`.
- **Node.js:** 24.x, fijado en `package.json`.

Si `package.json` está en la raíz de GitHub, deja **Root Directory** en la raíz. Si subes la carpeta `ritual` dentro de otro repositorio, usa `ritual` como Root Directory.

Revisa que no quede un override antiguo de Build Command que fuerce Vinext. Al desplegar, el registro debe mostrar `next build --webpack` y terminar con la tabla de rutas de Next.js.

La compilación puede terminar sin las cuentas externas configuradas: en ese caso la pantalla de acceso indica qué falta. Las reservas y la administración se activan al configurar las variables y aplicar la migración. **Un build correcto sin Supabase configurado no representa una aplicación operativa.**

## 4. Primer acceso

1. Abre `/admin`; Vercel te llevará a `/login`.
2. Entra con el usuario confirmado de Supabase.
3. Pulsa **Crear mi espacio de trabajo**. El servidor comprueba `RITUAL_OWNER_EMAIL` antes de conceder el rol de operador.
4. Se crean los negocios de demostración y sus agendas. Puedes registrar luego tu empresa desde **Tu plataforma**.
5. Para incorporar al equipo, usa **Configuración → Accesos → Dar acceso**, asigna sus permisos y marca **Enviar invitación por correo**. Los requisitos de correo se explican abajo. También puedes crear sus cuentas confirmadas manualmente en Supabase.

No existe registro público automático ni se confía en los encabezados de identidad de Sites en Vercel. Las credenciales del formulario de acceso se validan mediante Supabase Auth y las sesiones usan cookies del mismo sitio. Los datos operativos permanecen en el esquema privado y se consultan exclusivamente desde el servidor, que comprueba empresa, sede y rol.

## Desarrollo y verificación

```sh
npm ci
npm run dev:vercel
```

Usa `.env.local` con las variables reales para probar Supabase localmente. El servidor Next.js usa el puerto que imprime en consola, normalmente 3000.

```sh
npm run typecheck
npm test
npm run build:vercel
```

Los tests PostgreSQL aplican la migración real sobre PGlite. Cubren conflictos, descansos, protección de turnos, claves entre empresas, la inicialización y el limitador de solicitudes. No se ha conectado una cuenta de Supabase en esta revisión porque todavía no se ha creado.

Para la infraestructura original de Sites, conserva `npm run dev`, `npm run build` y `.openai/hosting.json`. El Worker incorpora su base D1 al contexto de cada solicitud. El script `build` también detecta `VERCEL=1` como respaldo; el despliegue Vercel usa explícitamente `build:vercel`.

## Alcance

Esta preparación no configura WhatsApp, pagos ni credenciales externas. La versión alojada originalmente en Sites sigue siendo una instalación independiente. Para migrar datos reales más adelante debe hacerse una exportación/importación revisada; la migración inicial de Supabase crea una instalación nueva.

## Eliminación desde el panel

- El operador puede eliminar una barbería desde **Tu plataforma** escribiendo su nombre exacto. Se eliminan sus datos dependientes en una transacción y se conservan las cuentas de inicio de sesión y la auditoría. Al eliminar la última barbería, el operador puede registrar otra desde la pantalla vacía.
- El propietario puede eliminar sucursales, barberos y servicios desde sus tarjetas/listas o formularios de edición. Las reservas asociadas impiden eliminar esos registros; se puede archivarlos o eliminar primero sus dependencias. Una barbería debe conservar una sucursal activa. Los turnos y permisos vinculados deben resolverse antes de eliminar una sucursal o un barbero.
- El propietario y los encargados pueden eliminar reservas y turnos de las sucursales que administran. Eliminar una reserva también elimina sus avisos y desactiva su enlace privado. La confirmación se rechaza si la reserva cambió mientras estaba abierta.
- En **Configuración → Accesos**, el propietario puede eliminar los permisos de otra persona. En **Configuración → WhatsApp**, puede eliminar avisos de la semana sin borrar la reserva.
- Todas las acciones muestran una confirmación y vuelven a validar permisos en el servidor. Estos cambios usan el esquema existente; no requieren volver a ejecutar la migración inicial.

## Invitaciones del equipo y creación de contraseña

La versión inicial solo guardaba permisos por correo. Los accesos que ya existen se conservan y ahora tienen un botón **Enviar invitación**. Ese botón también permite reenviar un enlace si el anterior venció. Las invitaciones requieren estos pasos de configuración externa:

1. En **Supabase → Settings → API Keys**, copia una **Secret key** y configúrala directamente en Vercel como `SUPABASE_SECRET_KEY` para Production. Esta clave se usa exclusivamente en el servidor; el navegador sigue usando la publishable key para autenticar al usuario. También se admite el nombre `SUPABASE_SERVICE_ROLE_KEY` para proyectos que aún usan una clave heredada.
2. Configura `RITUAL_APP_URL=https://barber-appointment-two.vercel.app` en Vercel, o la URL de tu dominio de producción. Como respaldo, el servidor usa `VERCEL_PROJECT_PRODUCTION_URL` si está disponible.
3. En **Supabase → Authentication → URL Configuration**, establece la URL base de producción como **Site URL** y añade `https://barber-appointment-two.vercel.app/auth/accept` a **Redirect URLs**. Si usas otro dominio, sustituye el dominio en ambos lugares.
4. En **Supabase → Authentication → Email → SMTP Settings**, configura tu proveedor SMTP: remitente, nombre, host, puerto, usuario y contraseña. El servicio de correo predeterminado de Supabase restringe los destinatarios a miembros del equipo del proyecto; para invitar a otros correos necesitas SMTP propio o un Send Email Hook. Sigue la [guía oficial de SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
5. Conserva las plantillas de invitación y recuperación con el enlace predeterminado `{{ .ConfirmationURL }}`. Si ya usas plantillas personalizadas que verifican `TokenHash` en tu propia app, la ruta admite `/auth/accept?token_hash={{ .TokenHash }}&type=invite` y el equivalente `type=recovery` para recuperación.
6. Guarda las variables y vuelve a desplegar. En **Configuración → Accesos**, pulsa **Enviar invitación** en cada acceso ya creado. Para accesos nuevos, deja marcada **Enviar invitación por correo** al guardar.

La persona abre el correo, crea su contraseña y entra a `/admin`. Si ya tiene una cuenta, se envía un enlace para establecer contraseña y también puede entrar con su contraseña actual. El propietario debe usar exactamente el mismo correo de la cuenta al asignar los permisos. El enlace no transmite contraseñas; la persona elige la suya.

El sistema conserva el permiso aunque falle el envío y muestra un aviso indicando que el correo no se envió. No confunde un permiso guardado con una invitación enviada. Se limita el reenvío a un intento por minuto para cada correo y barbería, además de los límites del proveedor.

### Acceso manual mientras no haya SMTP

En **Supabase → Authentication → Users → Add user → Create new user**, crea la cuenta con el mismo correo del acceso y márcala como confirmada. Establece una contraseña y facilita las credenciales directamente a esa persona. Podrá iniciar sesión en `/login` y los permisos guardados se aplicarán al acceder. La aplicación no envía correos en este procedimiento manual.

## Portadas desde un archivo y descripciones multilínea

En **Configuración → Página pública → Editar mi página**, **Cargar imagen** permite elegir JPEG, PNG o WebP de hasta 15 MB. El navegador prepara una versión de hasta 1920 píxeles y 2 MB, muestra la vista previa y la carga al guardar el formulario. **Quitar imagen** limpia la portada al guardar. La opción de URL sigue disponible dentro de un desplegable.

La carga requiere `SUPABASE_SECRET_KEY`. El servidor prepara automáticamente el bucket público `ritual-covers` si no existe, limitado a imágenes y a 2 MB por archivo. Si ya existe como privado, no cambia su visibilidad: el operador debe revisar su configuración. Cada barbería tiene su propia carpeta; la carga exige ser propietario de esa barbería. Las imágenes de portada son públicas porque se muestran en la página de reservas.

Si falla el guardado del negocio, se elimina la carga nueva y se mantiene la portada anterior. Al guardar correctamente una nueva portada, se limpia la anterior solo cuando pertenece al mismo negocio y a este bucket. Las URL de imágenes externas no se borran del proveedor externo.

Las descripciones de servicios usan un campo de varias líneas. Enter separa líneas y párrafos; el panel, la lista pública y el selector de servicios conservan esos saltos. Todo el contenido sigue tratándose como texto, sin interpretar HTML.

Estos cambios utilizan las tablas existentes. No vuelvas a ejecutar la migración inicial. Las pruebas locales simulan el proveedor de correo y el almacenamiento: enviar correos y guardar imágenes en la cuenta real requiere completar la configuración anterior.
