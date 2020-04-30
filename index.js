const serverless = require('serverless-http');
// let formidable = require('express-formidable');
// let path = require('path');
const express = require("express");
const WebSocket = require('ws');
const SocketServer = require('ws').Server;
const app = express();
const wsService = require('./src/service/wsService')
const errorHandler = require("./src/middleware/errorHandler")
const bodyParser = require('body-parser');

// app.use(formidable({
//     encoding: 'utf-8',
//     uploadDir: path.join(__dirname, 'resource'),
//     multiples: true,
//     keepExtensions:true// req.files to be arrays of files
//     }));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

//disable cors
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTION' | req.method === 'OPTIONS') {
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
let server = app.listen(port, () => console.log(`Maestro started in port ${port}`));
const wss = new SocketServer({ server });

wss.on('connection', function (ws, req, client) {

    wsService.userConnected(req, ws);

    ws.on('message', function (message) {
        console.log(JSON.stringify(req));
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.log("Invalid JSON");
            data = {};
        }
        //semd msg to everyoen including yourself
        wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });

        //send msg to everyone else
        wss.clients.forEach(function each(client) {
            console.log(client.readyState)
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                //    client.send(JSON.stringify(data));
            }
        });

        //    console.log(data);
        //   ws.send(JSON.stringify(data));
    });

    wss.on("close", function () {
        wsService.userDisconnected(req, ws);
    })

});

module.exports.handler = serverless(app);