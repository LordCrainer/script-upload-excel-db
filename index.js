const express = require('express');
const mariadb = require('mariadb');
const multer = require('multer');
const XLSX = require('xlsx');

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


const CHUNK_SIZE = 4000; // Tamaño de cada bloque

app.post('/upload', upload.single('excelFile'), async (req, res) => {
  try {
    const { buffer, originalname = "" } = req.file;
    const [tableName] = originalname.split(".")
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    let conn = await pool.getConnection();

    const columns = Object.keys(rows[0]).join(', ');
    const placeholdersPerRow = `(${new Array(Object.keys(rows[0]).length).fill('?').join(', ')})`;

    // Divide los datos en bloques
    // for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    //   const chunk = rows.slice(i, i + CHUNK_SIZE);

    //   // Preparar los datos para la inserción en bloque
    //   const values = chunk.map(row => Object.values(row));

    //   const columns = Object.keys(chunk[0]).join(', ');
    //   const placeholders = values.map(() => `(${new Array(Object.keys(chunk[0]).length).fill('?').join(', ')})`).join(', ');

    //   const query = `INSERT INTO ${tableName} (${columns}) VALUES ${placeholders}`;
    //   await conn.batch(query, values.flat());
    //   console.log(`Lote ${(i / CHUNK_SIZE) + 1} / ${rows.length} terminado`);
    // }

    const allColumns = Object.keys(rows[0]);

    // Función para asegurarse de que cada fila tenga todos los campos
    function normalizeRow(row) {
      const normalized = { ...row };
      for (const col of allColumns) {
        if (!(col in normalized)) {
          normalized[col] = null; // o cualquier valor por defecto que desees
        }
      }
      return normalized;
    }

    // Divide los datos en bloques
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE).map(normalizeRow); // Normaliza cada fila

      const values = chunk.flatMap(row => {
        return allColumns.map(col => (row[col] !== undefined && row[col] !== '') ? row[col] : null);
      });
      const placeholders = new Array(chunk.length).fill(placeholdersPerRow).join(', ');

      const query = `INSERT INTO ${tableName} (${columns}) VALUES ${placeholders}`;
      await conn.query(query, values);
      console.log(`Lote ${(i / CHUNK_SIZE) + 1} / ${Math.ceil(rows.length / CHUNK_SIZE)} terminado`);
    }


    res.send(`
    Datos guardados exitosamente!<br><br>
    <button onclick="window.history.back();">Regresar</button>
`);
  } catch (err) {
    console.error(err);
    res.status(500).send(`
    Error al guardar en la base de datos!<br><br>
    <button onclick="window.history.back();">Regresar</button>
`);
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
