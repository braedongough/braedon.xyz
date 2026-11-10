// Syncs the reading list from Google Sheets into reading.html.
// Needs GOOGLE_SERVICE_ACCOUNT_KEY (service account JSON with Viewer access to the sheet).
// Every sheet column is rendered; headers starting with "_" are skipped.
// Run: bun run sync:reading

const SHEET_ID = "1KYhDXsFYYrOfrCxSduZykTLMAWN31kOFuBIThzr_Wos";
const TAB = "Reading List";
const PAGE = new URL("../reading.html", import.meta.url);
const START = "<!-- reading-list:start -->";
const END = "<!-- reading-list:end -->";

type Kind = "date" | "number" | "filter" | "text";
type Column = { key: string; label: string; kind: Kind; index: number };

async function accessToken(): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set");
  const key = JSON.parse(raw);
  const b64 = (data: string | ArrayBuffer) => Buffer.from(data as ArrayBuffer).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    b64(JSON.stringify({ alg: "RS256", typ: "JWT" })) +
    "." +
    b64(
      JSON.stringify({
        iss: key.client_email,
        scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
        aud: key.token_uri,
        iat: now,
        exp: now + 600,
      }),
    );
  const der = Buffer.from(key.private_key.replace(/-----[^-]+-----|\s/g, ""), "base64");
  const signer = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", signer, new TextEncoder().encode(unsigned));
  const res = await fetch(key.token_uri, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: unsigned + "." + b64(sig),
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Token request failed (${res.status}): ${body.error_description ?? body.error}`);
  return body.access_token;
}

async function fetchRows(): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(TAB)}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${await accessToken()}` } });
  const body = await res.json();
  if (!res.ok) throw new Error(`Sheets request failed (${res.status}): ${body.error?.message}`);
  return body.values ?? [];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Escaped text with http(s) URLs turned into links.
const linkify = (s: string) =>
  esc(s).replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (url) => `<a href="${url}">${url}</a>`);

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "col";

// Guess how each column should behave from its values.
function kindOf(values: string[]): Kind {
  const filled = values.filter(Boolean);
  if (!filled.length) return "text";
  if (filled.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v))) return "date";
  if (filled.every((v) => /^-?\d+(\.\d+)?$/.test(v))) return "number";
  const distinct = new Set(filled);
  const short = filled.every((v) => v.length <= 24);
  const repeats = distinct.size < filled.length;
  if (short && repeats && distinct.size <= 8) return "filter";
  return "text";
}

// Columns with special roles, matched by header name. Books whose Status is
// "Reading" become the Now reading cards, "To read" (or blank) is Up next with
// the filters, and every other status gets its own list. Type picks the colour.
const STATUS = "status";
const NOW = "reading";
const NEXT = "to read";
const TYPE = "type";

