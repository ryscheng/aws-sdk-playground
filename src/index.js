var AWS = require("aws-sdk");
var Q = require("q");

// Loading credentials from .aws/credentials
AWS.config.region = "us-east-1";
var errHandler = function(err) { console.error("ERR:"+err); };
var sqs = new AWS.SQS();

var queueUrls = {};
var writeRatio = 0;
var count, totalOps = 0;
var startTime, endTime, duration;

if (process.argv.length < 4) {
  console.log("Usage: node index.js [WRITES] [TOTAL]");
  process.exit(0);
}
writeRatio = parseFloat(process.argv[2]);
totalOps = parseInt(process.argv[3]);

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
}).catch(errHandler);


startTime = process.hrtime();

for (count = 0; count < totalOps; count++) {
  if (Math.random() < writeRatio) { // Write
    console.log("Write");
  } else { // Read
    console.log("Read");
  }
}



endTime = process.hrtime();
console.log(startTime);
console.log(endTime);
console.log(writeRatio);

// Write to stats: #ops / (endTime - startTime)
