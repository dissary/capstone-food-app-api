const request = require("supertest");
const app = require("../app");

describe("POST /api/orders", () => {
  it("rejects an order with no items", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({
        restaurant_id: 1,
        payment_method: "counter",
        guest_name: "Test User",
        guest_phone: "0123456789",
        items: [],
      });
    expect(res.status).toBe(400);
  });

  it("creates a guest order with valid items", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({
        restaurant_id: 1,
        payment_method: "counter",
        guest_name: "Test User",
        guest_phone: "0123456789",
        items: [{ menu_item_id: 1, quantity: 1 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.total_amount).toBeDefined();
    expect(res.body.items.length).toBe(1);
  });
});