// Issue a stop command,
// wait until all nodes stop,
// process throughput numbers

var AWS = require("aws-sdk");
var Q = require("q");

AWS.config.region = "us-east-1";
var errHandler = function(err) { 
  if (err) { 
    console.error("ERR:"+err); 
    return true;
  } else {
    return false;
  }
};
var ecs = new AWS.ECS();
var sqs = new AWS.SQS();

var numTasks = 0;
var queueUrls = {};

if (process.argv.length < 3) {
  console.log("Usage: node stop.js [NUM_TASKS]");
  process.exit(0);
}
// This is how many stats messages to wait for
numTasks = parseInt(process.argv[2]);

var queryStats = function() {
  if (numTasks <= 0) {
    console.log("Done");
    return;
  }

  Q.ninvoke(sqs, "receiveMessage", {
    QueueUrl: queueUrls.stats,
    WaitTimeSeconds: 20,
    MaxNumberOfMessages: 1
  }).then(function(data) {
    if (data.Messages && data.Messages.length > 0) {
      numTasks--;
      // Process message 
      console.log(data.Messages[0].Body); 

      return Q.ninvoke(sqs, "deleteMessage", { 
        QueueUrl: queueUrls.stats,
        ReceiptHandle: data.Messages[0].ReceiptHandle
      });
    } else {
      console.log("Still waiting. Trying again");
      return Q.resolve();;
    }
  }).then(function(data) {
    queryStats();
  }).catch(errHandler);
};

// Get queue URLs
Q.ninvoke(sqs, "listQueues", {}).then(function(data) {
  
  for (var i = 0; i < data.QueueUrls.length; i++) {
    if (data.QueueUrls[i].indexOf("commands") > -1) {
      queueUrls.commands = data.QueueUrls[i];
    } else if (data.QueueUrls[i].indexOf("messages") > -1) {
      queueUrls.messages = data.QueueUrls[i];
    } else if (data.QueueUrls[i].indexOf("stats") > -1) {
      queueUrls.stats = data.QueueUrls[i];
    }
  }
  console.log(queueUrls);

  return Q.ninvoke(sqs, "sendMessage", {
    QueueUrl: queueUrls.commands,
    MessageBody: "stop",
    DelaySeconds: 0
  });

}).then(function(data) {
  console.log(data);
  // Begin processing stats queue
  queryStats();
}).catch(errHandler);

