// TODO 'p' formatting
// TODO alignment
struct = {};

struct.Struct = function(fmt) {
    struct.validateFormat(fmt);
    function partial() {
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
    }
    return {
        'format': fmt,
        'pack': partial(struct.pack, fmt),
        'unpack': partial(struct.unpack, fmt),
        'size': struct.calcsize(fmt)
    };
};

struct.typeLengths = {
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

struct.pack = function(fmt) {
	var values = [];
	for (var i=1;i<arguments.length;i++) {
		values.push(arguments[i]);
	}
    struct.validateFormat(fmt);
    var endian = struct.getByteOrder(fmt);

    function parseArg(fmt) {
    	var args = [];
    	for (var i=1;i<arguments.length;i++) {
    		args.push(arguments[i]);
    	}

	    function intToBin(num, size, signed, endian) {
	    	var bitstring = parseInt(num).toString(2);
	    	var big_endian = (endian === ">");
	    	if (!signed && num<0) {
	    		throw "Cannot convert signed number to unsigned number!";
	    	}
	    	if ((!signed && bitstring.length>size*8) || (signed && bitstring.length>(size*8-1))) {
	    		throw "Value is too large, cannot pack into "+size+" bytes!";
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
	    	if (big_endian) {
	    		var reversed = '';
	    		for(var j=result.length-1;j>=0;j--) {
	    		    reversed+=result[j];
	    		}
	    		result = reversed;
	    	}
	    	return result;
	    }

	    function floatToBin(num, size, endian) {
	    	var big_endian = (endian === ">");
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
	    		    reversed+=result[j];
	    		}
	    		result = reversed;
	    	}
	    	return result;
	    }
	    var len = /^[0-9]+/.exec(fmt);
        var type;
        if (!len) {
            len = 1;
            type = fmt[0];
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
                while (val.length<len) {
                	val = val + String.fromCharCode(0);
                }
            case 'p':
            	// TODO
            	break;
            case 'b':
            case 'h':
            case 'i':
            case 'l':
            case 'q':
                for (var i=0;i<len;i++) {
                    val+=intToBin(args[i], struct.typeLengths[type], true, endian);
                }
                break;
            case 'B':
            case 'H':
            case 'I':
            case 'L':
            case 'Q':
                for (var i=0;i<len;i++) {
                    val+=intToBin(args[i], struct.typeLengths[type], false, endian);
                }
                break;
            case 'f':
            case 'd':
                for (var i=0;i<len;i++) {
                    val+=floatToBin(args[i], struct.typeLengths[type], endian);
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
    }
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

struct.unpack = function(fmt, string) {

    var parseBlock = function(fmt, string, endian) {

        var parseNum = function (data, endian) {
            var i;
            var ret;
            var big_endian = (endian === ">");
            for (big_endian ? i = 0 : i = data.length - 1;
                 big_endian ? i < data.length : i >= 0;
                 big_endian ? i++ : i--) {
                ret <<= 8;
                ret += data.charCodeAt(i);
            }
            return ret;
        };

        var parseSnum = function (data, endian) {
            var i;
            var ret;
            var neg;
            var big_endian = (endian === ">");
            for (big_endian ? i = 0 : i = 0 + data.length - 1;
                 big_endian ? i < data.length : i >= 0;
                 big_endian ? i++ : i--) {
                if (neg === undefined) {
	            /* Negative if top bit is set */
	            neg = (data.charCodeAt(i) & 0x80) === 0x80;
                }
                ret <<= 8;
                /* If it is negative we invert the bits */
                ret += neg ? ~data.charCodeAt(i) & 0xff: data.charCodeAt(i);
            }
            if (neg) {
                /* If it is negative we do two's complement */
                ret += 1;
                ret *= -1;
            }
            return ret;
        };

        var parseFP = function (data, endian) {
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
            var bitstring = parseNum(data, endian).toString(2);
            while (bitstring.length<data.length*8) {
        		bitstring = '0'+bitstring;
            }
            var sign = Math.pow(-1, parseInt(bitstring[0], 2));
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
            type = fmt[0];
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
            	// TODO
            	break;
            case 'b':
            case 'h':
            case 'i':
            case 'l':
            case 'q':
                for (var i=0;i<len;i++) {
                    val.push(parseSnum(string.substr(struct.typeLengths[type]*i, struct.typeLengths[type]), endian));
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
                    val.push(parseNum(string.substr(struct.typeLengths[type]*i, struct.typeLengths[type]), endian));
                }
                break;
            case 'f':
            case 'd':
                for (var i=0;i<len;i++) {
                	val = [];
                    val.push(parseFP(string.substr(struct.typeLengths[type]*i, struct.typeLengths[type]), endian));
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
        if (block_fmt[block_fmt.length-1]!='x') {
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
        var bs = struct.typeLengths[fmt[0]];
        if (!bs) {
            bs = 0;
        }
        size+=bs*parseInt(len);
        fmt = fmt.slice(1);
    }
    return size;
};

struct.validateFormat = function(fmt) {
    if (fmt.indexOf('P')>-1) {
        throw '"P" is not available.';
    }
    if (!/^[@=<>!]?\s*(\d*[xcbB?hHiIlLqQfdsp]\s*)+$/.exec(fmt)) {
        throw 'Invalid format "'+fmt+'"!';
    }
};

struct.getByteOrder = function(fmt) {
    var bom = '<';
    if (fmt[0]=='>') {
        bom='>';
    }
    return bom;
};