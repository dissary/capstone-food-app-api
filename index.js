const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./config/db");

const app = express();
app.use(cors());
app.use(express.json());

// Health check route — confirms API + DB are alive
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ status: "ok", dbTime: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

const restaurantRoutes = require("./routes/restaurants");
app.use("/api/restaurants", restaurantRoutes);

const menuItemRoutes = require("./routes/menuItems");
app.use("/api/menu-items", menuItemRoutes);

const orderRoutes = require("./routes/orders");
app.use("/api/orders", orderRoutes);

const userRoutes = require("./routes/users");
app.use("/api/users", userRoutes);

const paymentRoutes = require("./routes/payments");
app.use("/api/payments", paymentRoutes);

app.listen(3000, () => {
  console.log("App is listening on port 3000");
});