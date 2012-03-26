var spawn = require('child_process').spawn;

function Shync(opts, cmd, cb){
  if (arguments.length < 3
      ||typeof opts !== 'object'
      || (opts.domains.length === 0 || !opts.user || !opts.keyLoc)
      || typeof cmd !== 'string'
      || !cmd
      || typeof cb !== 'function'){
    throw {name: 'Error',
           message: 'You must pass a config object, command string, and callback'}
  }

  this.opts = opts;
  this.cmd = cmd;
  this.cb = cb;
  this.cbCalled = false;
  this.domains = {};
  this.procs = {};
}

Shync.prototype.spawn = spawn;

function run(){
  for (var i = 0, l = this.opts.domains.length; i < l; i +=1) {
    this.runCmd(
      {domain: this.opts.domains[i],
       user:   this.opts.user,
       keyLoc: this.opts.keyLoc
      },
      this.cmd
    );
  }
}
Shync.prototype.run = run;


function runCmd(opts, cmd){
  if (arguments.length < 2
      ||typeof opts !== 'object'
      || (!opts.domain || !opts.user || !opts.keyLoc)
      || typeof cmd !== 'string'
      || !cmd){
    throw {name: 'Error',
           message: 'You must pass a config object and command string'}
  }

  this.domains[opts.domain] = {
    cmdComplete: false
  }

  var sshParams = [];
  sshParams.push('-i' + opts.keyLoc);
  sshParams.push('-l' + opts.user);
  sshParams.push(opts.domain);
  sshParams.push('date');

  this.procs[opts.domain] = this.spawn('ssh', sshParams);
  //this.procs[opts.domain].pid = parseInt(Math.random() * 10000);
  //this.procs[opts.domain].killed = false;

  var self = this;
  this.procs[opts.domain].addListener('exit', function(){
    self.cmdCb();
  });

}
Shync.prototype.runCmd = runCmd;

function cmdCb(code, domain){
  if (this.cbCalled){
    return;
  }

  if(arguments.length < 2
     || typeof code !== 'number'
     || typeof domain !== 'string'
     || !domain){
    throw {name: 'Error',
           message: 'You must pass a return code + domain'}
  }
  
  //if we ever get a not 0 code, call the user cb
  //and kill all outstanding procs
  if(code !== 0){
    this.cb(code);
    this.domains[domain].cmdComplete = true;
    this.cbCalled = true;

    //kill outstanding procs
    for (d in this.domains){
      if (!this.domains[d].cmdComplete){
        this.procs[d].kill();
      }
    }

    return;
  }

  //mark process as having completed
  if (this.domains[domain]){
    this.domains[domain].cmdComplete = true;
  }

  //check all processes and if even one has not
  //returned then exit this fn.
  for (var d in this.domains){
    if (!this.domains[d].cmdComplete){
      return;
    }
  }

  //only once all processes have completed with a
  //0 ret code do we call the user cb
  this.cb(0);
  this.cbCalled = true;

}
Shync.prototype.cmdCb = cmdCb;


exports.Shync = Shync;


