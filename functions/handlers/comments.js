const {db} = require('../utils/admin');


exports.getAllComments = (req,res) => {
    db
    .collection('comments')
    .orderBy('createdAt','desc')
    .get()
    .then((data)=> {
        let comments=[];
        data.forEach((doc) => {
            comments.push({
                commentId: doc.id,
                body: doc.data().body,
                userHandle: doc.data().userHandle,
                createdAt: doc.data().createdAt,
                replyCount: doc.data().replyCount,
                likeCount: doc.data().likecount,
                userImage: doc.data().userImage
                });
            });
            return res.json(comments);

        })
        .catch((err) => {
           console.error(err);
           res.status(500).json({error: err.code});
        });
           
}

exports.postOneComment = (req, res) => {

    if (req.body.body.trim() === ''){
        return res.status(400).json({ body: 'Body must not be empty'});
    }

     const newComment = {
         body:req.body.body,
         userHandle: req.user.handle,
         userImage: req.user.imageUrl,
         createdAt: new Date().toISOString(),
         likeCount: 0,
         replyCount: 0
         
     };
     db
         .collection('comments')
         .add(newComment)
         .then((doc) => {

            const resComment = newComment;
            resComment.commentId = doc.id;
            res.json({resComment});
         })
         .catch((err) => {
             res.status(500).json({ error: 'something went wrong'});
             console.error(err);
         });
    };

exports.getComment = (req, res) => {
        let commentData = {};
        db.doc(`/comments/${req.params.commentId}`)
          .get()
          .then((doc) => {
            if (!doc.exists) {
              return res.status(404).json({ error: 'Comment not found' });
            }
            commentData = doc.data();
            commentData.commentId = doc.id;
            return db
              .collection('replies')
              .orderBy('createdAt', 'desc')
              .where('commentId', '==', req.params.commentId)
              .get();
          })
          .then((data) => {
            commentData.replies = [];
            data.forEach((doc) => {
              commentData.replies.push(doc.data());
            });
            return res.json(commentData);
          })
          .catch((err) => {
            console.error(err);
            res.status(500).json({ error: err.code });
          });
      };

exports.replyOnComment = (req,res) => {

    if(req.body.body.trim() === '') return res.status(400).json({reply: 'Must not be empty'});

    const newReply = {
        body:req.body.body,
        createdAt: new Date().toISOString(),
        commentId: req.params.commentId,
        userHandle: req.user.handle,
        userImage: req.user.imageUrl
     };

   db.doc(`/comments/${req.params.commentId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      return doc.ref.update({replyCount : doc.data().replyCount + 1 });
    })

    .then(() => {
        return db.collection('replies').add(newReply);
    })
    
    .then(() => {
      res.json(newReply);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ error: 'Something went wrong' });
    });
};

exports.likeComment = (req,res) => {

    const likeDocument = db
    .collection('likes')
    .where('userHandle', '==', req.user.handle)
    .where('commentId', '==', req.params.commentId)
    .limit(1);

  const commentDocument = db.doc(`/comments/${req.params.commentId}`);

  let commentData;

  commentDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        commentData = doc.data();
        commentData.commentId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: 'Comment not found' });
      }
    })
    .then((data) => {
      if (data.empty) {
        return db
          .collection('likes')
          .add({
            commentId: req.params.commentId,
            userHandle: req.user.handle
          })
          .then(() => {
            commentData.likeCount++;
            return commentDocument.update({ likeCount: commentData.likeCount });
          })
          .then(() => {
            return res.json(commentData);
          });
      } else {
        return res.status(400).json({ error: 'Comment already liked' });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.unlikeComment = (req, res) => {
    const likeDocument = db
      .collection('likes')
      .where('userHandle', '==', req.user.handle)
      .where('commentId', '==', req.params.commentId)
      .limit(1);
  
    const commentDocument = db.doc(`/comments/${req.params.commentId}`);
  
    let commentData;
  
    commentDocument
      .get()
      .then((doc) => {
        if (doc.exists) {
          commentData = doc.data();
          commentData.commentId = doc.id;
          return likeDocument.get();
        } else {
          return res.status(404).json({ error: 'comment not found' });
        }
      })
      .then((data) => {
        if (data.empty) {
          return res.status(400).json({ error: 'comment not liked' });
        } else {
          return db
            .doc(`/likes/${data.docs[0].id}`)
            .delete()
            .then(() => {
              commentData.likeCount--;
              return commentDocument.update({ likeCount: commentData.likeCount });
            })
            .then(() => {
              res.json(commentData);
            });
        }
      })
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: err.code });
      });
  };

  exports.deleteComment = (req,res) => {
    const document = db.doc(`/comments/${req.params.commentId}`);
    document
      .get()
      .then((doc) => {
        if (!doc.exists) {
          return res.status(404).json({ error: 'comment not found' });
        }
        if (doc.data().userHandle !== req.user.handle) {
          return res.status(403).json({ error: 'Unauthorized' });
        } else {
          return document.delete();
        }
      })
      .then(() => {
        res.json({ message: 'comment deleted successfully' });
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  }
