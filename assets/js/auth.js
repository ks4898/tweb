const verifyRole = (roles) => {
    return (req, res, next) => {
      if (!req.session.userId) {
        return res.redirect("/");
      }
  
      if (!req.session.role || !roles.includes(req.session.role)) {
        return res.status(403).json({ message: "Forbidden. You do not have necessary privileges" });
      }
  
      next();
    };
  };
  
  module.exports = { verifyRole };
  