/*
 * Copyright 2011 Richard Mitchell
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *  http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * This module performs conversions between JavaScript values and C
 * structs represented as JavaScript strings. This can be used in
 * handling binary data stored in files or from network connections,
 * among other sources. It uses format strings as compact descriptions
 * of the layout of the C structs and the intended conversion to/from
 * JavaScript values.
 *
 * Differences from the Python module:
 *  * Alignment of bytes is not allowed for
 *  * Where big-endianness is not explicitly indicated in the format
 *    string, little-endianness is assumed.
 *  * The 'P' format character is considered invalid.
 *  * The 'pack_into' and 'unpack_from' are not yet implemented.
 */
struct = {};

/**
 * Return a new Struct object which writes and reads binary data
 * according to the format string format.
 * @param {string} format
 * @return {{format: string, pack: Function,
 *           unpack: Function, size: number}}
 * @constructor
 */
struct.Struct = function(format) {
  struct.validateFormat(format);
  var partial = function () {
    fn = arguments[0];
    var args = [];
    for (var i=1;i<arguments.length;i++) {
      args.push(arguments[i]);
    }
    return function() {
      for (var i=0;i<arguments.length;i++) {
        args.push(arguments[i]);
      }
      return fn.apply(this, args);
    };
  };
  return {
    'format': format,
    'pack': partial(struct.pack, format),
    'unpack': partial(struct.unpack, format),
    'size': struct.calcsize(format)
  };
};

/**
 * The standard lengths of each individual content marker in bytes.
 * @type {Object.<string, number>}
 * @const
 */
struct.STANDARD_TYPE_LENGTHS = {
    'x': 1,
    'c': 1,
    'b': 1,
    'B': 1,
    '?': 1,
    's': 1,
    'p': 1,
    'h': 2,
    'H': 2,
    'i': 4,
    'I': 4,
    'l': 4,
    'L': 4,
    'f': 4,
    'q': 8,
    'Q': 8,
    'd': 8
};

/**
 * Return a string containing the values packed according to the given
 * format. The arguments must match the values required by the format
 * exactly.
 * @param {string} fmt
 * @param {...(number|string|bool)} values
 * @return {string}
 */
struct.pack = function(fmt) {
  var values = [];
  for (var i=1;i<arguments.length;i++) {
    values.push(arguments[i]);
  }
  struct.validateFormat(fmt);
  var endian = struct.getByteOrder(fmt);

