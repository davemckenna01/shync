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
  this.cbCalled = false;
  this.domains = {};
  this.procs = {};
}

Shync.prototype._spawn = spawn;

function run(){
  var cmd,
      self = this;

  if (arguments.length > 1)
    cmd = arguments;        // scp
  else
    cmd = arguments[0];     // ssh

  this._deferred = new Q.defer();

  this.domains = {};
  this.procs = {};

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

  return this._deferred.promise;
}
Shync.prototype.run = run;


function _runCmd(opts, cmd){
  var cmdParams = [],
      program = '',
      self = this;

  if (
      typeof opts !== 'object'
      || (!opts.domain || !opts.user || !opts.keyLoc)

      || (typeof cmd !== 'string' 
          && Object.prototype.toString.call(cmd) !== '[object Array]')

      || (typeof cmd === 'string'
          && !cmd)

      || (Object.prototype.toString.call(cmd) === '[object Array]'
          && cmd.length !== 2)
  ){

    throw {name: 'Error',
           message: 'You must pass a config object and a command'}
  }

  this.domains[opts.domain] = {
    cmdComplete: false
  }

  if(this.opts.bypassFingerprint){
    cmdParams.push('-oUserKnownHostsFile=/dev/null');
    cmdParams.push('-oStrictHostKeyChecking=no');
  }

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
  this.cb(0);

}
Shync.prototype._cmdCb = _cmdCb;


exports.Shync = Shync;


