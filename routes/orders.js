const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// CREATE an order (checkout) — expects: consumer_id (or guest info), restaurant_id, payment_method, items: [{ menu_item_id, quantity }]
router.post("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const { consumer_id, guest_name, guest_phone, restaurant_id, payment_method, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Order must contain at least one item" });
    }

    await client.query("BEGIN");

    // 1. Fetch current prices for all items in the cart (never trust price from frontend)
    const menuItemIds = items.map((i) => i.menu_item_id);
    const priceResult = await client.query(
      "SELECT id, price FROM menu_items WHERE id = ANY($1::int[])",
      [menuItemIds]
    );
    const priceMap = {};
    priceResult.rows.forEach((row) => {
      priceMap[row.id] = parseFloat(row.price);
    });

    // 2. Calculate total from real DB prices
    let total = 0;
    items.forEach((item) => {
      total += priceMap[item.menu_item_id] * item.quantity;
    });

    // 3. Insert the order
    const orderResult = await client.query(
      `INSERT INTO orders (consumer_id, guest_name, guest_phone, restaurant_id, status, payment_method, total_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [consumer_id || null, guest_name || null, guest_phone || null, restaurant_id, "pending", payment_method, total]
    );
    const order = orderResult.rows[0];

    // 4. Insert each order item
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
router.get("/restaurant/:restaurantId", async (req, res) => {
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

// GET single order with its items (order detail / receipt)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const orderResult = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }
    const itemsResult = await pool.query(
      `SELECT oi.*, mi.name, mi.image_url
       FROM order_items oi
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = $1`,
      [id]
    );
    res.json({ ...orderResult.rows[0], items: itemsResult.rows });
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