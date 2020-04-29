const express = require("express");
const moment = require('moment');
const Joi = require("joi");
const uuid = require('uuid');
const resourceRepo = require('../repository/resourceRepo');
const thumbnailService = require('../service/thumbnailService');
const constant = require('./../constant/constant');
const auth = require("../middleware/authInterceptor");
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3-transform');
const { v4: uuidv4 } = require('uuid');

const fs = require('fs');
const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });
const s3 = new AWS.S3();

const sharp = require('sharp');

//will assign resource uuid
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/jpg') {
    req.resourceUuid = uuidv4();
    cb(null, true);
  } else {
    cb(new Error(message.FAIL.invalidImage), false);
  }
};
const roundedCorners = Buffer.from(
  '<svg><rect x="0" y="0" width="200" height="200" rx="50" ry="50"/></svg>'
)
const uploadThumbNail = multer({
  fileFilter,
  storage: multerS3({
    s3: s3,
    bucket: process.env.MEMBER_RESOURCES || 'zerotoheroquick-member-resources',
    key: function (req, file, cb) {
      cb(null, req.userDate.memberUuid + '/' + req.resourceUuid + '/thumbnail/' + file.originalname); //use Date.now() for unique file keys
    },
    contentType: function (req, file, cb) {
      if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
        cb(null, 'image/jpeg');
      } else if (file.mimetype === 'video/mp4') {
        cb(null, 'video/mp4');
      } else {
        cb(null, file.mimetype);
      }
    },
    limits: {
      fileSize: 1000,
      files: 5
    },
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    shouldTransform: function (req, file, cb) {
      cb(null, true);
    },
    transforms: [
      {
        id: 'original',
        key: function (req, file, cb) {
          cb(null, req.userDate.memberUuid + '/' + req.resourceUuid + '/original/' + file.originalname)
        },
        transform: function (req, file, cb) {
          //Perform desired transformations
          cb(null, sharp().jpeg({ progressive: true, force: false }));
        }
      },
      {
        id: 'thumbnail',
        key: function (req, file, cb) {
          cb(null, req.userDate.memberUuid + '/' + req.resourceUuid + '/thumbnail/' + file.originalname)
        },
        transform: function (req, file, cb) {
          //Perform desired transformations
          cb(null, sharp()
            .resize(500, 300)
            .jpeg())
        }
      }]
  })
});

const upload = multer({
  fileFilter,
  storage: multerS3({
    s3: s3,
    bucket: process.env.MEMBER_RESOURCES || 'zerotoheroquick-member-resources',
    key: function (req, file, cb) {
      cb(null, req.userDate.memberUuid + '/original/' + uuidv4() + '/' + file.originalname); //use Date.now() for unique file keys
    },
    contentType: function (req, file, cb) {
      if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
        cb(null, 'image/jpeg');
      } else if (file.mimetype === 'video/mp4') {
        cb(null, 'video/mp4');
      } else {
        cb(null, file.mimetype);
      }
    },
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    }
  })
});

router.get("/getResourcesByMemberUuid", auth, async (req, res, next) => {
  // console.log("Get Resources called")
  if (!req.userDate.memberUuid) {
    return next(new Error('Unknown memberUuid'));
  }
  let items = await resourceRepo.getResourcesByMemberUuid(req.userDate.memberUuid);

  if (items.message) {
    return next(new Error(items.message));
  }
  let resources = [];

  items.Items.forEach(res => {
    //  console.log(res.info.originalname);
    //change date to readable format
    // res.createDate = moment.utc(res.createDate).format("YYYY-MM-DD HH:mm:ss a");
    // res.updatedDate = moment.utc(res.updatedDate).format("YYYY-MM-DD HH:mm:ss a");
    //add preSingedUrl to access private data
 
    res.preSignedUrlForThumbnail = s3.getSignedUrl('getObject', {
      Bucket: res.info.transforms.filter(info => info.id == 'thumbnail')[0].bucket,
      Key: res.info.transforms.filter(info => info.id == 'thumbnail')[0].key,
      Expires: 60 * 5
    });
    res.preSignedUrlForOriginal = s3.getSignedUrl('getObject', {
      Bucket: res.info.transforms.filter(info => info.id == 'original')[0].bucket,
      Key: res.info.transforms.filter(info => info.id == 'original')[0].key,
      Expires: 60 * 5
    });
    
    resources.push(res);
  });

  //latest first
  // console.log('Response sent ' + resources.length)
  res.send(resources.sort((a, b) => b.createDate - a.createDate));
});

