# Verificación

## Pruebas automáticas

`npm test` ejecuta 27 pruebas de dominio y SQL: duración, descansos, margen, anticipación, ventanas de reserva, zonas horarias, servicios habilitados, prioridades al elegir cualquier barbero, citas canceladas, traslados, aislamiento entre empresas y permisos por sede/profesional.

La adaptación para Vercel añade la aplicación de la migración PostgreSQL real sobre PGlite y verifica su SQL parametrizado, restricciones de exclusión, descansos, traslado y protección de turnos con reservas. Pasan tanto `npm run build:vercel` (Next.js, con `.next/routes-manifest.json`) como `npm run build` (Sites/Vinext). La prueba HTTP del modo Sites también se ejecutó tras incorporar el adaptador y el nuevo contexto de identidad.

Las pruebas SQL cargan la migración real en SQLite, comprueban que la segunda reserva de un intervalo falla y que un turno con citas no puede moverse ni eliminarse. También verifican claves compuestas entre empresas y conservación de precio/duración.

`npm run test:integration` usa exclusivamente un servidor en loopback. Inicializa su sesión con la ruta oficial de desarrollo, crea un negocio ficticio y lo deja suspendido al finalizar. Verifica CRUD, cuatro semanas de turnos, dos reservas concurrentes, rechazo de cambios con citas existentes, instantánea del catálogo, reprogramación/cancelación y alta/revocación de permisos. Comprueba además que los encabezados de identidad falsificados sin sesión son rechazados.

El proveedor de identidad local solo emula un usuario. Por ello los ámbitos de encargado/barbero se comprueban en pruebas de dominio; una prueba de aceptación con varias cuentas reales requiere compartir el sitio y asignar esos accesos.

## Navegador

Se revisó la agenda en escritorio y la página pública al ancho móvil disponible en el navegador de prueba, sin desbordamiento de la página. El recorrido probado creó una cita, cambió sede y horario desde su enlace privado y canceló la reserva. También se comprobó el mensaje que bloquea mover un turno con reservas.

## Límites

No se probaron mensajes reales, pagos, proveedores externos ni sesiones de varios usuarios reales. Los negocios, direcciones, contactos de prueba y fotografías iniciales son ilustrativos. Antes de abrir la aplicación a clientes, reemplaza el contenido de ejemplo, prueba las cuentas del equipo y configura las integraciones que se vayan a ofrecer.
