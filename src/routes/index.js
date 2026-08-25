const express = require("express");
const router = express.Router();

//==================================== A D M I N =======================================

//authentication
const authenticationRoutes = require("./../modules/authentication/authentication.router.js");

//loginrequency
const loginFreqencyRoutes = require("./../modules/authentication/loginfrequency.router.js")

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
router.use("/analytics", loginFreqencyRoutes);
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

//=================================== P A R E N T S ========================================

//dashboard routes
const parentsProfileRoutes = require("../modules/parents/parentsProfile/parentsProfile.router.js");
//linked children routes
const linkedChildrenRoutes = require("./../modules/parents/LinkedChildren/linkedChildren.router.js");

router.use("/profile", parentsProfileRoutes);
router.use("/linkedChildren", linkedChildrenRoutes);

module.exports = router;
