const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const verifyToken = require("../middleware/verifyToken");
const checkRole = require("../middleware/checkRole");

const optionalAuth = require("../middleware/optionalAuth");

router.post("/", optionalAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { guest_name, guest_phone, restaurant_id, payment_method, items, stripe_payment_id, status } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Order must contain at least one item" });
    }

    // Resolve consumer_id from token if logged in
    let consumer_id = null;
    if (req.user) {
      const userResult = await client.query("SELECT id FROM users WHERE firebase_uid = $1", [req.user.uid]);
      if (userResult.rows.length > 0) {
        consumer_id = userResult.rows[0].id;
      }
    }

    await client.query("BEGIN");

    const menuItemIds = items.map((i) => i.menu_item_id);
    const priceResult = await client.query(
      "SELECT id, price FROM menu_items WHERE id = ANY($1::int[])",
      [menuItemIds]
    );
    const priceMap = {};
    priceResult.rows.forEach((row) => { priceMap[row.id] = parseFloat(row.price); });

    let total = 0;
    items.forEach((item) => { total += priceMap[item.menu_item_id] * item.quantity; });

    const orderResult = await client.query(
      `INSERT INTO orders (consumer_id, guest_name, guest_phone, restaurant_id, status, payment_method, total_amount, stripe_payment_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [consumer_id, guest_name || null, guest_phone || null, restaurant_id, status || "pending", payment_method, total, stripe_payment_id || null]
    );
    const order = orderResult.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_order)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.menu_item_id, item.quantity, priceMap[item.menu_item_id]]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ ...order, items });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

// GET all orders for a consumer (order history)
router.get("/consumer/:consumerId", async (req, res) => {
  try {
    const { consumerId } = req.params;
    const result = await pool.query(
      "SELECT * FROM orders WHERE consumer_id = $1 ORDER BY created_at DESC",
      [consumerId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// GET all orders for a restaurant (owner dashboard)
router.get("/restaurant/:restaurantId", verifyToken, checkRole("owner", "admin"), async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const result = await pool.query(
      "SELECT * FROM orders WHERE restaurant_id = $1 ORDER BY created_at DESC",
      [restaurantId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// GET orders for the currently logged-in consumer
router.get("/mine", verifyToken, async (req, res) => {
  try {
    const userResult = await pool.query("SELECT id FROM users WHERE firebase_uid = $1", [req.user.uid]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const userId = userResult.rows[0].id;

    const result = await pool.query(
      "SELECT * FROM orders WHERE consumer_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// GET single order with its items (order detail / receipt)
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const orderResult = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }
    const order = orderResult.rows[0];

    // Guest orders (no consumer_id) — anyone with the link can view (matches guest checkout flow)
    if (!order.consumer_id) {
      const itemsResult = await pool.query(
        `SELECT oi.*, mi.name, mi.image_url FROM order_items oi JOIN menu_items mi ON oi.menu_item_id = mi.id WHERE oi.order_id = $1`,
        [id]
      );
      return res.json({ ...order, items: itemsResult.rows });
    }

    // Order belongs to a registered consumer — must be logged in
    if (!req.user) {
      return res.status(401).json({ message: "Login required to view this order" });
    }

    const userResult = await pool.query("SELECT id, role FROM users WHERE firebase_uid = $1", [req.user.uid]);
    if (userResult.rows.length === 0) {
      return res.status(403).json({ message: "Not authorized to view this order" });
    }
    const { id: userId, role } = userResult.rows[0];

    // Allowed if: it's their own order, OR they're an owner/admin managing that restaurant
    const isOwnerOfOrder = order.consumer_id === userId;
    const isOwnerOrAdmin = role === "owner" || role === "admin";

    if (!isOwnerOfOrder && !isOwnerOrAdmin) {
      return res.status(403).json({ message: "Not authorized to view this order" });
    }

    const itemsResult = await pool.query(
      `SELECT oi.*, mi.name, mi.image_url FROM order_items oi JOIN menu_items mi ON oi.menu_item_id = mi.id WHERE oi.order_id = $1`,
      [id]
    );
    res.json({ ...order, items: itemsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// UPDATE order status (owner updates: pending -> paid -> completed, etc.)
router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;