const config = require('./config.json');
var env = process.env.NODE_ENV || 'development';

if (env === 'development' || env === 'test') {
  //var config = require('./config.json');
  var envConfig = config[env];
  Object.keys(envConfig).forEach((key) => {
    process.env[key] = envConfig[key];
  });
}

const appConfig = config["twitter-app-info"];
module.exports = {
  "consumerKey": appConfig.consumerKey,
  "consumerSecret": appConfig.consumerSecret
};

