# Arquitectura

## Plataforma desplegada

La implementación utiliza React 19, TypeScript y las convenciones App Router de Next.js mediante Vinext. Sites compila y aloja el servidor en Cloudflare Workers. D1 proporciona SQL persistente y Sign in with ChatGPT identifica al usuario. No hay datos de negocio guardados en `localStorage` ni contraseñas de demostración en el navegador.

La aplicación está publicada inicialmente con acceso privado. La persona que inicializa ese espacio privado recibe el rol de operador. El acceso al sitio y los permisos internos son dos controles distintos: compartir el sitio no concede automáticamente acceso a la administración de una empresa.

## Modelo de negocio

`empresa → sucursales → turnos → reservas`

El barbero pertenece a la empresa y tiene un perfil único. Los turnos lo asignan a una sucursal durante un intervalo. Una empresa nueva recibe una sede Principal. Cuando hay una sola sede activa, la reserva omite su selector.

Todas las entidades operativas llevan `tenant_id`. Las claves foráneas compuestas impiden asociar sucursales, servicios o barberos de otra empresa. La autorización del servidor aplica el ámbito de cada membresía en lecturas y escrituras. Los clientes nunca eligen su rol ni un identificador de usuario.

## Disponibilidad

`lib/scheduling.ts` calcula intervalos de 15 minutos usando:

- Apertura y días de cierre de la sede.
- Turnos y descansos del barbero.
- Servicios habilitados por sede y profesional.
- Duración, precio y margen entre citas.
- Reservas de ese barbero en todas las sedes.
- Tiempo de traslado, anticipación mínima y ventana máxima de reserva.

Los instantes se guardan en UTC, en milisegundos, y se presentan en la zona IANA de la sede. Un cambio de catálogo conserva precio, nombre y duración de las citas existentes.

La comprobación de disponibilidad mejora la experiencia, pero los triggers de `db/constraints.sql` son la última garantía frente a escrituras concurrentes. Dos clientes que consultaron el mismo horario no pueden confirmarlo ambos. La base también rechaza turnos superpuestos, traslados insuficientes y cambios de turno que invalidan reservas existentes.

Los turnos repetidos se materializan en fechas concretas, en lotes atómicos de hasta 13 semanas. Editar una jornada no modifica silenciosamente las demás. Los turnos futuros del ejemplo se generan para los próximos 60 días al inicializar; el dueño debe continuar planificando sus jornadas.

## Identidad y permisos

- Operador: registra empresas y administra sus estados/planes; puede operar todos los negocios.
- Propietario: configura su empresa, servicios, personal, sedes y accesos.
- Encargado: administra citas y turnos de las sedes asignadas.
- Barbero: consulta su agenda y actualiza la atención de sus propias citas.

Las concesiones por correo se vinculan al usuario identificado por el proveedor en su siguiente acceso. Revocarlas elimina también las membresías existentes. No se envían invitaciones por correo. La simulación `local_seedy` existe solo en el middleware local del starter y queda fuera del build de producción; ese middleware descarta encabezados de identidad aportados por el cliente.

## Gestión del cliente

La reserva no exige cuenta. El servidor genera un token aleatorio de 256 bits y solo guarda su SHA-256. El enlace permite consultar, cancelar o reprogramar esa cita dentro del plazo de la empresa. No se exponen tokens en los listados administrativos. Los datos públicos de disponibilidad no incluyen nombres, teléfonos ni correos de clientes.

Las modificaciones usan una versión de registro para detectar operaciones simultáneas. La creación y los avisos asociados se escriben en una transacción D1. Se limita el número de intentos de reserva por dirección de origen y empresa.

## Servicios externos pendientes

La aplicación registra el estado de las notificaciones, pero **no envía mensajes**. No existe todavía un proceso de envío activo. WhatsApp requiere alta del remitente de cada empresa, plantillas aprobadas, consentimiento y un trabajador de cola con reintentos/idempotencia. Los avisos figuran como `not_configured` o `not_requested`, no como enviados.

Los planes son administrativos: no hay cobros de suscripciones, pagos online, liquidaciones ni comisiones. Su pasarela debe elegirse según el país de la entidad que cobrará.

La portada admite una imagen HTTPS. La galería, carga de archivos, reseñas verificadas, campañas, caja e inventario no forman parte de esta primera versión.

## Supabase / Vercel

Esta versión utiliza la infraestructura de Sites para poder probarla sin credenciales externas. **No está conectada a Supabase ni desplegada en Vercel.** El código de dominio y las pantallas son reutilizables, pero un traslado necesita:

1. Convertir `db/schema.ts` y los triggers de SQLite a PostgreSQL. Usar restricciones de exclusión para los intervalos por barbero y conservar las claves compuestas por empresa.
2. Reemplazar `lib/server/db.ts`, sus operaciones preparadas D1 y las llamadas `batch` por un repositorio transaccional PostgreSQL. No publicar una función RPC que acepte SQL arbitrario.
3. Sustituir `app/chatgpt-auth.ts` por sesiones verificadas de Supabase Auth y vincularlas a las membresías; configurar RLS y comprobar todos los roles.
4. Mover las imágenes a Storage si se incorpora carga de archivos. Guardar secretos únicamente en el servidor.
5. Ejecutar nuevamente las pruebas del dominio y los recorridos de integración; adaptar el despliegue a Next.js/Vercel.

No se deben alojar los endpoints actuales detrás de un proxy genérico que permita a los visitantes inventar encabezados `oai-authenticated-user-*`. El alojamiento Sites proporciona esa frontera de identidad.

## Archivos principales

- `components/public-booking.tsx`: reserva y reprogramación.
- `components/admin.tsx` y `components/admin-forms.tsx`: administración.
- `lib/server/commands.ts`: mutaciones autorizadas.
- `lib/server/repository.ts`: lecturas y reservas transaccionales.
- `lib/server/auth.ts`: membresías y ámbitos de acceso.
- `lib/scheduling.ts`: reglas puras de horarios.
- `db/schema.ts`, `db/constraints.sql`, `drizzle/`: esquema y migraciones.

Las migraciones aplicadas son inmutables; cualquier cambio posterior debe añadirse mediante una nueva migración. Los datos locales y alojados son independientes.
