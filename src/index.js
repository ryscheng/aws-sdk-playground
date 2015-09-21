var AWS = require("aws-sdk");
var Q = require("q");

// Loading credentials from .aws/credentials
AWS.config.region = "us-east-1";
var errHandler = function(err) { console.error("ERR:"+err); };
var sqs = new AWS.SQS();

var queueUrls = {};
var writeRatio = 0;
var readCount, writeCount;
var startTime, endTime, duration;
var running = true;

if (process.argv.length < 3) {
  console.log("Usage: node index.js [WRITES]");
  process.exit(0);
}
writeRatio = parseFloat(process.argv[2]);

// Wait for start and stop signals
var pollCommands = function(isInit) {
  var queue;
  if (isInit) {
    queue = queueUrls.startCmd;
    console.log("Polling for start");
  } else {
    queue = queueUrls.stopCmd;
    console.log("Polling for stop");
  }


  Q.ninvoke(sqs, "receiveMessage", {
    QueueUrl: queue,
    WaitTimeSeconds: 20,
    MaxNumberOfMessages: 1
  }).then(function(data) {
    // No message, poll again
    if (!data.Messages || data.Messages.length <= 0) {
      pollCommands(isInit);
      return;
    }
    // Got a start command, go go go. Begin polling for stop
    if (isInit) {
      console.log("START");
      pollCommands(false);
      running = true;
      startTime = process.hrtime();
      readCount = 0;
      writeCount = 0;
      runExperiment();
    } else { // Got a stop command
      console.log("STOP");
      running = false; // Trigger experiment to stop
      endTime = process.hrtime();
      var stats = {
        readCount: readCount,
        writeCount: writeCount,
        startTime: startTime,
        endTime: endTime,
        writeRatio: writeRatio
      };
      console.log(stats);
      // Write to stats: #ops / (endTime - startTime)
      return Q.ninvoke(sqs, "sendMessage", {
        QueueUrl: queueUrls.stats,
        MessageBody: JSON.stringify(stats),
        DelaySeconds: 0
      });
    }
  }).catch(errHandler);
};

var runExperiment = function() {

  if (Math.random() < writeRatio) { // Write
    console.log("Write");
    Q.ninvoke(sqs, "sendMessage", {
      QueueUrl: queueUrls.messages,
      MessageBody: ""+Math.random(),
      DelaySeconds: 0
    }).then(function(data) {
      return Q.ninvoke(sqs, "receiveMessage", {
        QueueUrl: queueUrls.messages,
        WaitTimeSeconds: 0,
        MaxNumberOfMessages: 1
      });
    }).then(function(data) {
      if (data.Messages && data.Messages.length > 0) {
        return Q.ninvoke(sqs, "deleteMessage", {
          QueueUrl: queueUrls.messages,
          ReceiptHandle: data.Messages[0].ReceiptHandle
        });
      } else {
        return Q.resolve();
      }
    }).then(function(data) {
      writeCount++;
      if (running) {
        setTimeout(runExperiment, 0);
      }
    }).catch(errHandler);
  } else { // Read
    console.log("Read");
    Q.ninvoke(sqs, "receiveMessage", {
      QueueUrl: queueUrls.messages,
      WaitTimeSeconds: 0,
      MaxNumberOfMessages: 1
    }).then(function(data) {
      readCount++;
      if (running) {
        setTimeout(runExperiment, 0);
      }
    }).catch(errHandler);

  }

};

// Start here
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

  // Wait for the start command
  pollCommands(true);
}).catch(errHandler);

