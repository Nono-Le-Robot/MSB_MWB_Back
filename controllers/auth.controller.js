const userModel = require("../models/auth.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

module.exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  const checkUser = await userModel.findOne({ username });
  const checkEmail = await userModel.findOne({ email });
  if (checkUser) {
    return res.json({ msg: "Username already used", status: false });
  }
  if (checkEmail) {
    return res.json({ msg: "Email already used", status: false });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await new userModel({
    username: username,
    email: email,
    password: hashedPassword,
  });

  newUser
    .save()
    .then(() => {
      res
        .status(200)
        .json({ msg: "user created", username: username, email: email });
    })
    .catch((err) => res.status(400).json({ error: err.message }));
};

module.exports.login = async (req, res) => {
  userModel
    .findOne({ username: req.body.username })
    .then((user) => {
      if (!user) {
        return res.json({ msg: "User not found", status: false });
      }
      bcrypt
        .compare(req.body.password, user.password)
        .then((valid) => {
          if (!valid) {
            return res.json({
              msg: "Username or password invalid",
              status: false,
            });
          }

          function generateAcessToken(data) {
            return jwt.sign(
              { data },
              `${process.env.ACCESS_TOKEN_SECRET}`,
              { expiresIn: "100y" }
            );
            // res.cookie("jwt",token,{httpOnly : true,  maxAge: durationTokenLogin})
          }
          const acessToken = generateAcessToken(user);
          res.status(200).json({
            userId: user._id,
            username: req.body.username,
            iat: acessToken,
            password: undefined,
          });
        })
        .catch((error) => res.status(401).send(error.message));
    })
    .catch((error) => res.status(401).send(error.message));
};
