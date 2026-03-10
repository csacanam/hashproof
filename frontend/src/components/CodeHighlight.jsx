const COLORS = {
  keyword:     "#c084fc",
  string:      "#86efac",
  comment:     "#52525b",
  number:      "#fb923c",
  key:         "#7dd3fc",
  punctuation: "#71717a",
  envvar:      "#fb923c",
  command:     "#86efac",
  plain:       "#e4e4e7",
};

function tokenizeJson(code) {
  const tokens = [];
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)|(\btrue\b|\bfalse\b|\bnull\b)|([{}[\],:])/g;
  let last = 0, m;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) tokens.push({ t: "plain", v: code.slice(last, m.index) });
    if (m[1] && m[2]) {
      tokens.push({ t: "key", v: m[1] });
      tokens.push({ t: "punctuation", v: m[2] });
    } else if (m[1]) {
      tokens.push({ t: "string", v: m[1] });
    } else if (m[3]) {
      tokens.push({ t: "number", v: m[3] });
    } else if (m[4]) {
      tokens.push({ t: "keyword", v: m[4] });
    } else if (m[5]) {
      tokens.push({ t: "punctuation", v: m[5] });
    }
    last = m.index + m[0].length;
  }
  if (last < code.length) tokens.push({ t: "plain", v: code.slice(last) });
  return tokens;
}

const JS_KEYWORDS = new Set([
  "import","export","from","as","const","let","var","function","async","await",
  "return","new","class","extends","if","else","for","of","in","true","false",
  "null","undefined","typeof","instanceof",
]);

function tokenizeJs(code) {
  const tokens = [];
  // Order matters: comments first, then template/strings, then words, then numbers, then rest
  const re = /(\/\/[^\n]*)|(`)|(["'])(?:(?!\3)[^\\]|\\.)*\3|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][A-Za-z0-9_$]*)|([{}[\]();,:.=<>!+\-*/&|?])/g;
  let last = 0, m;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) tokens.push({ t: "plain", v: code.slice(last, m.index) });

    if (m[1]) {
      tokens.push({ t: "comment", v: m[1] });
    } else if (m[2]) {
      // template literal — find the closing backtick manually
      const start = m.index;
      let i = start + 1;
      while (i < code.length && code[i] !== "`") {
        if (code[i] === "\\") i++;
        i++;
      }
      const raw = code.slice(start, i + 1);
      tokens.push({ t: "string", v: raw });
      re.lastIndex = i + 1;
      last = i + 1;
      continue;
    } else if (m[3] !== undefined) {
      tokens.push({ t: "string", v: m[0] });
    } else if (m[4]) {
      tokens.push({ t: "number", v: m[4] });
    } else if (m[5]) {
      tokens.push({ t: JS_KEYWORDS.has(m[5]) ? "keyword" : "plain", v: m[5] });
    } else if (m[6]) {
      tokens.push({ t: "punctuation", v: m[6] });
    }
    last = m.index + m[0].length;
  }
  if (last < code.length) tokens.push({ t: "plain", v: code.slice(last) });
  return tokens;
}

function tokenizeBash(code) {
  const tokens = [];
  const lines = code.split("\n");
  for (let li = 0; li < lines.length; li++) {
    if (li > 0) tokens.push({ t: "plain", v: "\n" });
    const line = lines[li];
    if (!line.trim()) continue;

    // env vars before the command: UPPERCASE=value
    const envRe = /^((?:[A-Z_][A-Z0-9_]*=\S*\s*)+)/;
    let rest = line;
    const envMatch = envRe.exec(rest);
    if (envMatch) {
      tokens.push({ t: "envvar", v: envMatch[1] });
      rest = rest.slice(envMatch[1].length);
    }

    // first word = command
    const cmdRe = /^(\S+)(.*)/s;
    const cmdMatch = cmdRe.exec(rest);
    if (cmdMatch) {
      tokens.push({ t: "command", v: cmdMatch[1] });
      tokens.push({ t: "plain", v: cmdMatch[2] });
    } else {
      tokens.push({ t: "plain", v: rest });
    }
  }
  return tokens;
}

export default function CodeHighlight({ code, lang = "json", className = "docs-code" }) {
  let tokens;
  if (lang === "json") tokens = tokenizeJson(code);
  else if (lang === "bash") tokens = tokenizeBash(code);
  else tokens = tokenizeJs(code);

  return (
    <pre className={className}>
      {tokens.map((tk, i) => (
        <span key={i} style={{ color: COLORS[tk.t] ?? COLORS.plain }}>{tk.v}</span>
      ))}
    </pre>
  );
}