  /*
   * Parse an individual section of a format string,
   */
  var parseArg = function (fmt) {
    var args = [];
    for (var i=1;i<arguments.length;i++) {
      args.push(arguments[i]);
    }

    /*
     * Convert an integer to a binary string
     * @param {number} num
     * @param {number} size the size in bytes
     * @param {bool} signed true is the number should be signed
     * @param {string} endian '>' to indicate big-endianness
     */
    var intToBin = function (num, size, signed, endian) {
      var bitstring = parseInt(num).toString(2);
      var big_endian = (endian === '>');
      if (!signed && num<0) {
        throw 'Cannot convert signed number to unsigned number!';
      }
      if ((!signed && bitstring.length>size*8) || (signed && bitstring.length>(size*8-1))) {
        throw 'Value is too large, cannot pack into '+size+' bytes!';
      }
      while (bitstring.length<(signed ? size*8-1 : size*8)) {
        bitstring = '0'+bitstring;
      }
      if (signed) {
        bitstring = (num<0 ? '1' : '0') + bitstring;
      }
      var result = '';
      for (var k=0;k<bitstring.length;k+=8) {
        result+=String.fromCharCode(parseInt(bitstring.substr(k, 8),2));
      }
      if (!big_endian) {
        var reversed = '';
        for(var j=result.length-1;j>=0;j--) {
          reversed+=result.charAt(j);
        }
        result = reversed;
      }
      return result;
    };

    /*
     * Convert a floating point value to a binary string
     * @param {number} num
     * @param {number} size the size in bytes (accepted values 4 & 8)
     * @param {string} endian '>' to indicate big-endianness
     */
    var floatToBin = function (num, size, endian) {
      var big_endian = (endian === '>');
      var exponent_size;
      var significand_size;
      var bias;
      if (size==4) {
        // single float
        exponent_size = 8;
        significand_size = 23;
        bias = 127;
      } else {
        // double float
        exponent_size = 11;
        significand_size = 52;
        bias = 1023;
      }
      var bitstring = Math.floor(num).toString(2).slice(1);
      bitstring = (bitstring.length + bias).toString(2) + bitstring;
      bitstring = num<0 ? '1' : '0' + bitstring;
      bitstring = bitstring.slice(0,size*8);
      var fraction = num - Math.floor(num);
      while (fraction && bitstring.length<size*8) {
        fraction = fraction*2;
        bitstring += fraction > 1 ? '1' : '0';
        fraction = fraction - Math.floor(fraction);
      }
      var result = '';
      for (var k=0;k<bitstring.length;k+=8) {
        result+=String.fromCharCode(parseInt(bitstring.substr(k, 8),2));
      }
      if (!big_endian) {
        var reversed = '';
        for(var j=result.length-1;j>=0;j--) {
          reversed+=result.charAt(j);
        }
        result = reversed;
      }
      return result;
    };
    var len = /^[0-9]+/.exec(fmt);
    var type;
    if (!len) {
      len = 1;
      type = fmt.charAt(0);
    } else {
      type = fmt.slice(len.length+1);
      len = parseInt(len);
    }

    var val = '';
    switch (type) {
    case 'c':
      val = args.join('');
      break;
    case 's':
      val = args[0];
      if (val.length>len) {
        val = val.slice(0,len);
      }
      while (val.length<len) {
        val = val + String.fromCharCode(0);
      }
      break;
    case 'p':
      val = args[0];
      val = String.fromCharCode(Math.min(val.length, 255)) + val;
      if (val.length>len) {
        val = val.slice(0,len);
      }
      while (val.length<len) {
        val = val + String.fromCharCode(0);
      }
      break;
    case 'b':
    case 'h':
    case 'i':
    case 'l':
    case 'q':
      for (var i=0;i<len;i++) {
        val+=intToBin(args[i], struct.STANDARD_TYPE_LENGTHS[type], true, endian);
      }
      break;
    case 'B':
    case 'H':
    case 'I':
    case 'L':
    case 'Q':
      for (var i=0;i<len;i++) {
        val+=intToBin(args[i], struct.STANDARD_TYPE_LENGTHS[type], false, endian);
      }
      break;
    case 'f':
    case 'd':
      for (var i=0;i<len;i++) {
        val+=floatToBin(args[i], struct.STANDARD_TYPE_LENGTHS[type], endian);
      }
      break;
    case 'x':
      for (var i=0;i<len;i++) {
        val += String.fromCharCode(0);
      }
      break;
    case '?':
      for (var i=0;i<len;i++) {
        val += args[i] ? String.fromCharCode(1) : String.fromCharCode(0);
      }
      break;
    }
    return val;
  };
  fmt = new String(fmt);
  var result = '';
  while (fmt) {
    var block_fmt = /^\d*[xcbB?hHiIlLqQfdspP]/.exec(fmt);
    if (!block_fmt) {
      fmt=fmt.slice(1);
      continue;
    }
    block_fmt = String(block_fmt);
    var block_length = struct.calcsize(block_fmt);
    var len = /^[0-9]+/.exec(block_fmt);
    if (!len || block_fmt[block_fmt.length-1]=='s') {
      len = 1;
    } else {
      len = parseInt(len);
    }
    result+=parseArg(block_fmt, values.slice(0, len));
    fmt = fmt.slice(block_fmt.length);
    values = values.slice(len);
  }
  return result;
};

/**
 * Unpack the string (presumably packed by pack(fmt, ...)) according to
 * the given format. The result is an array even if it contains exactly
 * one item. The string must contain exactly the amount of data
 * required by the format (len(string) must equal calcsize(fmt)).
 * @param {string} fmt
 * @param {string} string
 * @return {Array.<(string|number|bool)>}
 */
struct.unpack = function(fmt, string) {

