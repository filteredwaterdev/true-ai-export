/**
 * true-ai-export — Word (.docx) formatters.
 *
 * GENERATED FILE — do not edit. Edit tools/docx/template.js and run
 * node tools/docx/build.mjs. That also regenerates the two console
 * scripts, claude/v1.2.0/export-docx.js and export-docx-clean.js.
 *
 * buildDocx and buildDocxClean are the console scripts' document
 * builder. The two console scripts differ only in the CLEAN flag, so
 * here the shared body is built once by createBuilder(clean). A fresh
 * builder is created for every export, because the document builder
 * keeps per-document state (hyperlink relationships, numbered-list
 * instances, table counts) that must not carry over from one export
 * to the next.
 *
 * The output is a Word file assembled in the page with no libraries:
 * the OOXML parts are written as strings and packed into a stored
 * (uncompressed) ZIP by the small writer below. Tables are written as
 * ordinary text — aligned columns, or one block per row for heavy
 * tables — because Pages turns Word tables into objects that cannot
 * be selected together with the surrounding text.
 *
 * build*() returns { blob, humanCount, claudeCount, skippedCount,
 * warningCount, omittedCount }. The blob is handed to downloadFile,
 * which accepts a Blob as content.
 */
(function () {
  'use strict';

  const ns = globalThis.TrueAiExport;
  const { formatTimestamp, sanitizeTitle } = ns.walk;

  const DOCX_MIME =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  function createBuilder(CLEAN) {
    const FORMAT_LABEL = CLEAN ? 'Word clean v1.2.0' : 'Word v1.2.0';

    // ─── Markdown parsing ────────────────────────────────────────────────────
    // Claude writes its replies in Markdown. This turns that Markdown into
    // blocks (headings, paragraphs, lists, code, quotes, rules, tables) and
    // inline runs (bold, italic, code, links) for the Word document.

    const FENCE_RE = /^\s*(```+|~~~+)\s*([\w+#.-]*)/;
    const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
    const HR_RE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
    const ITEM_RE = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;
    const TABLE_SEP_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
    // Bounded lengths keep this linear on very long paragraphs.
    const LINK_RE =
      /\[((?:[^\[\]]|\[[^\]]{0,200}\]){0,1000})\]\(\s*<?([^)\s>]{1,2000})>?(?:\s+"[^"]{0,200}")?\s*\)/y;
    const ESCAPABLE = '\\`*_{}[]()#+-.!|>~';

    function splitRow(line) {
      let s = line.trim();
      if (s.startsWith('|')) s = s.slice(1);
      if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
      const cells = [];
      let cur = '';
      for (let i = 0; i < s.length; i++) {
        if (s[i] === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
        if (s[i] === '|') { cells.push(cur.trim()); cur = ''; continue; }
        cur += s[i];
      }
      cells.push(cur.trim());
      return cells;
    }

    function parseBlocks(text) {
      const lines = text.split('\n');
      const n = lines.length;
      const blocks = [];
      const para = [];
      const stack = [];
      let i = 0;

      const flush = () => {
        if (para.length) {
          blocks.push({ k: 'p', text: para.join('\n') });
          para.length = 0;
        }
      };

      while (i < n) {
        const line = lines[i];
        let m = FENCE_RE.exec(line);
        if (m) {
          flush();
          stack.length = 0;
          const fence = m[1];
          const body = [];
          i++;
          while (i < n) {
            const t = lines[i].trim();
            if (t && [...t].every(ch => ch === fence[0]) &&
                t.length >= fence.length) break;
            body.push(lines[i]);
            i++;
          }
          i++;
          blocks.push({ k: 'code', text: body.join('\n') });
          continue;
        }
        if (!line.trim()) { flush(); i++; continue; }
        m = HEADING_RE.exec(line);
        if (m) {
          flush();
          stack.length = 0;
          blocks.push({ k: 'h', level: m[1].length, text: m[2] });
          i++;
          continue;
        }
        if (HR_RE.test(line)) {
          flush();
          stack.length = 0;
          blocks.push({ k: 'hr' });
          i++;
          continue;
        }
        if (line.trimStart().startsWith('>')) {
          flush();
          stack.length = 0;
          const q = [];
          while (i < n && lines[i].trimStart().startsWith('>')) {
            q.push(lines[i].replace(/^\s*>\s?/, ''));
            i++;
          }
          blocks.push({ k: 'quote', blocks: parseBlocks(q.join('\n')) });
          continue;
        }
        if (line.includes('|') && i + 1 < n && lines[i + 1].includes('|') &&
            TABLE_SEP_RE.test(lines[i + 1])) {
          flush();
          stack.length = 0;
          const head = splitRow(line);
          i += 2;
          const rows = [];
          while (i < n && lines[i].trim() && lines[i].includes('|')) {
            rows.push(splitRow(lines[i]));
            i++;
          }
          blocks.push({ k: 'table', head, rows });
          continue;
        }
        m = ITEM_RE.exec(line);
        if (m) {
          flush();
          const indent = m[1].replace(/\t/g, '    ').length;
          const marker = m[2];
          let body = m[3];
          while (stack.length && indent < stack[stack.length - 1]) stack.pop();
          if (!stack.length || indent > stack[stack.length - 1]) stack.push(indent);
          const level = stack.length - 1;
          const ordered = /^\d/.test(marker);
          i++;
          while (i < n && lines[i].trim() && !ITEM_RE.test(lines[i]) &&
                 !FENCE_RE.test(lines[i]) && !HEADING_RE.test(lines[i]) &&
                 /^[ \t]/.test(lines[i])) {
            body += '\n' + lines[i].trim();
            i++;
          }
          blocks.push({ k: 'li', level, marker, ordered, text: body });
          continue;
        }
        if (stack.length && !/^[ \t]/.test(line)) stack.length = 0;
        para.push(line);
        i++;
      }
      flush();
      return blocks;
    }

    const isSpace = ch => /\s/.test(ch);
    const isAlnum = ch => /[\p{L}\p{N}]/u.test(ch);

    function findClose(s, start, c, cnt) {
      const delim = c.repeat(cnt);
      let k = start;
      for (;;) {
        k = s.indexOf(delim, k);
        if (k === -1) return -1;
        let j = k;
        while (j < s.length && s[j] === c) j++;
        if (j - k === cnt && k > start && !isSpace(s[k - 1])) {
          if (c !== '_' || j >= s.length || !isAlnum(s[j])) return k;
        }
        k = j;
      }
    }

    function parseInline(s, bold = false, italic = false, href = null) {
      const runs = [];
      let buf = '';
      let i = 0;
      const n = s.length;
      const emit = () => {
        if (buf) {
          runs.push({ t: buf, b: bold, i: italic, code: false, href });
          buf = '';
        }
      };
      while (i < n) {
        const c = s[i];
        if (c === '\\' && i + 1 < n && ESCAPABLE.includes(s[i + 1])) {
          buf += s[i + 1];
          i += 2;
          continue;
        }
        if (c === '`') {
          let j = i;
          while (j < n && s[j] === '`') j++;
          const ticks = s.slice(i, j);
          const k = s.indexOf(ticks, j);
          if (k !== -1 && k > j) {
            emit();
            let code = s.slice(j, k);
            if (code.length > 1 && code[0] === ' ' &&
                code[code.length - 1] === ' ' && code.trim()) {
              code = code.slice(1, -1);
            }
            runs.push({ t: code, b: bold, i: italic, code: true, href });
            i = k + ticks.length;
            continue;
          }
          buf += ticks;
          i = j;
          continue;
        }
        if (c === '[') {
          LINK_RE.lastIndex = i;
          const m = LINK_RE.exec(s);
          if (m) {
            emit();
            runs.push(...parseInline(m[1], bold, italic, m[2]));
            i = LINK_RE.lastIndex;
            continue;
          }
        }
        if (c === '*' || c === '_') {
          let done = false;
          if (!(c === '_' && i > 0 && isAlnum(s[i - 1]))) {
            for (const cnt of [3, 2, 1]) {
              if (s.startsWith(c.repeat(cnt), i) && i + cnt < n &&
                  !isSpace(s[i + cnt])) {
                const k = findClose(s, i + cnt, c, cnt);
                if (k !== -1) {
                  emit();
                  runs.push(...parseInline(
                    s.slice(i + cnt, k),
                    bold || cnt >= 2,
                    italic || cnt === 1 || cnt === 3,
                    href
                  ));
                  i = k + cnt;
                  done = true;
                  break;
                }
              }
            }
          }
          if (done) continue;
        }
        buf += c;
        i++;
      }
      emit();
      return runs;
    }

    const plainOf = cell => parseInline(cell).map(r => r.t).join('');

    // ─── Word (OOXML) building blocks ────────────────────────────────────────

    const W_NS =
      'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

    // Remove characters that are not allowed in XML 1.0 (control characters,
    // U+FFFE/U+FFFF and unpaired surrogates) — one of these would make the
    // whole document unreadable in Pages and Word.
    const XML_INVALID =
      /[\x00-\x08\x0b\x0c\x0e-\x1f\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
    const xt = s => String(s)
      .replace(XML_INVALID, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const xa = s => xt(s).replace(/"/g, '&quot;');
    const safeHref = u => (/^(https?:\/\/|mailto:)/i.test(u || '') ? u : null);

    // Per-document state: hyperlink relationships and numbered-list instances.
    const ctx = { rels: [], nextNum: 3, extraNums: [] };

    function linkId(url) {
      const id = `rId${ctx.rels.length + 10}`;
      ctx.rels.push([id, url]);
      return id;
    }

    function runsXml(runs, boldAll = false) {
      let out = '';
      for (const r of runs) {
        if (!r.t) continue;
        const url = safeHref(r.href);
        let rpr = url ? '<w:rStyle w:val="Hyperlink"/>' : '';
        if (r.code) {
          rpr += '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" ' +
                 'w:cs="Courier New"/>';
        }
        if (r.b || boldAll) rpr += '<w:b/>';
        if (r.i) rpr += '<w:i/>';
        if (r.code) rpr += '<w:sz w:val="19"/>';
        const inner = r.t.split('\n')
          .map(p => `<w:t xml:space="preserve">${xt(p.replace(/\t/g, '    '))}</w:t>`)
          .join('<w:br/>');
        let run = `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}${inner}</w:r>`;
        if (url) {
          run = `<w:hyperlink r:id="${linkId(url)}" w:history="1">${run}</w:hyperlink>`;
        }
        out += run;
      }
      return out;
    }

    const textRun = (t, bold = false, italic = false) =>
      runsXml([{ t, b: bold, i: italic, code: false, href: null }]);

    function para(inner, style = null, ppr = '') {
      const body = (style ? `<w:pStyle w:val="${style}"/>` : '') + ppr;
      return `<w:p>${body ? `<w:pPr>${body}</w:pPr>` : ''}${inner}</w:p>`;
    }

    function codePara(text, indent = 0) {
      const inner = text.split('\n')
        .map(l => `<w:t xml:space="preserve">${xt(l.replace(/\t/g, '    '))}</w:t>`)
        .join('<w:br/>');
      return para(`<w:r>${inner}</w:r>`, 'Code',
                  indent ? `<w:ind w:left="${indent}"/>` : '');
    }

    function boxed(title, lines, fill, border) {
      const side = s =>
        `<w:${s} w:val="single" w:sz="4" w:space="4" w:color="${border}"/>`;
      const ppr = `<w:pBdr>${side('top')}${side('left')}${side('bottom')}` +
        `${side('right')}</w:pBdr>` +
        `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`;
      let runs = textRun(title, true);
      for (const ln of lines) runs += '<w:r><w:br/></w:r>' + textRun(ln);
      return para(runs, null, ppr);
    }

    const warnBox = (title, lines) => boxed(title, lines, 'FFFBEB', 'F59E0B');
    const infoBox = (title, lines) => boxed(title, lines, 'EFF6FF', '93C5FD');
    const okBox = title => boxed(title, [], 'F0FDF4', 'BBF7D0');

    // ─── Text tables ─────────────────────────────────────────────────────────
    // Tables are written as ordinary text (see header comment for why).

    const TABLE_MAX_WRAP_LINES = 4;   // a cell needing more lines -> row blocks
    const TABLE_MAX_COLUMNS = 6;      // more columns than this -> row blocks
    const TEXT_CHAR_PT = 6.2;         // conservative average char width, 11 pt
    const TEXT_COL_GAP_PT = 14;       // space between columns
    const TEXT_WIDTH = 9360;          // 6.5 inches in twips (Letter, 1" margins)
    const tableStats = { columns: 0, blocks: 0 };

    function textColWidths(head, rows, total) {
      const n = Math.max(head.length, ...rows.map(r => r.length));
      const mins = [];
      const weights = [];
      for (let k = 0; k < n; k++) {
        const cells = [head, ...rows].map(r => (k < r.length ? plainOf(r[k]) : ''));
        let word = 1;
        for (const c of cells) {
          for (const w of c.split(/\s+/)) word = Math.max(word, w.length);
        }
        mins.push(Math.floor((word * TEXT_CHAR_PT * 1.1 + TEXT_COL_GAP_PT) * 20));
        weights.push(Math.max(8, Math.min(Math.max(...cells.map(c => c.length)), 90)));
      }
      const spare = total - mins.reduce((a, b) => a + b, 0);
      if (spare < 0) return null;
      const sum = weights.reduce((a, b) => a + b, 0);
      return mins.map((m, k) => m + Math.floor(spare * weights[k] / sum));
    }

    const colCapacity = width =>
      Math.max(3, Math.floor((width / 20 - TEXT_COL_GAP_PT) / TEXT_CHAR_PT));

    function wrapRuns(runs, cap) {
      const words = [];
      for (const r of runs) {
        for (const part of r.t.replace(/\n/g, ' ').split(/(\s+)/)) {
          if (!part) continue;
          words.push(/^\s+$/.test(part) ? null : { ...r, t: part });
        }
      }
      const lines = [];
      let line = [];
      let used = 0;
      let space = false;
      for (const w of words) {
        if (w === null) { space = used > 0; continue; }
        const need = w.t.length + (space ? 1 : 0);
        if (used && used + need > cap) {
          lines.push(line);
          line = [];
          used = 0;
          space = false;
        }
        if (space) { line.push({ ...w, t: ' ' }); used += 1; }
        line.push(w);
        used += w.t.length;
        space = false;
      }
      if (line.length || !lines.length) lines.push(line);
      return lines;
    }

    function textTable(headIn, rowsIn, indent = 0, header = true, count = true) {
      const total = TEXT_WIDTH - indent;
      const ncols = Math.max(headIn.length, ...rowsIn.map(r => r.length));
      const pad = r => [...r, ...Array(ncols - r.length).fill('')];
      const head = pad(headIn);
      const rows = rowsIn.map(pad);
      const widths = ncols <= TABLE_MAX_COLUMNS
        ? textColWidths(header ? head : Array(ncols).fill(''), rows, total)
        : null;
      let wrapped = null;
      if (widths) {
        const caps = widths.map(colCapacity);
        wrapped = (header ? [head, ...rows] : rows).map(r =>
          r.map((c, k) => wrapRuns(parseInline(c), caps[k])));
        if (wrapped.some(r => r.some(cell => cell.length > TABLE_MAX_WRAP_LINES))) {
          wrapped = null;
        }
      }
      if (count) tableStats[wrapped ? 'columns' : 'blocks']++;
      const ind = indent ? `<w:ind w:left="${indent}"/>` : '';
      let out = '';

      if (wrapped) {
        // Aligned columns
        const stops = [];
        let edge = indent;
        for (const w of widths.slice(0, -1)) { edge += w; stops.push(edge); }
        const tabs = '<w:tabs>' +
          stops.map(p => `<w:tab w:val="left" w:pos="${p}"/>`).join('') +
          '</w:tabs>';
        wrapped.forEach((cells, i) => {
          const isHead = header && i === 0;
          const last = i === wrapped.length - 1;
          const n = Math.max(...cells.map(c => c.length));
          let runs = '';
          for (let li = 0; li < n; li++) {
            if (li) runs += '<w:r><w:br/></w:r>';
            cells.forEach((cell, k) => {
              if (k) runs += '<w:r><w:tab/></w:r>';
              if (li < cell.length) {
                runs += runsXml(cell[li], isHead || (!header && k === 0));
              }
            });
          }
          // One line under each row. Neighbouring rows alternate between two
          // shades of grey that look identical; apps merge identical borders on
          // consecutive paragraphs, which would hide all but the last line.
          const shade = isHead ? '888888' : (i % 2 ? 'CCCCCC' : 'CBCBCB');
          const line = `<w:pBdr><w:bottom w:val="single" w:sz="${isHead ? 6 : 4}" ` +
            `w:space="3" w:color="${shade}"/></w:pBdr>`;
          const spacing = `<w:spacing w:before="40" w:after="${last ? 160 : 40}"/>`;
          out += para(runs, null,
            (isHead ? '<w:keepNext/>' : '') + line + tabs + spacing + ind);
        });
        return out;
      }

      // Row blocks
      const labels = header
        ? head.map((h, k) => plainOf(h) || `Column ${k + 1}`)
        : Array(ncols).fill('');
      rows.forEach((r, j) => {
        const name = plainOf(r[0]) ? r[0] : `Row ${j + 1}`;
        out += para(runsXml(parseInline(name), true), null,
          `<w:keepNext/><w:spacing w:before="${j === 0 ? 160 : 120}" w:after="20"/>` + ind);
        for (let k = 1; k < ncols; k++) {
          if (!plainOf(r[k])) continue;
          const label = labels[k] ? textRun(labels[k] + ': ', true) : '';
          const last = j === rows.length - 1 && k === ncols - 1;
          out += para(label + runsXml(parseInline(r[k])), null,
            `<w:spacing w:after="${last ? 160 : 20}"/>` +
            `<w:ind w:left="${indent + 360}"/>`);
        }
      });
      return out;
    }

    // ─── Markdown blocks → Word ──────────────────────────────────────────────

    function newOrderedList(start) {
      const id = ctx.nextNum++;
      ctx.extraNums.push(
        `<w:num w:numId="${id}"><w:abstractNumId w:val="2"/>` +
        `<w:lvlOverride w:ilvl="0"><w:startOverride w:val="${start}"/>` +
        '</w:lvlOverride></w:num>');
      return id;
    }

    function blocksXml(blocks, indent = 0, quote = false) {
      let out = '';
      let curOrdered = null;
      const bdr = quote
        ? '<w:pBdr><w:left w:val="single" w:sz="12" w:space="8" w:color="BBBBBB"/></w:pBdr>'
        : '';
      const ind = indent ? `<w:ind w:left="${indent}"/>` : '';
      for (const blk of blocks) {
        if (blk.k !== 'li') curOrdered = null;
        if (blk.k === 'h') {
          out += para(runsXml(parseInline(blk.text)),
                      `Heading${Math.min(blk.level + 1, 4)}`, bdr + ind);
        } else if (blk.k === 'p') {
          out += para(runsXml(parseInline(blk.text)), null, bdr + ind);
        } else if (blk.k === 'li') {
          const lvl = Math.min(blk.level, 8);
          let numId = 1;
          if (blk.ordered) {
            if (curOrdered === null) {
              const start = parseInt(blk.marker, 10);
              curOrdered = newOrderedList(Number.isFinite(start) ? start : 1);
            }
            numId = curOrdered;
          } else if (blk.level === 0) {
            curOrdered = null;
          }
          out += para(runsXml(parseInline(blk.text)), 'ListParagraph',
            `<w:numPr><w:ilvl w:val="${lvl}"/><w:numId w:val="${numId}"/></w:numPr>` + bdr);
        } else if (blk.k === 'code') {
          out += codePara(blk.text, indent);
        } else if (blk.k === 'hr') {
          out += para('', null,
            '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="BBBBBB"/></w:pBdr>');
        } else if (blk.k === 'quote') {
          out += blocksXml(blk.blocks, indent + 360, true);
        } else if (blk.k === 'table') {
          out += textTable(blk.head, blk.rows, indent);
        }
      }
      return out;
    }

    // Human messages are shown as typed (as claude.ai shows them), keeping
    // line breaks; ``` fenced code becomes a code block.
    function humanXml(text) {
      let out = '';
      let buf = [];
      let inCode = false;
      const flush = () => {
        const seg = buf.join('\n');
        buf = [];
        if (!seg.trim()) return;
        if (inCode) {
          out += codePara(seg);
        } else {
          for (const p of seg.replace(/^\n+|\n+$/g, '').split(/\n\s*\n/)) {
            if (p.trim()) out += para(textRun(p.replace(/^\n+|\n+$/g, '')));
          }
        }
      };
      for (const line of text.split('\n')) {
        if (line.trim().startsWith('```')) { flush(); inCode = !inCode; continue; }
        buf.push(line);
      }
      flush();
      return out;
    }

    // ─── Word package parts ──────────────────────────────────────────────────

    function stylesXml() {
      const style = (id, name, ppr = '', rpr = '') =>
        `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>` +
        '<w:basedOn w:val="Normal"/><w:qFormat/>' +
        (ppr ? `<w:pPr>${ppr}</w:pPr>` : '') +
        (rpr ? `<w:rPr>${rpr}</w:rPr>` : '') + '</w:style>';
      const heading = (n, size) => style(`Heading${n}`, `heading ${n}`,
        `<w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="${n - 1}"/>`,
        `<w:b/><w:sz w:val="${size}"/>`);
      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<w:styles ${W_NS}>` +
        '<w:docDefaults><w:rPrDefault><w:rPr>' +
        '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/>' +
        '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US"/>' +
        '</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>' +
        '<w:spacing w:after="120" w:line="276" w:lineRule="auto"/>' +
        '</w:pPr></w:pPrDefault></w:docDefaults>' +
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">' +
        '<w:name w:val="Normal"/><w:qFormat/></w:style>' +
        '<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont">' +
        '<w:name w:val="Default Paragraph Font"/></w:style>' +
        '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/>' +
        '<w:rPr><w:color w:val="1155CC"/><w:u w:val="single"/></w:rPr></w:style>' +
        style('Title', 'Title', '<w:spacing w:after="80"/>', '<w:b/><w:sz w:val="40"/>') +
        style('Meta', 'Meta', '<w:spacing w:after="0"/>',
              '<w:i/><w:color w:val="666666"/><w:sz w:val="18"/>') +
        // Heading 1 = each "Human (...)" / "Claude (...)" line
        style('Heading1', 'heading 1',
              '<w:keepNext/><w:pBdr><w:top w:val="single" w:sz="6" w:space="10" ' +
              'w:color="D9D9D9"/></w:pBdr><w:spacing w:before="360" w:after="120"/>' +
              '<w:outlineLvl w:val="0"/>',
              '<w:b/><w:sz w:val="24"/>') +
        heading(2, 28) + heading(3, 25) + heading(4, 22) +
        style('Code', 'Code',
              '<w:shd w:val="clear" w:color="auto" w:fill="F4F4F4"/>' +
              '<w:spacing w:after="120" w:line="240" w:lineRule="auto"/>',
              '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>' +
              '<w:sz w:val="19"/>') +
        style('ListParagraph', 'List Paragraph', '<w:spacing w:after="60"/>') +
        '</w:styles>';
    }

    function numberingXml() {
      const lvl = (i, fmt, text, font) =>
        `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/>` +
        `<w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/>` +
        `<w:pPr><w:ind w:left="${720 + 360 * i}" w:hanging="360"/></w:pPr>` +
        (font ? `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:hint="default"/></w:rPr>` : '') +
        '</w:lvl>';
      let bullets = '';
      let numbers = '';
      for (let i = 0; i < 9; i++) {
        bullets += lvl(i, 'bullet', ['•', '◦', '▪'][i % 3], 'Arial');
        numbers += lvl(i, ['decimal', 'lowerLetter', 'lowerRoman'][i % 3], `%${i + 1}.`);
      }
      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<w:numbering ${W_NS}>` +
        '<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>' +
        bullets + '</w:abstractNum>' +
        '<w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="hybridMultilevel"/>' +
        numbers + '</w:abstractNum>' +
        '<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>' +
        '<w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>' +
        ctx.extraNums.join('') + '</w:numbering>';
    }

    // Minimal ZIP writer (stored, no compression) — no libraries needed.
    const CRC_TABLE = (() => {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
      }
      return t;
    })();

    function crc32(bytes) {
      let c = 0xFFFFFFFF;
      for (let i = 0; i < bytes.length; i++) {
        c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
      }
      return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function zipBlob(files) {
      const enc = new TextEncoder();
      const parts = [];
      const central = [];
      let offset = 0;
      for (const f of files) {
        const name = enc.encode(f.name);
        const data = enc.encode(f.data);
        const crc = crc32(data);
        const lh = new DataView(new ArrayBuffer(30));
        lh.setUint32(0, 0x04034b50, true);
        lh.setUint16(4, 20, true);
        lh.setUint16(6, 0x0800, true);      // UTF-8 names
        lh.setUint16(8, 0, true);           // stored
        lh.setUint16(10, 0, true);          // time
        lh.setUint16(12, 0x0021, true);     // date 1980-01-01
        lh.setUint32(14, crc, true);
        lh.setUint32(18, data.length, true);
        lh.setUint32(22, data.length, true);
        lh.setUint16(26, name.length, true);
        lh.setUint16(28, 0, true);
        parts.push(new Uint8Array(lh.buffer), name, data);
        const ch = new DataView(new ArrayBuffer(46));
        ch.setUint32(0, 0x02014b50, true);
        ch.setUint16(4, 20, true);
        ch.setUint16(6, 20, true);
        ch.setUint16(8, 0x0800, true);
        ch.setUint16(10, 0, true);
        ch.setUint16(12, 0, true);
        ch.setUint16(14, 0x0021, true);
        ch.setUint32(16, crc, true);
        ch.setUint32(20, data.length, true);
        ch.setUint32(24, data.length, true);
        ch.setUint16(28, name.length, true);
        ch.setUint32(42, offset, true);
        central.push(new Uint8Array(ch.buffer), name);
        offset += 30 + name.length + data.length;
      }
      const cdSize = central.reduce((a, b) => a + b.length, 0);
      const end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true);
      end.setUint16(8, files.length, true);
      end.setUint16(10, files.length, true);
      end.setUint32(12, cdSize, true);
      end.setUint32(16, offset, true);
      return new Blob([...parts, ...central, new Uint8Array(end.buffer)],
                      { type: DOCX_MIME });
    }

    // ─── Word document builder ───────────────────────────────────────────────

    function buildDocx(messages, conversationName) {
      let humanCount = 0;
      let claudeCount = 0;
      let skippedCount = 0;
      let warningCount = 0;
      let omittedCount = 0;

      const title = sanitizeTitle(conversationName || 'Conversation with Claude');
      const exportDate = new Date().toLocaleString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
      });

      let body = para(textRun(title), 'Title');
      body += para(textRun(`Exported on ${exportDate}`), 'Meta');
      body += para(runsXml([
        { t: 'Exported by ', b: false, i: false, code: false, href: null },
        { t: 'true-ai-export', b: false, i: false, code: false,
          href: 'https://github.com/filteredwaterdev/true-ai-export' },
        { t: ` — ${FORMAT_LABEL}`, b: false, i: false, code: false, href: null }
      ]), 'Meta');

      for (const msg of messages) {
        const ts = formatTimestamp(msg.created_at);
        const contentBlocks = Array.isArray(msg.content) ? msg.content : [];
        let label, color, isHuman;

        if (msg.sender === 'human') {
          humanCount++;
          label = 'Human'; color = '1A56DB'; isHuman = true;
        } else if (msg.sender === 'assistant') {
          claudeCount++;
          label = 'Claude'; color = '166534'; isHuman = false;
        } else {
          skippedCount++;
          continue;
        }

        let content = '';
        let hasContent = false;

        for (const block of contentBlocks) {
          if (!block || typeof block !== 'object') continue;

          if (block.type === 'text') {
            const text = String(block.text ?? '').trim();
            if (text) {
              content += isHuman ? humanXml(text) : blocksXml(parseBlocks(text));
              hasContent = true;
            }

          } else if (block.type === 'document' || block.type === 'file') {
            warningCount++;
            hasContent = true;
            const name = block.name || block.file_name || block.filename || null;
            const mediaType = block.media_type || block.file_type || null;
            const lines = [
              'This message contained an attached document that could not be ' +
              'captured as plain text' + (CLEAN ? '.' : ' by this export script.')
            ];
            if (name) lines.push(`Filename: ${name}`);
            if (mediaType) lines.push(`Type: ${mediaType}`);
            lines.push(
              'Possible causes: Large text paste auto-converted to an attachment ' +
              'by the claude.ai interface (a known concurrent regression), or a ' +
              'manually uploaded file.',
              'Action required: Refer to the original conversation in Claude to ' +
              'retrieve this content.');
            content += warnBox('⚠️ ATTACHMENT — CONTENT NOT FULLY EXPORTED', lines);

          } else if (block.type === 'image') {
            warningCount++;
            hasContent = true;
            content += warnBox('⚠️ IMAGE — NOT EXPORTED', [
              'An image exists at this point in the conversation and cannot be ' +
              'exported as plain text.',
              'Action required: Refer to the original conversation in Claude to ' +
              'view this image.']);

          } else if (block.type === 'tool_use') {
            if (CLEAN) { omittedCount++; continue; }
            warningCount++;
            hasContent = true;
            content += warnBox('⚠️ TOOL USE — NOT FULLY EXPORTED', [
              'Claude invoked a tool at this point in the conversation.',
              `Tool: ${block.name || 'unknown'}`,
              'Action required: Refer to the original conversation in Claude to ' +
              'see the full tool interaction.']);

          } else if (block.type === 'tool_result') {
            if (CLEAN) { omittedCount++; continue; }
            warningCount++;
            hasContent = true;
            content += warnBox('⚠️ TOOL RESULT — NOT FULLY EXPORTED', [
              'A tool result exists at this point that could not be captured as ' +
              'plain text.',
              'Action required: Refer to the original conversation in Claude to ' +
              'see the full result.']);

          } else if (block.type === 'thinking' || block.type === 'redacted_thinking') {
            if (CLEAN) { omittedCount++; continue; }
            warningCount++;
            hasContent = true;
            content += warnBox('⚠️ EXTENDED THINKING — NOT EXPORTED', [
              "Claude's internal reasoning block exists at this point but cannot " +
              'be exported as plain text.',
              'Action required: Refer to the original conversation in Claude to ' +
              'view the thinking block.']);

          } else {
            warningCount++;
            hasContent = true;
            const lines = [
              `A content block of unrecognised type "${block.type ?? 'unknown'}" ` +
              'exists at this point.'];
            if (!CLEAN) lines.push('This script does not know how to handle this content type.');
            lines.push(
              'Action required: Refer to the original conversation in Claude to ' +
              'see this content.',
              'If you see this warning, please open a GitHub issue so support for ' +
              'this content type can be added.');
            content += warnBox('⚠️ UNKNOWN CONTENT BLOCK — NOT EXPORTED', lines);
          }
        }

        if (!hasContent) {
          if (CLEAN) { skippedCount++; continue; }
          warningCount++;
          content += warnBox('⚠️ EMPTY OR UNREADABLE MESSAGE', [
            'This message exists in the transcript but contained no exportable ' +
            'content.',
            'Action required: Refer to the original conversation in Claude.']);
        }

        const heading = `${label}${ts ? ` (${ts})` : ''}:`;
        body += para(
          `<w:r><w:rPr><w:color w:val="${color}"/></w:rPr>` +
          `<w:t xml:space="preserve">${xt(heading)}</w:t></w:r>`, 'Heading1');
        body += content;
      }

      // Export summary (plain text, not a table object)
      body += para(textRun('Export Summary'), 'Heading1');
      const rows = [['Human messages', String(humanCount)],
                    ['Claude messages', String(claudeCount)]];
      if (CLEAN) {
        rows.push(['Attachments / images flagged', String(warningCount)],
                  ['Technical blocks omitted', String(omittedCount)],
                  ['System messages skipped', String(skippedCount)]);
      } else {
        rows.push(['Content gaps flagged', String(warningCount)],
                  ['System messages skipped', String(skippedCount)]);
      }
      rows.push(['Exported at', new Date().toISOString()]);
      body += textTable(['', ''], rows, 0, false, false);

      if (CLEAN) {
        if (warningCount > 0) {
          body += warnBox(
            `⚠️ ${warningCount} attachment or image${warningCount === 1 ? '' : 's'} ` +
            'flagged in this transcript.',
            ['Refer to the original conversation in Claude to retrieve any content ' +
             'that could not be exported.']);
        }
        if (omittedCount > 0) {
          body += infoBox(
            `ℹ️ ${omittedCount} technical block${omittedCount === 1 ? '' : 's'} ` +
            'omitted (tool use, tool results, extended thinking).',
            ['Use export-docx.js for the full version with all blocks flagged.']);
        }
        if (warningCount === 0 && omittedCount === 0) {
          body += okBox('✅ Clean export complete. All messages exported as plain ' +
                        'text with no omissions.');
        }
      } else if (warningCount > 0) {
        body += warnBox(
          `⚠️ ${warningCount} content gap${warningCount === 1 ? '' : 's'} ` +
          'detected in this transcript.',
          ['Each gap is marked inline with a ⚠️ warning above.',
           'Refer to the original conversation in Claude to retrieve any content ' +
           'that could not be exported as plain text.']);
      } else {
        body += okBox('✅ No content gaps detected. All messages exported as plain text.');
      }

      const sect = '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>' +
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" ' +
        'w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>';

      const files = [
        { name: '[Content_Types].xml', data:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
          '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
          '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
          '</Types>' },
        { name: '_rels/.rels', data:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
          '</Relationships>' },
        { name: 'word/document.xml', data:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          `<w:document ${W_NS}><w:body>${body}${sect}</w:body></w:document>` },
        { name: 'word/_rels/document.xml.rels', data:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
          '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
          ctx.rels.map(([id, url]) =>
            `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" ` +
            `Target="${xa(url)}" TargetMode="External"/>`).join('') +
          '</Relationships>' },
        { name: 'word/styles.xml', data: stylesXml() },
        { name: 'word/numbering.xml', data: numberingXml() }
      ];

      return {
        blob: zipBlob(files),
        humanCount, claudeCount, skippedCount, warningCount, omittedCount
      };
    }


    return buildDocx;
  }

  function buildDocx(messages, conversationName) {
    return createBuilder(false)(messages, conversationName);
  }

  function buildDocxClean(messages, conversationName) {
    return createBuilder(true)(messages, conversationName);
  }

  ns.formatDocx = { DOCX_MIME, buildDocx, buildDocxClean };
})();
