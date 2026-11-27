/**
 * true-ai-export — download filename derivation.
 *
 * Mirrors the console scripts exactly: sanitizeFilename() applied to
 * the conversation name, then the format's extension appended. Clean
 * variants append "-clean" before the extension, as in
 * export-markdown-clean.js and its siblings.
 *
 * The four PDF entries do not download a file — they open a print
 * document and the browser's print dialog supplies the name from the
 * document title — so they have no entry here.
 */
(function () {
  'use strict';

  const ns = globalThis.TrueAiExport;
  const { sanitizeFilename } = ns.walk;

  // suffix is everything the console script concatenates onto
  // sanitizeFilename(conversationName), copied character for character.
  const SUFFIX = {
    'markdown': '.md',
    'markdown-clean': '-clean.md',
    'plaintext': '.txt',
    'plaintext-clean': '-clean.txt',
    'html': '.html',
    'html-clean': '-clean.html',
    'json': '.json',
    'docx': '.docx',
    'docx-clean': '-clean.docx'
  };

  const MIME = {
    'markdown': 'text/markdown;charset=utf-8',
    'markdown-clean': 'text/markdown;charset=utf-8',
    'plaintext': 'text/plain;charset=utf-8',
    'plaintext-clean': 'text/plain;charset=utf-8',
    'html': 'text/html;charset=utf-8',
    'html-clean': 'text/html;charset=utf-8',
    'json': 'application/json;charset=utf-8',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'docx-clean': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };

  function forFormat(formatId, conversationName) {
    const suffix = SUFFIX[formatId];
    if (!suffix) return null;
    return sanitizeFilename(conversationName) + suffix;
  }

  function mimeFor(formatId) {
    return MIME[formatId] || null;
  }

  ns.filename = { SUFFIX, MIME, forFormat, mimeFor };
})();
