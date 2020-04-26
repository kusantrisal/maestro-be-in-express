const express = require("express");
const app = express();
const errorHandler = require("./src/middleware/errorHandler")
const bodyParser = require('body-parser');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


app.use(express.json());

//disable cors
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTION') {
        res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, PATCH, DELETE');
        return res.status(200).json({});
    }
    next();
});

app.use("/entry", require("./src/controller/entryController"));
app.use("/resource", require("./src/controller/resourceController"));
app.use("/member", require("./src/controller/memberController"));

//if no route is found
app.use((req, res, next) => {
    const error = new Error('API Not found');
    error.status = 404;
    next(error);
});

//handles all errors
app.use(errorHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Maestro started in port ${port}`));
