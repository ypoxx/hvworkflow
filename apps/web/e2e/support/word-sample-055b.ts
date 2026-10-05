/**
 * Scheibe 055b: synthetic clipboard samples for the answer field (no real document, no real names, no company data;
 * AGENTS.md R11). They imitate the HTML that Word, Google Docs, a browser copy of a web page and LibreOffice put on the
 * clipboard, closely enough for the walker (`domToBody.ts`) to meet their quirks: Word's conditional comments, `<o:p>`,
 * `mso-list:Ignore` bullets, `mso-hide`, a style block in the head; Google Docs' `<b style="font-weight:normal">`
 * wrapper with `font-weight:700/400` spans; links, headings and table cells; LibreOffice's `<ol><li><p>`.
 *
 * Invisible characters only as escapes (Trojan Source lesson, decision 10).
 */

/** Set by the `<img onerror>` and the `<script>` of the Word sample if anything of it ever ran. */
export const MARKER_055B = '__marker055b';

/** Word (HTML format of the clipboard), with what the walker must drop and what an attacker would try. */
export const WORD_SAMPLE_055B = [
  '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">',
  '<head><meta http-equiv=Content-Type content="text/html; charset=utf-8"><meta name=ProgId content=Word.Document>',
  '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Normal</w:View></w:WordDocument></xml><![endif]-->',
  '<style><!-- p.MsoNormal {margin:0cm;font-size:11.0pt;} .geheim {display:block} --></style></head>',
  '<body lang=DE style="tab-interval:35.4pt">',
  '<!--StartFragment-->',
  '<p class=MsoNormal><b>Fettes Wort</b> und <i>kursiver Teil</i> und <span style="background:yellow;mso-highlight:yellow">markierter Teil</span> und <u>unterstrichen</u>.<o:p></o:p></p>',
  '<p class=MsoListParagraphCxSpFirst style="text-indent:-18.0pt;mso-list:l0 level1 lfo1"><![if !supportLists]><span style="font-family:Symbol;mso-list:Ignore">\u00B7<span style="font:7.0pt \'Times New Roman\'">&nbsp;&nbsp;&nbsp;</span></span><![endif]>Erster Punkt<o:p></o:p></p>',
  '<p class=MsoListParagraphCxSpLast style="text-indent:-18.0pt;mso-list:l0 level1 lfo1"><![if !supportLists]><span style="font-family:Symbol;mso-list:Ignore">\u00B7<span style="font:7.0pt \'Times New Roman\'">&nbsp;&nbsp;&nbsp;</span></span><![endif]>Zweiter Punkt<o:p></o:p></p>',
  '<p class=MsoNormal><span style="display:none;mso-hide:all">VERBORGEN-055B </span>Sichtbarer Schluss.<o:p></o:p></p>',
  `<img src=x onerror="window.${MARKER_055B}='img'">`,
  `<script>window.${MARKER_055B}='script'</script>`,
  '<!--EndFragment-->',
  '</body></html>',
].join('\r\n');

/** The plain text Word puts next to it. */
export const WORD_PLAIN_055B = 'Fettes Wort und kursiver Teil und markierter Teil und unterstrichen.\r\n\u00B7 Erster Punkt\r\n\u00B7 Zweiter Punkt\r\nSichtbarer Schluss.';

/** Three lines of plain text only: three paragraphs. */
export const PLAIN_THREE_LINES_055B = 'Erste Zeile\r\nZweite Zeile\nDritte Zeile';

/** Google Docs: everything inside `<b style="font-weight:normal">`, weights on the spans. */
export const GOOGLE_DOCS_SAMPLE_055B =
  '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-0a1b2c3d-7fff-1234-5678-90abcdef0055">' +
  '<p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;">' +
  '<span style="font-size:11pt;font-family:Arial,sans-serif;color:#000000;background-color:transparent;font-weight:700;font-style:normal;">Fett</span>' +
  '<span style="font-size:11pt;font-family:Arial,sans-serif;color:#000000;background-color:transparent;font-weight:400;font-style:normal;"> und normal und </span>' +
  '<span style="font-size:11pt;font-family:Arial,sans-serif;color:#000000;background-color:#ffff00;font-weight:400;font-style:normal;">gelb</span></p>' +
  '<ul style="margin-top:0;margin-bottom:0;padding-inline-start:48px;"><li dir="ltr" style="list-style-type:disc;font-size:11pt;" aria-level="1">' +
  '<p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;" role="presentation">' +
  '<span style="font-size:11pt;font-weight:400;font-style:italic;">kursiver Punkt</span></p></li></ul></b>';

