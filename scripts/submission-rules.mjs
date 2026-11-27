// Content rules for portfolio pull requests, shared by validate-submission.mjs (the `validate` check) and
// automerge.mjs (the auto-merge job). Pure functions over file text, no dependencies, so the privileged
// auto-merge job can run them on PR files it only reads as data and never executes.

export const PORTFOLIO_DIR = "src/content/portfolios"
export const SHOWCASE_DIR = "src/showcases"
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/
export const SHOWCASE_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const SHOWCASE_EXTENSIONS = new Set([".tsx", ".ts", ".json", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif"])
export const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"])

/** Is `path` one the PR author may change: their own portfolio file or something in their showcase folder? */
export function isOwnPath(path, username) {
  return path === `${PORTFOLIO_DIR}/${username}.md` || path.startsWith(`${SHOWCASE_DIR}/${username}/`)
}

// ------------------------------------------------------------------------------------------- Markdown

const stripCode = (md) =>
  md
    .replace(/^(\s*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1\2[^\n]*$/gm, "") // fenced blocks
    .replace(/(`+)[^`\n]*?\1/g, "") // inline code

/**
 * Problems in a portfolio's Markdown body (the About section). Astro renders raw HTML in Markdown as is,
 * so the body must be plain Markdown: no HTML tags, and links only to http(s), mailto, # or / targets.
 * These are hard failures for everyone.
 */
export function markdownProblems(body) {
  const text = stripCode(body)
  const problems = []
  if (/<\/?[A-Za-z][\w:-]*(?=[\s/>])|<!--|<!\[?[A-Za-z]|<\?/.test(text)) {
    problems.push("HTML tags aren't allowed in the About text. Use Markdown only (put code in `backticks`)")
  }
  const scheme = "(?!https?:|mailto:|#|/)[A-Za-z][\\w+.-]*:"
  if (new RegExp(`\\]\\(\\s*<?\\s*${scheme}`).test(text) || new RegExp(`^\\s{0,3}\\[[^\\]]+\\]:\\s*<?\\s*${scheme}`, "m").test(text)) {
    problems.push("links in the About text must start with https://, http://, mailto:, # or /")
  }
  if (/&#|&colon;|&Tab;|&NewLine;/i.test(text)) {
    problems.push("character references like `&#…;` aren't allowed in the About text; type the character itself")
  }
  return problems
}

// ------------------------------------------------------------------------------------------- Showcases

// Hard rules: the `validate` check fails on these for everyone.
export const ALLOWED_IMPORTS = [/^react$/, /^lucide-react$/, /^@\/components\/ui\/[a-z-]+$/, /^@\/lib\/utils$/, /^\.\/[\w./-]+$/]
export const FORBIDDEN = [
  [/\bfetch\s*\(/, "network requests (fetch)"],
  [/\bXMLHttpRequest\b/, "network requests (XMLHttpRequest)"],
  [/\bWebSocket\b|\bEventSource\b|\bsendBeacon\b/, "network connections"],
  [/\beval\s*\(|\bnew\s+Function\b/, "eval / new Function"],
  [/dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=/, "raw HTML injection"],
  [/document\.cookie/, "cookies"],
  [/\bimport\s*\(/, "dynamic imports"],
  [/\brequire\s*\(/, "require()"],
  [/<script\b|<iframe\b/i, "script or iframe tags"],
]

/** Hard-rule problems in one showcase code file (.ts/.tsx). */
export function showcaseCodeProblems(source) {
  const problems = []
  for (const [, spec] of source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)) {
    if (!ALLOWED_IMPORTS.some((re) => re.test(spec)) || spec.includes("..")) {
      problems.push(`import \`${spec}\` isn't allowed. See "Showcases" in SUBMISSION.md`)
    }
  }
  for (const [re, what] of FORBIDDEN) if (re.test(source)) problems.push(`${what} aren't allowed in showcases`)
  return problems
}

// Auto-merge rules: stricter. A showcase that trips one isn't rejected; it just waits for a maintainer.
// The goal is that an auto-merged showcase can only draw inside its own box in the 02 Portfolio section:
// no reaching the page, the browser, storage, other sites or the <head>, and no escaping its box visually.
// This is a pattern check, not a sandbox: it catches the obvious routes and anything that looks like an
// attempt to hide one, and leaves everything else to a human.
const word = (w) => new RegExp(`(?<![\\w$-])${w}(?![\\w$-])`)
const STRICT = [
  // The page and the browser outside the showcase's own React tree.
  [word("(?:window|document|globalThis|self|frames|opener)"), "uses window/document (showcases may only render inside their own section)"],
  [/(?<![\w$.-])(?:top|parent)\s*\./, "reaches the top or parent window"],
  [word("(?:localStorage|sessionStorage|indexedDB|cookieStore|caches)"), "uses browser storage"],
  [word("(?:navigator|location|history\\s*\\.\\s*(?:push|replace)State)"), "uses navigator, location or history"],
  [/(?<![\w$.])open\s*\(|\bpostMessage\b|\bimportScripts\b|\b(?:Shared)?Worker\b|\bserviceWorker\b/, "opens windows, workers or messages"],
  [/\bnew\s+(?:Image|Audio)\b/, "loads media from code"],
  [/\bcreatePortal\b|react-dom/, "renders outside its section (portals)"],
  // Elements React hoists into <head>, or that pull in or send things elsewhere.
  [/<\s*(?:title|meta|link|style|base|script|iframe|object|embed|form|frame|frameset|portal)\b/i, "uses a <head>, style, embed or form element"],
  [/(?:src|srcSet|poster|xlinkHref)\s*=\s*\{?\s*[`"']\s*(?:https?:)?\/\/(?![^`"']*\bsuy\.us\/)/i, "loads an image or media from another site (import images from the showcase folder instead)"],
  [/url\s*\(\s*["']?\s*(?:https?:)?\/\//i, "loads a CSS url() from another site"],
  [/\b(?:href|src)\s*=\s*\{?\s*[`"']\s*(?:javascript|data|vbscript):/i, "uses a javascript:/data: URL"],
  // Escaping its box: fixed positioning covers the whole page.
  [/(?<![\w-])fixed(?![\w-])|position\s*:\s*["']?fixed/, "uses fixed positioning (it would cover the rest of the page)"],
  // Ways of hiding any of the above from this check.
  [/\b(?:Function|Reflect|Proxy|constructor|__proto__|prototype|defineProperty|getPrototypeOf|setPrototypeOf)\b/, "uses reflection (constructor, prototype, Reflect, Proxy…)"],
  [/\b(?:atob|btoa|fromCharCode|fromCodePoint|unescape|decodeURI(?:Component)?|escape)\s*\(/, "decodes strings at runtime"],
  [/\\x[0-9a-f]{2}|\\u[0-9a-f{]/i, "uses escaped characters in strings"],
  [/["'`]\s*\+\s*["'`]/, "joins string literals with +"],
  [/\[\s*`|\[\s*["'][^"'\]]*["']\s*\+/, "builds property names from strings"],
  [/\b(?:setTimeout|setInterval)\s*\(\s*[`"']/, "passes a string to setTimeout/setInterval"],
  [/\bwith\s*\(/, "uses `with`"],
]

export const LIMITS = { files: 40, codeBytes: 120_000, imageBytes: 1_000_000, totalBytes: 3_000_000 }

/** Auto-merge problems in one showcase code file (.ts/.tsx). Empty = this file can be merged without review. */
export function showcaseStrictProblems(source) {
  // Whole-line and block comments don't run, so prose in them ("a fixed-width window") doesn't count.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
  const problems = []
  for (const [re, why] of STRICT) if (re.test(code)) problems.push(why)
  return problems
}
