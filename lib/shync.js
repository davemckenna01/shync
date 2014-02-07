var spawn = require('child_process').spawn;

function Shync(opts){
  this.opts = opts;
  this.cbCalled = false;
  this.domains = {};
  this.procs = {};
}

Shync.prototype._spawn = spawn;

function run(){
  var cmd, cb, i, l, stdout, stderr;

  if (typeof arguments[0] === 'string' &&
      typeof arguments[1] === 'function') {
    //ssh
    cmd = arguments[0];
    cb = arguments[1];
  } else if (typeof arguments[0] === 'string' &&
             typeof arguments[1] === 'string' &&
             typeof arguments[2] === 'function') {
    //scp
    cmd = [arguments[0],arguments[1]];
    cb = arguments[2];
  }

  this.cb = cb;

  this.cbCalled = false;
  this.domains = {};
  this.procs = {};

  for (i = 0, l = this.opts.domains.length; i < l; i +=1) {
    this._runCmd(
      {domain: this.opts.domains[i],
       user:   this.opts.user,
       keyLoc: this.opts.keyLoc
      },
      cmd
    );
  }
}
Shync.prototype.run = run;

function _runCmd(opts, cmd){
  var cmdParams = [],
      program,
      self = this;

  this.domains[opts.domain] = {
    cmdComplete: false
  }

  if(this.opts.bypassFingerprint){
    cmdParams.push('-oUserKnownHostsFile=/dev/null');
    cmdParams.push('-oStrictHostKeyChecking=no');
  }

  cmdParams.push('-oNumberOfPasswordPrompts=0');

  if (typeof cmd === 'string'){
    //ssh
    program = 'ssh';
    cmdParams.push('-i' + opts.keyLoc);
    cmdParams.push('-l' + opts.user);
    cmdParams.push(opts.domain);
    cmdParams.push(cmd);
  } else {
    //scp
    program = 'scp';
    cmdParams.push('-i' + opts.keyLoc);
    cmdParams.push(cmd[0]);
    cmdParams.push(opts.user+'@'+opts.domain+':'+cmd[1]);
  }

  this.procs[opts.domain] = this._spawn(program, cmdParams);

  this.procs[opts.domain].addListener('exit', function(code){
    self._cmdCb(code, opts.domain);
  });

  ///////////////////////////////////
  // No tests written for this yet...

  if (this.opts.stdout) {
    this.procs[opts.domain].stdout.addListener('data', function(data){
      self.opts.stdout(opts.domain + ':STDOUT: ' + data.toString());
    });
  }

  if (this.opts.stderr) {
    this.procs[opts.domain].stderr.addListener('data', function(data){
      self.opts.stderr(opts.domain + ':STDERR: ' + data.toString());
    });
  }

  ///////////////////////////////////

}
Shync.prototype._runCmd = _runCmd;

function _cmdCb(code, domain){
  var d;

  if (this.cbCalled){
    return;
  }

  //if we ever get a not 0 code, call the user cb
  //and kill all outstanding procs
  if(code !== 0){
    this.domains[domain].cmdComplete = true;
    this.cbCalled = true;
    this.cb('Error: ' + domain + ': Return Code ' + code);

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
  for (d in this.domains){
    if (!this.domains[d].cmdComplete){
      return;
    }
  }

  //only once all processes have completed with a
  //0 ret code do we call the user cb
  this.cbCalled = true;
  this.cb(null);

}
Shync.prototype._cmdCb = _cmdCb;

exports.Shync = Shync;
