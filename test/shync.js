var assert = require('chai').assert,
    sinon  = require('sinon'),
    util   = require('util'),
    Shync  = require('../lib/shync.js').Shync;

suite('Shync', function(){

  setup(function(){
    this.opts = {
      domains: ['abc.com', '123.456.789'],
      user: 'ubuntu',
      keyLoc: '/foo/id_rsa.pub',
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
        new Shync({domains:[],
                   user:'',
                   keyLoc:''}, '', cb)
      });
      assert.doesNotThrow(function(){
        new Shync({domains:['foo'],
                   user:'foo',
                   keyLoc:'/foo/id_rsa.pub'}, 'foo', cb)
      });

    });
  });

  suite('run()', function(){
    test('should call the callback with an exit code', function(){
      var cb = sinon.spy();
      var ssh = new Shync(this.opts, 'date', cb);
      ssh.runCmd = sinon.spy();
      ssh.run()

      assert.ok(cb.calledOnce);
      assert.ok(cb.calledWith('0'));
    });

    test('should call runCmd() w/ opts and the command, iterating over domains', function(){
      var command = 'date';
      var ssh = new Shync(this.opts, command, function(){});
      ssh.runCmd = sinon.spy();
      ssh.run()

      assert.ok(ssh.runCmd.calledTwice);
      assert.ok(ssh.runCmd.getCall(0).calledWithExactly(
        {domain:  'abc.com',
         user:    'ubuntu',
         keyLoc: '/foo/id_rsa.pub'
        }, 
        'date'
      ));
      assert.ok(ssh.runCmd.getCall(1).calledWithExactly(
        {domain:  '123.456.789',
         user:    'ubuntu',
         keyLoc: '/foo/id_rsa.pub'
        }, 
        'date'
      ));
    });

  });

  suite('runCmd()', function(){

    test('should expect an opts object and command string as args', function(){
      var ssh = new Shync(this.opts, 'date', function(){});

      assert.throws(function(){ssh.runCmd()});
      assert.throws(function(){ssh.runCmd({}, '')});
      assert.throws(function(){
        ssh.runCmd({domain:'',
                      user:'',
                      keyLoc:''}, '')
      });
      assert.doesNotThrow(function(){
        ssh.runCmd({domain:'foo',
                    user:'foo',
                    keyLoc:'/foo/id_rsa.pub'}, 'foo');
      });
    });
    
    test('should return an exit code', function(){
      var ssh = new Shync(this.opts, 'date', function(){});
      assert.isNumber(ssh.runCmd({domain:'foo',
                                  user:  'foo',
                                  keyLoc:'/foo/id_rsa.pub'}, 'foo')
      )
    });

  });

});
