const jwt = require("jsonwebtoken");
const memberRepo = require('../repository/memberRepo');
const AWS = require('aws-sdk')

const userConnected = async (req, ws) => {

    let member = await memberRepo.updateMemberValue(isAuthenticated(req).memberUuid, 'isOnline', true);
    // console.log('Member connected')
    // console.log(member);

    if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(member))
    }
}

const userDisconnected = async (req, ws) => {
    let member = await memberRepo.updateMemberValue(isAuthenticated(req).memberUuid, 'isOnline', false);
    console.log('Member Disconnected')
    console.log(member);
}

isAuthenticated = (req) => {

    if (!req.headers['sec-websocket-protocol']) {
        throw new Error('Unauthorized request');
    }

    const token = req.headers['sec-websocket-protocol'];
    return jwt.verify(token, process.env.JWT_KEY || 'secret');
}
module.exports = {
    userConnected,
    userDisconnected
}