var AWS = require("aws-sdk");
var Q = require("q");

// Loading credentials from .aws/credentials
AWS.config.region = "us-east-1";
var errHandler = function(err) { console.error("ERR:"+err); };
var sqs = new AWS.SQS();
var statsQueue = null;
var msgQueue = null;

Q.ninvoke(sqs, "createQueue", {
  QueueName: "stats",
  Attributes: {
    ReceiveMessageWaitTimeSeconds: "0", //shortpoll = 0, longpoll=20
    VisibilityTimeout: "0"
  }
}).then(function(data) {
  statsQueue = new AWS.SQS({ params: { QueueUrl: data.QueueUrl } });
  console.log(data);
  return Q.ninvoke(sqs, "createQueue", {
    QueueName: "messages",
    Attributes: {
      ReceiveMessageWaitTimeSeconds: "0", //shortpoll = 0, longpoll=20
      VisibilityTimeout: "0"
    }
  });
}).then(function(data) {
  msgQueue = new AWS.SQS({ params: { QueueUrl: data.QueueUrl } });
  console.log(data);
}).catch(errHandler);


