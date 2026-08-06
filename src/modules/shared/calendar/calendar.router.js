const express = require("express");
const router = express.Router();
const calendarManagement = require("./calendar.controller");


router.post("/addEvent", calendarManagement.createCalendarEvent);
router.get("/", calendarManagement.getCalendarEvents);
router.get("/:id", calendarManagement.getCalendarEventById);
router.put("/:id", calendarManagement.updateCalendarEvent);
router.delete("/:id", calendarManagement.deleteCalendarEvent);


module.exports = router;