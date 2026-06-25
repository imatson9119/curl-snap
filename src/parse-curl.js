// Parse a curl command string into a structured RequestSpec.
//
// We render the evidence card from THIS parse (not from what curl/fetch actually
// sends), which is exactly why "only explicitly-set headers" works: auto-added
// defaults never appear here.

/**
 * @typedef {Object} RequestSpec
 * @property {string} method
 * @property {string} url
 * @property {string} domain      host portion, shown small/de-emphasized
 * @property {string} path        path + query, the emphasized line
 * @property {{name: string, value: string}[]} headers  only explicitly-set headers
 * @property {string|undefined} body
 * @property {boolean} insecure
 * @property {string[]} warnings  unsupported flags etc.
 */

/**
 * Tokenize a shell-ish command line, honoring single/double quotes, $'...'
 * ANSI-C quoting, backslash escapes, and line-continuation backslashes.
 * @param {string} input
 * @returns {string[]}
 */
export function tokenize(input) {
  const tokens = [];
  let current = '';
  let hasCurrent = false; // distinguishes "" (empty token) from no token
  let i = 0;
  const n = input.length;

  const push = () => {
    if (hasCurrent) tokens.push(current);
    current = '';
    hasCurrent = false;
  };

  while (i < n) {
    const c = input[i];

    if (c === '\\') {
      const next = input[i + 1];
      if (next === '\n') {
        // line continuation — swallow both
        i += 2;
        continue;
      }
      if (next !== undefined) {
        current += next;
        hasCurrent = true;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (c === "'") {
      // single-quoted: literal until next single quote
      hasCurrent = true;
      i += 1;
      while (i < n && input[i] !== "'") {
        current += input[i];
        i += 1;
      }
      i += 1; // skip closing quote
      continue;
    }

    if (c === '$' && input[i + 1] === "'") {
      // ANSI-C quoting $'...' with escape sequences
      hasCurrent = true;
      i += 2;
      while (i < n && input[i] !== "'") {
        if (input[i] === '\\') {
          const e = input[i + 1];
          const map = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', '0': '\0' };
          current += map[e] !== undefined ? map[e] : e;
          i += 2;
        } else {
          current += input[i];
          i += 1;
        }
      }
      i += 1;
      continue;
    }

    if (c === '"') {
      // double-quoted: honor backslash escapes for a small set
      hasCurrent = true;
      i += 1;
      while (i < n && input[i] !== '"') {
        if (input[i] === '\\' && '"\\$`'.includes(input[i + 1])) {
          current += input[i + 1];
          i += 2;
        } else {
          current += input[i];
          i += 1;
        }
      }
      i += 1;
      continue;
    }

    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      push();
      i += 1;
      continue;
    }

    current += c;
    hasCurrent = true;
    i += 1;
  }
  push();
  return tokens;
}

const FLAGS_WITH_VALUE = new Set([
  '-X', '--request',
  '-H', '--header',
  '-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode',
  '--json',
  '-u', '--user',
  '-b', '--cookie',
  '-A', '--user-agent',
  '-e', '--referer',
  '--url',
  '-o', '--output',
  '-m', '--max-time',
  '--connect-timeout',
  '-F', '--form',
]);

// Boolean flags we recognize but mostly ignore (so they don't get treated as a URL)
const BOOLEAN_FLAGS = new Set([
  '-k', '--insecure',
  '-G', '--get',
  '-s', '--silent',
  '-S', '--show-error',
  '-L', '--location',
  '-i', '--include',
  '-v', '--verbose',
  '-f', '--fail',
  '-#', '--progress-bar',
  '--compressed',
]);

/**
 * @param {string} command
 * @returns {RequestSpec}
 */
export function parseCurl(command) {
  const tokens = tokenize(command.trim());
  if (tokens.length && tokens[0] === 'curl') tokens.shift();

  const headers = [];
  const dataParts = [];
  const form = []; // -F parts: { name, value } or { name, file }
  const warnings = [];
  let method;
  let url;
  let insecure = false;
  let useGet = false; // -G: append data as query string
  let userAgent;
  let referer;
  let basicAuth;
  let cookie;
  let maxTime; // -m/--max-time, seconds
  let connectTimeout; // --connect-timeout, seconds

  for (let i = 0; i < tokens.length; i++) {
    let tok = tokens[i];

    // Support --flag=value form
    let inlineValue;
    if (tok.startsWith('--') && tok.includes('=')) {
      const eq = tok.indexOf('=');
      inlineValue = tok.slice(eq + 1);
      tok = tok.slice(0, eq);
    }

    const takeValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      i += 1;
      return tokens[i];
    };

    // Combined short flags like -sS or -ks
    if (/^-[a-zA-Z#]{2,}$/.test(tok) && !FLAGS_WITH_VALUE.has(tok)) {
      let consumed = true;
      for (const ch of tok.slice(1)) {
        const f = '-' + ch;
        if (f === '-k') insecure = true;
        else if (f === '-G') useGet = true;
        else if (BOOLEAN_FLAGS.has(f)) { /* ignore */ }
        else { consumed = false; break; }
      }
      if (consumed) continue;
      // fall through if it wasn't a clean boolean cluster
    }

    switch (tok) {
      case '-X':
      case '--request':
        method = takeValue();
        break;
      case '-H':
      case '--header': {
        const raw = takeValue();
        const idx = raw.indexOf(':');
        if (idx === -1) {
          // header with no value (e.g. "X-Foo;") — keep name only
          headers.push({ name: raw.replace(/;$/, '').trim(), value: '' });
        } else {
          headers.push({ name: raw.slice(0, idx).trim(), value: raw.slice(idx + 1).trim() });
        }
        break;
      }
      case '-d':
      case '--data':
      case '--data-raw':
      case '--data-binary':
      case '--data-ascii':
        dataParts.push(takeValue());
        break;
      case '--data-urlencode': {
        const v = takeValue();
        // name=value -> urlencode value portion; bare -> urlencode whole
        const eq = v.indexOf('=');
        if (eq === -1) dataParts.push(encodeURIComponent(v));
        else dataParts.push(v.slice(0, eq + 1) + encodeURIComponent(v.slice(eq + 1)));
        break;
      }
      case '--json': {
        const v = takeValue();
        dataParts.push(v);
        if (!headers.some((h) => h.name.toLowerCase() === 'content-type')) {
          headers.push({ name: 'Content-Type', value: 'application/json' });
        }
        if (!headers.some((h) => h.name.toLowerCase() === 'accept')) {
          headers.push({ name: 'Accept', value: 'application/json' });
        }
        break;
      }
      case '-u':
      case '--user':
        basicAuth = takeValue();
        break;
      case '-b':
      case '--cookie':
        cookie = takeValue();
        break;
      case '-A':
      case '--user-agent':
        userAgent = takeValue();
        break;
      case '-e':
      case '--referer':
        referer = takeValue();
        break;
      case '--url':
        url = takeValue();
        break;
      case '-o':
      case '--output':
        takeValue(); // accept + ignore (we don't write curl's output file)
        break;
      case '-m':
      case '--max-time': {
        const n = Number(takeValue());
        if (Number.isFinite(n) && n > 0) maxTime = n;
        break;
      }
      case '--connect-timeout': {
        const n = Number(takeValue());
        if (Number.isFinite(n) && n > 0) connectTimeout = n;
        break;
      }
      case '-F':
      case '--form': {
        const raw = takeValue();
        const eq = raw.indexOf('=');
        if (eq === -1) {
          warnings.push(`Malformed -F (expected name=value): ${raw}`);
          break;
        }
        const name = raw.slice(0, eq);
        const val = raw.slice(eq + 1);
        if (val.startsWith('@') || val.startsWith('<')) {
          // @file uploads / <file reads content — take the path up to any ;type=
          form.push({ name, file: val.slice(1).split(';')[0] });
        } else {
          form.push({ name, value: val });
        }
        break;
      }
      case '-k':
      case '--insecure':
        insecure = true;
        break;
      case '-G':
      case '--get':
        useGet = true;
        break;
      default:
        if (BOOLEAN_FLAGS.has(tok)) {
          // recognized, ignore
        } else if (tok.startsWith('-')) {
          warnings.push(`Unsupported flag ignored: ${tok}`);
          // best-effort: if it looks like it expects a value, skip the next token
          if (FLAGS_WITH_VALUE.has(tok) && inlineValue === undefined) i += 1;
        } else if (!url) {
          url = tok;
        } else {
          warnings.push(`Ignored extra argument: ${tok}`);
        }
    }
  }

  if (!url) {
    throw new Error('Could not find a URL in the curl command.');
  }

  // Synthesize derived headers from convenience flags (treated as explicit).
  if (basicAuth) {
    const encoded = Buffer.from(basicAuth).toString('base64');
    headers.push({ name: 'Authorization', value: `Basic ${encoded}` });
  }
  if (cookie) headers.push({ name: 'Cookie', value: cookie });
  if (userAgent) headers.push({ name: 'User-Agent', value: userAgent });
  if (referer) headers.push({ name: 'Referer', value: referer });
  // For -F, fetch sets the multipart boundary itself, but show the type on the
  // card so the request reflects reality.
  if (form.length && !headers.some((h) => h.name.toLowerCase() === 'content-type')) {
    headers.push({ name: 'Content-Type', value: 'multipart/form-data' });
  }

  let body = dataParts.length ? dataParts.join('&') : undefined;

  // Normalize URL (curl tolerates missing scheme)
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) {
    url = 'https://' + url;
  }

  // -G moves data into the query string
  if (useGet && body) {
    url += (url.includes('?') ? '&' : '?') + body;
    body = undefined;
  }

  if (!method) method = body !== undefined || form.length ? 'POST' : 'GET';
  method = method.toUpperCase();

  let domain = url;
  let path = url;
  const query = [];
  try {
    const u = new URL(url);
    domain = u.host;
    path = u.pathname || '/';
    // Pull query params out of the URL so they render as their own section
    // instead of cluttering the route line. searchParams decodes %-encoding.
    for (const [name, value] of u.searchParams) query.push({ name, value });
  } catch {
    warnings.push(`Could not parse URL: ${url}`);
  }

  return {
    method, url, domain, path, query, headers, body, insecure, warnings,
    form: form.length ? form : undefined,
    maxTime, connectTimeout,
  };
}
