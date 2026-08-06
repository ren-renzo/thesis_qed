// teacherSubjectController.js
const connection = require('../../../../config/db');

exports.getAssignedSubjects = async (req, res) => {
  try {
    const userId = req.user?.userId; // galing sa JWT payload (qed_authentication.id)

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: walang user ID na nakuha mula sa token.',
      });
    }

    const [rows] = await connection.query(
      `SELECT 
          ss.id AS subject_section_id,
          es.id AS subject_id,
          es.subject_code,
          es.subject_name,
          gl.id AS grade_level_id,
          gl.grade_level,
          gls.id AS section_id,
          gls.section_name
       FROM \`subject-section\` ss
       INNER JOIN teacher_table tt ON ss.teacher_id = tt.id
       INNER JOIN elem_subjects es ON ss.subject_id = es.id
       INNER JOIN grade_level_sections gls ON ss.section_id = gls.id
       INNER JOIN grade_level gl ON es.grade_level_id = gl.id
       WHERE tt.user_id = ?
       ORDER BY gl.id ASC, gls.section_name ASC, es.subject_name ASC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('Error fetching assigned subjects:', error);
    return res.status(500).json({
      success: false,
      message: 'Error sa pag-fetch ng assigned subjects.',
      error: error.message,
    });
  }
};

