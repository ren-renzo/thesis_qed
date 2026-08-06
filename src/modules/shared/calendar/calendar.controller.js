const connection = require("../../../../config/db");

const VALID_ROLES = ["principal", "teacher", "parent"];

// --------------------------------------------------------
// Create calendar event
// --------------------------------------------------------
exports.createCalendarEvent = async (req, res) => {
  const {
    title,
    description,
    calendarDate,
    startTime,
    endTime,
    gradeLevelId, // null/"" = All Grade Levels
    sectionId,    // null/"" = All Sections
    roles,        // array, e.g. ['teacher', 'parent']
    createdBy,    // user_id ng naka-login na admin/principal
  } = req.body;

  // Basic validation
  if (!title || !calendarDate) {
    return res.status(400).json({
      success: false,
      message: "Title and date are required.",
    });
  }

  if (!roles || !Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one target role (Send To) is required.",
    });
  }

  const invalidRoles = roles.filter((r) => !VALID_ROLES.includes(r));
  if (invalidRoles.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Invalid role(s): ${invalidRoles.join(", ")}`,
    });
  }

  let conn;
  try {
    conn = await connection.getConnection();
    await conn.beginTransaction();

    // 1. Insert sa `elem_calendar`
    const [result] = await conn.query(
      `INSERT INTO elem_calendar 
        (title, description, calendar_date, start_time, end_time, grade_level_id, section_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description || null,
        calendarDate,
        startTime || null,
        endTime || null,
        gradeLevelId || null,
        sectionId || null,
        createdBy || null,
      ]
    );

    const calendarId = result.insertId;

    // 2. Insert sa `calendar_target_roles` (isang row per napiling role)
    const roleValues = roles.map((r) => [calendarId, r]);
    await conn.query(
      `INSERT INTO calendar_target_roles (calendar_id, role) VALUES ?`,
      [roleValues]
    );

    await conn.commit();

    res.status(201).json({
      success: true,
      message: "Calendar event created successfully!",
      calendarId,
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

// --------------------------------------------------------
// Get single calendar event by ID
// --------------------------------------------------------
exports.getCalendarEventById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await connection.query(
      `
        SELECT 
          ec.id,
          ec.title,
          ec.description,
          ec.calendar_date,
          ec.start_time,
          ec.end_time,
          ec.grade_level_id,
          gl.grade_level,
          ec.section_id,
          gs.section_name,
          ec.created_by,
          ec.created_at
        FROM elem_calendar ec
        LEFT JOIN grade_level gl ON gl.id = ec.grade_level_id
        LEFT JOIN grade_level_sections gs ON gs.id = ec.section_id
        WHERE ec.id = ? AND ec.is_deleted = 0
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Calendar event not found.",
      });
    }

    const [roleRows] = await connection.query(
      `SELECT role FROM calendar_target_roles WHERE calendar_id = ?`,
      [id]
    );

    const event = rows[0];
    res.status(200).json({
      success: true,
      data: {
        id: event.id,
        title: event.title,
        description: event.description,
        calendarDate: event.calendar_date,
        startTime: event.start_time,
        endTime: event.end_time,
        gradeLevelId: event.grade_level_id,
        gradeLevel: event.grade_level || "All Grade Levels",
        sectionId: event.section_id,
        section: event.section_name || "All Sections",
        createdBy: event.created_by,
        createdAt: event.created_at,
        roles: roleRows.map((r) => r.role),
      },
    });
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch calendar event.",
    });
  }
};

// --------------------------------------------------------
// Update calendar event
// --------------------------------------------------------
exports.updateCalendarEvent = async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    calendarDate,
    startTime,
    endTime,
    gradeLevelId,
    sectionId,
    roles,
  } = req.body;

  if (!title || !calendarDate) {
    return res.status(400).json({
      success: false,
      message: "Title and date are required.",
    });
  }

  if (roles && Array.isArray(roles)) {
    const invalidRoles = roles.filter((r) => !VALID_ROLES.includes(r));
    if (invalidRoles.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid role(s): ${invalidRoles.join(", ")}`,
      });
    }
  }

  let conn;
  try {
    conn = await connection.getConnection();
    await conn.beginTransaction();

    const [updateResult] = await conn.query(
      `UPDATE elem_calendar
       SET title = ?, description = ?, calendar_date = ?, start_time = ?, 
           end_time = ?, grade_level_id = ?, section_id = ?
       WHERE id = ? AND is_deleted = 0`,
      [
        title,
        description || null,
        calendarDate,
        startTime || null,
        endTime || null,
        gradeLevelId || null,
        sectionId || null,
        id,
      ]
    );

    if (updateResult.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: "Calendar event not found.",
      });
    }

    // Kung may bagong roles, i-replace lahat ng dati (delete then re-insert)
    if (roles && Array.isArray(roles) && roles.length > 0) {
      await conn.query(`DELETE FROM calendar_target_roles WHERE calendar_id = ?`, [id]);
      const roleValues = roles.map((r) => [id, r]);
      await conn.query(
        `INSERT INTO calendar_target_roles (calendar_id, role) VALUES ?`,
        [roleValues]
      );
    }

    await conn.commit();

    res.status(200).json({
      success: true,
      message: "Calendar event updated successfully!",
    });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error("Database Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update calendar event.",
    });
  } finally {
    if (conn) conn.release();
  }
};

