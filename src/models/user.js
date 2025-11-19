const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    min: 3,
    max: 30,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    min: 3,
    max: 30,
    trim: true
  },
  email: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  hashPassword:{
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  contactNumber: {
    type: String
  },
  profileImage: {
    type: String
  }
  }, {timestamps: true}
)

UserSchema.virtual("password").set(function(password){
  this.hashPassword = bcrypt.hashSync(password, 12);
});

UserSchema.virtual('fullName').get(function(){
  return `${this.firstName} ${this.lastName}`;
})

UserSchema.methods = {
  authenticate: function(password){
    return bcrypt.compareSync(password, this.hashPassword );
  }
}


UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', UserSchema);
