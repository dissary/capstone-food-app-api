const { auth } = require("../config/firebaseAdmin");

async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      req.user = await auth.verifyIdToken(token);
    } catch (err) {
      req.user = null; // invalid token, treat as guest
    }
  } else {
    req.user = null; // no token, guest
  }
  next();
}

module.exports = optionalAuth;