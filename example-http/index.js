const url = require('url');
let Url = (URL, base) => url.URL ? new url.URL(URL, base) : url.parse(base ? url.resolve(base, URL) : URL)
const path = require('path');
const fs = require('fs');
const CharMap = require('..')
const http = require('http');
let displayed = (char) => /* @html */`<div class="char">
<dt class="displayed" aria-hidden="true">&#${char.num};</dt>
<dd class="name">${(char.unicode_name || char.name).toLowerCase()}</dd>
<dd class="value"><a href="/${char.value}">U+${char.value}</a></dd>
</div>
`

let BLOCK = CharMap.Char.BLOCK
let mod = ({num}, amt = 0) => {
  var s = Number(num + amt).toString(16).toUpperCase();
  while (s.length < 4) s = '0'+s;
  return s;
}

let header = /* @html */`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
`;

let idx = path.join(__dirname, 'index.html')
let RANGE = /[^0-9A-F]*([0-9A-F]{4,6})[\/\.-]([0-9A-F]{4,6})[^0-9A-F]*/

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, {
      'Content-Type': 'text/html'
    })

    return fs.createReadStream(idx, 'utf8').pipe(res)
  };
  if (/^\/res\//i.test(req.url)) {
    return fs.createReadStream(path.join(__dirname, req.url)).pipe(res)
  };
  if (/^\/?[0-9A-F]{4,6}$/.test(req.url)) {
    res.writeHead(200, {
      'Content-Type': 'text/html'
    })
    res.write(header)
    let char = CharMap.get(parseInt(
      req.url.slice(1), 16
    ))
    let block = char[BLOCK]
    res.write(/* @html */`<title>${(char.unicode_name || char.name).toLowerCase()} | CharMap</title></head><body>`)
    res.write(/* @html */'<article class="char">')
    res.write(/* @html */`<h1>${char.category === 'Cc' ? '&lt;control&gt;' : `&#${char.num};`}</h1>`)
    res.write(/* @html */`<h2 class="name">${(char.unicode_name || char.name).toLowerCase()} <span class="value">(U+${char.value})</span></h2>`)
    res.write(/* @html */`<nav class="centre">${
      char.num ? /* @html */ `<a href="/${mod(char, -1)}" data-char="&#x${mod(char, -1)};" rel="prev">Prev</a> | ` : ''
    }<a href="/${mod(char, 1)}" data-char="&#x${mod(char, 1)};" rel="next">Next</a></nav>`)
    res.write(/* @html */`<aside class="block">\nIn block ${block.block} <a href="/range/${block.MIN}/${block.MAX}/">U+${block.MIN} \u2192 U+${block.MAX}</a>\n</aside>`)

    return res.end('</article></body></html>')
  }
  let URL = Url(req.url, "http://" + req.headers.host);
  if (URL.pathname === '/search') {
    res.writeHead(200, {
      'Content-Type': 'text/html'
    })
    let find = CharMap.find_middleware('q', (char) => res.write(displayed(char)))
    res.write(header)
    res.write(`<title>${URL.query ? URL.query.q : URL.searchParams.get('q')}</title></head><body><dl>`)
    find(req, res, err => {
      if (err) return res.end(err.toString())
      return res.end('</dl></body></html>')
    })
  }
  if (RANGE.test(URL.pathname)) {
    res.writeHead(200, {
      'Content-Type': 'text/html'
    })
    res.write(header)
    let [, begin, end] = RANGE.exec(URL.pathname)
    res.write(`<title>${begin}..${end}</title></head><body>`)
    res.write(`<h1>Characters U+${begin}...U+${end}</h1><dl>`)
    CharMap.range(
      parseInt(begin, 16),
      parseInt(end, 16),
      char=>res.write(displayed(char)),
      ()=>res.end('</dl></body></html>')
    )
  }
})

server.on('clientError', (err, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(8000, () => console.log(server.address()));
