const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });

const dynamoClient = new AWS.DynamoDB.DocumentClient();

const createMember = async member => {
    try {
        let params = {
            TableName: process.env.MEMBER || 'MEMBER',
            Item: member,
            ReturnValues: "NONE"
        };
        return await dynamoClient.put(params).promise();
    } catch (e) {
        return e;
    }
}

const deleteMember = async member => {
    try {
        let params = {
            TableName: process.env.MEMBER || 'MEMBER',
            Key: {
                'memberUuid': member.memberUuid,
                'email': member.email
            }
        };
        return await dynamoClient.delete(params).promise();
    } catch (e) {
        return e;
    }
}

const getMemberByMemberUuid = async memberUuid => {
    try {
        let params = {
            TableName: process.env.MEMBER || 'MEMBER',
            KeyConditionExpression: 'memberUuid = :memberUuid',
            ExpressionAttributeValues: {
                ':memberUuid': memberUuid
            }
        };
        let member = await dynamoClient.query(params).promise();
        return member;
    } catch (e) {
        return e;
    }
}


module.exports = {
    createMember,
    getMemberByMemberUuid,
    deleteMember
}
