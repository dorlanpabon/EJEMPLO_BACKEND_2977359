# EJEMPLO_BACKEND

Proyecto ejemplo de backend con autenticación JWT, roles (admin/client), productos, carrito y pedidos.

## Requisitos
- Node.js 16+ (recomendado)
- MySQL / MariaDB
- `npm` (incluido con Node)

## Dependencias principales
- `express`, `mysql2`, `jsonwebtoken`, `bcryptjs`, `cors`

## Estructura relevante
- `index.js` – servidor Express con rutas de auth, productos, carrito y pedidos
- `migration_add_role_and_tables.sql` – script SQL para migrar la BD y crear tablas
- `usuarios.sql` – dump de ejemplo con usuarios (algunos con contraseña en texto plano)

## Configuración rápida
1. Clona o copia el proyecto en tu máquina.
2. Instala dependencias:

```powershell
npm install
```

3. Crea la base de datos `meli` y aplica la migración (usa tu cliente MySQL o phpMyAdmin). Desde PowerShell con el cliente `mysql`:

```powershell
mysql -u root -p meli < migration_add_role_and_tables.sql
```

Ajusta el usuario/host si tu configuración es distinta.

> Nota: el SQL marca como administradores a los emails: `admin@gmail.com`, `admin1@gmail.com`, `admin34@gmail.com`. Modifica la lista en el archivo SQL si quieres otros admins.

4. Variables de entorno opcionales (PowerShell):

```powershell
$env:JWT_SECRET = 'tu_secreto_fuerte_aqui'
$env:PORT = '3000'
node index.js
```

Si no defines `JWT_SECRET`, se usará el valor por defecto `mi_secreto_super_seguro` (no recomendable en producción).

## Ejecutar la app
```powershell
node index.js
# o en desarrollo
node --watch index.js
```

El servidor escuchará por defecto en `http://localhost:3000`.

## Endpoints principales (resumen)
- POST `/register` – Registrar usuario (se crea con `role = client`). Body: `{ "email": "...", "password": "..." }`.
- POST `/login` – Login. Body: `{ "email": "...", "password": "..." }`. Responde `{ "token": "..." }`.
- GET `/users` – Lista usuarios (admin únicamente).

Productos (público / admin):
- GET `/products`
- GET `/products/:id`
- POST `/products` (admin)
- PUT `/products/:id` (admin)
- DELETE `/products/:id` (admin)

Carrito (autenticado):
- GET `/cart` – obtener carrito del usuario
- POST `/cart/items` – añadir / actualizar item. Body: `{ "producto_id": 1, "cantidad": 2 }`
- DELETE `/cart/items/:id` – eliminar item (por id del item)

Pedidos (autenticado):
- POST `/orders` – crear pedido a partir del carrito (verifica stock, descuenta y vacía carrito)
- GET `/orders` – admin ve todos; cliente ve los suyos
- GET `/orders/:id` – ver pedido y items (owner o admin)
- PUT `/orders/:id` – actualizar estado (admin)

## Ejemplos de uso (PowerShell)
Registrar un usuario:
```powershell
curl -X POST http://localhost:3000/register -H "Content-Type: application/json" -d '{"email":"cliente@example.com","password":"1234"}'
```

Login (obtener token):
```powershell
curl -X POST http://localhost:3000/login -H "Content-Type: application/json" -d '{"email":"admin@gmail.com","password":"123"}'
# Respuesta: { "token": "..." }
```

Usar token para llamar endpoints protegidos (ejemplo actualizar estado de pedido):
```powershell
$token = '<pega_aqui_el_token>'
curl -X PUT http://localhost:3000/orders/3 -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d '{"estado":"shipped"}'
```

Crear producto (admin):
```powershell
curl -X POST http://localhost:3000/products -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d '{"nombre":"Producto A","descripcion":"...","precio":1000,"stock":10}'
```

Añadir item al carrito (cliente):
```powershell
$token_client = '<token_cliente>'
curl -X POST http://localhost:3000/cart/items -H "Authorization: Bearer $token_client" -H "Content-Type: application/json" -d '{"producto_id":1,"cantidad":2}'
```

Crear pedido desde carrito (cliente):
```powershell
curl -X POST http://localhost:3000/orders -H "Authorization: Bearer $token_client"
```

## Migración de contraseñas en texto plano (recomendado)
El proyecto soporta actualmente un fallback para contraseñas almacenadas en texto plano (comparación directa), pero es altamente recomendable migrar esas contraseñas a bcrypt. Si quieres, puedo generar un script Node que:
- busque usuarios cuya contraseña no esté hasheada (no comienza con `$2`)
- calcule `bcrypt.hash` y actualice la tabla `usuarios`

¿Quieres que lo genere?

## Notas de seguridad y producción
- Cambia `JWT_SECRET` por un secreto fuerte en producción.
- Usa HTTPS y políticas CORS apropiadas.
- No mantengas contraseñas en texto plano: migra y fuerza cambio de contraseña si es necesario.
- Considera paginación en endpoints públicos como `/products`.

---
Si quieres que añada tests, un script para poblar productos de prueba, o el script de migración de contraseñas, dime cuál y lo creo.