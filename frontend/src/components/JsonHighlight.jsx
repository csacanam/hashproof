import CodeHighlight from "./CodeHighlight.jsx";

export default function JsonHighlight({ code, className }) {
  return <CodeHighlight code={code} lang="json" className={className} />;
}
