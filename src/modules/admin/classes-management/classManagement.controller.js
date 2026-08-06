const connection = require("../../../../config/db");

// Mapping ng short day codes (frontend) papuntang full day name (DB)
const DAY_MAP = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
};

exports.createClass = async (req, res) => {
  const { gradeLevel, section, adviserId, schedule } = req.body;

  let conn;

  try {
    conn = await connection.getConnection();
    await conn.beginTransaction();

    // 0. Isang class lang dapat kada section
    const [existingClassForSection] = await conn.query(
      `SELECT id FROM classes WHERE section_id = ? LIMIT 1`,
      [section],
    );
    if (existingClassForSection.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: "Ang section na ito ay may class na. I-edit na lang ang existing class.",
      });
    }

    // 0b. Kunin ang active school year — kailangan ito para sa subject-section rows
    const [activeSY] = await conn.query(
      `SELECT id FROM school_year WHERE is_active = 1 LIMIT 1`,
    );
    if (activeSY.length === 0) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: "Walang active school year na naka-set.",
      });
    }
    const schoolYearId = activeSY[0].id;

    // 1. Insert sa `classes` table
    const classesQuery = `
      INSERT INTO classes (grade_level_id, section_id, class_adviser_id) 
      VALUES (?, ?, ?)
    `;
    const [classResult] = await conn.query(classesQuery, [
      gradeLevel,
      section,
      adviserId,
    ]);

    const newClassId = classResult.insertId;

    // 2. I-loop ang schedule
    if (schedule && Array.isArray(schedule) && schedule.length > 0) {
      for (const period of schedule) {
        const { subject, teacherId, startTime, endTime, days } = period;

        let subjectId;

        const [existingSubject] = await conn.query(
          `SELECT id FROM elem_subjects WHERE subject_name = ? AND grade_level_id = ?`,
          [subject, gradeLevel],
        );

        if (existingSubject.length > 0) {
          subjectId = existingSubject[0].id;
        } else {
          const [newSubjectResult] = await conn.query(
            `INSERT INTO elem_subjects (subject_name, grade_level_id) VALUES (?, ?)`,
            [subject, gradeLevel],
          );
          subjectId = newSubjectResult.insertId;
        }

        const scheduleQuery = `
          INSERT INTO class_schedule (class_id, subject_name, subject_teacher_id, start_time, end_time)
          VALUES (?, ?, ?, ?, ?)
        `;
        const [scheduleResult] = await conn.query(scheduleQuery, [
          newClassId,
          subject,
          teacherId,
          startTime,
          endTime,
        ]);

        const newScheduleId = scheduleResult.insertId;

        if (days && Array.isArray(days) && days.length > 0) {
          const daysQuery = `
            INSERT INTO class_schedule_day (class_schedule_id, day_of_week)
            VALUES (?, ?)
          `;

          for (const day of days) {
            const fullDayName = DAY_MAP[day] || day;
            await conn.query(daysQuery, [newScheduleId, fullDayName]);
          }
        }

        // 2b. I-sync din sa subject-section — dito kumukuha ang "My Subjects"
        // ng teacher, kaya kailangan laging naka-align sa schedule.
        await conn.query(
          `INSERT INTO \`subject-section\` (subject_id, section_id, teacher_id, school_year_id, status)
           VALUES (?, ?, ?, ?, 'Active')`,
          [subjectId, section, teacherId, schoolYearId],
        );
      }
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      message: "Class, subjects, and schedule created successfully!",
      classId: newClassId,
    });
  } catch (error) {
    if (conn) await conn.rollback();

    console.error("Database Error:", error);
    res.status(500).json({
      success: false,
      message: "Database error occurred while saving.",
    });
  } finally {
    if (conn) conn.release();
  }
};

