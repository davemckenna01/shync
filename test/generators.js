var co = require('co');
var Shync = require('../lib/shync').Shync;

var remote = new Shync({
  domains:['ec2-174-129-171-245.compute-1.amazonaws.com', 
           'ec2-54-225-9-79.compute-1.amazonaws.com'],
  user:   'ubuntu',
  keyLoc: '/Users/davemckenna/.ec2/ec22.pem',
  bypassFingerprint: true,
  stdout: function(o) {
    console.log(o);
  },
  stderr: function(e) {
    console.log(e);
  }
});

co(function*(){
  try{
    yield remote.run('ls -al ~');
    yield remote.run('rm newfile*');
    yield remote.run('touch newfile'+new Date().getTime());
  }catch(e){
    console.log(e);
  }
})();
