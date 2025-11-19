const User = require('../models/user')
const jwt = require('jsonwebtoken');
const fs = require('fs');

exports.signup = async (req, res) => {
  try {
    const userFoundByEmail = await User.findOne({ email: req.body.email });
    const userFoundByUsername = await User.findOne({ username: req.body.username });

    if (userFoundByEmail || userFoundByUsername) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'User already exists' });
    } else {
      const { firstName, lastName, username, password, email, adminPassword, role } = req.body;
      const newUser = new User({
        firstName,
        lastName,
        username,
        password,
        email,
      });

      if(req.file){
        newUser.profileImage = req.file.filename
      }

      if (role) {
        if (adminPassword === process.env.ADMIN_PASSWORD) {
          newUser.role = role;
        } else {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: "Wrong admin password" });
        }
      }

      const savedUser = await newUser.save();
      if (savedUser === newUser) {
        const token = jwt.sign({ _id: savedUser._id, role: savedUser.role }, process.env.JWT_SECRET, { expiresIn: '2h' });
        return res.json({token, user: savedUser });
      } else {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'Error saving the user' });
      }
    }
  } catch (error) {
    console.log(error);
    console.error(error.errors);
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: 'Something went wrong', errors: error.errors });
  }
};

exports.signin = async (req, res) => {
  try {
    const foundUser = await User.findOne({ email: req.body.email });
    if (!foundUser) return res.status(400).json({ message: "Incorrect email or password" });

    if (foundUser.authenticate(req.body.password)) {
      const token = jwt.sign({ _id: foundUser._id, role: foundUser.role }, process.env.JWT_SECRET, { expiresIn: '2h' });
      const { _id, firstName, lastName, email, role, fullName } = foundUser;

      return res.status(200).json({
        token,
        user: {
          _id,
          firstName,
          lastName,
          email,
          role,
          fullName
        }
      });
    } else {
      return res.status(400).json({ message: "Invalid email or password" });
    }

  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: "Something went wrong", error: error });
  }
};