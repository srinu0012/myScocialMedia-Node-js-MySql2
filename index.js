// requirements
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { hashPassword } = require("./bycryptpassgen");
const AWS = require("aws-sdk");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");

const multer = require("multer");
const path = require("path");

require("dotenv").config();


// db requirements

const {
  registration,
  getclosefriends,
  deletefollowing,
  insertfollowing,
  getISfollowing,
  getComments,
  postComment,
  getSuggestions,
  getProfilePostMethod,
  setLike,
  login,
  insertProfileImages,
  addpost,
  getProfileImages,
  updateProfileInfo,
  getProfileInfo,
  getPostMethod,
} = require("./models/db");
const { log } = require("console");
const { decode } = require("punycode");

// server establishment
const App = express();

// adding middlewares
App.use(express.json());
App.use(cors());
App.use(bodyParser.json());

//  request and response methods

// register apis
App.post("/register", async (req, res) => {
  // generated hashed pasword
  let hashedPassword = await hashPassword(req.body.password);

  // share to the database registerd data
  registration(req.body.userName, hashedPassword, req.body.email)
    .then((data) => {
      res.status(200);
      res.send(data);
    })
    .catch((err) => {
      res.status(400);
      res.send(err);
    });
});

// =========================================================================================================

// login api

App.post("/login", async (req, res) => {
  const { userName, password } = req.body;

  // Check if user exists
  login(userName)
    .then(async (data) => {
      let { user_id, username, password_hash } = data;
      // Compare the entered password with the stored hash
      const isPasswordValid = await bcrypt.compare(password, password_hash);

      if (isPasswordValid) {
        // Generate JWT token
        const token = jwt.sign(
          { userId: user_id, username: username },
          process.env.JWT_SECRET
        );

        // sending sucess status code and jwt token
        res.status(200);
        res.send(token);
      } else {
        res.status(400);
        res.send("invalid credentials");
      }
    })
    .catch((err) => {
      res.send(err);
    });
});

// =====================================================================================================

// creating aws s3

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Configure multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

App.post("/upload", upload.single("file"), async (req, res) => {

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  });

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `uploads/${Date.now()}-${req.file.originalname}`, // File path in S3
    Body: req.file.buffer, // File data
    ContentType: req.file.mimetype,
  };

  try {
    const data = await s3.upload(params).promise();

    const decoded = jwt.verify(req.body.token, process.env.JWT_SECRET);

    // Extract user ID from the decoded payload

    const userId = decoded.userId;
    insertProfileImages(userId, req.body.type, data.Location)
      .then((result) => {
 
        return res
          .status(200)
          .json({
            message: "Image uploaded successfully",
            imageUrl: data.Location,
          });
      })
      .catch((err) => {
        return res.status(400).json({ err: "No file uploaded" });
      });
  } catch (error) {
    console.error("S3 Upload Error:", error); // Log the detailed error
    res
      .status(500)
      .json({ error: "Failed to upload image", details: error.message });
  }
});

// ================================================================================================
// intial profile images

App.get("/profileImages/:token", (req, res) => {
  const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET);

  // Extract user ID from the decoded payload
  const userId = decoded.userId;

  getProfileImages(userId)
    .then((data) => {
      res.send(data);
    })
    .catch((err) => {
      res.send(err);
    });
});

// ===========================================================================


// updateprofileinfo

App.post("/updateProfileInfo", (req, res) => {
  const { name, description } = req.body;



  const decoded = jwt.verify(req.body.token, process.env.JWT_SECRET);

  // // Extract user ID from the decoded payload
  const userId = decoded.userId;

  updateProfileInfo(userId, name, description)
    .then((message) => {
      res.status(200).json({ message: "Profile updated successfully" });
    })
    .catch((message) => {
      return res.status(500).json({ message: "Failed to update profile info" });
    });
});
// =========================================================================================

App.get("/profileInfo/:token", (req, res) => {
  const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET);

  // // Extract user ID from the decoded payload
  const userId = decoded.userId;

  getProfileInfo(userId)
    .then((data) => {
      res.send(data);
    })
    .catch((err) => {
      res.send(err);
    });
});

// =========================================================================


