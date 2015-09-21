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
var totalOps = 0;
var maxTime = 0;

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
    console.log("Total Ops: " + totalOps);
    console.log("Max Time (s): " + maxTime);
    console.log("Throughput (ops/s): " + (totalOps / maxTime));
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
      try {
        var stats = JSON.parse(data.Messages[0].Body);
        console.log(stats);
        totalOps += stats.readCount;
        totalOps += stats.writeCount;

        var timeSpan = stats.endTime[0] - stats.startTime[0];
        if (timeSpan > maxTime) {
          maxTime = timeSpan;
        }

      } catch(e) {
        console.error("Error parsing stats: " + e);
        console.error(data.Messages[0].Body); 
      }

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

var purgeQueue = function(queueName) {
  Q.ninvoke(sqs, "receiveMessage", {
    QueueUrl: queueUrls[queueName],
    WaitTimeSeconds: 0,
    MaxNumberOfMessages: 1
  }).then(function(queueName, data) {
    if (data.Messages && data.Messages.length > 0) {
      purgeQueue(queueName);
      return Q.ninvoke(sqs, "deleteMessage", {
        QueueUrl: queueUrls[queueName],
        ReceiptHandle: data.Messages[0].ReceiptHandle
      });
    }
  }.bind({}, queueName)).catch(errHandler);
};

// Get queue URLs
Q.ninvoke(sqs, "listQueues", {}).then(function(data) {
  
  for (var i = 0; i < data.QueueUrls.length; i++) {
    if (data.QueueUrls[i].indexOf("startCmd") > -1) {
      queueUrls.startCmd = data.QueueUrls[i];
    } else if (data.QueueUrls[i].indexOf("stopCmd") > -1) {
      queueUrls.stopCmd = data.QueueUrls[i];
    } else if (data.QueueUrls[i].indexOf("messages") > -1) {
      queueUrls.messages = data.QueueUrls[i];
    } else if (data.QueueUrls[i].indexOf("stats") > -1) {
      queueUrls.stats = data.QueueUrls[i];
    }
  }
  console.log(queueUrls);

  return Q.ninvoke(sqs, "sendMessage", {
    QueueUrl: queueUrls.stopCmd,
    MessageBody: "stop",
    DelaySeconds: 0
  });

}).then(function(data) {
  console.log(data);
  // Begin processing stats queue
  queryStats();
  // Purge messages, startCmd, stopCmd queues
  purgeQueue("messages");
  purgeQueue("startCmd");
  //purgeQueue("stopCmd");
}).catch(errHandler);

