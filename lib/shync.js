var spawn = require('child_process').spawn,
    Q     = require('q');

function Shync(opts){
  if (typeof opts !== 'object'
      || Object.prototype.toString.call(opts.domains) !== '[object Array]' 
        ||opts.domains.length === 0 
          || !opts.user || !opts.keyLoc){
    throw {name: 'Error',
           message: 'You must pass a valid config object'}
  }

  this.opts = opts;
  this.domains = {};
  this._procs = {};
  this._running;
}

Shync.prototype._spawn = spawn;

function run(){
  var cmd = arguments,
      self = this;

  this.domains = {};
  this._procs = {};
  this._running = new Q.defer();

  // plop this on the "queue" to run after we return the deferred
  process.nextTick(function(){
    var i, l;
    for (i = 0, l = self.opts.domains.length; i < l; i += 1) {
      self._runCmd(
        {domain: self.opts.domains[i],
         user:   self.opts.user,
         keyLoc: self.opts.keyLoc
        },
        cmd
      );
    }
  });

  return this._running.promise;
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

  if (cmd.length === 1){
    //ssh
    program = 'ssh';
    cmdParams.push('-i' + opts.keyLoc);
    cmdParams.push('-l' + opts.user);
    cmdParams.push(opts.domain);
    cmdParams.push(cmd[0]);
  } else {
    //scp
    program = 'scp';
    cmdParams.push('-i' + opts.keyLoc);
    cmdParams.push(cmd[0]);
    cmdParams.push(opts.user+'@'+opts.domain+':'+cmd[1]);
  }

  this._procs[opts.domain] = this._spawn(program, cmdParams);

  this._procs[opts.domain].addListener('exit', function(code){
    self._cmdCb(code, opts.domain);
  });
}
Shync.prototype._runCmd = _runCmd;

function _cmdCb(code, domain){
  var d;

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
    this.domains[domain].cmdComplete = true;
    this.cbCalled = true;
    this.cb(code);

    //kill outstanding procs
    for (d in this.domains){
      if (!this.domains[d].cmdComplete){
        this._procs[d].kill();
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
  this.cb(0);

}
Shync.prototype._cmdCb = _cmdCb;


exports.Shync = Shync;


