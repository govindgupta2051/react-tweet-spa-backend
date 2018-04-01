const passport = require('passport');
const TwitterTokenStrategy = require('passport-twitter-token');
const User = require('mongoose').model('User');
const twitterConfig = require('../config/config');

module.exports = function () {
  passport.use(new TwitterTokenStrategy({
    consumerKey:twitterConfig.consumerKey,
    consumerSecret:twitterConfig.consumerSecret,
    includeEmail:true
  }, function (token, tokenSecret, profile, done) {
    User.upsertTwitterUser(token, tokenSecret, profile, function (err, user) {
      return done(err, user);
    });
  }));
};
