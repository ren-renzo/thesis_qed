//ENVIRONMENT VARIABLES
require('dotenv').config();

//API FRAMEWORD
const express = require('express');
//CROSS ORIGIN RESOURCE SHARING
const cors = require('cors');
//DATABASE CONNECTION
const db=require('./config/db.js');
//ROUTES
const apiRoutes = require('./src/routes/index.js');

//UTILIZATION OF EXPRESS
const app = express();

const cookieParser = require('cookie-parser');

//MOMENT
const moment = require('moment');
const logger = (req, res, next) => {
    console.log(`${req.protocol}://${req.get('host')} ${req.originalUrl} - ${moment().format()}` );
    next();
}
app.use(logger);

app.use(cookieParser());

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({extended:true})) //this will allow to read the url body tags

//use routes
app.use('/api', apiRoutes);

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
})