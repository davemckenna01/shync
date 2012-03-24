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

}

function run(){
  this.cb('0');

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

  return 0;
}
Shync.prototype.runCmd = runCmd;

exports.Shync = Shync;