// --------------------------------------------------------
// Delete calendar event (soft delete)
// --------------------------------------------------------
exports.deleteCalendarEvent = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await connection.query(
      `UPDATE elem_calendar SET is_deleted = 1, deleted_at = NOW() WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Calendar event not found.",
      });
    }

    res.status(200).json({ success: true, message: "Calendar event deleted." });
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete calendar event.",
    });
  }
};

// --------------------------------------------------------
// Get all calendar events (with target roles, grade level, section, creator)
// --------------------------------------------------------
exports.getCalendarEvents = async (req, res) => {
  try {
    const [events] = await connection.query(`
      SELECT 
        ec.id,
        ec.title,
        ec.description,
        ec.calendar_date,
        ec.start_time,
        ec.end_time,
        ec.grade_level_id,
        gl.grade_level,
        ec.section_id,
        gs.section_name,
        ec.created_by,
        qa.role AS created_by_role,
        COALESCE(
          CONCAT(a.first_name, ' ', a.last_name),
          CONCAT(p.first_name, ' ', p.last_name),
          CONCAT(t.first_name, ' ', t.last_name)
        ) AS created_by_name,
        ec.created_at
      FROM elem_calendar ec
      LEFT JOIN grade_level gl ON gl.id = ec.grade_level_id
      LEFT JOIN grade_level_sections gs ON gs.id = ec.section_id
      LEFT JOIN qed_authentication qa ON qa.id = ec.created_by
      LEFT JOIN admin_table a ON a.user_id = ec.created_by
      LEFT JOIN principal_table p ON p.user_id = ec.created_by
      LEFT JOIN teacher_table t ON t.user_id = ec.created_by
      WHERE ec.is_deleted = 0
      ORDER BY ec.calendar_date ASC, ec.start_time ASC
    `);

    if (events.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const eventIds = events.map((e) => e.id);
    const [roleRows] = await connection.query(
      `SELECT calendar_id, role FROM calendar_target_roles WHERE calendar_id IN (?)`,
      [eventIds]
    );

    const rolesByEvent = {};
    for (const row of roleRows) {
      if (!rolesByEvent[row.calendar_id]) rolesByEvent[row.calendar_id] = [];
      rolesByEvent[row.calendar_id].push(row.role);
    }

    const data = events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      calendarDate: e.calendar_date,
      startTime: e.start_time,
      endTime: e.end_time,
      gradeLevelId: e.grade_level_id,
      gradeLevel: e.grade_level || "All Grade Levels",
      sectionId: e.section_id,
      section: e.section_name || "All Sections",
      createdBy: e.created_by,
      createdByRole: e.created_by_role || null,
      createdByName: e.created_by_name || "Unknown",
      createdAt: e.created_at,
      roles: rolesByEvent[e.id] || [],
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch calendar events." });
  }
};