function render(rows: string[][]): string {
  const [header = [], ...data] = rows;
  const books = data.filter((r) => r.some((c) => c?.trim()));
  const used = new Set<string>();
  const columns: Column[] = [];
  header.forEach((label, index) => {
    label = label.trim();
    if (!label || label.startsWith("_")) return;
    let key = slug(label);
    while (used.has(key)) key += "-x";
    used.add(key);
    const values = books.map((r) => (r[index] ?? "").trim());
    // first two columns are always the title and byline
    const kind = columns.length < 2 ? "text" : kindOf(values);
    columns.push({ key, label, kind, index });
  });
  if (!columns.length) throw new Error("Sheet has no header row");

  const cell = (r: string[], c?: Column) => (c ? (r[c.index] ?? "").trim() : "");
  const [titleCol, bylineCol, ...rest] = columns;
  const sortCol = rest.find((c) => c.kind === "date");
  if (sortCol) books.sort((a, b) => cell(b, sortCol).localeCompare(cell(a, sortCol)));

  const statusCol = rest.find((c) => c.key === STATUS);
  const typeCol = rest.find((c) => c.key === TYPE && c.kind === "filter");
  const types = [...new Set(books.map((r) => cell(r, typeCol)).filter(Boolean))].sort();
  const tone = (r: string[]) => (typeCol && cell(r, typeCol) ? types.indexOf(cell(r, typeCol)) % 4 : 1);
  // remaining short-value columns (Medium, Heard via, ...) show as tags
  const tagCols = rest.filter((c) => c.kind === "filter" && c !== statusCol && c !== typeCol);

  const attrs = (r: string[]) => columns.map((c) => ` data-${c.key}="${esc(cell(r, c))}"`).join("");
  const tags = (r: string[]) =>
    tagCols
      .filter((c) => cell(r, c))
      .map((c) => `<span class="tag tag--${(tagCols.indexOf(c) + 2) % 4}" title="${esc(c.label)}">${esc(cell(r, c))}</span>`)
      .join("");
  // every column not already in the summary goes in the expandable details
  const more = (r: string[], shown: (Column | undefined)[]) => {
    const items = rest
      .filter((c) => !shown.includes(c) && cell(r, c))
      .map((c) => `<div><dt>${esc(c.label)}</dt><dd>${linkify(cell(r, c))}</dd></div>`)
      .join("");
    return items ? `<div class="book-more"><dl class="book-meta">${items}</dl></div>` : "";
  };
  const titleAndByline = (r: string[]) =>
    `<h3 class="book-title">${esc(cell(r, titleCol))}</h3>` +
    (cell(r, bylineCol) ? `<span class="book-byline">${esc(cell(r, bylineCol))}</span>` : "");

  const status = (r: string[]) => cell(r, statusCol).toLowerCase();
  const now = statusCol ? books.filter((r) => status(r) === NOW) : [];
  const next = books.filter((r) => !statusCol || !status(r) || status(r) === NEXT);
  const others = new Map<string, string[][]>();
  for (const r of books) {
    if (now.includes(r) || next.includes(r)) continue;
    const label = cell(r, statusCol);
    others.set(label, [...(others.get(label) ?? []), r]);
  }

  const card = (r: string[]) =>
    [
      `          <li class="book book--now cart tone-${tone(r)}"${attrs(r)}>`,
      `            <details>`,
      `              <summary><span class="cart-head"><span class="book-type">${esc(cell(r, typeCol))}</span></span>` +
        `<span class="cart-body">${titleAndByline(r)}<span class="book-tags">${tags(r)}</span></span></summary>`,
      `              ${more(r, [typeCol, statusCol, ...tagCols])}`,
      `            </details>`,
      `          </li>`,
    ].join("\n");
  const row = (r: string[]) =>
    [
      `        <li class="book book--row tone-${tone(r)}"${attrs(r)}>`,
      `          <details>`,
      `            <summary><span class="book-main">${titleAndByline(r)}</span>` +
        `<span class="book-tags">${tags(r)}</span><span class="book-date">${esc(cell(r, sortCol))}</span></summary>`,
      `            ${more(r, [...tagCols, sortCol])}`,
      `          </details>`,
      `        </li>`,
    ].join("\n");

  const legend = types.length
    ? `<span class="reading-legend">${types.map((t, i) => `<span class="tone-${i % 4}"><i></i>${esc(t)}</span>`).join("")}</span>`
    : "";
  const meta = columns.map(({ key, label, kind }) => ({ key, label, kind }));
  return [
    START,
    `    <div class="reading" data-reading data-type="${typeCol?.key ?? ""}">`,
    `      <script type="application/json" class="reading-columns">${JSON.stringify(meta).replace(/</g, "\\u003c")}</script>`,
    ...(now.length
      ? [
          `      <section class="reading-now">`,
          `        <div class="reading-head"><h2>Now reading</h2><span class="reading-count">${now.length}</span></div>`,
          `        <ul class="now-list">`,
          ...now.map(card),
          `        </ul>`,
          `      </section>`,
        ]
      : []),
    `      <section class="reading-next">`,
    `        <div class="reading-head"><h2>${statusCol ? "Up next" : "All books"}</h2><span class="reading-count">${next.length}</span>${legend}</div>`,
    `        <ul class="book-list">`,
    ...next.map(row),
    `        </ul>`,
    `      </section>`,
    ...[...others].flatMap(([label, rs]) => [
      `      <section class="reading-other">`,
      `        <div class="reading-head"><h2>${esc(label)}</h2><span class="reading-count">${rs.length}</span></div>`,
      `        <ul class="book-list">`,
      ...rs.map(row),
      `        </ul>`,
      `      </section>`,
    ]),
    `    </div>`,
    `    ${END}`,
  ].join("\n");
}

const page = await Bun.file(PAGE).text();
const start = page.indexOf(START);
const end = page.indexOf(END);
if (start < 0 || end < start) throw new Error(`reading.html is missing the ${START} / ${END} markers`);
const next = page.slice(0, start) + render(await fetchRows()) + page.slice(end + END.length);
if (next === page) {
  console.log("Reading list unchanged");
} else {
  await Bun.write(PAGE, next);
  console.log("Reading list updated");
}
