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
        worker.on("disconnect", function () {
            childrenOfPid(process.pid, function(err, pidlist){
              if (err) {
                console.error(err.stack);
                return;
              }
              pidlist.forEach(function (pid) {
                try {
                  process.kill(pid, "SIGKILL");
                } catch(e) {
                  // kill may throw if the pid does not exist.
                }
              });
            });
        });

        function childrenOfPid(pid, callback) {
            vfsLocal.execFile("ps", {args: ["-A", "-oppid,pid"]}, function(err, meta) {
                if (err)
                return callback(err);

                var parents = {};
                meta.stdout.split("\n").slice(1).forEach(function(line) {
                    var col = line.trim().split(/\s+/g);
                    (parents[col[0]] || (parents[col[0]] = [])).push(col[1]);
                });

                function search(roots) {
                var res = roots.concat();
                for (var c, i = 0; i < roots.length; i++) {
                    if ((c = parents[roots[i]]) && c.length)
                        res.push.apply(res, search(c));
                    }
                    return res;
                }
                callback(null, search([pid]));
            });
        }

        if (callback) callback(err, vfs);
    });
    process.on("uncaughtException", function (err) {
      console.error(process.pid, err.stack);
      worker.disconnect(err);
    });
};

