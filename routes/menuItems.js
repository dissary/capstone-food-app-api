const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const verifyToken = require("../middleware/verifyToken");
const checkRole = require("../middleware/checkRole");

// GET all menu items for a restaurant (owner/admin management view — includes unavailable items)
router.get("/restaurant/:restaurantId/all", verifyToken, checkRole("owner", "admin"), async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const result = await pool.query(
      "SELECT * FROM menu_items WHERE restaurant_id = $1 ORDER BY category, name",
      [restaurantId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// GET all menu items for a specific restaurant
router.get("/restaurant/:restaurantId", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const result = await pool.query(
      "SELECT * FROM menu_items WHERE restaurant_id = $1 AND is_available = true ORDER BY category, name",
      [restaurantId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// GET single menu item by id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM menu_items WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// CREATE menu item (restaurant owner)
router.post("/", verifyToken, checkRole("owner","admin"), async (req, res) => {
  try {
    const { restaurant_id, category, name, description, price, image_url } = req.body;
    const result = await pool.query(
      `INSERT INTO menu_items (restaurant_id, category, name, description, price, image_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [restaurant_id, category, name, description, price, image_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// UPDATE menu item (restaurant owner)
router.put("/:id", verifyToken, checkRole("owner", "admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { category, name, description, price, image_url, is_available } = req.body;
    const result = await pool.query(
      `UPDATE menu_items
       SET category = $1, name = $2, description = $3, price = $4, image_url = $5, is_available = $6
       WHERE id = $7 RETURNING *`,
      [category, name, description, price, image_url, is_available, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE menu item (restaurant owner)
router.delete("/:id", verifyToken, checkRole("owner", "admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM menu_items WHERE id = $1 RETURNING *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    res.json({ message: "Menu item deleted", deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;