StringIO = function(string) {
  this.string = string;
  this.position = 0;
};

StringIO.prototype.read = function(n) {
  if (n===undefined) {
    n = 1;
  }
  var result = '';
  if (this.position<this.string.length) {
    for (var i=0;i<n;i++) {
      result += this.string.charAt(this.position+i);
    }
    this.position += n;
  } else {
    throw "EOF";
  }
  return result;
};

StringIO.prototype.tell = function() {
  return this.position;
};

StringIO.prototype.seek = function(n) {
  this.position = n;
}