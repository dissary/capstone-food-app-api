const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const verifyToken = require("../middleware/verifyToken");
const checkRole = require("../middleware/checkRole");

// GET all restaurants including paused ones (admin management view)
router.get("/all", verifyToken, checkRole("admin"), async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM restaurants ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

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

router.get("/mine", verifyToken, checkRole("owner", "admin"), async (req, res) => {
  try {
    const userResult = await pool.query("SELECT id FROM users WHERE firebase_uid = $1", [req.user.uid]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const userId = userResult.rows[0].id;

    const result = await pool.query("SELECT * FROM restaurants WHERE owner_id = $1 ORDER BY created_at", [userId]);
    res.json(result.rows); // array now, even if just one
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
router.post("/", verifyToken, checkRole("admin"), async (req, res) => {
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
router.put("/:id", verifyToken, checkRole("owner", "admin"), async (req, res) => {
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
router.delete("/:id", verifyToken, checkRole("owner", "admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM restaurants WHERE id = $1 RETURNING *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    res.json({ message: "Restaurant deleted", deleted: result.rows[0] });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({
        message: "This restaurant has existing orders/menu items and can't be deleted. Pause it instead.",
      });
    }
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;