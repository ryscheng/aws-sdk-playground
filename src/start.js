// Initiate ECS tasks,
// issue start command

var AWS = require("aws-sdk");
var Q = require("q");

AWS.config.region = "us-east-1";
var errHandler = function(err) { console.error("ERR:"+err); };
var ecs = new AWS.ECS();
var sqs = new AWS.SQS();

var runTaskPromises = [];
var numTasks = 0;

if (process.argv.length < 3) {
  console.log("Usage: node start.js [NUM_TASKS]");
  process.exit(0);
}
numTasks = parseInt(process.argv[2]);

var count;
while (numTasks > 0) {
  if (numTasks > 10) {
    count = 10;
  } else {
    count = numTasks;
  }
  numTasks -= count;

  runTaskPromises.push(Q.ninvoke(ecs, "runTask", {
    taskDefinition: "radiatus",
    cluster: "radiatus",
    count: count
  }));
}

Q.all(runTaskPromises).then(function(data) {
  console.log(data);
  return Q.ninvoke(sqs, "createQueue", {
    QueueName: "stats",
    Attributes: {
      ReceiveMessageWaitTimeSeconds: "0", //shortpoll = 0, longpoll=20
      VisibilityTimeout: "0"
    }
  });
}).then(function(data) {
  console.log(data);
  return Q.ninvoke(sqs, "createQueue", {
    QueueName: "messages",
    Attributes: {
      ReceiveMessageWaitTimeSeconds: "0", //shortpoll = 0, longpoll=20
      VisibilityTimeout: "0"
    }
  });
}).then(function(data) {
  console.log(data);
  return Q.ninvoke(sqs, "createQueue", {
    QueueName: "commands",
    Attributes: {
      ReceiveMessageWaitTimeSeconds: "0", //shortpoll = 0, longpoll=20
      VisibilityTimeout: "0"
    }
  });
}).then(function(data) {
  console.log(data);
  cmdQueue = new AWS.SQS({ params: { QueueUrl: data.QueueUrl } });
  return Q.ninvoke(sqs, "sendMessage", {
    QueueUrl: data.QueueUrl,
    MessageBody: "start",
    DelaySeconds: 0
  }); 
}).catch(errHandler);
