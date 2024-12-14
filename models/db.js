const { query } = require("express");
let sql = require("mysql2");
require("dotenv").config();




const db = sql.createConnection({
  host: process.env.host,
  user: process.env.user,
  password: process.env.password,
  database: process.env.database,
});

db.connect((error) => {
  if(error){console.log(error)}
  console.log("connected database");
});
// registration

function registration(userName, password, email) {
  return new Promise((resolve, reject) => {
    db.query(
      `insert into  users (username,password_hash,email) values  ('${userName}','${password}','${email}')`,
      (err) => {

        if (err) {
          reject("alredy existed");
        } else {
          resolve("successfully registered");
        }
      }
    );
  });
}
// =====================================================================================================================
// login

function login(userName) {
  return new Promise((resolve, reject) => {
    
    db.query(
      `SELECT user_id, username, password_hash FROM users WHERE username = '${userName}'`,
      (err, rows) => {
        if (err) {
          reject("invalid credentials");
        } else {
          if (rows.length > 0) {
            
            resolve(rows[0]);

          } else {
            reject("invalid credentials");
          }
        }
      }
    );
  });
}

// ====================================================================================================================

// function profile images set in database

function insertProfileImages(id, img_type, image) {

  return new Promise((resolve, reject) => {
    db.query(
      `DELETE FROM user_images WHERE user_id =${id} AND image_type ='${img_type}';`,
      () => {}
    );

    db.query(
      `INSERT INTO user_images (user_id, image_type, image_url)VALUES (?, ?, ?);`,
      [id, img_type, image],
      (err, rows) => {
        if (err) {
          reject("not upload");
        } else {
          resolve("ok");
        }
      }
    );
  });
}

// ====================================================================================

// function for get personal images

function getProfileImages(id) {
  return new Promise((resolve, reject) => {
    db.query(
      `select image_type,image_url from user_images where user_id=${id};`,
      (err, rows) => {
        if (err) {
          reject("no data");
        } else {
          resolve(rows);
        }
      }
    );
  });
}

function updateProfileInfo(user_id, username, userdesc) {
  return new Promise((resolve, reject) => {
    db.query(`DELETE FROM profile_info WHERE user_id = ${user_id};`, () => {});
    db.query(
      `INSERT INTO profile_info (user_id, user_name, description) VALUES (?, ?,?);`,
      [user_id, username, userdesc],
      (err) => {
        if (err) {
          reject("err");
        } else {
          resolve("success");
        }
      }
    );
  });
}

function getProfileInfo(user_id) {
  return new Promise((resolve, reject) => {
    db.query(
      `select user_name,description from profile_info where user_id=${user_id}`,
      (err, rows) => {
        if (err) {
          reject("no data found");
        } else {
          resolve(rows);
        }
      }
    );
  });
}

// =====================================================================

