const express = require('express')
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = express()
const cors = require('cors');

app.use(cors());

app.use(express.json());

const port = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET || 'mi_secreto_super_seguro'

// Nota: ahora usamos el campo `role` desde la base de datos (admin | client)

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  database: process.env.DB_NAME || 'meli',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 3306
});

// Middleware: verifica JWT y adjunta `req.user`
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) return res.status(401).json({ message: 'Token missing' })

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' })
    req.user = user
    next()
  })
}

// Middleware: autoriza sólo administradores
function authorizeAdmin(req, res, next) {
  const role = req.user && req.user.role
  if (!role) return res.status(403).json({ message: 'No user information' })
  if (role !== 'admin') return res.status(403).json({ message: 'Forbidden: admin only' })
  next()
}

// Login: verifica credenciales y emite JWT
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const [rows] = await pool.promise()
      .query('SELECT `id`, `email`, `password`, `role` FROM `usuarios` WHERE email = ?', [email]);

    if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' })

    const user = rows[0]

    // Soportar contraseñas antiguas en texto plano y nuevas con bcrypt
    let passwordMatches = false
    try {
      passwordMatches = await bcrypt.compare(password, user.password)
    } catch (e) {
      passwordMatches = false
    }
    if (!passwordMatches) {
      // fallback para contraseñas guardadas en texto plano
      if (password === user.password) passwordMatches = true
    }

    if (!passwordMatches) return res.status(401).json({ message: 'Invalid credentials' })

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role || 'client' }, JWT_SECRET, { expiresIn: '1h' })
    res.json({ token })
  } catch (error) {
    console.error(error);
    res.status(500).send('Error during login')
  }
})

// Registro: crea usuario con password hasheada
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body
    const hashed = await bcrypt.hash(password, 10)
    const [rows] = await pool.promise()
      .query('INSERT INTO `usuarios` (`email`, `password`, `role`) VALUES (?, ?, ?)', [email, hashed, 'client']);
    if (rows.affectedRows > 0) {
      res.send('Registration Successful')
    } else {
      res.send('Registration Failed')
    }
  } catch (error) {
    console.error(error);
    res.send('Error during registration')
  }
})

// Ruta protegida: lista de usuarios (sólo admin)
app.get('/users', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const [rows] = await pool.promise()
      .query('SELECT `id`, `email` FROM `usuarios`');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.send('Error fetching users')
  }
})

// ---------- RUTAS DE PRODUCTOS ----------
// Listar productos (público)
app.get('/products', async (req, res) => {
  try {
    const [rows] = await pool.promise().query('SELECT * FROM `productos`');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching products' });
  }
});

// Obtener producto por id (público)
app.get('/products/:id', async (req, res) => {
  try {
    const [rows] = await pool.promise().query('SELECT * FROM `productos` WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching product' });
  }
});

// Crear producto (admin)
app.post('/products', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { nombre, descripcion, precio, stock } = req.body;
    const [result] = await pool.promise().query(
      'INSERT INTO `productos` (`nombre`,`descripcion`,`precio`,`stock`) VALUES (?,?,?,?)',
      [nombre, descripcion || null, precio || 0, stock || 0]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating product' });
  }
});

// Actualizar producto (admin)
app.put('/products/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { nombre, descripcion, precio, stock } = req.body;
    const [result] = await pool.promise().query(
      'UPDATE `productos` SET `nombre` = ?, `descripcion` = ?, `precio` = ?, `stock` = ? WHERE id = ?',
      [nombre, descripcion || null, precio || 0, stock || 0, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating product' });
  }
});

// Eliminar producto (admin)
app.delete('/products/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const [result] = await pool.promise().query('DELETE FROM `productos` WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting product' });
  }
});

// ---------- RUTAS DE CARRITO ----------
async function getOrCreateCartId(usuarioId) {
  const [rows] = await pool.promise().query('SELECT id FROM `carts` WHERE usuario_id = ?', [usuarioId]);
  if (rows.length > 0) return rows[0].id;
  const [result] = await pool.promise().query('INSERT INTO `carts` (`usuario_id`) VALUES (?)', [usuarioId]);
  return result.insertId;
}

// Obtener carrito del usuario actual
app.get('/cart', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [cartRows] = await pool.promise().query('SELECT id FROM `carts` WHERE usuario_id = ?', [userId]);
    if (cartRows.length === 0) return res.json({ items: [] });
    const cartId = cartRows[0].id;
    const [items] = await pool.promise().query(
      `SELECT ci.id, ci.cantidad, ci.precio_unit, p.id AS producto_id, p.nombre, p.descripcion
       FROM cart_items ci
       JOIN productos p ON p.id = ci.producto_id
       WHERE ci.cart_id = ?`, [cartId]
    );
    res.json({ id: cartId, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching cart' });
  }
});