  /*
   * Parse a single format block
   * @param {string} fmt the format string
   * @param {string} string the binary string
   * @param {string} endian
   * @return {string|number}
   */
  var parseBlock = function(fmt, string, endian) {

    /*
     * Convert a binary string to an integer.
     * @param {string} data
     * @param {bool} signed
     * @param {string} endian
     * @return {number}
     */
    var binToInt = function(data, signed, endian) {
      var big_endian = (endian === '>');
      var bitstring = '';
      for(var i=big_endian ? 0 : data.length-1;
          big_endian ? i<data.length : i>=0;
          big_endian ? i++ : i--) {
        var next = parseInt(data.charCodeAt(i)).toString(2);
        while(next.length % 8) {
          next = '0' + next;
        }
        bitstring += next;
      }
      var sign = 1;
      if (signed) {
        sign = Math.pow(-1, parseInt(bitstring.charAt(0)));
        bitstring = bitstring.slice(1);
      }
      return sign*parseInt(bitstring, 2);
    };

    /*
     * Convert a binary string to a floating point number.
     * @param {string} data
     * @param {string} endian
     * @return {number}
     */
    var binToFP = function (data, endian) {
      var ret;
      var exponent_size;
      var significand_size;
      var bias;
      if (data.length==4) {
        // single float
        exponent_size = 8;
        significand_size = 23;
        bias = 127;
      } else {
        // double float
        exponent_size = 11;
        significand_size = 52;
        bias = 1023;
      }
      var bitstring = binToInt(data, false, endian).toString(2);
      while (bitstring.length<data.length*8) {
        bitstring = '0'+bitstring;
      }
      var sign = Math.pow(-1, parseInt(bitstring.charAt(0), 2));
      var exponent = bitstring.substr(1, exponent_size);
      exponent = parseInt(exponent, 2);

      var significand = bitstring.substr(exponent_size + 1, significand_size);
      if (exponent>0) {
        significand = '1'+ significand;
      } else if (exponent==255) {
        return NaN;
      } else {
        significand = '0'+ significand;
      }
      significand = parseInt(significand, 2)*Math.pow(2, -significand_size);
      ret = sign * significand *Math.pow(2, (exponent - bias));
      return ret;
    };

    var len = /^[0-9]+/.exec(fmt);
    var type;
    if (!len) {
      len = 1;
      type = fmt.charAt(0);
    } else {
      type = fmt.slice(len.length+1);
      len = parseInt(len);
    }

    var val = null;
    switch (type) {
    case 'c':
      val = string.slice(0, len).split('');
      break;
    case 's':
      val = [string.slice(0, len)];
      break;
    case 'p':
      var givenLen = string.charCodeAt(0);
      val = [string.slice(1, Math.min(givenLen, len))];
      break;
    case 'b':
    case 'h':
    case 'i':
    case 'l':
    case 'q':
      for (var i=0;i<len;i++) {
        val.push(binToInt(string.substr(struct.STANDARD_TYPE_LENGTHS[type]*i, struct.STANDARD_TYPE_LENGTHS[type]), true, endian));
      }
      break;
    case 'B':
    case 'H':
    case 'I':
    case 'L':
    case 'Q':
    case '?':
      for (var i=0;i<len;i++) {
        val = [];
        val.push(binToInt(string.substr(struct.STANDARD_TYPE_LENGTHS[type]*i, struct.STANDARD_TYPE_LENGTHS[type]), false, endian));
      }
      break;
    case 'f':
    case 'd':
      for (var i=0;i<len;i++) {
        val = [];
        val.push(binToFP(string.substr(struct.STANDARD_TYPE_LENGTHS[type]*i, struct.STANDARD_TYPE_LENGTHS[type]), endian));
      }
      break;
    case 'x':
    default:
      val = null;
    }
    if (type=='?') {
      val = !!val;
    }
    return val;
  };

  struct.validateFormat(fmt);
  var result = [];
  var endian = struct.getByteOrder(fmt);
  fmt = new String(fmt);
  while (fmt) {
    var block_fmt = /^\d*[xcbB?hHiIlLqQfdspP]/.exec(fmt);
    if (!block_fmt) {
      fmt=fmt.slice(1);
      continue;
    }
    block_fmt = String(block_fmt);
    var block_length = struct.calcsize(block_fmt);
    if (block_fmt.charAt(block_fmt.length-1)!='x') {
      var block = parseBlock(block_fmt, string.substr(0, block_length), endian);
      if (block.shift) {
        // is array
        result = result.concat(block);
      } else {
        result.push(block);
      }
    }
    string = string.slice(block_length);
    fmt = fmt.slice(block_fmt.length);
  }
  return result;
};

/**
 * Return the size of the struct (and hence of the string)
 * corresponding to the given format.
 */
struct.calcsize = function(fmt) {
  struct.validateFormat(fmt);
  var size = 0;
  fmt = new String(fmt);
  while(fmt.length){
    var len = /^[0-9]+/.exec(fmt);
    if (!len) {
      len = 1;
    } else {
      fmt = fmt.slice(String(len).length);
      len = parseInt(len);
    }
    var bs = struct.STANDARD_TYPE_LENGTHS[fmt.charAt(0)];
    if (!bs) {
      bs = 0;
    }
    size+=bs*parseInt(len);
    fmt = fmt.slice(1);
  }
  return size;
};

/**
 * Given a format string, throw an exception if it is invalid.
 */
struct.validateFormat = function(fmt) {
  if (fmt.indexOf('P')>-1) {
    throw '"P" is not available.';
  }
  if (!/^[@=<>!]?\s*(\d*[xcbB?hHiIlLqQfdsp]\s*)+$/.exec(fmt)) {
    throw 'Invalid format "'+fmt+'"!';
  }
};

/**
 * Get the byte-ordering character from the given format string, or
 * default to '<' (little-endian) if none exists.
 * @param {string} fmt
 * @return {string}
 */
struct.getByteOrder = function(fmt) {
  var bom = '<';
  if (fmt.charAt(0)=='>') {
    bom='>';
  }
  return bom;
};
