var AWS = require("aws-sdk");
var Q = require("q");

AWS.config.region = "us-east-1";
var errHandler = function(err) { console.error("ERR:"+err); };
var ecs = new AWS.ECS();
var ec2 = new AWS.EC2();
var sqs = new AWS.SQS();

Q.ninvoke(ecs, "createCluster", {
  clusterName: "radiatus"
}).then(function(data) {
  console.log(data);
  return Q.ninvoke(ecs, "registerTaskDefinition", {
    family: "radiatus",
    containerDefinitions: [{
      name: "radiatus",
      image: "node",
      cpu: 1,
      memory: 15,
      essential: true,
      command: [
        "node -v"
      ]
    }],
    volumes: [
    ]
  });
}).then(function(data) {
  console.log(data);
  return Q.ninvoke(ec2, "runInstances", {
    DryRun: false,
    ImageId: "ami-b540eade",
    MinCount: 1,
    MaxCount: 1,
    KeyName: "radiatus2", //Make sure key exists
    // See http://docs.aws.amazon.com/AmazonECS/latest/developerguide/launch_container_instance.html
    UserData: "IyEvYmluL2Jhc2gNCmVjaG8gRUNTX0NMVVNURVI9cmFkaWF0dXMgPj4gL2V0Yy9lY3MvZWNzLmNvbmZpZw==",
    InstanceType: "r3.large",
    IamInstanceProfile: { //Make sure IAM role exists
      Arn: "arn:aws:iam::830863662461:instance-profile/ec2Role"
      //Name: "ec2Role"
    },
    SubnetId: "subnet-9792dfbc"
  });
}).then(function(data) {
  console.log(data);
}).catch(errHandler);


