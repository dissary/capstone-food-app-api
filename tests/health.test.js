const request = require("supertest");
const app = require("../app");

describe("GET /api/health", () => {
  it("returns status ok and a db timestamp", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.dbTime).toBeDefined();
  });
});