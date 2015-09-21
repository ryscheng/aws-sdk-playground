// Initiate ECS tasks,
// issue start command

var AWS = require("aws-sdk");
var Q = require("q");

AWS.config.region = "us-east-1";
var errHandler = function(err) { console.error("ERR:"+err); };
var ecs = new AWS.ECS();
var sqs = new AWS.SQS();
var startCmdQueue = null;

var runTaskPromises = [];
var numTasks = 0;

if (process.argv.length < 3) {
  console.log("Usage: node start.js [NUM_TASKS]");
  process.exit(0);
}
numTasks = parseInt(process.argv[2]);


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
    QueueName: "stopCmd",
    Attributes: {
      ReceiveMessageWaitTimeSeconds: "0", //shortpoll = 0, longpoll=20
      VisibilityTimeout: "0"
    }
  });
}).then(function(data) {
  console.log(data);
  return Q.ninvoke(sqs, "createQueue", {
    QueueName: "startCmd",
    Attributes: {
      ReceiveMessageWaitTimeSeconds: "0", //shortpoll = 0, longpoll=20
      VisibilityTimeout: "0"
    }
  });
}).then(function(data) {
  console.log(data);
  startCmdQueue = new AWS.SQS({ params: { QueueUrl: data.QueueUrl } });

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

  return Q.all(runTaskPromises);
}).then(function(data) {
  console.log(data);

  // @TODO insert pause
  /**
  return Q.ninvoke(startCmdQueue, "sendMessage", {
    MessageBody: "start",
    DelaySeconds: 0
  }); 
  **/
}).catch(errHandler);
