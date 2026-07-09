const pool = require("../config/db");

function checkRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const result = await pool.query(
        "SELECT role FROM users WHERE firebase_uid = $1",
        [req.user.uid]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ message: "User not found in database" });
      }

      const userRole = result.rows[0].role;

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      req.userRole = userRole; // handy to have downstream
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.message });
    }
  };
}

module.exports = checkRole;