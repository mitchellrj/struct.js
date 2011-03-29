load('stringio.js');
load('bitstream.js');

var bytes = ['11111100', '01001000', '11001110', '00001110'];
var reverse_bytes = ['00111110', '10001011', '11100110', '10010000'];

for (var i=0; i<bytes.length; i++) {
  bytes[i] = String.fromCharCode(parseInt(bytes[i], 2));
}
bytes = bytes.join('');

for (var i=0; i<reverse_bytes.length; i++) {
  reverse_bytes[i] = String.fromCharCode(parseInt(reverse_bytes[i], 2));
}
reverse_bytes = reverse_bytes.join('');

var bs = new BitStream(new StringIO(bytes));

// expect 12, 7, 17, 6969, 1
var values = [bs.read(4), bs.read(3), bs.read(7), bs.read(13), bs.read(5)];
print(values);

var bs = new BitStream(new StringIO(reverse_bytes), true);

// expect 12, 7, 17, 6969, 1
var values = [bs.read(4), bs.read(3), bs.read(7), bs.read(13), bs.read(5)];
print(values);