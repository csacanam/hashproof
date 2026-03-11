import JsonHighlight from "./JsonHighlight.jsx";

/**
 * Wraps JsonHighlight so the code block never overflows the viewport.
 * Long lines wrap; container stays within 100% width at all breakpoints.
 */
export default function ResponsiveCode({ code }) {
  return (
    <div className="responsive-code">
      <JsonHighlight code={code} className="responsive-code__pre" />
    </div>
  );
}
