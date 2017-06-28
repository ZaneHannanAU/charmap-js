let RANGE = /^([0-9A-F]{4,6})\.{2}([0-9A-F]{4,6})(?:;\s*([\S\x20]+))?$/
class Block {
  constructor(input) {
    if (typeof input === 'string') {
      let [min, max, block] = RANGE.exec(input)
      this.min = parseInt(min, 16)
      this.MIN = min
      this.max = parseInt(max, 16)
      this.MIN = min
      this.block = block
    } else if (Array.isArray(input)) {
      if (input.length === 2) {
        let [min, max] = RANGE.exec(input[0])
        this.min = parseInt(min, 16)
        this.MIN = min
        this.max = parseInt(max, 16)
        this.MIN = min
        this.block = input[1]
      } else if (input.length === 3) {
        if (typeof input[0] === 'string' && typeof input[1] === 'string') {
          this.min = parseInt(input[0], 16)
          this.MIN = input[0].toLocaleUpperCase()
          this.max = parseInt(input[1], 16)
          this.MAX = input[1].toLocaleUpperCase()
        } else {
          this.min = input[0] | 0
          this.MIN = input[0].toString(16).toLocaleUpperCase()
          this.max = input[1] | 0
          this.MAX = input[1].toString(16).toLocaleUpperCase()
          while (this.MIN.length < 4) this.MIN = '0'+this.MIN
          while (this.MAX.length < 4) this.MAX = '0'+this.MAX
        }
        this.block = input[2]
      }
    } else {
      for (var prop in input) {
        if (input.hasOwnProperty(prop)) {
          this[prop] = input[prop]
        }
      }
    }
  }
  toJSON() {
    return this.toString()
  }
  toString() {
    return `${this.MIN}..${this.MAX}; ${this.block}`
  }
  inRange(value) {
    let val = value.valueOf()
    return (val <= this.max) && (val >= this.min)
  }

  fullRange(i = this.min) {
    let a = []
    while (i++ < this.max) a.push(i)
    return a;
  }

  inspect(depth, opts) {
    return depth < 0 ? opts.stylize('[Block]', 'special') : (
      `${
        opts.stylize('Block', 'special')
      } U+${this.MIN} -> U+${this.MAX}: ${
        opts.stylize(this.block, 'string')
      }`.replace(/U\+[0-9A-F]{4,6}/g, m=>opts.stylize(m,'number'))
    )
  }
}
module.exports = Block;
module.exports.RANGE = RANGE;