// Añadir/actualizar item en el carrito
app.post('/cart/items', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { producto_id, cantidad } = req.body;
    const qty = parseInt(cantidad, 10) || 1;

    // comprobar producto
    const [prod] = await pool.promise().query('SELECT id, precio, stock FROM productos WHERE id = ?', [producto_id]);
    if (prod.length === 0) return res.status(404).json({ message: 'Product not found' });
    if (prod[0].stock < qty) return res.status(400).json({ message: 'Insufficient stock' });

    const cartId = await getOrCreateCartId(userId);

    // comprobar si ya existe el item
    const [existing] = await pool.promise().query('SELECT id, cantidad FROM cart_items WHERE cart_id = ? AND producto_id = ?', [cartId, producto_id]);
    if (existing.length > 0) {
      const newQty = existing[0].cantidad + qty;
      await pool.promise().query('UPDATE cart_items SET cantidad = ? WHERE id = ?', [newQty, existing[0].id]);
      return res.json({ message: 'Cart updated' });
    }

    await pool.promise().query('INSERT INTO cart_items (cart_id, producto_id, cantidad, precio_unit) VALUES (?,?,?,?)', [cartId, producto_id, qty, prod[0].precio]);
    res.status(201).json({ message: 'Item added to cart' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error adding to cart' });
  }
});

// Eliminar item del carrito
app.delete('/cart/items/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // asegurar que el item pertenece al carrito del usuario
    const [rows] = await pool.promise().query(
      `SELECT ci.id FROM cart_items ci
       JOIN carts c ON c.id = ci.cart_id
       WHERE ci.id = ? AND c.usuario_id = ?`, [req.params.id, userId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Item not found' });
    await pool.promise().query('DELETE FROM cart_items WHERE id = ?', [req.params.id]);
    res.json({ message: 'Item removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error removing item' });
  }
});

// ---------- RUTAS DE PEDIDOS ----------
// Crear pedido a partir del carrito del usuario
app.post('/orders', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  let connection;
  try {
    // Obtener una conexión dedicada para la transacción
    connection = await pool.promise().getConnection();
    await connection.beginTransaction();

    // obtener items del carrito
    const [cartRows] = await connection.query('SELECT id FROM carts WHERE usuario_id = ?', [userId]);
    if (cartRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Cart is empty' });
    }
    const cartId = cartRows[0].id;

    const [items] = await connection.query(
      `SELECT ci.id, ci.cantidad, ci.precio_unit, p.id as producto_id
       FROM cart_items ci JOIN productos p ON p.id = ci.producto_id
       WHERE ci.cart_id = ? FOR UPDATE`, [cartId]
    );
    if (items.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Intentar decrementar stock de forma atómica por cada producto
    for (const it of items) {
      const [updateRes] = await connection.query(
        'UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [it.cantidad, it.producto_id, it.cantidad]
      );
      if (updateRes.affectedRows === 0) {
        // stock insuficiente, revertir
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: `Insufficient stock for product ${it.producto_id}` });
      }
    }

    // calcular total
    let total = 0;
    for (const it of items) total += parseFloat(it.precio_unit) * parseInt(it.cantidad, 10);

    // crear pedido
    const [orderRes] = await connection.query('INSERT INTO pedidos (usuario_id, total, estado) VALUES (?,?,?)', [userId, total, 'pending']);
    const orderId = orderRes.insertId;

    // insertar items del pedido
    for (const it of items) {
      await connection.query('INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unit) VALUES (?,?,?,?)', [orderId, it.producto_id, it.cantidad, it.precio_unit]);
    }

    // vaciar carrito
    await connection.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
    await connection.query('DELETE FROM carts WHERE id = ?', [cartId]);

    await connection.commit();
    connection.release();
    res.status(201).json({ orderId });
  } catch (err) {
    console.error(err);
    try {
      if (connection) await connection.rollback();
    } catch (e) { /* ignore */ }
    if (connection) connection.release();
    res.status(500).json({ message: 'Error creating order' });
  }
});

// Listar pedidos (admins ven todos, usuarios sólo los suyos)
app.get('/orders', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const [rows] = await pool.promise().query('SELECT * FROM pedidos');
      return res.json(rows);
    }
    const [rows] = await pool.promise().query('SELECT * FROM pedidos WHERE usuario_id = ?', [req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching orders' });
  }
});

// Obtener pedido por id (owner o admin)
app.get('/orders/:id', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.id;
    const [rows] = await pool.promise().query('SELECT * FROM pedidos WHERE id = ?', [orderId]);
    if (rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    const order = rows[0];
    if (req.user.role !== 'admin' && order.usuario_id !== req.user.id) return res.status(403).json({ message: 'Forbidden' });
    const [items] = await pool.promise().query('SELECT * FROM pedido_items WHERE pedido_id = ?', [orderId]);
    res.json({ order, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching order' });
  }
});

// Actualizar estado de un pedido (sólo admin)
app.put('/orders/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { estado } = req.body;
    const allowed = ['pending', 'paid', 'shipped', 'cancelled', 'processing', 'delivered'];
    if (!estado || typeof estado !== 'string') return res.status(400).json({ message: 'Missing estado in body' });
    if (!allowed.includes(estado)) return res.status(400).json({ message: `Invalid estado. Allowed: ${allowed.join(', ')}` });

    const [result] = await pool.promise().query('UPDATE pedidos SET estado = ? WHERE id = ?', [estado, orderId]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Order not found' });
    res.json({ message: 'Order status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating order' });
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
