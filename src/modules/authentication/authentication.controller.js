const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const connection = require('../../../config/db'); // mysql2 pool with .promise()
const ROLE_TABLES = require('../../../config/roleTables');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '1h';

// exports.login = async (req, res) => {
//   try {
//     const { userName, password } = req.body;

//     // 1. Validate input
//     // if (!userName || !password) {
//     //   return res.status(400).json({ message: 'Username and password are required' });
//     // }

//     // 2. Query single table
//     const [rows] = await connection.query(
//       'SELECT * FROM qed_authentication WHERE user_name = ? LIMIT 1',
//       [userName]
//     );

//     if (rows.length === 0) {
//       return res.status(401).json({ message: 'Invalid credentials' });
//     }

//     const user = rows[0];

//     // 3. Compare password
//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.status(401).json({ message: 'Invalid Password' });
//     }

//     // 4. Issue token with role
//     const token = jwt.sign(
//       { userId: user.id, userName: user.user_name, role: user.role },
//       JWT_SECRET,
//       { expiresIn: JWT_EXPIRES_IN }
//     );

//     // 5. Send response
//     res
//       .cookie('token', token, {
//         httpOnly: true,
//         secure: process.env.NODE_ENV === 'production',
//         sameSite: 'strict',
//         maxAge: 60 * 60 * 1000,
//       })
//       .status(200)
//       .json({
//         message: 'Login successful',
//         user: {
//           id: user.id,
//           user_name: user.user_name,
//           role: user.role,
//           token,
//         },
//       });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Server error' });
//   }
// };

exports.login = async (req, res) => {
  try {
    const { userName, password } = req.body;

    // 1. Hanapin ang account sa authentication table
    const [rows] = await connection.query(
      'SELECT * FROM qed_authentication WHERE user_name = ? LIMIT 1',
      [userName]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = rows[0];

    // 2. Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid Password' });
    }

    // 3. Hanapin ang tamang role table
    const table = ROLE_TABLES[user.role];

    if (!table) {
      return res.status(500).json({ message: 'Invalid user role configuration.' });
    }

    // 4. Check kung soft-deleted o inactive ang profile
    const [profileRows] = await connection.query(
      `SELECT is_deleted, status FROM ${table} WHERE user_id = ? LIMIT 1`,
      [user.id]
    );

    if (profileRows.length === 0) {
      return res.status(403).json({ message: 'User profile not found.' });
    }

    const profile = profileRows[0];

    if (profile.is_deleted === 1) {
      return res.status(403).json({ message: 'Account has been deleted.' });
    }

    if (
      profile.status &&
      profile.status.toLowerCase() === 'inactive'
    ) {
      return res.status(403).json({ message: 'Account is inactive.' });
    }

    // 5. Issue token
    const token = jwt.sign(
      { userId: user.id, userName: user.user_name, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // 6. Send response
    return res
      .cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000,
      })
      .status(200)
      .json({
        message: 'Login successful',
        user: {
          id: user.id,
          user_name: user.user_name,
          role: user.role,
          token,
        },
      });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.me = async (req, res) => {
  try {
    // galing ito sa verifyToken middleware (req.user = decoded JWT payload)
    const { userId, userName, role } = req.user;

    res.status(200).json({
      user: {
        id: userId,
        user_name: userName,
        role: role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};



exports.register = async (req, res) => {
  try {
    const { userName, password, role } = req.body;
    const normalizedRole = role?.toUpperCase();

    // if (!name || !email || !password) {
    //   return res.status(400).json({ message: 'Name, email and password are required.' });
    // }

    // check if user already exists
    // const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    // if (existing.length > 0) {
    //   return res.status(409).json({ message: 'Email already registered.' });
    // }

    // 1. Kuhanin ang secret dito at maglagay ng fallback
    const jwtSecret = process.env.JWT_SECRET || 'qed_default_fallback_secret_key_123';

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await connection.query(
      'INSERT INTO qed_authentication (user_name, password, role) VALUES (?, ?, ?)',
      [userName, hashedPassword, role]
    );

    const token = jwt.sign({ id: result.insertId, userName, role }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    return res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: { id: result.insertId, userName, role },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
};


// authentication.controller.js

exports.logout = async (req, res) => {
  try {
    res
      .clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      })
      .status(200)
      .json({ message: 'Logout successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};