var assert = require('chai').assert,
    sinon  = require('sinon'),
    util   = require('util'),
    Shync  = require('../lib/shync.js').Shync;

var EventEmitter = require('events').EventEmitter;

suite('Shync', function(){

  setup(function(){
    this.opts = {
      domains:['abc.com', '123.456.789'],
      user:   'ubuntu',
      keyLoc: '/foo/id_rsa.pub',
    };
    this.singleCmdOpts = {
      domain:this.opts.domains[0],
      user:   this.opts.user,
      keyLoc: this.opts.keyLoc
    };
  });

  teardown(function(){
  });

  suite('constructor', function(){
    test('should expect an opts object, command string, and callback as args', function(){
      function cb (){}
      assert.throws(function(){new Shync()});
      assert.throws(function(){new Shync({}, '')});
      assert.throws(function(){new Shync({}, '', cb)});
      assert.throws(function(){
        new Shync({domains: [],
                   user:    '',
                   keyLoc:  ''}, '', cb)
      });
      assert.doesNotThrow(function(){
        new Shync({domains: ['abc.com'],
                   user:    'ubuntu',
                   keyLoc:  '/foo/id_rsa.pub'}, 'date', cb)
      });

    });
  });

  suite('run()', function(){
    test('should call runCmd() w/ opts and the command, iterating over domains', function(){
      var command = 'date';
      var ssh = new Shync(this.opts, command, function(){});
      ssh.runCmd = sinon.spy();
      ssh.run()

      assert.ok(ssh.runCmd.calledTwice);
      assert.ok(ssh.runCmd.getCall(0).calledWithExactly(
        {domain:  this.opts.domains[0],
         user:    this.opts.user,
         keyLoc:  this.opts.keyLoc
        }, 
        'date'
      ));
      assert.ok(ssh.runCmd.getCall(1).calledWithExactly(
        {domain:  this.opts.domains[1],
         user:    this.opts.user,
         keyLoc:  this.opts.keyLoc
        }, 
        'date'
      ));
    });

  });

  suite('runCmd()', function(){

    test('should expect an opts object and command string as args', function(){
      var ssh = new Shync(this.opts, 'date', function(){});
      sinon.stub(ssh, 'spawn', function(){
        return {
          addListener: sinon.stub()
        }
      });

      assert.throws(function(){ssh.runCmd()});
      assert.throws(function(){ssh.runCmd({}, '')});
      assert.throws(function(){
        ssh.runCmd({domain:'',
                    user:'',
                    keyLoc:''}, '')
      });
      assert.doesNotThrow(function(){
        ssh.runCmd({domain: 'abc.com',
                    user:   'ubuntu',
                    keyLoc: '/foo/id_rsa.pub'}, 'date');
      });
    });

    test('should add an object representing command state to Shync.domains', function(){
      var ssh = new Shync(this.opts, 'date', function(){});
      sinon.stub(ssh, 'spawn', function(){
        return {
          addListener: sinon.stub()
        }
      });
      ssh.runCmd(this.singleCmdOpts, 'date');

      assert.ok(ssh.domains.hasOwnProperty(this.singleCmdOpts.domain));
      assert.isFalse(ssh.domains[this.singleCmdOpts.domain].commandRun);
      assert.isNull(ssh.domains[this.singleCmdOpts.domain].retCode);
    });
    
    test('should call Shync.spawn with the ssh cmd', function(){
      var ssh = new Shync(this.opts, 'date', function(){});
      
      sinon.stub(ssh, 'spawn', function(){
        return {
          addListener: sinon.stub()
        }
      });
      var opts = this.singleCmdOpts;
      ssh.runCmd(opts, 'date');

      var sshParams = [];
      sshParams.push('-i' + opts.keyLoc);
      sshParams.push('-l' + opts.user);
      sshParams.push(opts.domain);
      sshParams.push('date');

      assert.ok(ssh.spawn.calledOnce);
      assert.ok(ssh.spawn.calledWith('ssh', sshParams));
    });

    test('should add a process to Shync.procs', function(){
      var ssh = new Shync(this.opts, 'date', function(){});
      sinon.stub(ssh, 'spawn', function(){
        return {
          addListener: sinon.stub()
        }
      });
      var opts = this.singleCmdOpts;
      ssh.runCmd(opts, 'date');

      assert.ok(ssh.procs.hasOwnProperty(opts.domain));

    });

    test('should call Shync.spawn().addListener with "exit" and a cb', function(){

      var ssh = new Shync(this.opts, 'date', function(){});

      sinon.stub(ssh, 'spawn', function(){
        return {
          addListener: sinon.spy()
        }
      });

      ssh.runCmd(this.singleCmdOpts, 'date');
      
      var proc = ssh.procs[this.singleCmdOpts.domain];

      assert.ok(proc.addListener.calledOnce);
      assert.ok(proc.addListener.calledWith('exit'));
      assert.isFunction(proc.addListener.getCall(0).args[1]);
    });

    test('should call Shync.cmdCb as commands complete', function(done){
      var ssh = new Shync(this.opts, 'date', function(){});
      sinon.stub(ssh, 'spawn', function(){
        return new EventEmitter();
      });

      var calls = 0

      ssh.cmdCb = function(){
        calls += 1;
        console.log('call ', calls);
        if (calls == 2) {
          assert.ok(true);
          done();
        }
      }

      var self = this;

      this.singleCmdOpts.domain = 'hithere.com';
      ssh.runCmd(this.singleCmdOpts, 'date');

      setTimeout(function(){
        ssh.procs['hithere.com'].emit('exit', 0);
      }, 250);

      this.singleCmdOpts.domain = 'hellotoyou.com';
      ssh.runCmd(this.singleCmdOpts, 'date');

      setTimeout(function(){
        ssh.procs['hellotoyou.com'].emit('exit', 0);
      }, 500);

    });

  });

  //suite('cmdCb()', function(){
  //  test('should expect', function(){
  //    
  //  });
  //});

});
