var jsp = require("uglify-js").parser;
var pro = require("uglify-js").uglify;

// Generate the bootstrap code that's sent on stdin of the remote node process
// over the ssh tunnel.
var code = "(" + (function () {
  var stdin = process.stdin;
  // We don't want to send text on stdout
  console.log = console.error;
  var code = "";
  function onChunk(chunk) {
    var end = -1;
    // Scan for null byte
    for (var i = 0, l = chunk.length; i < l; i++) {
      if (chunk[i] === 0) {
        end = i;
        break;
      }
    }
    if (end < 0) {
      code += chunk.toString("utf8");
      return;
    }
    if (end > 0) {
      code += chunk.toString("utf8", 0, end);
    }
    var left = chunk.slice(end + 1);

    // Stop reading code and execute the code
    stdin.removeListener("data", onChunk);
    // uglify will refuse to mangle if it sees an eval, so we alias it here
    // and change it back later.
    _eval(code);

    // Emit any leftover data we consumed.
    if (left.length) stdin.emit("data", left);
  }

  // Start reading the code
  stdin.on("data", onChunk);
  stdin.resume();

}) + ")()";
var ast = jsp.parse(code); // parse code and get the initial AST
ast = pro.ast_mangle(ast); // get a new AST with mangled names
ast = pro.ast_squeeze(ast); // get an AST with compression optimizations
code = pro.gen_code(ast); // compressed code here
code = code.replace("_eval", "eval"); // Reinstate eval
module.exports = code;