// Update an existing class: updates classes row, then replaces its whole
// schedule AND its subject-section assignments (parehong gine-wipe at
// re-inserted mula sa payload, tulad ng class_schedule).
exports.updateClass = async (req, res) => {
  const { id } = req.params;
  const { gradeLevel, section, adviserId, schedule } = req.body;

  let conn;

  try {
    conn = await connection.getConnection();
    await conn.beginTransaction();

    // 1. Confirm the class exists
    const [existing] = await conn.query(
      `SELECT id FROM classes WHERE id = ? LIMIT 1`,
      [id],
    );
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: "Class not found.",
      });
    }

    // 1b. Isang class lang dapat kada section
    const [sectionTaken] = await conn.query(
      `SELECT id FROM classes WHERE section_id = ? AND id != ? LIMIT 1`,
      [section, id],
    );
    if (sectionTaken.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: "Ang section na ito ay may class na. Pumili ng ibang section.",
      });
    }

    // 1c. Kunin ang active school year
    const [activeSY] = await conn.query(
      `SELECT id FROM school_year WHERE is_active = 1 LIMIT 1`,
    );
    if (activeSY.length === 0) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: "Walang active school year na naka-set.",
      });
    }
    const schoolYearId = activeSY[0].id;

    // 2. Update the classes row itself
    await conn.query(
      `UPDATE classes SET grade_level_id = ?, section_id = ?, class_adviser_id = ? WHERE id = ?`,
      [gradeLevel, section, adviserId, id],
    );

    // 3. Wipe the existing schedule for this class (cascades to class_schedule_day)
    await conn.query(`DELETE FROM class_schedule WHERE class_id = ?`, [id]);

    // 3b. Wipe existing subject-section rows para sa section na ito, para
    // hindi mag-iwan ng stale/duplicate assignments bago i-rebuild
    await conn.query(
      `DELETE FROM \`subject-section\` WHERE section_id = ? AND school_year_id = ?`,
      [section, schoolYearId],
    );

    // 4. Re-insert the schedule from the request body
    if (schedule && Array.isArray(schedule) && schedule.length > 0) {
      for (const period of schedule) {
        const { subject, teacherId, startTime, endTime, days } = period;

        let subjectId;

        const [existingSubject] = await conn.query(
          `SELECT id FROM elem_subjects WHERE subject_name = ? AND grade_level_id = ?`,
          [subject, gradeLevel],
        );

        if (existingSubject.length > 0) {
          subjectId = existingSubject[0].id;
        } else {
          const [newSubjectResult] = await conn.query(
            `INSERT INTO elem_subjects (subject_name, grade_level_id) VALUES (?, ?)`,
            [subject, gradeLevel],
          );
          subjectId = newSubjectResult.insertId;
        }

        const [scheduleResult] = await conn.query(
          `INSERT INTO class_schedule (class_id, subject_name, subject_teacher_id, start_time, end_time)
           VALUES (?, ?, ?, ?, ?)`,
          [id, subject, teacherId, startTime, endTime],
        );

        const newScheduleId = scheduleResult.insertId;

        if (days && Array.isArray(days) && days.length > 0) {
          for (const day of days) {
            const fullDayName = DAY_MAP[day] || day;
            await conn.query(
              `INSERT INTO class_schedule_day (class_schedule_id, day_of_week) VALUES (?, ?)`,
              [newScheduleId, fullDayName],
            );
          }
        }

        // 4b. I-sync din sa subject-section
        await conn.query(
          `INSERT INTO \`subject-section\` (subject_id, section_id, teacher_id, school_year_id, status)
           VALUES (?, ?, ?, ?, 'Active')`,
          [subjectId, section, teacherId, schoolYearId],
        );
      }
    }

    await conn.commit();

    res.status(200).json({
      success: true,
      message: "Class updated successfully!",
      classId: Number(id),
    });
  } catch (error) {
    if (conn) await conn.rollback();

    console.error("Database Error:", error);
    res.status(500).json({
      success: false,
      message: "Database error occurred while updating.",
    });
  } finally {
    if (conn) conn.release();
  }
};

exports.getGradeLevels = async (req, res) => {
  try {
    const [rows] = await connection.query(
      `SELECT id, grade_level FROM grade_level ORDER BY id ASC`,
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Database Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch grade levels." });
  }
};

// Returns sections filtered by grade_level_id (query param), EXCLUDING
// sections na may class na — dahil isang class lang dapat kada section.
// Pass ?excludeClassId=<id> pag nag-e-edit para hindi ma-exclude yung
// sariling section ng class na ini-edit.
// GET /api/sections?gradeLevelId=2&excludeClassId=5
exports.getSectionsByGrade = async (req, res) => {
  const { gradeLevelId, excludeClassId } = req.query;

  if (!gradeLevelId) {
    return res
      .status(400)
      .json({ success: false, message: "gradeLevelId is required." });
  }

  try {
    let query = `
      SELECT id, section_name FROM grade_level_sections
      WHERE grade_level_id = ?
        AND id NOT IN (
          SELECT section_id FROM classes
          WHERE section_id IS NOT NULL
    `;
    const params = [gradeLevelId];

    if (excludeClassId) {
      query += ` AND id != ?`;
      params.push(excludeClassId);
    }

    query += `
        )
      ORDER BY section_name ASC
    `;

    const [rows] = await connection.query(query, params);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Database Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch sections." });
  }
};

// Get Teachers — EXCLUDING teachers na adviser na sa ibang class, dahil
// isang adviser lang dapat kada section. Pass ?excludeClassId=<id> pag
// nag-e-edit para hindi ma-exclude yung sariling adviser ng class.
exports.getTeachers = async (req, res) => {
  const { excludeClassId } = req.query;

  try {
    let query = `
      SELECT id, first_name, last_name, middle_name, email_address, contact_number
      FROM teacher_table
      WHERE is_deleted = 0 AND status = 'active'
        AND id NOT IN (
          SELECT class_adviser_id FROM classes
    `;
    const params = [];

    if (excludeClassId) {
      query += ` WHERE id != ?`;
      params.push(excludeClassId);
    }

    query += `
        )
      ORDER BY last_name ASC
    `;

    const [rows] = await connection.query(query, params);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Database Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch teachers." });
  }
};

//get subjects per grade level
exports.getSubjectsByGrade = async (req, res) => {
  const { gradeLevel } = req.params;

  try {
    const subjectsQuery = `
      SELECT 
        id,
        subject_name,
        grade_level_id
      FROM elem_subjects
      WHERE grade_level_id = ?
    `;

    const [rows] = await connection.query(subjectsQuery, [gradeLevel]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No subjects found for this grade level.",
      });
    }

    res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({
      success: false,
      message: "Database error occurred.",
    });
  }
};