function addpost(userId, description, imageUrl, tags, location, feeling) {
  return new Promise((resolve, reject) => {
    const query = `
    INSERT INTO posts (user_id, description, image_url,tags,location,feeling)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  console.log(tags)
    db.query(
      query,
      [userId, description, imageUrl, tags, location, feeling],
      (err) => {
        if (err) {
         
          reject("err");
        } else {
          resolve("success");
        }
      }
    );
  });
}

// =======================================================================

function getPostMethod(user_id) {
  return new Promise((resolve, reject) => {
    const query = ` SELECT 
    u.user_id,
    pi.user_name,
    pi.description AS profile_description,
    -- Get profile image URL from user_images table
    profile_image.image_url AS profile_image_url,
    p.id AS post_id,
    p.image_url AS post_image_url,
    p.description AS post_text,
    p.likes,
    p.comments,
    p.location,          -- Include location
    p.feeling,           -- Include feeling
    p.tags               -- Include tags
FROM 
    users u
inner JOIN 
    profile_info pi ON u.user_id = pi.user_id
LEFT JOIN 
    user_images profile_image ON u.user_id = profile_image.user_id AND profile_image.image_type = 'profile'
LEFT JOIN 
    posts p ON u.user_id = p.user_id
ORDER BY 
    p.created_at DESC;  -- Order posts by created_at in descending order

`;


    db.query(query, (err, results) => {
      if (err) {
        reject("err");
      } else {
        resolve(results);
      }
    });
  });
}

// =================================================================
function setLike(post_id, type) {
  op = "";
  if (type == "add") {
    querys = `UPDATE posts SET likes = likes + 1 WHERE id = ${post_id}; `;
  } else {
    querys = `UPDATE posts SET likes = likes - 1 WHERE id = ${post_id}; `;
  }
  
  return new Promise((resolve, reject) => {

    db.query(querys, (err, data) => {
      if (err) {
        reject(err);
      } else {
      
        resolve(data);
      }
    });
  });
}

// ============================================================================

function getProfilePostMethod(user_id) {
  return new Promise((resolve, reject) => {
    const query = `SELECT 
    u.user_id,
    pi.user_name,
    pi.description AS profile_description,
    profile_image.image_url AS profile_image_url,
    cover_image.image_url AS cover_image_url,
    p.id AS post_id,
    p.image_url AS post_image_url,
    p.description AS post_text,
    p.likes,
    p.comments
FROM 
    users u
INNER JOIN 
    profile_info pi ON u.user_id = pi.user_id
LEFT JOIN 
    user_images profile_image ON u.user_id = profile_image.user_id AND profile_image.image_type = 'profile'
LEFT JOIN 
    user_images cover_image ON u.user_id = cover_image.user_id AND cover_image.image_type = 'cover'
INNER JOIN 
    posts p ON u.user_id = p.user_id
WHERE 
    u.user_id =${user_id}
ORDER BY 
    p.created_at DESC;
 
`;

    db.query(query, (err, results) => {
      if (err) {
        reject("err");
      } else {
        resolve(results);
      }
    });
  });
}
// ================================================================================================================
function getSuggestions(searchQuery) {
  return new Promise((resolve, reject) => {
    const query = `
    SELECT user_name
    FROM profile_info
    WHERE user_name LIKE ? 
    LIMIT 10
  `;
    db.query(query, [`${searchQuery}%`], (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}
// =================================================================================================================

function postComment(post_id, user_name, text) {
  return new Promise((resolve, reject) => {
     db.query(`UPDATE posts
      SET comments = comments + 1
      WHERE id = ?;`,[post_id],(err)=>{})
    db.query(
      `INSERT INTO comments (post_id, user_name, text) VALUES (?, ?, ?)`,
      [post_id, user_name, text],
      (err) => {
        if (err) {
         
          reject("Error adding comment");
        } else {
          resolve("Comment added successfully");
        }
      }
    );
  });
}

// =======================================================================================================================================


function getComments(post_id){
  return new Promise((resolve, reject) => {
   
    db.query(`SELECT * FROM comments WHERE post_id = ? order by created_at desc`,[post_id],(err,rows)=>{
      if(err){
        reject("Error fetching comments")
      }else{
        resolve(rows)
      }
    })
  })
}

// =============================================================================================================================

function getISfollowing(id, userId) {
  return new Promise((resolve, reject) => {
   
  const query = `SELECT EXISTS (
    SELECT 1 FROM followers WHERE follower_id = ${userId} AND followed_id = ${id}
  ) AS isFollowing`; 
    db.query(query, (err, data) => {
      if (err) {
  
        reject(err);
      } else if(data[0].isFollowing>0) {
        resolve(data);
      }else{
        reject("no data")
      }
    });
  });
}

// ===================================================================================================================

function insertfollowing(id, userId) {
  return new Promise((resolve, reject) => {
   
  const query = `INSERT INTO followers ( follower_id, followed_id) VALUES (?, ?);`; 
    db.query(query, [userId, id], (err, data) => {
      if (err) {
        reject(err);
      } 
      else{
        resolve("inserted")
      }
    });
  });
}



// ======================================================================================================================================

function deletefollowing(id, userId) {
  return new Promise((resolve, reject) => {
   
    const query = `DELETE FROM followers WHERE follower_id = ${userId}  AND followed_id = ${id}`;
    db.query(query, [userId,id], (err, data) => {
      if (err) {
        console.log(err)
        reject(err);
      } else {
        resolve("deelted data");
      }
    });
  });
}
// =====================================================================================================
function getclosefriends(id) {
  return new Promise((resolve, reject) => {
   
    const query = `SELECT 
f.followed_id,
    pi.user_name,
    ui.image_url AS profile_image
FROM 
    followers f
JOIN 
    profile_info pi 
ON 
    f.followed_id = pi.user_id
JOIN 
    user_images ui 
ON 
    ui.user_id = pi.user_id AND ui.image_type = 'profile'
WHERE 
    f.follower_id = ${id};`;
    db.query(query, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}



// ==============================================================================================================================================




module.exports = {
  registration,
  login,
  insertProfileImages,
  getProfileImages,
  updateProfileInfo,
  getProfileInfo,
  addpost,
  getPostMethod,
  setLike,
  getProfilePostMethod,
  getSuggestions,
  postComment,
  getComments,
  getISfollowing,insertfollowing,
  deletefollowing,
  getclosefriends
};
