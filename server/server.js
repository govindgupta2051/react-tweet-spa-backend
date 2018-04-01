const twitterConfig = require('./config/config');
const {mongoose} = require('./db/mongoose');
const {User} = require('./models/user');
const passport = require('passport');
const express = require('express');
const jwt = require('jsonwebtoken');
const expressJwt = require('express-jwt');
const router = express.Router();
const bodyParser = require('body-parser');
const request = require('request');
const cors = require('cors');


//mongoose;
//const User = require('mongoose').model('User');
const passportConfig = require('./middleware/authenticate');

//setup configuration for facebook login
 passportConfig();


const app = express();
const port = process.env.PORT;
// enable cors
const corsOption = {
  origin: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  exposedHeaders: ['x-auth-token']
};

app.use(cors(corsOption));

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());


const createToken = function(auth) {
  return jwt.sign({
      id: auth.id
    }, 'my-secret',
    {
      expiresIn: 60 * 120
    });
};

const generateToken = function (req, res, next) {
  req.token = createToken(req.auth);
  return next();
};

const sendToken = function (req, res) {
  res.setHeader('x-auth-token', req.token);
  return res.status(200).send(JSON.stringify(req.user));
};

app.get('/health-check', (req,res) => {
  console.log('test pass');
  res.status(200);
  res.send('Hello !! HealthCheck test passed!!');
});

router.route('/auth/twitter/reverse')
  .post(function(req, res) {
    request.post({
      url: 'https://api.twitter.com/oauth/request_token',
      oauth: {
        oauth_callback: "http%3A%2F%2Flocalhost%3A3000%2Ftwitter-callback",
        consumer_key: twitterConfig.consumerKey,
        consumer_secret: twitterConfig.consumerSecret
      }
    }, function (err, r, body) {
      if (err) {
        return res.send(500, { message: err.message });
      }

      var jsonStr = '{ "' + body.replace(/&/g, '", "').replace(/=/g, '": "') + '"}';
      res.send(JSON.parse(jsonStr));
    });
  });


//token handling middleware
var authenticate = expressJwt({
  secret: 'my-secret',
  requestProperty: 'auth',
  getToken: function(req) {
    if (req.headers['x-auth-token']) {
      return req.headers['x-auth-token'];
    }
    return null;
  }
});

var getCurrentUser = function(req, res, next) {
  User.findById(req.auth.id, function(err, user) {
    if (err) {
      next(err);
    } else {
      req.user = user;
      next();
    }
  });
};

var getOne = function (req, res) {
  var user = req.user.toObject();

  delete user['twitterProvider'];
  delete user['__v'];

  res.json(user);
};

router.route('/auth/me')
  .get(authenticate, getCurrentUser, getOne);

router.route('/auth/twitter')
  .post((req, res, next) => {
    request.post({
      url: `https://api.twitter.com/oauth/access_token?oauth_verifier`,
      oauth: {
        consumer_key: twitterConfig.consumerKey,
        consumer_secret: twitterConfig.consumerSecret,
        token: req.query.oauth_token
      },
      form: { oauth_verifier: req.query.oauth_verifier }
    }, function (err, r, body) {
      if (err) {
        return res.send(500, { message: err.message });
      }
      const bodyString = '{ "' + body.replace(/&/g, '", "').replace(/=/g, '": "') + '"}';
      const parsedBody = JSON.parse(bodyString);

      req.body['oauth_token'] = parsedBody.oauth_token;
      req.body['oauth_token_secret'] = parsedBody.oauth_token_secret;
      req.body['user_id'] = parsedBody.user_id;

      next();
    });
  }, passport.authenticate('twitter-token', {session: false}), function(req, res, next) {
    if (!req.user) {
      return res.send(401, 'User Not Authenticated');
    }

    // prepare token for API
    req.auth = {
      id: req.user.id
    };

    return next();
  }, generateToken, sendToken);

//fetching user home timeline
//https://api.twitter.com/1.1/statuses/home_timeline.json

router.route('/auth/home_timeline')
  .get((req, res, next) => {
    const user = JSON.parse(req.query.user);
    request.get({
      url:'https://api.twitter.com/1.1/statuses/home_timeline.json',
      oauth:{
        consumer_key: twitterConfig.consumerKey,
        consumer_secret: twitterConfig.consumerSecret,
        token: user.twitterProvider.token,
        token_secret:user.twitterProvider.tokenSecret
      }
    },(err, r, body) =>{
      if(err){
        return res.send(500, { message: err.message });
      }
      res.status(200);
      res.send(body);
      next();
    });
  });

router.route('/auth/post_tweet')
  .post((req,res,next) =>{
    //var reqJson = JSON.parse(req);
    request.post({
      url:'https://api.twitter.com/1.1/statuses/update.json',
      oauth:{
        consumer_key: twitterConfig.consumerKey,
        consumer_secret: twitterConfig.consumerSecret,
        token: req.body.user.twitterProvider.token,
        token_secret:req.body.user.twitterProvider.tokenSecret
      },
      form: { status: req.body.tweetText }
    },function (err, r, body) {
      if(err){
        return res.send(500, { message: err.message });
      }
      res.status(200);
      res.send(body);
      next();
    })
  });

app.use('/api/v1', router);
app.listen(port, () =>{
  console.log(`server is listing on ${port}`);
});
