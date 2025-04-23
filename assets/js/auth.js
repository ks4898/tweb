const path = require("path");
const verifyRole = (roles) => {
  return (req, res, next) => {
    if (!req.session.userId) {
      return res.status(404).sendFile(path.join(__dirname, '../../public', '404.html'));
    }

    if (!req.session.role || !roles.includes(req.session.role)) {
      return res.status(404).sendFile(path.join(__dirname, '../../public', '404.html'));
    }

    next();
  };
};

module.exports = { verifyRole };
