export const FILTER_FIELDS = ["platform", "model", "build", "revision", "bucket", "evidence"];
export const SORT_FIELDS = ["model", "platform", "build"];
export function checkedQuery(query) {
  const allowed = new Set([...FILTER_FIELDS, "sort", "order", "limit", "cursor"]);
  if (Object.keys(query).some(key => !allowed.has(key))) throw new Error("Unsupported query field");
  if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100 || !SORT_FIELDS.includes(query.sort) || !["asc", "desc"].includes(query.order)) throw new Error("Invalid query");
  if (query.cursor !== null && (typeof query.cursor !== "string" || query.cursor.length > 512)) throw new Error("Invalid cursor");
  if (FILTER_FIELDS.some(field => typeof query[field] !== "string" || query[field].length > 160)) throw new Error("Invalid filter");
  return query;
}
export async function loadExamples(query, fetcher = fetch) {
  checkedQuery(query);
  if (query.cursor !== null) throw new Error("Example cursor unavailable");
  const response = await fetcher("/tests/fixtures/horde-benchmark-example.json", {cache:"no-store"});
  if (!response.ok) throw new Error("Examples unavailable");
  const body = await response.json();
  if (body.schemaVersion !== 1 || body.synthetic !== true || !Array.isArray(body.rows) || body.rows.length > 100) throw new Error("Invalid example data");
  return body.rows;
}
export function selectExamples(rows, query) {
  checkedQuery(query);
  const ordered = rows.filter(row => FILTER_FIELDS.every(field => !query[field] || row[field] === query[field])).sort((a,b) => String(a[query.sort] || "").localeCompare(String(b[query.sort] || "")) * (query.order === "desc" ? -1 : 1));
  const selected=ordered.slice(0,query.limit), groups=new Map();
  for (const row of selected) {
    // Every local fixture is provisional and shown separately; a future service must define validated comparison buckets.
    const key = `example:${row.key}`;
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row);
  }
  return {selected, groups:[...groups.values()], nextCursor:null};
}
