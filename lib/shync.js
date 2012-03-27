var spawn = require('child_process').spawn;

function Shync(opts){
  if (typeof opts !== 'object'
      || (opts.domains.length === 0 || !opts.user || !opts.keyLoc)){
    throw {name: 'Error',
           message: 'You must pass a config object'}
  }

  this.opts = opts;
  this.cbCalled = false;
  this.domains = {};
  this.procs = {};
}

Shync.prototype.spawn = spawn;

function run(){

  if (arguments.length === 2){
    //ssh
    var cmd = arguments[0];
    var cb = arguments[1];
    if (typeof cmd !== 'string'
        || !cmd
        || typeof cb !== 'function'){
      throw {name: 'Error',
             message: 'You must pass a command and a callback'}
    }
  } else if (arguments.length === 3){
    //scp
    var cmd = [arguments[0],arguments[1]];
    var cb = arguments[2];
    if (typeof cmd[0] !== 'string'
        || !cmd[0]
        || typeof cmd[1] !== 'string'
        || !cmd[1]
        || typeof cb !== 'function'){
      throw {name: 'Error',
             message: 'You must pass source and dest paths, and a callback'}
    }
  } else {
    throw {name: 'Error',
           message: 'Wrong # of args'}
  }

  this.cb = cb;

  this.cbCalled = false;
  this.domains = {};
  this.procs = {};

  for (var i = 0, l = this.opts.domains.length; i < l; i +=1) {
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

  var cmdParams = [];
  var program = '';
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

  this.procs[opts.domain] = this.spawn(program, cmdParams);

  var self = this;
  this.procs[opts.domain].addListener('exit', function(code){
    self._cmdCb(code, opts.domain);
  });

}
Shync.prototype._runCmd = _runCmd;

function _cmdCb(code, domain){
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
  for (var d in this.domains){
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