App.post("/addPost", upload.single("image"), async (req, res) => {
  const { description, tags, location, feeling } = req.body;
  // const token = req.headers.authorization.split(" ")[1];
  const token = req.headers.authorization.slice(7);

  try {
    // Decode JWT token to get the user ID
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    let imageUrl = null;

    // Initialize AWS S3 instance
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });

    if (req.file) {
      const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `uploads/${Date.now()}-${req.file.originalname}`, // File path in S3
        Body: req.file.buffer, // File data
        ContentType: req.file.mimetype,
      };

      // Upload file to S3
      const uploadResult = await s3.upload(params).promise();
      imageUrl = uploadResult.Location; // Get the URL of the uploaded image
    }

    // Save post details in the database
    addpost(userId, description, imageUrl, tags, location, feeling)
      .then((message) => {
        res.status(200).json({ message: "Post added successfully!", imageUrl });
      })
      .catch((error) => {
        console.error("Database Error:", error); // Log detailed database error
        res
          .status(400)
          .json({ message: "An error occurred while saving the post." });
      });
  } catch (error) {
    console.error("JWT or S3 Error:", error); // Log JWT or S3-related errors
    res.status(500).json({ message: "An error occurred in catch block." });
  }
});

// ========================================================================================================

App.get("/Profileposts/:token", (req, res) => {
  const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET);

  const userId = decoded.userId;

  getProfilePostMethod(userId)
    .then((data) => {
      res.status(200);
      res.send(data);
    })
    .catch((err) => {
      res.send(err);
    });
});
// ========================================================================================

App.get("/posts", (req, res) => {
  const { user_id } = req.query;

  getPostMethod(user_id)
    .then((data) => {
      res.status(200);

      res.send(data);
    })
    .catch((err) => {
      res.send(err);
    });
});

// =============================================================================================

App.post("/setlike/:post_id", (req, res) => {
  setLike(req.params.post_id, req.query.type)
    .then((data) => {
      res.send("success");
    })
    .catch((err) => {
      res.send(err);
    });
});

// ====================================================================================================
App.get("/searchUsernames", async (req, res) => {
  const searchQuery = req.query.query; // Query parameter `q` for the search term

  try {
    const suggestions = await getSuggestions(searchQuery);
    res.status(200);
    res.send(suggestions);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// =======================================================================================================

App.post("/comments/:post_id", async (req, res) => {
  const { post_id } = req.params;
  const { token, text } = req.body;

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user_name = decoded.username;

  postComment(post_id, user_name, text)
    .then((data) => {
      res.status(200);
      res.send(data);
    })
    .catch((err) => {
      res.status(500);
      res.send(err);
    });
});

// ========================================================================================================

// GET /comments/:post_id
App.get("/comments/:post_id", (req, res) => {
  const { post_id } = req.params;

  getComments(post_id)
    .then((data) => {
      res.status(200);
      res.send(data);
    })
    .catch((err) => {
      res.status(500);
      res.send(err);
    });
});

//==========================================================================================================

// Check is following or not

App.get("/isFollowing", (req, res) => {
  const { token, id } = req.query;

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const userId = decoded.userId;

  getISfollowing(id, userId)
    .then((data) => {
      res.send(true);
    })
    .catch((err) => {
      res.send(false);
    });
});

// ==========================================================================
App.get("/FriendProfileposts/:id", (req, res) => {
  const userId = req.params.id;
  getProfilePostMethod(userId)
    .then((data) => {
      res.status(200);
      res.send(data);
    })
    .catch((err) => {
      res.send(err);
    });
});

// ================================================================================

App.get("/friendProfileImages/:id", (req, res) => {
  const userId = req.params.id;

  getProfileImages(userId)
    .then((data) => {
      res.send(data);
    })
    .catch((err) => {
      res.send(err);
    });
});

// ==========================================================================================

App.post("/followFriend", (req, res) => {
  const { token, Id } = req.body;

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const userId = decoded.userId;

  insertfollowing(Id, userId)
    .then((data) => {
      res.status(200).json({ data: "Followed successfully" });
    })
    .catch((err) => {
      res.status(500).json({ err: "Failed to follow user" });
    });
});

// ==============================================================================================

App.post("/unfollowFriend", (req, res) => {
  const { token, Id } = req.body;

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const userId = decoded.userId;

  deletefollowing(Id, userId)
    .then((data) => {
      res.status(200).json({ message: "Unfollowed successfully" });
    })
    .catch((err) => {
      res.status(404).json({ message: "Not following this user" });
    });
});

// ============================================================================================

App.get("/friendProfileInfo/:id", (req, res) => {
  id = req.params.id;

  getProfileInfo(id)
    .then((data) => {
      res.send(data);
    })
    .catch((err) => {
      res.send(err);
    });
});

// ======================================================================================================

App.get("/getFriendsDetails/:token", (req, res) => {
  let decode = jwt.verify(req.params.token, process.env.JWT_SECRET);

  let userId = decode.userId;

  getclosefriends(userId)
    .then((data) => {
      res.send(data);
    })
    .catch((err) => {
      res.send("err");
    });
});

// ===========================================================================================

// assinging port
const port = process.env.port;

// listen server
App.listen(Number(port), () => {
  console.log("server started");
});
