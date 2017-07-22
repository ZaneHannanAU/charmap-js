const readline = require('readline');
const fs = require('fs');
const url = require('url');
let Url = (URL, base) => url.URL ? new url.URL(URL, base) : url.parse(base ? url.resolve(base, URL) : URL)
const Char = require('./char');
const Block = require('./block');

let fromCodePoint = String.fromCodePoint || require('./node-codepoint-polyfill').fromCodePoint
let codePointAt = require('./node-codepoint-polyfill').codePointAt
let numTest = /^U\+0*|^0[Xx]|^[0-9A-F]{4,6}$/

/** @func DSV
  * @arg {stream} input - a input stream.
  * @arg {string|regex} sep - a way to separate the data.
  * @arg {number|integer} sepMax - maximum to separate.
  * @arg {regex} comment - a tester for comments.
  * @callback {function} cb - a callback function
  * @arg {boolean} ordered - whether or not
  */
let DSV = ({
  input, sep = ';', sepMax, comment = /^#|^\/\/|^\s*$/, cb,
  ordered = false, close = () => null
}) => {
  let rl = readline.createInterface({input})
  rl.on('line', ln => {
    if (ordered) rl.pause();
    if (comment.test(ln)) return ordered ? rl.resume() : null;

    cb(null, ln.split(sep, sepMax), rl)
  })
  rl.on('close', close)
  return rl
}

let resultExclude = [...' abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ']

let UNIDATA = (name, env) => [
  `/usr/share/unicode/${name}.txt`, // debian
  `/usr/share/unicode-data/${name}.txt`, // gentoo
  `/usr/share/unicode/ucd/${name}.txt`, // redhat, unicode-ucd package
  env || `${name}.txt`, // manually downloaded
  `http://unicode.org/Public/UNIDATA/${name}.txt` // from network
]

let datatest = (p) => new Promise((resolve, reject) => {
  let URL = url.parse(p)
  if (URL.hostname) {
    if (URL.protocol === 'http:') {
      return require('http').get(URL, res => resolve(res));
    }
    if (URL.protocol === 'https:') {
      return require('https').get(URL, res => resolve(res))
    }
  } else {
    fs.stat(p, (err, stats) => {
      if (!err && stats) return resolve(fs.createReadStream(p,'utf8'))
    })
  }
});
let U = u => u ? u.replace(/([0-9A-F]{4,6})/g, 'U+$1') : ''
let MD_ORDER = [
  [['value', 'Value'], '-:',v=>'U+'+v],
  [['aliases', 'Aliases'], ':-', a=>a.reduce(
    (s, {alias: a, type: t}, i) => `${s}${
      i && t !== 'name' ? '; '+t.replace(/_/g,' ')+': ' : ''
    }${a.toLowerCase()}`,
    ''
  )],
  [['GC', 'Category'], ':-', ([s, l]) => l ? `${s} (${l})` : s],
  [
    ['BLOCK', 'Block'], ':-',
    ({MIN, MAX, block}) => U(MIN+' \u2192 '+MAX+': '+block)
  ],
  [['mapping', 'Mapping'], ':-', map=>U(map)],
  [['BIDI'], ':-', ([s, l]) => l ? `${s} (${l})` : s],
  [['mirrored', 'Mirrored'], '-', y=> y === 'Y' ? 'Y' : ''],
  [['numeric_value', 'Numeric'], '-:', n=>n||''],
  [['uppercase_mapping','Upper'],'-', u=>U(u)],
  [['lowercase_mapping', 'Lower'], '-', l=>U(l)],
  [['titlecase_mapping', 'Title'], '-', t=>U(t)]
]

class CharList extends Array {
  constructor(chars) {
    super(...chars)
  }
  /** @method toMD
    * @arg {arr[arr[[prop, title], align, handler]]} order the output table
    * @arg {string} sep - the table separator
    */
  toMD(order = MD_ORDER, sep = '|') {
    return this.reduce((acc, char, iter) => {
      if (iter === 0) {
        acc += order.reduce((t, [[p, title = p]]) => t+sep+title, '\n\n')
        acc += order.reduce((a, [, align = '-']) => a+sep+align,sep+'\n')+sep+'\n'
      };
      for (let [[prop],, cb] of order) {
        acc += (sep+cb(char[prop]))
      }
      return acc+sep+'\n'
    }, '').replace(/\|{2,}$/gm, sep)
  }
}

