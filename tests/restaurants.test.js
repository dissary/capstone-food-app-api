const request = require("supertest");
const app = require("../app");

describe("GET /api/restaurants", () => {
  it("returns an array of restaurants", async () => {
    const res = await request(app).get("/api/restaurants");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("GET /api/restaurants/:id", () => {
  it("returns 404 for a non-existent restaurant", async () => {
    const res = await request(app).get("/api/restaurants/999999");
    expect(res.status).toBe(404);
  });
});