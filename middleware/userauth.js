const usermodel = require("../model/usermodel");
const mongoose = require("mongoose");

const checksession = (req, res, next) => {
  if (req.session && req.session.user) {
    next();
  } else {
    res.redirect("/user/register");
  }
};

const isLogin = (req, res, next) => {
  if (req.session && req.session.user) {
    res.redirect("/user/home");
  } else {
    next();
  }
};

const checkBan = async (req, res, next) => {
  try {
    if (
      !req.session.user ||
      !mongoose.Types.ObjectId.isValid(req.session.user)
    ) {
      return res.redirect("/user/register");
    }
    const user = await usermodel.findById(req.session.user);
    if (!user || user.status === "Banned") {
      req.session.destroy(() => {
        res.redirect("/user/register?blocked=true");
      });
      return;
    }

    next();
  } catch (error) {
    console.error(error);
  }
};

module.exports = { checksession, isLogin, checkBan };