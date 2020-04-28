const jwt = require("jsonwebtoken");


module.exports = (req, res, next) => {

    if (!req.headers.authorization) {
        next(new Error('Unauthorized request'));
    } else {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_KEY || 'secret');
            req.userDate = decoded;
            //this token will be used to call the auth_server to get the memberUuid
            req.token = req.headers.authorization;
 
            next();

        } catch (e) {
            next(new Error(e.message));
        }
    }


};
