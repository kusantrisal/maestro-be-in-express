const express = require("express");
const WebSocket = require('ws');
const SocketServer = require('ws').Server;
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
    console.info("websocket connection open");

    if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
            msg1: 'yo, im msg 1'
        }))

        setTimeout(() => {
            ws.send(JSON.stringify({
                msg2: 'yo, im a delayed msg 2'
            }))
        }, 1000)
    }
    ws.on('message', function (message) {

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
        console.log("websocket connection close")
    })

});

