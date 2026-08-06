const express = require("express");
const router = express.Router();

//==================================== A D M I N =======================================

//authentication
const authenticationRoutes = require("./../modules/authentication/authentication.router.js");

//user accounts
const userRecordRoutes = require("./../modules/admin/user-record/userRecord.router.js");

//student records
const studentRecordRoutes = require("./../modules/admin/student-record/studentRecord.router.js");

//classes management
const classesManagementRoutes = require("./../modules/admin/classes-management/classManagement.router.js");

//section management
const sectionManagementRoutes = require("./../modules/admin/section-management/section.router.js");

//academics
// const academicsRoutes = require("./../modules/admin/academics/academics.router.js");

//subject management
const subjectManagementRoutes = require("./../modules/admin/subject-management/subjectManagement.router.js");

//utilities
const gradeLevelRoutes = require("./../modules/utils/gradeLevels.router.js");
const calendarRoutes = require("./../modules/shared/calendar/calendar.router.js");

//settings
const settingsRoutes = require("../modules/settings/school-year-management/sy.router.js");

router.use("/auth", authenticationRoutes);
router.use("/user", userRecordRoutes);
router.use("/student", studentRecordRoutes);
router.use("/classes", classesManagementRoutes);
router.use("/section", sectionManagementRoutes);
// router.use("/academics", academicsRoutes);
router.use("/subject", subjectManagementRoutes);
router.use("/gradeLevel", gradeLevelRoutes);
router.use("/calendar", calendarRoutes);
router.use("/sy", settingsRoutes);

//==================================== T E A C H E R =======================================

//teacher routes
const mySubjectRoutes = require("./../modules/teacher/my-subjects/mySubjects.router.js");

router.use("/mySubjects", mySubjectRoutes);

module.exports = router;
