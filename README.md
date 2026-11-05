# Ritual · Reservas y gestión de barberías

Aplicación funcional multiempresa con sucursales, barberos que rotan entre sedes y agendas independientes. Incluye la web pública de cada negocio y la administración del operador, propietarios, encargados y barberos.

## Qué funciona

- Empresas independientes, con una sede Principal automática al registrarlas.
- Reserva sin cuenta: servicio, barbero o cualquiera disponible, fecha, horario y datos del cliente.
- Confirmación con un enlace privado para consultar, cancelar o reprogramar la cita.
- Agenda por barbero y sucursal, estados de atención y registro manual de citas.
- Creación y edición de barberos, servicios, sucursales, apertura y cierres semanales.
- Turnos concretos o repetidos semanalmente, descansos y traslado entre sedes.
- Bloqueo de citas duplicadas y protección de reservas existentes al cambiar turnos.
- Precio y duración conservados en cada reserva, aunque el catálogo cambie después.
- Identidad y accesos comprobados en el servidor; permisos por empresa, sucursal y barbero.
- Personalización de la página pública, reglas de reserva y estados/planes administrativos.
- Persistencia SQL y registros de auditoría.

## Abrir la versión privada

La publicación se aloja en Sites. En `/admin`, inicia sesión y pulsa **Crear mi espacio de trabajo** una sola vez. Se registrará tu cuenta como operador y se crearán dos negocios de demostración:

| Negocio | Sedes | Equipo |
| --- | --- | --- |
| El Ritual | Centro y Norte | 5 barberos, con Carlos rotando entre sedes |
| Barber Studio | Principal | 3 barberos |

Los datos de ejemplo se crean al inicializar, no durante las migraciones. Los turnos se generan para los próximos 60 días. Puedes registrar una empresa nueva desde **Tu plataforma → Registrar barbería** y configurarla sin modificar esos ejemplos.

La publicación es privada: no está abierta a clientes externos. Dar un permiso dentro de la aplicación y compartir el sitio son operaciones diferentes. No existen contraseñas universales ni un selector para asumir el rol de otro usuario.

## Despliegue en Vercel

Consulta [docs/VERCEL.md](docs/VERCEL.md). El proyecto incluye un build Next.js real (`npm run build:vercel`), adaptador PostgreSQL y acceso con Supabase Auth. La migración y `.env.example` están preparados; crea Supabase y configura las variables antes de usar las reservas.

## Desarrollo local con Sites

Requiere Node.js 22.13 o posterior y npm. Se recomienda Node 24 o posterior.

```sh
npm ci
npm run build
```

Aplica la migración inicial **solo a una base local nueva**:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_quick_zombie.sql
```

Después inicia el servidor:

```sh
npm run dev -- --hostname 127.0.0.1 --port 5173
```

Abre `http://127.0.0.1:5173/admin`. El starter de Sites simula el inicio de sesión local como `seedy@sites.test`; ese mecanismo solo está activo en loopback durante desarrollo y queda fuera del build publicado. El primer acceso puede pasar por `/signin-with-chatgpt?return_to=/admin`.

Los datos se guardan en `.wrangler/state`, ignorado por Git. La base local y la alojada son independientes. Las migraciones posteriores deben ejecutarse en orden; no vuelvas a aplicar la inicial sobre una base existente.

## Verificación

```sh
npm run typecheck
npm test
```

Con el servidor local activo y el espacio inicializado:

```sh
npm run test:integration
```

La prueba HTTP se niega a operar fuera de loopback. Crea un negocio de prueba, usa exclusivamente datos ficticios y deja ese negocio suspendido al finalizar. Los detalles de cobertura están en [docs/QA.md](docs/QA.md).

## Rutas

- `/`: directorio de barberías.
- `/b/[slug]`: página pública y reservas de cada empresa.
- `/admin`: panel según los permisos de la cuenta.
- `/cita/[token]`: consulta y gestión de una cita mediante su enlace privado.

## Infraestructura utilizada

React, TypeScript, convenciones Next.js App Router con Vinext, Cloudflare Workers, D1, Drizzle, Zod y Lucide. El calendario por recursos es propio; no requiere comprar una licencia de FullCalendar. La publicación utiliza el flujo privado de Sites y sus credenciales temporales de repositorio.

## Pendientes de cuentas externas y ampliaciones

- WhatsApp: conectar remitentes de cada empresa, consentimiento, plantillas y procesamiento efectivo de la cola. **No se envía ningún mensaje en esta versión.**
- Cobro de suscripciones y pagos: los planes son administrativos y no generan cargos.
- Supabase/Vercel: soporte preparado en [docs/VERCEL.md](docs/VERCEL.md). Falta crear el proyecto de Supabase, aplicar su migración y configurar las variables. La publicación original de Sites continúa utilizando D1.
- Carga de archivos, galerías y reseñas verificadas no están implementadas. La portada admite una imagen mediante URL HTTPS.

No guardes tokens, contraseñas de proveedores ni credenciales en el código. Mantén las migraciones aplicadas sin cambios y añade migraciones nuevas para cualquier modificación del esquema.
