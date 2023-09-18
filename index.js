const express = require('express');
const mariadb = require('mariadb');
const multer = require('multer');
const XLSX = require('xlsx');
const Path = require("path")

const app = express();
const port = 3000;

// Configuración de Multer para manejar la carga de archivos
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const pool = mariadb.createPool({
  host: 'localhost',
  user: 'root',
  password: 'mariadb',
  database: 'xtrim',
  port: 3308
});

app.get('/', (req, res) => {
  res.send(`
        <form action="/upload" method="post" enctype="multipart/form-data">
            <input type="file" name="excelFile" />
            <button type="submit">Subir archivo</button>
        </form>
    `);
});


app.post('/upload', upload.single('excelFile'), async (req, res) => {
  try {
    const { buffer, originalname = "" } = req.file;
    const [filename] = originalname.split(".")
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    let conn = await pool.getConnection();

    for (let row of rows) {
      const columns = Object.keys(row).join(', ');
      const placeholders = Object.keys(row).map(() => '?').join(', ');
      const values = Object.values(row);
      const query = `INSERT INTO ${filename} (${columns}) VALUES (${placeholders})`;
      await conn.query(query, values);
    }

    res.send(`
    Datos guardados exitosamente!<br><br>
    <button onclick="window.history.back();">Regresar</button>
`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al guardar en la base de datos');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
