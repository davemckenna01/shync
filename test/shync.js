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

    this.LIVEopts = {
      domains:['ec2-107-22-124-43.compute-1.amazonaws.com', 
               'ec2-107-21-142-80.compute-1.amazonaws.com'],
      user:   'ubuntu',
      keyLoc: '/Users/davemckenna/.ec2/ec21.pem',
    };
  });

  teardown(function(){
  });

  suite('constructor', function(){
    test('should expect an opts object arg', function(){
      function cb (){}
      assert.throws(function(){new Shync()});
      assert.throws(function(){new Shync({})});
      assert.throws(function(){
        new Shync({domains: [],
                   user:    '',
                   keyLoc:  ''})
      });
      assert.doesNotThrow(function(){
        new Shync({domains: ['abc.com'],
                   user:    'ubuntu',
                   keyLoc:  '/foo/id_rsa.pub'})
      });

    });
  });

  suite('run()', function(){
    test('should expect a command string and a cb', function(){
      function cb (){}
      var ssh = new Shync(this.opts);
      assert.throws(function(){ssh.run()});
      assert.throws(function(){ssh.run('date')});
      assert.doesNotThrow(function(){ssh.run('date', cb)});

    });

    test('should add the cb to the parent object', function(){
      function cb (){}
      var ssh = new Shync(this.opts);
      ssh.run('date', cb);
      assert.strictEqual(cb, ssh.cb);
    });

    test('should call runCmd() w/ opts and the command, iterating over domains', function(){
      var ssh = new Shync(this.opts);
      ssh.runCmd = sinon.spy();
      ssh.run('date', function(){});

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
      var ssh = new Shync(this.opts);
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
      var ssh = new Shync(this.opts);
      sinon.stub(ssh, 'spawn', function(){
        return {
          addListener: sinon.stub()
        }
      });
      ssh.runCmd(this.singleCmdOpts, 'date');

      assert.ok(ssh.domains.hasOwnProperty(this.singleCmdOpts.domain));
      assert.isFalse(ssh.domains[this.singleCmdOpts.domain].cmdComplete);
    });
    
    test('should call Shync.spawn with the ssh cmd', function(){
      var ssh = new Shync(this.opts);
      
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
      var ssh = new Shync(this.opts);
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

      var ssh = new Shync(this.opts);

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

    test('should call Shync.cmdCb with ret code + domain', function(){
      var ssh = new Shync(this.opts);
      ssh.cmdCb = sinon.spy();

      sinon.stub(ssh, 'spawn', function(){
        return new EventEmitter();
      });

      this.singleCmdOpts.domain = 'hithere.com';
      ssh.runCmd(this.singleCmdOpts, 'date');
      ssh.procs['hithere.com'].emit('exit', 0);
      
      assert.ok(ssh.cmdCb.calledOnce);
      assert.ok(ssh.cmdCb.calledWith(0, 'hithere.com'));

    });

    test('should call Shync.cmdCb as commands complete', function(done){
      var ssh = new Shync(this.opts);
      sinon.stub(ssh, 'spawn', function(){
        return new EventEmitter();
      });

      var calls = 0

      ssh.cmdCb = function(){
        calls += 1;
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

  suite('cmdCb()', function(){
    test('should expect a return code and a domain', function(){
      var ssh = new Shync(this.opts);
      ssh.cb = sinon.stub();
      assert.throws(function(){
        ssh.cmdCb();
      });
      assert.doesNotThrow(function(){
        ssh.cmdCb(0, 'google.com');
      });
    });

    test('should update Shync.domains state object', function(){
      var ssh = new Shync(this.opts);
      ssh.cb = sinon.stub();
      ssh.domains['google.com'] = {cmdComplete: false};
      ssh.cmdCb(0, 'google.com');
      assert.isTrue(ssh.domains['google.com'].cmdComplete);
    });

    test('should call the user-provided callback with a ret code of 0 if all commands have completed with a 0', function(){
      var ssh = new Shync(this.opts);
      ssh.cb = sinon.spy();
      ssh.domains['google.com'] = {cmdComplete: false};
      ssh.domains['maps.google.com'] = {cmdComplete: false};

      ssh.cmdCb(0, 'google.com');
      assert.ok(!ssh.cb.called);
      ssh.cmdCb(0, 'maps.google.com');
      assert.ok(ssh.cb.calledOnce);
      assert.isNumber(ssh.cb.getCall(0).args[0]);
      
    });

    test('should call the user cb immediately with the ret code if the ret code is not 0', function(){
      var ssh = new Shync(this.opts);
      ssh.cb = sinon.spy();
      ssh.domains['google.com'] =      {cmdComplete: false};
      ssh.domains['maps.google.com'] = {cmdComplete: false};

      ssh.procs['google.com'] =      {kill:sinon.stub()};
      ssh.procs['maps.google.com'] = {kill:sinon.stub()};

      ssh.cmdCb(1928, 'google.com');

      assert.ok(ssh.cb.calledOnce);
      assert.ok(ssh.cb.calledWith(1928));
      assert.isTrue(ssh.domains['google.com'].cmdComplete);
      assert.isFalse(ssh.domains['maps.google.com'].cmdComplete);
    });

    test('should kill all outstanding processes as soon as we get a non 0 ret code from a process', function(){
      var ssh = new Shync(this.opts);
      ssh.cb = sinon.spy();
      
      ssh.domains['mail.google.com'] = {cmdComplete: false};
      ssh.domains['google.com'] =      {cmdComplete: false};
      ssh.domains['maps.google.com'] = {cmdComplete: false};
      ssh.domains['docs.google.com'] = {cmdComplete: false};

      ssh.procs['mail.google.com'] = {kill:sinon.spy()};
      ssh.procs['google.com'] =      {kill:sinon.spy()};
      ssh.procs['maps.google.com'] = {kill:sinon.spy()};
      ssh.procs['docs.google.com'] = {kill:sinon.spy()};

      ssh.cmdCb(0, 'mail.google.com');
      ssh.cmdCb(1928, 'google.com');

      assert.ok(!ssh.procs['mail.google.com'].kill.called);
      assert.ok(!ssh.procs['google.com'].kill.called);
      assert.ok(ssh.procs['maps.google.com'].kill.calledOnce);
      assert.ok(ssh.procs['docs.google.com'].kill.calledOnce);

    });

    test('should only call the user cb once', function(){
      var ssh = new Shync(this.opts);
      ssh.cb = sinon.spy();

      ssh.domains['google.com'] =      {cmdComplete: false};
      ssh.domains['maps.google.com'] = {cmdComplete: false};
      ssh.procs['google.com'] =      {kill:sinon.stub()};
      ssh.procs['maps.google.com'] = {kill:sinon.stub()};

      ssh.cmdCb(1928, 'google.com');
      assert.ok(ssh.cb.called);
      ssh.cmdCb(0, 'maps.google.com');
      assert.ok(ssh.cb.calledOnce);

      ssh = new Shync(this.opts);
      ssh.cb = sinon.spy();

      ssh.domains['google.com'] =      {cmdComplete: false};
      ssh.domains['maps.google.com'] = {cmdComplete: false};
      ssh.procs['google.com'] =      {kill:sinon.stub()};
      ssh.procs['maps.google.com'] = {kill:sinon.stub()};

      ssh.cmdCb(0, 'google.com');
      assert.ok(!ssh.cb.called);
      ssh.cmdCb(0, 'maps.google.com');
      assert.ok(ssh.cb.calledOnce);
    });
  });

  suite('playground', function(){
    test('do stuff', function(done){
      
      var ssh = new Shync(this.LIVEopts);
      ssh.run('sleepdf 5', function(code){
        console.log('user cb called with:', code);
        done();
      });

    });
  });

});
