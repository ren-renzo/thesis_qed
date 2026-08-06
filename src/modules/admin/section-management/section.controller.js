const connection = require("../../../../config/db");

exports.getGrade = async ( req, res ) => { 
    try {
    const [rows] = await connection.query(
      'SELECT id, grade_level FROM grade_level ORDER BY grade_level ASC'
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching grade levels:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}

exports.createSection = async (req, res) => {
  try {
    const { gradeLevel, sectionName } = req.body;

    if (!gradeLevel || !sectionName || sectionName.trim() === '') {
      return res.status(400).json({
        status: 'fail',
        message: 'Choose grade level and enter new section.',
      });
    }

    const cleanName = sectionName.trim();

    const [existing] = await connection.execute(
      `SELECT id FROM grade_level_sections WHERE grade_level_id = ? AND LOWER(section_name) = LOWER(?) LIMIT 1`,
      [gradeLevel, cleanName]
    );

    // if (existing.length > 0) {
    //   return res.status(409).json({
    //     status: 'fail',
    //     message: `"${cleanName}" is already in Grade ${gradeLevel} and cannot be duplicated.`,
    //   });
    // }

    const [result] = await connection.execute(
      `INSERT INTO grade_level_sections (grade_level_id, section_name) VALUES (?, ?)`,
      [gradeLevel, cleanName]
    );

    return res.status(201).json({
      status: 'success',
      message: 'Section added successfully!',
      data: {
        id: result.insertId,
        grade_level_id: gradeLevel, 
        section_name: cleanName,
      },
    });

  } catch (error) {
    console.error('Error creating section:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error. Try again.',
    });
  }
};

exports.getSectionsByGradeLevel = async (req, res) => {
  try {
    const { gradeLevel } = req.params;

    const [rows] = await connection.execute(
      `SELECT id, grade_level_id, section_name
       FROM grade_level_sections
       WHERE grade_level_id = ? AND is_active = 1 
       ORDER BY section_name ASC`,
      [gradeLevel]
    );

    return res.status(200).json({
      status: 'success',
      message: rows.length > 0 
        ? 'Sections retrieved successfully.' 
        : `No sections found for Grade ${gradeLevel}`,
      data: rows,
    });
  } catch (error) {
    console.error('Error fetching sections:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
};

exports.getTeachers = async (req, res) => {
  try {
    const [rows] = await connection.execute(
      `SELECT id, user_id, first_name, last_name, middle_name, email_address, contact_number
       FROM teacher_table
       WHERE is_deleted = 0 AND status = 'active'
       ORDER BY last_name ASC`,
    );  

    return res.status(200).json({   
    status: 'success',
    message: rows.length > 0  
      ? 'Teachers retrieved successfully.'
      : 'No teachers found.',
    data: rows,
  });
  } catch (error) {
    console.error('Error fetching teachers:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
};

exports.deactivateSection = async (req, res) => {
  try {
    const { id } = req.params;
    await connection.execute(
      `UPDATE grade_level_sections SET is_active = 0 WHERE id = ?`,
      [id]
    );
    return res.status(200).json({ status: 'success', message: 'Section removed.' });
  } catch (error) {
    console.error('Error deactivating section:', error);
    return res.status(500).json({ status: 'error', message: 'Server error. Try again.' });
  }
};