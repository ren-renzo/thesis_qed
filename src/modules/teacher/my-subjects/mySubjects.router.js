const express = require("express");
const router = express.Router();
const mySubjectsController = require("./mySubjects.controller");
const verifyToken = require("../../authentication/authentication.middleware");

router.get("/subjects", verifyToken, mySubjectsController.getAssignedSubjects);

module.exports = router;