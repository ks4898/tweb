const verifyRole = (roles) => {
    return (req, res, next) => {
      if (!req.session.userId) {
        return res.redirect("/");
      }
  
      if (!req.session.role || !roles.includes(req.session.role)) {
        return res.redirect("/");
      }
  
      next();
    };
  };
  
  module.exports = { verifyRole };
  