/** A browser copy of a web page: a heading, a link, a table cell with a background. */
export const BROWSER_SAMPLE_055B =
  '<meta charset="utf-8"><h2 style="color:rgb(0,0,0)">Überschrift</h2>' +
  '<p>Text mit <a href="https://example.invalid/055b">Verweis</a> und <strong>stark</strong>.</p>' +
  '<table><tbody><tr><td style="background:#eeeeee">Zelle</td></tr></tbody></table>';

/** LibreOffice Writer: a style block in the head, an ordered list of paragraphs. */
export const LIBREOFFICE_SAMPLE_055B =
  '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.0 Transitional//EN"><html><head>' +
  '<meta http-equiv="content-type" content="text/html; charset=utf-8"/><title></title>' +
  '<meta name="generator" content="LibreOffice 7.6"/><style type="text/css">p { line-height: 115%; background: transparent }</style></head>' +
  '<body lang="de-DE" link="#000080" vlink="#800000" dir="ltr">' +
  '<p style="line-height: 100%; margin-bottom: 0cm"><b>Fett</b> <span style="background: #ffff00">gelb</span> <i>kursiv</i></p>' +
  '<ol><li><p style="margin-bottom: 0cm">Eins</p></li><li><p style="margin-bottom: 0cm">Zwei</p></li></ol></body></html>';

/**
 * A2b (Codex P1 on #156): the host every URL of the sentinel sample points to. `.invalid` never resolves; the test
 * routes and counts every request to it. A random path, so no other request can be mistaken for it.
 */
export const SENTINEL_HOST_055B = 'sentinel-055b.invalid';
export const SENTINEL_URL_055B = `http://${SENTINEL_HOST_055B}/p-9c41e7d2b8`;

const u = (name: string): string => `${SENTINEL_URL_055B}/${name}`;

/** Every way HTML can ask a browser to fetch something, all aimed at the sentinel host, with bold text in between. */
export const SENTINEL_SAMPLE_055B = [
  `<html><head><base href="${u('base/')}"><meta http-equiv="refresh" content="0;url=${u('refresh')}">`,
  `<link rel="stylesheet" href="${u('style.css')}"><link rel="preload" as="image" href="${u('preload.png')}">`,
  `<link rel="prefetch" href="${u('prefetch.js')}"><link rel="modulepreload" href="${u('module.js')}"><link rel="icon" href="${u('favicon.ico')}">`,
  `<script src="${u('script.js')}"></script>`,
  `<style>@import url("${u('import.css')}"); p { background-image: url("${u('css-bg.png')}"); }`,
  `@font-face { font-family: Waechter055b; src: url("${u('font.woff2')}"); } b { font-family: Waechter055b; }</style></head>`,
  `<body background="${u('body-bg.png')}">`,
  '<p><b>Waechter fett 055b</b></p>',
  `<img src="${u('img.png')}"><img srcset="${u('srcset.png')} 1x, ${u('srcset2.png')} 2x">`,
  `<img loading="lazy" src="${u('lazy.png')}">`,
  `<picture><source srcset="${u('picture.webp')}"><img src="${u('picture.png')}"></picture>`,
  `<iframe src="${u('frame.html')}"></iframe>`,
  `<video poster="${u('poster.png')}"><source src="${u('video.mp4')}"></video><audio src="${u('audio.mp3')}"></audio>`,
  `<object data="${u('object.bin')}"></object><embed src="${u('embed.bin')}">`,
  `<svg><image href="${u('svg-image.png')}"></image><image xlink:href="${u('svg-xlink.png')}"></image></svg>`,
  `<p style="background-image:url('${u('inline-bg.png')}')">Hintergrund 055b</p>`,
  `<table background="${u('table-bg.png')}"><tr><td background="${u('td-bg.png')}">Zelle 055b</td></tr></table>`,
  `<input type="image" src="${u('input.png')}">`,
  '<p>Schluss <b>auch fett</b></p>',
  '</body></html>',
].join('\n');
