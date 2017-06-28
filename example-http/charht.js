let header = /* @html */`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
`;

let displayed = (char) => /* @html */`<div class="char">
<dt class="displayed" aria-hidden="true">&#${char.num};</dt>
<dd class="name">${(char.unicode_name || char.name).toLowerCase()}</dd>
<dd class="value"><a href="/${char.value}">U+${char.value}</a></dd>
</div>
`;

let page = (char) => /* @html */`<article class="char">
<h1>${char.category === 'Cc' ? '&lt;control&gt;' : `&#${char.num};`}</h1>
<h2 class="name">${
  (char.unicode_name || char.name).toLowerCase()
} <span class="value">(U+${char.value})</span></h2>
<nav class="centre">
${
  char.num ? /* @html */ `<a href="/${mod(char, -1)}" data-char="&#x${mod(char, -1)};" rel="prev">Prev</a> | ` : ''
}<a href="/${mod(char, 1)}" data-char="&#x${mod(char, 1)};" rel="next">Next</a>
</nav>
<aside class="block">
In block <a href="/range/${
  char[BLOCK].MIN}/${char[BLOCK].MAX
  }/">U+${char[BLOCK].MIN} \u2192 U+${char[BLOCK].MAX}</a>
</aside>
</article>`;

let range = (min, max) => /* @html */`<dl class="list">

</dl>`
