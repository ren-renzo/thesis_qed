const express = require("express");
const router = express.Router();
const authentication = require("./authentication.controller");
const verifyToken = require("./authentication.middleware")

//saving authentication
router.post('/register', authentication.register)

//login user
router.post('/login', authentication.login);

//logout user
router.post('/logout', authentication.logout);
// router.get('/admin/dashboard', verifyToken, requireRole('admin'), adminController.dashboard);
// router.get('/teacher/class', verifyToken, requireRole('teacher', 'principal', 'admin'), teacherController.getClass);
router.get('/me', verifyToken, authentication.me);
module.exports = router;