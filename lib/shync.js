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
    commandRun: false,
    retCode: null
  }

  var sshParams = [];
  sshParams.push('-i' + opts.keyLoc);
  sshParams.push('-l' + opts.user);
  sshParams.push(opts.domain);
  sshParams.push('date');

  this.procs[opts.domain] = this.spawn('ssh', sshParams);
  var self = this;
  this.procs[opts.domain].addListener('exit', function(){
    self.cmdCb();
  });

}
Shync.prototype.runCmd = runCmd;

function cmdCb(){

}
Shync.prototype.cmdCb = cmdCb;


exports.Shync = Shync;


