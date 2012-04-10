# shync

Simple parallel server cluster management tool for Node using ssh and scp. Specify an ssh or scp command and it will run on all servers in the cluster in parallel.

## Installation

    npm install shync

## ssh

```js
var Shync = require('shync').Shync;

var cluster = new Shync({
  domains: ['23.42.103.164',
            'mydomain.com'],
  user:    'ubuntu',
  keyLoc:  '/path/to/public/key',
  bypassFingerprint: true
});

cluster.run('node ~/stuff/important.js', function(code){
  if (code === 0){
    console.log('you\'ve done something important on many machines!');
  }
});
```

## scp

```js
cluster.run('~/important.tar.gz', '~/stuff/important.tar.gz', function(code){
  if (code === 0){
    console.log('you\'ve done something important on many machines!');
  }
});
```

## Chaining commands

```js
cluster.run('~/important.tar.gz', '~/stuff/important.tar.gz', function(code){
  if (code === 0) {
    cluster.run('tar xzvf ~/stuff/important.tar.gz', function(code){
      if (code === 0){
        cluster.run('node ~/stuff/important.js', function(code){
          if (code === 0){
            console.log('you\'ve done something important on many machines!');
          }
        });
      }
    });
  }
});
```

## code === 0

shync callbacks always receive the [return code](http://en.wikipedia.org/wiki/Exit_status) of the command that was run. shync treats the success of a command as "all or nothing." If the command was successful on all remote machines, 0 will be returned. If even one machine returned a non 0 code, then the command is deemed to have failed and the non 0 code will be returned to the callback.

shync fails quickly if a remote machine returns a non 0 code. All outstanding connections to the remaining servers are aborted, since their return codes are irrelevant now that a non 0 code has been received.

## bypassFingerprint

```js
var cluster = new Shync({
  ...
  bypassFingerprint: true
  ...
});
```

You know when you ssh from the command line into a brand new box, and you get this message:

    $ ssh user@example.com
    The authenticity of host 'example.com (23.20.102.179)' can't be established.
    RSA key fingerprint is 2f:5d:69:26:e2:a0:23:53:f7:0a:21:51:0a:74:8a:49.
    Are you sure you want to continue connecting (yes/no)?

bypassFingerprint: true stops this from happening.

_Warning_ Use bypassFingerprint at your own risk.
