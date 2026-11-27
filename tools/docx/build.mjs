#!/usr/bin/env node
/**
 * true-ai-export — generator for the Word (.docx) exporters.
 *
 * The Word exporter exists in three places that must stay identical:
 *
 *   claude/v1.2.0/export-docx.js                    console script, full
 *   claude/v1.2.0/export-docx-clean.js              console script, clean
 *   browser-extensions/chromium/lib/format-docx.js  extension formatter
 *
 * All three are generated from tools/docx/template.js. Edit the
 * template, never the generated files, then run:
 *
 *   node tools/docx/build.mjs           write all three files
 *   node tools/docx/build.mjs --check   fail if any file is out of date
 *
 * The console scripts are the template with the placeholders filled in.
 * The extension formatter is the shared builder section of the template
 * (from the "Markdown parsing" section header up to, not including, the
 * "Main" section header) wrapped in createBuilder(CLEAN), so it produces
 * byte-identical documents without the console scripts' fetch, status
 * box and download code.
 *
 * No dependencies. Node 16 or later.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const TEMPLATE = join(HERE, 'template.js');

const BUILDER_START = '  // ─── Markdown parsing';
const BUILDER_END = '  // ─── Main';

const VARIANTS = [
  {
    out: 'claude/v1.2.0/export-docx.js',
    values: {
      VARIANT_TITLE: 'Word',
      FUNC: 'trueAiExportDocx',
      CLEAN: 'false',
      HEADER_BLURB: [
        ' * This is the FULL version. Every non-text content block is',
        ' * flagged inline with a clearly visible warning. Nothing is',
        ' * silently dropped. Nothing is invisibly absent.',
        ' *',
        ' * For the clean version that omits tool use and internal',
        ' * reasoning blocks, use export-docx-clean.js instead.'
      ].join('\n'),
      WHAT_GETS_EXPORTED: [
        ' *   ✅ Every human message — full text, with timestamps',
        ' *   ✅ Every Claude response — full text and formatting,',
        ' *       with timestamps',
        ' *   ⚠️  Every non-text content block flagged inline —',
        ' *       attachments, images, tool use, tool results, thinking',
        ' *       blocks, unknown types. Nothing is silently dropped.',
        ' *       Nothing is invisibly absent from the transcript.',
        ' *   📋  Export summary at the end of every file'
      ].join('\n'),
      LIMITATIONS: [
        ' *   - Non-text content cannot be exported as text —',
        ' *     each instance is flagged inline with a ⚠️ warning'
      ].join('\n')
    }
  },
  {
    out: 'claude/v1.2.0/export-docx-clean.js',
    values: {
      VARIANT_TITLE: 'Word, Clean',
      FUNC: 'trueAiExportDocxClean',
      CLEAN: 'true',
      HEADER_BLURB: [
        ' * This is the CLEAN version. It exports the human-readable',
        ' * conversation only — the back-and-forth between you and Claude.',
        ' * Tool use, tool results, and internal reasoning blocks are',
        ' * omitted. Attachments and images are flagged since they',
        ' * directly affect what was visible in the conversation.',
        ' *',
        ' * For the full version that flags every non-text content block',
        ' * explicitly, use export-docx.js instead.'
      ].join('\n'),
      WHAT_GETS_EXPORTED: [
        ' *   ✅ Every human message — full text, with timestamps',
        ' *   ✅ Every Claude response — full text and formatting,',
        ' *       with timestamps',
        ' *   ⚠️  Attachments and images are flagged inline — these',
        ' *       directly affect the visible conversation and should',
        ' *       not be silently omitted',
        ' *   ➖  Tool use, tool results, and extended thinking blocks',
        ' *       are omitted — these are internal technical operations',
        ' *       not part of the readable conversation',
        ' *   📋  Export summary at the end of every file'
      ].join('\n'),
      LIMITATIONS: [
        ' *   - Tool use and tool results are intentionally omitted in',
        ' *     this version — use export-docx.js for full output'
      ].join('\n')
    }
  }
];

const EXTENSION_OUT = 'browser-extensions/chromium/lib/format-docx.js';

const EXTENSION_HEADER = `/**
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

`;

const EXTENSION_FOOTER = `

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
`;

function fail(message) {
  console.error(`build.mjs: ${message}`);
  process.exit(1);
}

function consoleScript(template, values) {
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`__${key}__`).join(value);
  }
  const left = out.match(/__[A-Z_]+__/);
  if (left) fail(`unfilled placeholder ${left[0]}`);
  return out;
}

function extensionFormatter(template) {
  const lines = template.split('\n');
  const start = lines.findIndex(l => l.startsWith(BUILDER_START));
  const end = lines.findIndex(l => l.startsWith(BUILDER_END));
  if (start < 0 || end < 0 || end <= start) {
    fail('could not find the builder section markers in the template');
  }
  const body = lines.slice(start, end)
    .map(l => (l.trim() ? '  ' + l : l))
    .join('\n');
  return EXTENSION_HEADER + body + EXTENSION_FOOTER;
}

const check = process.argv.includes('--check');
const template = readFileSync(TEMPLATE, 'utf8');

const outputs = VARIANTS.map(v => [v.out, consoleScript(template, v.values)]);
outputs.push([EXTENSION_OUT, extensionFormatter(template)]);

let stale = 0;
for (const [rel, content] of outputs) {
  const path = join(ROOT, rel);
  const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (current === content) {
    console.log(`up to date  ${rel}`);
    continue;
  }
  if (check) {
    console.log(`OUT OF DATE ${rel}`);
    stale++;
  } else {
    writeFileSync(path, content);
    console.log(`written     ${rel}`);
  }
}

if (check && stale) {
  fail(`${stale} file(s) differ from ${relative(ROOT, TEMPLATE)}. ` +
       'Run node tools/docx/build.mjs and review the diff.');
}
