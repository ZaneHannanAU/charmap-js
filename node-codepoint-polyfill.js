var stringFromCharCode = String.fromCharCode;
var floor = Math.floor;

var fromCodePoint = module.exports.fromCodePoint = function() {
  var MAX_SIZE = 0x4000;
  var codeUnits = [], highSurrogate, lowSurrogate, idx = -1;
  var length = arguments.length;
  if (!length) {
    return '';
  }
  var result = '';
  while (++idx < length) {
    var codePoint = Number(arguments[idx]);
    if (
      !isFinite(codePoint) ||       // `NaN`, `+Infinity`, or `-Infinity`
      codePoint < 0 ||              // not a valid Unicode code point
      codePoint > 0x10FFFF ||       // not a valid Unicode code point
      floor(codePoint) != codePoint // not an integer
    ) {
      throw RangeError('Invalid code point: ' + codePoint);
    }
    if (codePoint <= 0xFFFF) { // BMP code point
      codeUnits.push(codePoint);
    } else { // Astral code point; split in surrogate halves
      // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
      codePoint -= 0x10000;
      highSurrogate = (codePoint >> 10) + 0xD800;
      lowSurrogate = (codePoint % 0x400) + 0xDC00;
      codeUnits.push(highSurrogate, lowSurrogate);
    }
    if (idx + 1 == length || codeUnits.length > MAX_SIZE) {
      result += stringFromCharCode.apply(null, codeUnits);
      codeUnits.length = 0;
    }
  }
  return result;
}

var codePointAt = module.exports.codePointAt = function(str, pos) {
  if (str == null) {
    throw TypeError();
  }
  var string = String(str);
  var size = string.length;
  // `ToInteger`
  var index = pos ? Number(pos) : 0;
  if (index != index) { // better `isNaN`
    index = 0;
  }
  // Account for out-of-bounds indices:
  if (index < 0 || index >= size) {
    return undefined;
  }
  // Get the first code unit
  var first = string.charCodeAt(index);
  var second;
  if ( // check if it’s the start of a surrogate pair
    first >= 0xD800 && first <= 0xDBFF && // high surrogate
    size > index + 1 // there is a next code unit
  ) {
    second = string.charCodeAt(index + 1);
    if (second >= 0xDC00 && second <= 0xDFFF) { // low surrogate
      // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
      return (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
    }
  }
  return first;
};
