
 const functions = require('firebase-functions');

 const express = require('express');
 const app = express();


 const FBAuth = require('./utils/FBAuth');
 const { db } = require('./utils/admin');
 
 
 const {
    getAllComments,
    postOneComment,
    getComment,
    replyOnComment,
    likeComment,
    unlikeComment,
    deleteComment
  } = require('./handlers/comments');

  const {
    signup,
    login,
    uploadImage,
    addUserDetails,
    getAuthenticatedUser,
    getUserDetails,
    markNotiRead
  } = require('./handlers/users');
  
 
 
 // Comment Routes
 app.get('/comments',getAllComments);
 app.post('/comment',FBAuth,postOneComment);
 app.get('/comment/:commentId',getComment);
 app.post('/comment/:commentId/reply',FBAuth,replyOnComment);
 app.get('/comment/:commentId/like',FBAuth,likeComment);
 app.get('/comment/:commentId/unlike',FBAuth,unlikeComment);
 app.delete('/comment/:commentId',FBAuth,deleteComment);
 

 // User Routes
 app.post('/signup',signup);
 app.post('/login',login);
 app.post('/user/image',FBAuth,uploadImage);
 app.post('/user',FBAuth,addUserDetails);
 app.get('/user',FBAuth,getAuthenticatedUser);
 app.get('/user/:handle',getUserDetails);
 app.post('/notifications',FBAuth,markNotiRead);

 
exports.api =functions.https.onRequest(app);

exports.createNotificationsOnLike = functions
.firestore.document('likes/{id}')
.onCreate((snapshot) => {
    return db.doc(`/comments/${snapshot.data().commentId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipients: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'like',
            read: false,
            commentId: doc.id
          });
        }
      })
      .catch((err) => {
          console.error(err);
      });
});

exports.deleteNotificationOnUnlike = functions
  .firestore.document('likes/{id}')
  .onDelete((snapshot) => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch((err) => {
        console.error(err);
        return;
      });
  });

exports.createNotificationsOnReply = functions
.firestore.document('replies/{id}')
  .onCreate((snapshot) => {
    return db.doc(`/comments/${snapshot.data().commentId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipients: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'reply',
            read: false,
            commentId: doc.id
          });
        }
      })
      .catch((err) => {
        console.error(err);
    });
  });

  exports.onUserImageChange = functions
  .firestore.document('/users/{userId}')
  .onUpdate((change) => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      console.log('image has changed');
      const batch = db.batch();
      return db
        .collection('comments')
        .where('userHandle', '==', change.before.data().handle)
        .get()
        .then((data) => {
          data.forEach((doc) => {
            const comment = db.doc(`/comments/${doc.id}`);
            
            batch.update(comment, { userImage: change.after.data().imageUrl });
            
          });
          return batch.commit();
        });
    } else return true;
  });

exports.oncommentDelete = functions
  .firestore.document('/comments/{commentId}')
  .onDelete((snapshot, context) => {
    const commentId = context.params.commentId;
    const batch = db.batch();
    return db
      .collection('replies')
      .where('commentId', '==', commentId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/replies/${doc.id}`));
        });
        return db
          .collection('likes')
          .where('commentId', '==', commentId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection('notifications')
          .where('commentId', '==', commentId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch((err) => console.error(err));
  });

