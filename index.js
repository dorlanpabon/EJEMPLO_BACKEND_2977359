const express = require('express')
const mysql = require('mysql2');
const app = express()

app.use(express.json());

const port = 3000
//SELECT `id`, `email`, `password` FROM `usuarios` WHERE 1
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  database: 'meli'
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const [rows] = await pool.promise()
      .query('SELECT `id`, `email`, `password`' +
        ' FROM `usuarios` WHERE email = ? AND password = ?',
        [email, password]);
    if (rows.length > 0) {
      res.send('Login Successful')
    } else {
      res.send('Invalid Credentials')
    }
  } catch (error) {
    console.error(error);
    res.send('Error during login')
  }
})

app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body
    const [rows] = await pool.promise()
      .query('INSERT INTO `usuarios` (`email`, `password`) VALUES (?, ?)',
        [email, password]);
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

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