//create resource
router.post("/addResource", auth, uploadThumbNail.array('file'), async (req, res, next) => {
  let promises = [];
  for (const file of req.files) {
    let resource = {};
    let resourceUuid = file.transforms[0].key.split('/')[1] || file.key.split('/')[1];
    let fileType = file.transforms[0].key.split('/')[2] || file.key.split('/')[2];
    resource.memberUuid = req.userDate.memberUuid;
    resource.resourceUuid = resourceUuid;
    resource.createDate = Date.now();
    resource.info = file
    promises.concat(resourceRepo.createResource(resource));
  }

  let response = await Promise.all([promises]);

  if (response.message) {
    return next(new Error(response.message));
  }
  res.send(response);

  // req.body.fileLocation = req.files[0];
  //Might have to move it to lambda later on
  //create thumbnail and add url to database
  //replace video with something that identify it has video
  //   if (false) {
  //     fileType = fileType[0].slice(1)
  //     if (allowedVideoTypes.indexOf(fileType) === -1) {
  //       throw new Error(`filetype: ${fileType} is not an allowed type`)
  //     }
  //     req.body.thumbnailLocation = await thumbnailService.createVideoThumbnail(req.body.fileLocation);
  //   }
  // console.log('Adding resource')
  // const { error, value } = validateResource(req.body);

  // if (error) {
  //   res.statusCode = 404;
  //   return next(error);
  // }



});

router.delete("/deleteResource", auth, async (req, res, next) => {

  let response = await resourceRepo.deleteResource(req.query.resourceUuid, req.userDate.memberUuid);

  if (response) {
    let bucket = '';
    let listOfObjects = [];
    response.Attributes.info.transforms.forEach(transform => {
      bucket = transform.bucket;
      listOfObjects.push({ Key: transform.key });
    });
    let params = {
      Bucket: bucket,
      Delete: {
        Objects: listOfObjects
      }
    }
    response = await s3.deleteObjects(params).promise();
  }

  if (response.message) {
    return next(new Error(response.message));
  }

  res.send(response);
});


function validateResource(resource) {
  const now = Date.now();
  const schema = {
    resourceUuid: Joi.string().default(uuid.v4()),
    originalname: Joi.string().required(),
    fileLocation: Joi.object().required(),
    //  thumbnailLocation: Joi.object().required(),
    memberUuid: Joi.string().optional().default('TBD'),
    createDate: Joi.string().optional().default(now),
    updatedDate: Joi.string().optional().default(now)
  };

  return Joi.validate(resource, schema);
}

router.post('/upload', uploadThumbNail.single('image'), function (req, res, next) {
  // console.log('filessss ', req.file)
  res.send('Successfully uploaded ' + req.file + ' files!')
})

var uploadImage = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'test',
    // shouldTransform: function (req, file, cb) {
    //     cb(null, /^image/i.test(file.mimetype))
    // },
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    shouldTransform: function (req, file, cb) {
      //  console.log('in should transform ', file)
      cb(null, /^image/i.test(file.mimetype))
    },
    transforms: [{
      id: 'original',
      key: function (req, file, cb) {
        //    console.log('original')
        cb(null, "original")
      },
      transform: function (req, file, cb) {
        //    console.log('original1')

        cb(null, sharp().jpg())
      }
    }, {
      id: 'thumbnail',
      key: function (req, file, cb) {
        //   console.log('thumbnail')

        cb(null, "thumbnail")
      },
      transform: function (req, file, cb) {
        //    console.log('thumbnail1')

        cb(null, sharp().resize(100, 100).jpg())
      }
    }]
  })
})
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
