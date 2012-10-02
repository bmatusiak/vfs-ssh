var spawn = require('child_process').spawn;
var Consumer = require('vfs-socket/consumer').Consumer;
var Transport = require('vfs-socket/consumer').smith.Transport;
var inherits = require('util').inherits;
var embedderSync = require('./embedder');

// This is the function to be bootstrapped on the remote node command
var bootstrap = require('./bootstrap');
// This is all the required dependencies bundled up in a single string
var libCode = embedderSync(__dirname, ["vfs-socket", "vfs-local", "vfs-socket/worker", "./slave"], true);

exports.smith = require('vfs-socket/consumer').smith;
exports.Master = Master;
function Master(fsOptions) {
    // Call the super constructor to set things up.
    Consumer.call(this);

    // host is the hostname of the remote machine (can include username like user@foo.com)
    if (!fsOptions.host) throw new Error("host is a required option in vfs-ssh");
    var host = fsOptions.host;
    delete fsOptions.host;

    // nodePath is the path to the node binary on the remote machine
    var nodePath = fsOptions.nodePath || "/usr/local/bin/node";
    delete fsOptions.nodePath;

    // Configure the ssh command-line options
    var args = [host];
    args.push("-F", "/dev/null"); // use empty config file to not depend on local settings

    var sshOptions = { BatchMode: "yes" };
    // see `man ssh_config` to see what options are avaialble
    // Mix in user specified options overrides
    var key;
    if (fsOptions.sshOptions) {
        for (key in fsOptions.sshOptions) {
            sshOptions[key] = fsOptions.sshOptions[key];
        }
    }
    delete fsOptions.sshOptions;
    for (key in sshOptions) {
        args.push("-o", key + "=" + sshOptions[key]);
    }
    args.push(nodePath + " -e '" + bootstrap + "'");
    var child;

    this.connect = connect.bind(this);
    function connect(callback) {
        try {
            child = spawn("ssh", args, {
                customFds: [-1, -1, 2]
            });
        } catch (e) {
            callback(new Error("Could not spawn ssh client: " + e.toString()));
        }

        var code = libCode + "\nrequire('vfs-ssh/slave')(" + JSON.stringify(fsOptions) + ");\n";
        child.stdin.write(code + "\0");

        // Record output in case there is an error and we want to see what
        // happened.
        var stdoutChunks = [];
        function captureStdout(chunk) {
            stdoutChunks.push(chunk);
        }
        child.stdout.on("data", captureStdout);
        child.on("exit", onError);
        var self = this;
        child.on("error", function (err) {
            self.emit("error", err);
        });

        // Remove the startup listeners
        function reset() {
            if (!child) return;
            child.stdout.removeListener("data", captureStdout);
            child.removeListener("exit", onError);
        }
        // Connection failed.
        function onError(code, signal) {
            reset();
            var stdout = stdoutChunks.join("").trim();
            var err = new Error("ssh process died");
            if (signal) {
                err.message += " because of signal " + signal;
                err.signal = signal;
            }
            if (code) {
                err.message += " with exit code " + code;
                err.exitCode = code;
            }
            if (stdout) {
                err.message += "\n" + stdout;
                err.stdout = stdout;
            }
            self.emit("error", err);
        }
        this.once("connect", reset);

        Consumer.prototype.connect.call(this, new Transport([child.stdout, child.stdin], fsOptions.debug), callback);
    }

    this.disconnect = disconnect.bind(this);
    function disconnect() {
        Consumer.prototype.disconnect.apply(this, arguments);
        if (child) {
            child.kill();
            child = undefined;
        }
    }

}
inherits(Master, Consumer);
