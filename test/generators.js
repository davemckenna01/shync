var co = require('co');
var thunkify = require('thunkify');
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

var run = thunkify(remote.run).bind(remote);

co(function*(){
  try{
    yield run('ls -al ~');
    yield run('rm newfile*');
    yield run('touch newfile'+new Date().getTime());
  }catch(e){
    console.log(e);
  }
})();
