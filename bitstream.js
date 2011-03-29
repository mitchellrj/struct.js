BitStream = function(byteStream, be) {
  if (typeof byteStream == 'string') {
    byteStream = new StringIO(byteStream);
  }
  this.be = be;
  this.stream = byteStream;
  this.currentByte = 0;
  this.readBytes = 0;
  this.currentPosition = 8;
};

BitStream.reverseByte = function (b) {
  // http://graphics.stanford.edu/~seander/bithacks.html#BitReverseObvious
  var v = b;
  var r = v;
  var s = 7;
  for (v >>= 1; v; v >>= 1)
  {
    r <<= 1;
    r |= v & 1;
    s--;
  }
  r <<= s;
  return r & 255;
};

BitStream.prototype.getNextByte = function() {
  var nextByte = this.stream.read().charCodeAt(0);
  nextByte = this.be ? BitStream.reverseByte(nextByte) : nextByte;
  if (nextByte < 0) { nextByte = ~nextByte; }
  return nextByte;
};

BitStream.prototype.read = function(n) {
  var result = this.currentByte>>this.currentPosition;
  var offset = 8 - this.currentPosition;
  var numWholeBytes = Math.floor(n/8);
  while (numWholeBytes>0) {
    if (this.be) {
      result = (result<<8) + this.getNextByte();
    } else {
      result = (this.getNextByte()<<offset) + result;
    }
    offset = 8 + offset;
    numWholeBytes--;
  }
  // trim
  var numBits = n % 8 - (8 - this.currentPosition);
  if (numBits>0) {
    this.currentByte = this.getNextByte();
    this.readBytes++;
    if (this.be) {
      offset = 9-this.currentPosition;
      result = (result<<offset) + (this.currentByte & (Math.pow(2, numBits)-1));
    } else {
      result = ((this.currentByte & (Math.pow(2, numBits)-1))<<(8-this.currentPosition+8*Math.floor(n/8))) + result;
    }
  }
  result = result & (Math.pow(2, n) - 1);
  this.currentPosition = (8 + numBits);
  if (this.currentPosition>8) {
    this.currentPosition = this.currentPosition % 8;
  }
  return result;
};

BitStream.prototype.seekNextWholeByte = function() {
  if (this.currentPosition>0) {
    this.currentPosition = 8;
  }
};

BitStream.prototype.seek = function (n) {
  this.stream.tell(Math.floor(n/8));
  var bits = n % 8;
  if (bits) {
    this.currentByte = this.getNextByte();
    this.currentPosition = bits;
  } else {
    this.currentPosition = 8;
  }
};

BitStream.prototype.tell = function() {
  return this.readBytes * 8 + this.currentPosition;
};