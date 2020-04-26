const express = require("express");
const memberRepo = require('../repository/memberRepo');
const auth = require("../middleware/authInterceptor");
const router = express.Router();
const Joi = require("joi");
const axios = require('axios');
const moment = require('moment');

const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });
const s3 = new AWS.S3();

//create member
router.post("/createMember", auth, async (req, res, next) => {
  try {
    if (!req.token) {
      return next(new Error('Invalid request'));
    }

    //if the member already exist throw error
    let items = await memberRepo.getMemberByMemberUuid(req.userDate.memberUuid);
    if (items && items.Items.length == 1) {
      res.statusCode = 409;
      return next(new Error(`Member already exist with uuid ${req.userDate.memberUuid}`));
    }

    //fetch member info
    let url = (process.env.AUTH_SERVER_URL || 'http://localhost:8081') + '/auth/getMemberByMemberUuid';

    let response = await axios.get(url, { headers: { "Authorization": req.token } });

    if (response.status == 200) {

      let member = {
        memberUuid: response.data.principal.memberUuid,
        firstName: response.data.principal.firstName,
        lastName: response.data.principal.lastName,
        email: response.data.principal.email,
        phone: response.data.principal.phone,
        profilePic: { bucket: 'zerotoheroquick-app-resources', key: 'images/profile-pic.jpg' }
      };

      const { error, value } = validateMember(member);

      if (error) {
        return next(error);
      }

      response = await memberRepo.createMember(value);

      if (response.message) {

        res.statusCode = 406;
        return next(new Error(response.message));
      }

      value.profilePicPreSignedUrl = s3.getSignedUrl('getObject', {
        Bucket: member.profilePic.bucket,
        Key: member.profilePic.key,
        Expires: 60 * 5
      })

      return res.send(value);

    }
    res.statusCode = 404;
    return next(new Error(response.message));

  } catch (err) {
    res.statusCode = 400;
    return next(new Error(err));
  }
});

//get member
router.get("/getMember", auth, async (req, res, next) => {

  let items = await memberRepo.getMemberByMemberUuid(req.userDate.memberUuid);

  if (!items || (items.Items && items.Items.length !== 1)) {
    res.statusCode = 404;
    return next(new Error(`Unable to fetch member ${req.userDate.memberUuid}`));
  }
  let member = items.Items[0];
  member.createDate = moment.utc(member.createDate).format("YYYY-MM-DD HH:mm:ss a");
  member.lastUpdated = moment.utc(member.lastUpdated).format("YYYY-MM-DD HH:mm:ss a");
  member.profilePicPreSignedUrl = s3.getSignedUrl('getObject', {
    Bucket: member.profilePic.bucket,
    Key: member.profilePic.key,
    Expires: 60 * 5
  })
  res.send(member);
});

//update member value
router.post("/updateMemberValue", auth, async (req, res, next) => {
  console.log("update method invoked")

  if (!req.userDate.memberUuid) {
    return next(new Error('Unknown memberUuid'));
  }

  let items = await memberRepo.getMemberByMemberUuid(req.userDate.memberUuid);

  if (!items || items.Items.length !== 1) {
    return next(new Error(`Unable to fetch member ${req.userDate.memberUuid}`));
  }
  //console.log(req)
  let [response, unused] = await Promise.all([memberRepo.updateMemberValue(req.userDate.memberUuid, req.body.key, req.body.value), memberRepo.updateMemberValue(req.userDate.memberUuid, 'lastUpdated', Date.now())]);
  if (response.message) {
    return next(new Error(response.message));
  }
  res.send(await memberRepo.getMemberByMemberUuid(req.userDate.memberUuid));
});

//update member might have to filter it to specific value in the futre this is too risky
router.put("/updateMemberByMemberUuid", async (req, res, next) => {
  let items = await memberRepo.getMemberByMemberUuid(req.userDate.memberUuid);

  if (!items || items.Items.length !== 1) {
    return next(new Error(`Unable to fetch member ${req.userDate.memberUuid}`));
  }
  //timestamp is added to member
  const { error, value } = validateMember(req.body);

  if (error) {
    res.statusCode = 404;
    return next(error);
  }

  value.memberUuid = items.Items[0].memberUuid || req.userDate.memberUuid;
  let response = await memberRepo.createMember(value);

  if (response.message) {
    return next(new Error(response.message));
  }
  res.send(value);
});


//delete member
router.delete("/deleteMemberByMemberUuid", async (req, res, next) => {
  let items = await memberRepo.getMemberByMemberUuid(req.userDate.memberUuid);

  if (!items || items.Items.length !== 1) {
    return next(new Error(`Unable to fetch member ${req.userDate.memberUuid}`));
  }
  let member = items.Items[0];
  //TODO send access code to delete stuff 
  let response = await memberRepo.deleteMember(member);
  if (response.message) {
    return next(new Error(response.message));
  }
  res.send(response);
});

//Schema defines the data Structure persisted in dynamo
function validateMember(member) {

  const now = Date.now();

  const schema = {
    memberUuid: Joi.string().optional(),
    profilePic: Joi.object().optional(),
    firstName: Joi.string().min(3).required(),
    lastName: Joi.string().min(3).required(),
    phone: Joi.string().min(10).required(),
    email: Joi.string().required().email(),
    createDate: Joi.string().optional().default(now),
  };

  return Joi.validate(member, schema);
}

module.exports = router;
