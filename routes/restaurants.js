const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// GET all restaurants (for Home page listing)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM restaurants WHERE is_active = true ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// GET single restaurant by id (for restaurant detail page)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM restaurants WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// CREATE restaurant (admin only — auth check comes later)
router.post("/", async (req, res) => {
  try {
    const { owner_id, name, description, address, phone, image_url } = req.body;
    const result = await pool.query(
      `INSERT INTO restaurants (owner_id, name, description, address, phone, image_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [owner_id, name, description, address, phone, image_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// UPDATE restaurant (owner/admin)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, address, phone, image_url, is_active } = req.body;
    const result = await pool.query(
      `UPDATE restaurants
       SET name = $1, description = $2, address = $3, phone = $4, image_url = $5, is_active = $6
       WHERE id = $7 RETURNING *`,
      [name, description, address, phone, image_url, is_active, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE restaurant (owner/admin)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM restaurants WHERE id = $1 RETURNING *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    res.json({ message: "Restaurant deleted", deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;