const util = require('util');
let fromCodePoint = String.fromCodePoint || require('./node-codepoint-polyfill').fromCodePoint
let codePointAt = require('./node-codepoint-polyfill').codePointAt
let [CHAR, BIDI, GC, BLOCK] = [
  'char',
  'bidirectional category',
  'general category',
  'block'
].map(s => Symbol.for(s))

let keys = [
  'value',
  'name',
  'category',
  'class',
  'bidirectional_category',
  'mapping',
  'decimal_digit_value',
  'digit_value',
  'numeric_value',
  'mirrored',
  'unicode_name',
  'comment',
  'uppercase_mapping',
  'lowercase_mapping',
  'titlecase_mapping'
]

let short_keys = {
  category({[keys[2]]: cat, [GC]: CAT}, opts) {
    return CAT ? `${
      opts.stylize(cat, 'string')
    } (${
      opts.stylize(CAT, 'string')
    })` : opts.stylize(cat, 'string')
  },
  class({[keys[3]]: cls}) {
    return cls !== '0' ? ` / cls ${cls}` : ''
  },
  bidirectional_category({[keys[4]]: cat, [BIDI]: CAT}) {
    return cat ? ` / bidi ${CAT || cat}` : ''
  },
  mapping({[keys[5]]: map}) {
    return map ? ` / mapping ${
      map.replace(/\b[0-9A-Z]{4,6}\b/g, m=>'U+'+m)
    }` : ''
  },
  decimal_digit_value({[keys[6]]: val}) {
    return val ? ` / dec ${val}` : ''
  },
  digit_value({[keys[7]]: val}) {return val ? ` / dig ${val}` : ''},
  numeric_value({[keys[8]]: val}) {return val ? ` / numeric ${val}` : ''},
  mirrored({[keys[9]]: y}) {return y !== 'N' ? ` / mirrored` : ''},
  comment({[keys[11]]: c}) {return c ? ` / {${c}}` : ''},
  uppercase_mapping({[keys[12]]: Uc}) {
    return Uc ? ` / Uc U+${Uc}` : ''
  },
  lowercase_mapping({[keys[13]]: Lc}) {
    return Lc ? ` / Lc U+${Lc}` : ''
  },
  titlecase_mapping({[keys[14]]: Tc}) {
    return Tc ? ` / Tc U+${Tc}` : ''
  }
}

class Char {
  constructor(input) {
    let data = this
    if (typeof input === 'string') {
      input.split(';').forEach((val, idx) => val ? data[keys[idx]] = val : 0);
    } else if (Array.isArray(input)) {
      keys.forEach((key,idx) => input[idx] ? data[key] = input[idx] : 0)
    } else {
      for (var key of keys) {
        if (input.hasOwnProperty(key)) {
          data[key] = input[key]
        };
      };
    };

    this.num = parseInt(data.value, 16);
    this.aliases = [
      { alias: data.name,
        type: keys[1] },
      { alias: data.unicode_name,
        type: keys[10] },
      { alias: data.decimal_digit_value,
        type: keys[6] },
      { alias: data.decimal_digit_value,
        type: keys[7] },
      { alias: data.decimal_digit_value,
        type: keys[8] },
      { alias: data.comment,
        type: keys[11] }
    ].filter(n => n.alias);
  }

  allAliases(joiner = '\n') {
    return this.aliases.map(({alias}) => alias).join(joiner)
  }

  get ln() {
    let data = this || {}
    return keys.map(key => data[key] || '').join(';');
  }

  get char() {
    return this[CHAR] ? this[CHAR] : this[CHAR] = fromCodePoint(this.num)
  }

  set alias(al) {
    if (this.aliases.find(({alias}) => al.alias === alias)) return;
    else return this.aliases.push(al);
  }

  static fromJSON(json) {
    if (typeof json === 'string') {
      json = JSON.parse(json)
    }
    new Char(json)
  }

  toJSON() {
    return this.toString()
  }

  toString() {
    return this.ln
  }

  valueOf() {return this.num}
  setBlock(list) {
    return this[BLOCK] = list[list.findIndex(block => block.inRange(this))]
  }

  setBIDI(obj, keys = Object.keys(obj)) {
    return this[BIDI] = obj[
      keys.find(k=>k===this.bidirectional_category)
    ]
  }
  setGC(obj, keys = Object.keys(obj)) {
    return this[GC] = obj[
      keys.find(k=>k===this.category)
    ]
  }

  setCats(obj) {
    if (obj.gc) this.setGC(obj.gc)
    if (obj.bc) this.setBIDI(obj.bc)
  }


  inspect(depth, opts) {
    let num = 'number', str = 'string', spec = 'special'
    let newOpts = Object.assign({}, opts, {
      depth: opts.depth === null ? null : opts.depth - 1
    })
    return depth < 0 ? opts.stylize(
      `[Char]`, 'special'
    ) : (
      `${
        opts.stylize(`Char`, spec)
      } U+${this.value} ${
        keys
        .map(key => short_keys[key] ? short_keys[key](this, opts) : '')
        .join('')
      }\n  ${
        this.aliases
        .map(({alias, type}) => `${
          opts.stylize(type, 'regexp')
        }: ${
          opts.stylize(alias, str)
        }`)
        .join('\n  ')
      }${
        this[BLOCK] ? '\n  ' + util.inspect(this[BLOCK], newOpts) : ''
      }`.replace(/U\+[0-9A-F]{4,6}/g, m=>opts.stylize(m, num))
    )
  }
}
module.exports = Char;
module.exports.keys = keys;
module.exports.BLOCK = BLOCK;
module.exports.CHAR = CHAR;
module.exports.BIDI = BIDI;
module.exports.GC = GC;
module.exports.BLOCK = BLOCK;
module.exports.short_keys = short_keys;
