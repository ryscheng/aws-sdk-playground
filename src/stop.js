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
var stats = {};
var totalOps, maxTime;

var numTasks = 0;
var queueUrls = {};

if (process.argv.length < 3) {
  console.log("Usage: node stop.js [NUM_TASKS]");
  process.exit(0);
}
// This is how many stats messages to wait for
numTasks = parseInt(process.argv[2]);

var queryStats = function() {
  if (Object.keys(stats).length >= numTasks) {
    // Compute
    totalOps = 0;
    maxTime = 0;
    for (var k in stats) {
      if (stats.hasOwnProperty(k)) {
        try {
          var elt = JSON.parse(stats[k]);
          //console.log(elt);
          totalOps += elt.readCount;
          totalOps += elt.writeCount;

          var timeSpan = elt.endTime[0] - elt.startTime[0];
          if (timeSpan > maxTime) {
            maxTime = timeSpan;
          }

        } catch(e) {
          console.error("Error parsing stats: " + e);
          console.error(stats[k]); 
        }
      }
    }

    console.log("Done");
    console.log("Total Ops: " + totalOps);
    console.log("Max Time (s): " + maxTime);
    console.log("Throughput (ops/s): " + (totalOps / maxTime));
    return;
  }

  Q.ninvoke(sqs, "receiveMessage", {
    QueueUrl: queueUrls.stats,
    WaitTimeSeconds: 20,
    MaxNumberOfMessages: 10
  }).then(function(data) {
    if (data.Messages && data.Messages.length > 0) {
      // Cache message
      var deleteEntries = [];
      for (var i = 0; i < data.Messages.length; i++) {
        stats[data.Messages[i].MessageId] = data.Messages[i].Body;
        console.log(Object.keys(stats).length + ": " + data.Messages[i].Body);
        deleteEntries.push({
          Id: ""+i,
          ReceiptHandle: data.Messages[i].ReceiptHandle
        });
      }
      return Q.ninvoke(sqs, "deleteMessageBatch", { 
        QueueUrl: queueUrls.stats,
        Entries: deleteEntries
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

