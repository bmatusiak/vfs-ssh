var Master = require('vfs-ssh').Master;

console.log(Master);

var master = new Master({
  root: "/home/tim/",
  host: "tim@creationix.com",
  nodePath: "/home/tim/nvm/v0.8.4/bin/node"
});

master.connect(function (err, vfs) {
  if (err) throw err;
  console.log(vfs);
});