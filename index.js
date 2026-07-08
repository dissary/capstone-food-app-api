let express = require("express");
let path = require("path");
const cors = require("cors");
let app = express();
app.use(cors());
app.use(express.json());

const { Pool } = require("pg");
require("dotenv").config();
const { DATABASE_URL } = process.env;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    require: true,
  },
});

async function getPostgresVersion() {
  const client = await pool.connect();
  try {
    const response = await client.query("SELECT version()");
    console.log(response.rows[0]);
  } finally {
    client.release();
  }
}

getPostgresVersion();


app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname + "/index.html"));
});


app.listen(3000, () => {
  console.log("App is listening on port 3000");
});