const request = require("supertest");
const app = require("../app");

describe("GET /api/menu-items/restaurant/:restaurantId", () => {
  it("returns an array of menu items", async () => {
    const res = await request(app).get("/api/menu-items/restaurant/1");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});