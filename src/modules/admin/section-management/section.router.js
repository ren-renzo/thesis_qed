const express = require("express");
const router = express.Router();
const sectionManagement = require("./section.controller");


//get grade
router.get('/getGradeLevel', sectionManagement.getGrade);

// //Add section
router.post('/addSection', sectionManagement.createSection);

//get sections
router.get('/getSections/:gradeLevel', sectionManagement.getSectionsByGradeLevel);

//get teachers
router.get('/getTeachers', sectionManagement.getTeachers);  

router.put('/deleteSections/:id', sectionManagement.deactivateSection);




module.exports = router;
