const express = require("express");
const auth = require("../middleware/authInterceptor");
const axios = require('axios');
const router = express.Router();

//all members must call this api before they can use any of the api that requres the memberUuid
//this is an extra security feature
router.get("/getMemberUuidFromAuthServer", auth, async (req, res, next) => {
    try {
        if (!req.token) {
            return next(new Error('Invalid request'));
        }
        const response = await axios.get(process.env.AUTH_SERVER_URL_GETMEMBERUUID || 'http://localhost:8081/auth/getMemberUuid', { headers: { "Authorization": req.token } });
        if (response.status == 200) {
            return res.send(response.data);
        }
        return next(new Error(response.message));
    } catch (err) {
        return next(new Error(err));
    }
});

module.exports = router;
