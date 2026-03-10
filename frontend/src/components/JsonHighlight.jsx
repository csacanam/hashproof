const JSON_COLORS = {
  key:         "#7dd3fc",
  string:      "#86efac",
  number:      "#fb923c",
  literal:     "#c084fc",
  punctuation: "#52525b",
  plain:       "#e4e4e7",
};

export default function JsonHighlight({ code, className = "home-code" }) {
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
      tokens.push({ t: "literal", v: m[4] });
    } else if (m[5]) {
      tokens.push({ t: "punctuation", v: m[5] });
    }
    last = m.index + m[0].length;
  }
  if (last < code.length) tokens.push({ t: "plain", v: code.slice(last) });

  return (
    <pre className={className}>
      {tokens.map((tk, i) => (
        <span key={i} style={{ color: JSON_COLORS[tk.t] }}>{tk.v}</span>
      ))}
    </pre>
  );
}
