const bcrypt = require('bcrypt');
require("dotenv").config()
// Hash a password
async function hashPassword(password) {
    const saltRounds = Number(process.env.Gen_rounds); // Cost factor
    const salt = await bcrypt.genSalt(saltRounds); // Generate salt
    const hashedPassword = await bcrypt.hash(password, salt); // Hash the password
    return hashedPassword;
}


module.exports ={
    hashPassword
}


