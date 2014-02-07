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
      bypassFingerprint: false
    };
    this.singleCmdOpts = {
      domain:this.opts.domains[0],
      user:   this.opts.user,
      keyLoc: this.opts.keyLoc,
    };

    this.LIVEopts = {
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
    };
  });

  teardown(function(){
  });

  suite('run()', function(){
    test('should add the cb to the parent object', function(){
      function cb (){}
      var ssh = new Shync(this.opts);
      ssh._runCmd = sinon.stub();
      ssh.run('date', cb);
      assert.strictEqual(cb, ssh.cb);
    });

    test('should reset object state, for running with a clean slate', function(){
      function cb (){}
      var ssh = new Shync(this.opts);
      ssh._runCmd = sinon.stub();
      ssh.cbCalled = true;
      ssh.domains = {foo:'bar'};
      ssh.procs = {bar:'baz'};
      ssh.run('date', cb);
      
      assert.isFalse(ssh.cbCalled);
      assert.deepEqual({}, ssh.domains);
      assert.deepEqual({}, ssh.procs);

    });

    test('should call _runCmd() w/ opts and the command, iterating over domains', function(){
      var ssh = new Shync(this.opts);
      ssh._runCmd = sinon.spy();
      ssh.run('date', function(){});

      assert.ok(ssh._runCmd.calledTwice);
      assert.ok(ssh._runCmd.getCall(0).calledWith(
        {domain:  this.opts.domains[0],
         user:    this.opts.user,
         keyLoc:  this.opts.keyLoc
        }, 
        'date'
      ));
      assert.ok(ssh._runCmd.getCall(1).calledWith(
        {domain:  this.opts.domains[1],
         user:    this.opts.user,
         keyLoc:  this.opts.keyLoc
        }, 
        'date'
      ));
    });

  });

  suite('_runCmd()', function(){
    test('should add an object representing command state to Shync.domains', function(){
      var ssh = new Shync(this.opts);
      sinon.stub(ssh, '_spawn', function(){
        return {
          addListener: sinon.stub()
        }
      });
      ssh._runCmd(this.singleCmdOpts, 'date');

      assert.ok(ssh.domains.hasOwnProperty(this.singleCmdOpts.domain));
      assert.isFalse(ssh.domains[this.singleCmdOpts.domain].cmdComplete);
    });

    test('should add RSA fingerprint bypass args if bypassFingerprint is true', function(){
      var ssh = new Shync(this.opts);

      sinon.stub(ssh, '_spawn', function(){
        return {
          addListener: sinon.stub()
        }
      });
      var opts = this.singleCmdOpts;

      ssh.opts.bypassFingerprint = true;
      ssh._runCmd(opts, 'date');

      var sshParams = [];
      sshParams.push('-oUserKnownHostsFile=/dev/null');
      sshParams.push('-oStrictHostKeyChecking=no');
      sshParams.push('-oNumberOfPasswordPrompts=0');
      sshParams.push('-i' + opts.keyLoc);
      sshParams.push('-l' + opts.user);
      sshParams.push(opts.domain);
      sshParams.push('date');

      assert.ok(ssh._spawn.calledOnce);
      assert.ok(ssh._spawn.calledWith('ssh', sshParams));

    });

    test('should call Shync._spawn with the ssh or scp cmd', function(){
      var ssh = new Shync(this.opts);

      sinon.stub(ssh, '_spawn', function(){
        return {
          addListener: sinon.stub()
        }
      });
      var opts = this.singleCmdOpts;
      ssh._runCmd(opts, 'date');

      var sshParams = [];
      sshParams.push('-oNumberOfPasswordPrompts=0');
      sshParams.push('-i' + opts.keyLoc);
      sshParams.push('-l' + opts.user);
      sshParams.push(opts.domain);
      sshParams.push('date');

      assert.ok(ssh._spawn.calledOnce);
      assert.ok(ssh._spawn.calledWith('ssh', sshParams));

      
      ssh = new Shync(this.opts);
      
      sinon.stub(ssh, '_spawn', function(){
        return {
          addListener: sinon.stub()
        }
      });
      opts = this.singleCmdOpts;
      ssh._runCmd(opts, ['/foo/bar', '/bar/baz']);

      var scpParams = [];
      scpParams.push('-oNumberOfPasswordPrompts=0');
      scpParams.push('-i' + opts.keyLoc);
      scpParams.push('/foo/bar');
      scpParams.push(opts.user+'@'+opts.domain+':'+'/bar/baz');

      assert.ok(ssh._spawn.calledOnce);
      assert.ok(ssh._spawn.calledWith('scp', scpParams));

      
    });

    test('should add a process to Shync.procs', function(){
      var ssh = new Shync(this.opts);
      sinon.stub(ssh, '_spawn', function(){
        return {
          addListener: sinon.stub()
        }
      });
      var opts = this.singleCmdOpts;
      ssh._runCmd(opts, 'date');

      assert.ok(ssh.procs.hasOwnProperty(opts.domain));

    });

    test('should call Shync._spawn().addListener with "exit" and a cb', function(){

      var ssh = new Shync(this.opts);

      sinon.stub(ssh, '_spawn', function(){
        return {
          addListener: sinon.spy()
        }
      });

      ssh._runCmd(this.singleCmdOpts, 'date');
      
      var proc = ssh.procs[this.singleCmdOpts.domain];

      assert.ok(proc.addListener.calledOnce);
      assert.ok(proc.addListener.calledWith('exit'));
      assert.isFunction(proc.addListener.getCall(0).args[1]);
    });

    test('should call Shync._cmdCb with ret code + domain', function(){
      var ssh = new Shync(this.opts);
      ssh._cmdCb = sinon.spy();

      sinon.stub(ssh, '_spawn', function(){
        return new EventEmitter();
      });

      this.singleCmdOpts.domain = 'hithere.com';
      ssh._runCmd(this.singleCmdOpts, 'date');
      ssh.procs['hithere.com'].emit('exit', 0);
      
      assert.ok(ssh._cmdCb.calledOnce);
      assert.ok(ssh._cmdCb.calledWith(0, 'hithere.com'));

    });

    test('should call Shync._cmdCb as commands complete', function(done){
      var ssh = new Shync(this.opts);
      sinon.stub(ssh, '_spawn', function(){
        return new EventEmitter();
      });

      var calls = 0

      ssh._cmdCb = function(){
        calls += 1;
        if (calls == 2) {
          assert.ok(true);
          done();
        }
      }

      var self = this;

      this.singleCmdOpts.domain = 'hithere.com';
      ssh._runCmd(this.singleCmdOpts, 'date');

      setTimeout(function(){
        ssh.procs['hithere.com'].emit('exit', 0);
      }, 250);

      this.singleCmdOpts.domain = 'hellotoyou.com';
      ssh._runCmd(this.singleCmdOpts, 'date');

      setTimeout(function(){
        ssh.procs['hellotoyou.com'].emit('exit', 0);
      }, 500);

    });

  });

  suite('_cmdCb()', function(){
    test('should update Shync.domains state object', function(){
      var ssh = new Shync(this.opts);
      ssh.cb = sinon.stub();
      ssh.domains['google.com'] = {cmdComplete: false};
      ssh._cmdCb(0, 'google.com');
      assert.isTrue(ssh.domains['google.com'].cmdComplete);
    });

    test('should call the user-provided callback with null if all commands have completed with a 0', function(){
      var ssh = new Shync(this.opts);
      ssh.cb = sinon.spy();
      ssh.domains['google.com'] = {cmdComplete: false};
      ssh.domains['maps.google.com'] = {cmdComplete: false};

      ssh._cmdCb(0, 'google.com');
      assert.ok(!ssh.cb.called);
      ssh._cmdCb(0, 'maps.google.com');
      assert.ok(ssh.cb.calledOnce);
      assert.isNull(ssh.cb.getCall(0).args[0]);
      
    });

    test('should call the user cb immediately with the ret code if the ret code is not 0', function(){
      var ssh = new Shync(this.opts);
      ssh.cb = sinon.spy();
      ssh.domains['google.com'] =      {cmdComplete: false};
      ssh.domains['maps.google.com'] = {cmdComplete: false};

      ssh.procs['google.com'] =      {kill:sinon.stub()};
      ssh.procs['maps.google.com'] = {kill:sinon.stub()};

      ssh._cmdCb(1928, 'google.com');

      assert.ok(ssh.cb.calledOnce);
      assert.ok(ssh.cb.calledWith('Error: google.com: Return Code 1928'));
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

      ssh._cmdCb(0, 'mail.google.com');
      ssh._cmdCb(1928, 'google.com');

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

      ssh._cmdCb(1928, 'google.com');
      assert.ok(ssh.cb.called);
      ssh._cmdCb(0, 'maps.google.com');
      assert.ok(ssh.cb.calledOnce);

      ssh = new Shync(this.opts);
      ssh.cb = sinon.spy();

      ssh.domains['google.com'] =      {cmdComplete: false};
      ssh.domains['maps.google.com'] = {cmdComplete: false};
      ssh.procs['google.com'] =      {kill:sinon.stub()};
      ssh.procs['maps.google.com'] = {kill:sinon.stub()};

      ssh._cmdCb(0, 'google.com');
      assert.ok(!ssh.cb.called);
      ssh._cmdCb(0, 'maps.google.com');
      assert.ok(ssh.cb.calledOnce);
    });
  });

  // suite('playground', function(){
  //   test('do stuff', function(done){
  //     var cluster = new Shync(this.LIVEopts);
  //     // cluster.run('echo "console.log(\'yoohoo\')" > yoohoo.js', function(err){
  //     //   if (err) return console.log(err);
  //     //   cluster.run('cat yoohoo.js', function(err){
  //     //     if (err) return console.log(err);
  //     //     console.log('you\'ve done something important on many machines!');
  //     //   });
  //     // });

  //     cluster.run('~/ascript.js', '~/ascript.js', function(err){
  //       if (err) return console.log(err);
  //       // cluster.run('cat ~/ascript.js', function(err){
  //       //   if (err) return console.log(err);
  //       //   console.log('you\'ve done something important on many machines!');
  //       // });
  //     });
  //   });
  // });

});