class CharMap {
  /** @class CharMap
    * @arg {function} save - save a cached copy of data.
    * @arg {string|array} data - Where to pull the data from as csv-semicolon
    * @arg {string|array} blocks - Where to pull definition data from
    * @arg {string|array} aliases - naming aliases
    * @arg {string|array} property_aliases - property aliases.
    * @arg {object[compare as function]} search - Returns 0 or false if a match is found.
    */
  constructor({
    save,
    data = UNIDATA('UnicodeData', process.env.NODE_CHARMAP_DATA),
    blocks = UNIDATA('Blocks', process.env.NODE_CHARMAP_BLOCKS),
    aliases = UNIDATA('NameAliases', process.env.NODE_CHARMAP_ALIASES),
    property_aliases = UNIDATA('PropertyValueAliases', process.env.NODE_PROPVAL_ALIASES),
    search = new Intl.Collator('en-u-co-dict-kn-true-kf-false', {
      usage: 'search',
      sensitivity: 'base',
      ignorePunctuation: true
    })
  } = {}) {
    let sort = (k,v) => k.num - v.num
    this.save = save
    let chars = this.chars = []
    let Blocks = this.blocks = []
    let PENDING = 0
    let PROPERTY_ALIASES = this.PROPERTY_ALIASES = {}
    let BLOCKS = () => {
      if (PENDING === 0) {
        chars.forEach(char => {
          char.setBlock(Blocks)
          char.setCats(PROPERTY_ALIASES)
        })

        console.info('CharMap is ready for use.')
      }
    }

    if (Array.isArray(data)) {
      data = Promise.race(data.map(datatest))
    } else {
      data = datatest(data)
    }
    PENDING++
    if (Array.isArray(aliases)) {
      aliases = Promise.race(aliases.map(datatest))
    } else {
      aliases = datatest(aliases)
    }
    PENDING++

    if (Array.isArray(property_aliases)) {
      property_aliases = Promise.race(property_aliases.map(datatest))
    } else {
      property_aliases = datatest(property_aliases)
    }
    PENDING++

    data.then(input => {
      DSV({
        input, cb(err, ln, slf) {
          if (err) throw err;
          else if (ln) chars.push(new Char(ln));
          slf.resume()
        }, close() {
          chars.sort(sort)
          aliases.then(input => {
            DSV({
              input, cb(err, ln, slf) {
                if (err) throw err;
                else if (ln) {
                  chars.find(c=>c.value === ln[0]).alias = {
                    alias: ln[1],
                    type: ln[2]
                  }
                }
                slf.resume()
              }, close() {
                if (!--PENDING) BLOCKS()
              }
            })
          }).catch(console.error)
          property_aliases.then(input => {
            DSV({
              input, sep: /\s*;\s*/g, cb(err, ln, slf) {
                if (err) throw err;
                else if (ln) {
                  let [prop, name, value] = ln
                  if (!PROPERTY_ALIASES[prop])
                    PROPERTY_ALIASES[prop] = {}
                  ;
                  if (!PROPERTY_ALIASES[prop][name])
                    PROPERTY_ALIASES[prop][name] = value
                      .replace(/_/g, ' ')
                      .replace(/\s*#.*$/, '')
                  ;
                }
                slf.resume()
              }, close() {
                if (!--PENDING) BLOCKS()
              }
            })
          })
        }
      });
    }).catch(console.error)

    if (Array.isArray(blocks)) {
      blocks = Promise.race(blocks.map(datatest))
    } else {
      blocks = datatest(blocks)
    }
    blocks.then(input => {
      DSV({
        input, sep: /\.{2}|;\s*/g, cb(err, ln, slf) {
          if (err) throw err;
          else if (ln) Blocks.push(new Block(ln));
          slf.resume()
        },
        close() {
          if (!--PENDING) BLOCKS()
        }
      })
    }).catch(console.error)


    this.search = search
  }

  get(...numbers) {
    let nums = numbers.length > 1 ? new Set(
      numbers.map(n=>parseInt(n))
    ) : (
      Array.isArray(numbers[0]) ? new Set(
        numbers[0].map(n=>parseInt(n))
      ) : new Set(
        numbers.map(n=>parseInt(n))
      )
    )
    if (nums.has(0)) nums.add(NaN);;

    if (nums.size) {
      if (nums.size > 1)
        return new CharList(this.chars.filter(({num}) => nums.has(num)));
      return this.chars.filter(({num}) => nums.has(num))[0];
    } else {
      throw new SyntaxError('Must provide at least one argument')
    }
  }

  range(begin, end, cb, next) {
    if (typeof begin === typeof end && typeof begin === 'number') {
      // nothing doing
    } else if (typeof begin === 'object' && begin instanceof Block) {
      end = parseInt(begin.MAX, 16)
      begin = parseInt(begin.MIN, 16)
    } else if (/[0-9A-F]{4,6}(\/[0-9A-F]{4,6})?/.test(begin)) {
      let [, start, finish] = /[^0-9A-F]*([0-9A-F]{4,6})(?:[\/\.-]([0-9A-F]{4,6}))?[^0-9A-F]*/.exec(begin)
      begin = parseInt(start, 16)
      if (!end && !finish) end = parseInt(begin, 16) + 0x100
      else if (!end) end = parseInt(finish, 16)
      else end = parseInt(end, 16);

      begin = parseInt(begin, 16)
    } else if (typeof begin === 'string') {
      ({min: begin, max: end} = this.blocks.find(
        b => b.name.toLocaleUpperCase().indexOf(begin.toLocaleUpperCase()) > 0
      ))
    }
    let i = parseInt(begin)
    let c = parseInt(end)
    if (cb) {
      cb(this.get(i))
      while (i++ < c) cb(this.get(i))
      return next ? next() : null;
    } else {
      let a = []
      a.push(i)
      while (i++ < c) a.push(i);
      return this.get(...a)
    }
  }

  /** @method code
    * @arg {string} txt - a character, codepoint or name to match against.
    * @arg {function} compare - a comparison function for find().
    * @callback cb - lets you get a callback ASAP for streaming.
    */
  code(txt, compare, cb = (char) => console.log(require('util').inspect(char, {colors:true}))) {
    let chars = new Set()
    if (numTest.test(txt)) {
      let byNum = this.get(parseInt(txt.replace(/^U\+0*|^0[Xx]/, ''), 16) | 0)
      if (byNum) cb(byNum) & chars.add(byNum.num)
      // callback with this single check
    };
    let TxT = [...txt].filter(s=>!resultExclude.includes(s))
    this.chars.forEach(
      char => TxT.includes(char.char) ? cb(char) & chars.add(char.num) : null
    )
    this.find(
      txt,
      new RegExp(`\\b${txt}\\b`, 'i'),
      compare,
      char => cb(char) & chars.add(char.num)
    )
    return this.get(...chars);
  }

  /** @method find
    * @arg {string} str - to find
    * @arg {regexp} regexp - can be used to create a function.
    * @arg {function} compare - a comparison function.
    * @callback cb - lets you get a callback ASAP for streaming.
    */
  find(
    str, regex = new RegExp(`\\b${str}\\b`, 'i'),
    compare = (
      alias, str, regexp
      ) => regexp.test(alias) || !this.search.compare(alias, str),
    cb = (
      char
      ) => console.log(require('util').inspect(char, {colors:true}))
  ) {
    return new CharList(this.chars.filter(
      char => char.aliases.some(({alias}) => {
        if (compare(alias, str, regex)) {
          cb(char)
          return true
        } else return false
      })
    ))
  }

  /** @method find_middleware
    * @arg {string} q - which query string to use
    * @callback cb - an optional custom callback function allowing more efficient streaming.
    * @returns {middleware as function}
    */
  find_middleware(q = 'q', cb) {
    let find = (str, callback) => this.code(str, undefined, callback)
    return (req, res, next) => {
      let URL = Url(req.url, `${req.headers.referrer || 'http://'+req.headers.host+'/'}`)
      if (!cb || typeof cb !== 'function') {
        if (!res.locals) res.locals = {};
        res.locals.chars = [];
        cb = (char) => res.locals.chars.push(char)
      }

      if (URL.query && (URL.query[q] || URL.query.q || URL.query.search)) {
        find(URL.query[q] || URL.query.q || URL.query.search, cb)
      } else if (URL.searchParams) {
        find(
          URL.searchParams.get(q) ||
          URL.searchParams.get('q') ||
          URL.searchParams.get('search'),
          cb
        )
      }

      next()
    }
  }
}
module.exports = new CharMap();
module.exports.Char = Char;
module.exports.Block = Block;