const ADVISER_NAME_EXPR = "CONCAT(t.first_name, ' ', t.last_name)";
// Get all classes with grade, section, adviser, schedule, and student count
exports.getClasses = async (req, res) => {
  console.log("🔥 getClasses HIT");
  try {
    const [classes] = await connection.query(`
      SELECT 
  c.id,
  gl.id   AS grade_level_id,
  gl.grade_level,
  gs.id   AS section_id,
  gs.section_name,
  c.class_adviser_id AS adviser_id,
  ${ADVISER_NAME_EXPR} AS adviser_name,
  t.email_address AS adviser_email,
  t.contact_number AS adviser_contact,
  (
    SELECT COUNT(*) FROM elem_students es
    WHERE es.grade_level_id = c.grade_level_id
      AND es.section_id = c.section_id
      AND es.is_deleted = 0
  ) AS student_count
FROM classes c
JOIN grade_level gl ON gl.id = c.grade_level_id
JOIN grade_level_sections gs ON gs.id = c.section_id
LEFT JOIN teacher_table t ON t.id = c.class_adviser_id
ORDER BY gl.id ASC, gs.section_name ASC
    `);

    if (classes.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const classIds = classes.map((c) => c.id);
    const [scheduleRows] = await connection.query(
      `
        SELECT 
  cs.id,
  cs.class_id,
  cs.subject_name,
  cs.subject_teacher_id,
  CONCAT(t2.first_name, ' ', t2.last_name) AS subject_teacher_name,
  cs.start_time,
  cs.end_time,
  GROUP_CONCAT(csd.day_of_week ORDER BY FIELD(csd.day_of_week,
    'Monday','Tuesday','Wednesday','Thursday','Friday')) AS days
FROM class_schedule cs
LEFT JOIN teacher_table t2 ON t2.id = cs.subject_teacher_id
LEFT JOIN class_schedule_day csd ON csd.class_schedule_id = cs.id
WHERE cs.class_id IN (?)
GROUP BY cs.id
ORDER BY cs.start_time ASC
      `,
      [classIds],
    );

    const scheduleByClass = {};
    for (const row of scheduleRows) {
      if (!scheduleByClass[row.class_id]) scheduleByClass[row.class_id] = [];
      scheduleByClass[row.class_id].push({
        id: row.id,
        subject: row.subject_name,
        teacherId: row.subject_teacher_id,
        teacherName: row.subject_teacher_name || "Unassigned",
        startTime: row.start_time,
        endTime: row.end_time,
        days: row.days ? row.days.split(",") : [],
      });
    }

    const data = classes.map((c) => ({
      id: c.id,
      gradeLevelId: c.grade_level_id,
      gradeLevel: c.grade_level,
      sectionId: c.section_id,
      section: c.section_name,
      adviserId: c.adviser_id,
      adviserName: c.adviser_name || "Unassigned",
      adviserEmail: c.adviser_email || null,
      adviserContact: c.adviser_contact || null,
      studentCount: c.student_count,
      schedule: scheduleByClass[c.id] || [],
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Database Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch classes." });
  }
};

// Delete class
exports.deleteClass = async (req, res) => {
  const { id } = req.params;
  try {
    await connection.query(`DELETE FROM classes WHERE id = ?`, [id]);
    res.status(200).json({ success: true, message: "Class deleted." });
  } catch (error) {
    console.error("Database Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete class." });
  }
};