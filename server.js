require('./dbConfig/dbConfig.js');
const express = require('express');
require('dotenv').config();

const fileUpload = require("express-fileupload");
const router = require('./router/userRouter.js');

const app = express();

const port = process.env.PORT;

app.use(fileUpload({
    useTempFiles: true,
    limits:{ fileSize: 5 * 1024 * 1024 }
}));

app.use(express.json());
app.get('/', (req, res) => {
    res.send("Welcome to Location API");
})
app.use('/api/v1', router);


app.listen(port, () => {
    console.log(`Server up and running on port: ${port}`);
})