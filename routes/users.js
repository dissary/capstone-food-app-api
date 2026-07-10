const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const verifyToken = require("../middleware/verifyToken");
const checkRole = require("../middleware/checkRole");

// Sync/create user in Neon DB after Firebase signup/login
router.post("/sync", verifyToken, async (req, res) => {
  try {
    const { uid, email, name } = req.user;

    // Check if user already exists
    const existing = await pool.query("SELECT * FROM users WHERE firebase_uid = $1", [uid]);

    if (existing.rows.length > 0) {
      return res.json(existing.rows[0]); // already synced
    }

    // Create new user, default role 'consumer'
    const result = await pool.query(
      `INSERT INTO users (firebase_uid, email, name, role) VALUES ($1, $2, $3, 'consumer') RETURNING *`,
      [uid, email, name || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// Get current user's profile (used to check role on frontend)
router.get("/me", verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const result = await pool.query("SELECT * FROM users WHERE firebase_uid = $1", [uid]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found in database" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// GET all users (admin only)
router.get("/", verifyToken, checkRole("admin"), async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// UPDATE a user's role (admin only)
router.put("/:id/role", verifyToken, checkRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["consumer", "owner", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const result = await pool.query(
      "UPDATE users SET role = $1 WHERE id = $2 RETURNING *",
      [role, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;