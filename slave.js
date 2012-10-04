module.exports = function (config, callback) {

    process.title = "vfs-worker " + JSON.stringify(config);
    var Worker = require('vfs-socket/worker').Worker;
    var vfsLocal = require('vfs-local')(config);
    var worker = new Worker(vfsLocal);
    worker.connect([process.stdin, process.stdout], function (err, vfs) {
        if (err) {
          if (callback) return callback(err);
          throw err;
        }

        if (callback) callback(err, vfs);
    });
    process.on("uncaughtException", function (err) {
      console.error(process.pid, err.stack);
      worker.disconnect(err);
    });
};

