const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });

const dynamoClient = new AWS.DynamoDB.DocumentClient();

const createResource = async resource => {
    console.log(resource);
    try {
        let params = {
            TableName: process.env.RESOURCE || 'RESOURCE',
            Item: resource,
            ReturnValues: "NONE"
        };
        return await dynamoClient.put(params).promise();
    } catch (e) {
        return e;
    }
}

const deleteResource = async (resourceUuid, memberUuid) => {
    try {
        let params = {
            TableName: process.env.RESOURCE || 'RESOURCE',
            Key: {
                'resourceUuid': resourceUuid,
                'memberUuid': memberUuid
            },
            ReturnValues: 'ALL_OLD'
        };
        return await dynamoClient.delete(params).promise();
    } catch (e) {
        return e;
    }
}

const getResourceByResourceUuid = async resourceUuid => {
    try {
        let params = {
            TableName: process.env.RESOURCE || 'RESOURCE',
            KeyConditionExpression: 'resourceUuid = :resourceUuid',
            ExpressionAttributeValues: {
                ':resourceUuid': resourceUuid
            }
        };
        return await dynamoClient.query(params).promise();
    } catch (e) {
        return e;
    }
}

const getResourcesByMemberUuid = async (memberUuid) => {
    try {
        let params = {
            TableName: process.env.RESOURCE || 'RESOURCE',
            IndexName: 'memberUuid-index',
            KeyConditionExpression: 'memberUuid = :memberUuid',
            ExpressionAttributeValues: {
                ':memberUuid': memberUuid
            }
        };
        return await dynamoClient.query(params).promise();
    } catch (e) {
        return e;
    }
}

module.exports = {
    createResource,
    getResourceByResourceUuid,
    deleteResource,
    getResourcesByMemberUuid
}
