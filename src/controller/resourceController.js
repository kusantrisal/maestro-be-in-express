const express = require("express");
const moment = require('moment');
const Joi = require("joi");
const uuid = require('uuid');
const resourceRepo = require('../repository/resourceRepo');
const auth = require("../middleware/authInterceptor");
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const { v4: uuidv4 } = require('uuid');
const member = require("../model/member");
const memberRepo = require('../repository/memberRepo');

const fs = require('fs');
const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });
const s3 = new AWS.S3();

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.MEMBER_RESOURCES || 'zerotoheroquick-member-resources',
    key: function (req, file, cb) {
      cb(null, req.userDate.memberUuid + '/' + uuidv4() + '/' + file.originalname); //use Date.now() for unique file keys
    }
  })
});

router.get("/getResourcesByMemberUuid", auth, async (req, res, next) => {
  if (!req.userDate.memberUuid) {
    return next(new Error('Unknown memberUuid'));
  }
  let items = await resourceRepo.getResourcesByMemberUuid(req.userDate.memberUuid);

  if (items.message) {
    return next(new Error(items.message));
  }
  let resources = [];

  items.Items.forEach(res => {
    res.createDate = moment.utc(res.createDate).local();
    resources.push(res);
  });
  //latest first
  res.send(resources.sort((a, b) => b.createDate - a.createDate));
});

//create resource
router.post("/addResource", auth, upload.array('file', 1), async (req, res, next) => {

  req.body.fileLocation = req.files[0];
  const { error, value } = validateResource(req.body);

  if (error) {
    res.statusCode = 404;
    return next(error);
  }
  value.memberUuid = req.userDate.memberUuid;
  let response = await resourceRepo.createResource(value);

  if (response.message) {
    return next(new Error(response.message));
  }
  res.send(value);
});

function validateResource(resource) {
  const now = Date.now();
  const schema = {
    resourceUuid: Joi.string().default(uuid.v4()),
    name: Joi.string().required(),
    fileLocation: Joi.object().required(),
    memberUuid: Joi.string().optional().default('TBD'),
    createDate: Joi.string().optional().default(now),
    updatedDate: Joi.string().optional().default(moment(now).format("MMMM Do YYYY, HH:mm:ss.SSSS A Z")),
  };

  return Joi.validate(resource, schema);
}


///////////

// const resources = [
//   { id: "123", name: "music" },
//   { id: "456", name: "video" },
// ];

// //sample
// router.get("/sample/:input1/:input2", (req, res) => {
//   res.send(
//     "Hello World " +
//     req.params.input1 +
//     " " +
//     req.params.input2 +
//     " " +
//     JSON.stringify(req.query) +
//     " " +
//     JSON.stringify(member)
//   );
// });

// router.get("/", (req, res) => {
//   res.send(resources);
// });

// router.get("/:id", (req, res) => {
//   const resource = resources.find((res) => res.id == req.params.id);
//   if (!resource) {
//     return res.status(404).send(`Resouce not found with id ${req.params.id}`);
//   }
//   res.send(resource);
// });

// router.post("/addResource", (req, res) => {
//   // const result = validateResource(req.body);
//   const { error } = validateResource(req.body); // this is equivalent to result.error

//   if (error) {
//     return res.status(400).send(error.details[0]);
//   }

//   const resource = {
//     id: "uuid",
//     name: req.body.name,
//   };
//   resources.push(resource);
//   res.send(resource);
// });

// router.put("/updateResource/:id", (req, res) => {
//   const resource = resources.find((res) => res.id == req.params.id);
//   if (!resource) {
//     return res.status(404).send(`Resouce not found with id ${req.params.id}`);
//   }

//   const { error } = validateResource(req.body);

//   if (error) {
//     return res.status(400).send(error.details[0]);
//   }

//   resource.name = req.body.name;
//   res.send(resource);
// });

// router.delete("/deleteResource/:id", (req, res) => {
//   const resource = resources.find((res) => res.id == req.params.id);
//   if (!resource) {
//     return res.status(404).send(`Resouce not found with id ${req.params.id}`);
//   }
//   const index = resources.indexOf(resource);
//   resources.splice(index, 1);
//   res.send(resource);
// });

// function validateResource(resoure) {
//   const schema = {
//     name: Joi.string().min(3).required(),
//   };

//   const result = Joi.validate(resoure, schema);
//   return result;
// }

module.exports = router;
