import { useState, useRef } from "react"
import JsonTree from "./JsonTree"
import History from "./History"
import "./App.css"

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]
const AUTH_TYPES = ["None", "Bearer", "API Key", "Basic"]
const PROXY_BASE = "http://localhost:8000/proxy"

function buildProxyUrl(url) {
  const params = new URLSearchParams({ __url: url })
  return `${PROXY_BASE}?${params.toString()}`
}

function buildAuthHeader(authType, authValue, authKeyName) {
  if (!authValue) return {}
  if (authType === "Bearer") return { "Authorization": `Bearer ${authValue}` }
  if (authType === "Basic")  return { "Authorization": `Basic ${authValue}` }
  if (authType === "API Key") return { [authKeyName]: authValue }
  return {}
}

function JsonTable({ data }) {
  if (!Array.isArray(data) || data.length === 0) return null
  const cols = [...new Set(data.flatMap(row => typeof row === "object" && row ? Object.keys(row) : []))]
  if (cols.length === 0) return null
  return (
    <div className="table-wrap">
      <table className="json-table">
        <thead>
          <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {cols.map(c => {
                const val = row?.[c]
                return (
                  <td key={c}>
                    {val === null || val === undefined
                      ? <span className="t-null">null</span>
                      : typeof val === "boolean"
                      ? <span className={val ? "t-true" : "t-false"}>{String(val)}</span>
                      : typeof val === "object"
                      ? <span className="t-obj">{JSON.stringify(val).slice(0, 60)}{JSON.stringify(val).length > 60 ? "…" : ""}</span>
                      : <span>{String(val)}</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EndpointList({ endpoints, onSelect }) {
  const [filter, setFilter] = useState("")
  const methodColors = { GET: "m-get", POST: "m-post", PUT: "m-put", PATCH: "m-patch", DELETE: "m-delete" }
  const filtered = endpoints.filter(ep =>
    ep.path.toLowerCase().includes(filter.toLowerCase()) ||
    ep.method.toLowerCase().includes(filter.toLowerCase()) ||
    ep.summary.toLowerCase().includes(filter.toLowerCase())
  )
  return (
    <div className="endpoint-list">
      <div className="endpoint-header">
        <span className="endpoint-count">{endpoints.length} endpoints</span>
      </div>
      <input className="endpoint-filter" placeholder="Filter..." value={filter} onChange={e => setFilter(e.target.value)} />
      <div className="endpoint-scroll">
        {filtered.map((ep, i) => (
          <button key={i} className="endpoint-item" onClick={() => onSelect(ep)}>
            <span className={`ep-method ${methodColors[ep.method] || ""}`}>{ep.method}</span>
            <div className="ep-right">
              <span className="ep-path">{ep.path}</span>
              {ep.summary && <span className="ep-summary">{ep.summary}</span>}
            </div>
          </button>
        ))}
        {filtered.length === 0 && <p className="endpoint-empty">No match</p>}
      </div>
    </div>
  )
}

export default function App() {
  const [baseUrl, setBaseUrl] = useState("")
  const [url, setUrl] = useState("")
  const [method, setMethod] = useState("GET")
  const [authType, setAuthType] = useState("None")
  const [authValue, setAuthValue] = useState("")
  const [authKeyName, setAuthKeyName] = useState("X-API-Key")
  const [body, setBody] = useState("")
  const [headers, setHeaders] = useState([{ key: "", value: "" }])
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])
  const [activeTab, setActiveTab] = useState("body")
  const [responseView, setResponseView] = useState("tree")
  const [endpoints, setEndpoints] = useState(null)
  const [discoveryError, setDiscoveryError] = useState(null)

  const addHeader = () => setHeaders([...headers, { key: "", value: "" }])
  const removeHeader = (i) => setHeaders(headers.filter((_, idx) => idx !== i))
  const updateHeader = (i, field, val) => {
    const updated = [...headers]; updated[i][field] = val; setHeaders(updated)
  }

  const discover = async () => {
    if (!baseUrl) return
    setDiscovering(true); setDiscoveryError(null); setEndpoints(null)
    const base = baseUrl.replace(/\/$/, "")
    const candidates = [
      `${base}/openapi.json`,
      `${base}/swagger.json`,
      `${base}/api-docs`,
      `${base}/v1/openapi.json`,
      `${base}/v2/swagger.json`,
    ]
    let found = null
    for (const candidate of candidates) {
      try {
        const res = await fetch(buildProxyUrl(candidate), { headers: buildAuthHeader(authType, authValue, authKeyName) })
        const data = await res.json()
        if (data.status_code === 200 && data.body?.paths) { found = { url: candidate, spec: data.body }; break }
      } catch (_) {}
    }
    if (!found) {
      setDiscoveryError("No OpenAPI/Swagger spec found at /openapi.json, /swagger.json or /api-docs.")
      setDiscovering(false); return
    }
    const spec = found.spec
    const serverBase = spec.servers?.[0]?.url || base
    const parsed = []
    for (const [path, methods] of Object.entries(spec.paths || {})) {
      for (const [m, detail] of Object.entries(methods)) {
        if (!METHODS.includes(m.toUpperCase())) continue
        parsed.push({
          method: m.toUpperCase(), path,
          fullUrl: `${serverBase}${path}`,
          summary: detail.summary || "",
          parameters: detail.parameters || [],
          requestBody: detail.requestBody || null,
        })
      }
    }
    setEndpoints(parsed)
    setDiscovering(false)
  }

  const selectEndpoint = (ep) => {
    setUrl(ep.fullUrl); setMethod(ep.method); setActiveTab("body")
    if (ep.requestBody) {
      const schema = ep.requestBody?.content?.["application/json"]?.schema
      if (schema?.properties) {
        const example = {}
        Object.entries(schema.properties).forEach(([k, v]) => { example[k] = v.example ?? v.default ?? "" })
        setBody(JSON.stringify(example, null, 2))
      }
    } else { setBody("") }
  }

  const sendRequest = async () => {
    if (!url) return
    setLoading(true); setError(null); setResponse(null)
    try {
      const reqHeaders = {
        "Content-Type": "application/json",
        ...buildAuthHeader(authType, authValue, authKeyName),
      }
      headers.forEach(({ key, value }) => { if (key) reqHeaders[key] = value })
      const opts = { method, headers: reqHeaders }
      if (["POST", "PUT", "PATCH"].includes(method) && body) opts.body = body
      const res = await fetch(buildProxyUrl(url), opts)
      const data = await res.json()

      // Backend returned a 500 (invalid URL, connection error, etc.)
      if (!res.ok && data.detail) {
        setError(data.detail)
        setLoading(false)
        return
      }

      const safeBody = data.body ?? null
      setResponseView(Array.isArray(safeBody) ? "table" : "tree")
      const entry = { id: Date.now(), method, url, status: data.status_code, elapsed: data.elapsed_ms, timestamp: new Date().toLocaleTimeString(), response: { ...data, body: safeBody } }
      setResponse({ ...data, body: safeBody })
      setHistory(h => [entry, ...h].slice(0, 20))
    } catch (e) { setError("Could not reach the proxy. Is the FastAPI server running?") }
    finally { setLoading(false) }
  }

  const loadFromHistory = (entry) => { setUrl(entry.url); setMethod(entry.method); setResponse(entry.response) }
  const statusColor = (code) => !code ? "" : code < 300 ? "status-ok" : code < 400 ? "status-redirect" : code < 500 ? "status-client-err" : "status-server-err"
  const isTableable = Array.isArray(response?.body) && response.body.length > 0 && typeof response.body[0] === "object"

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-icon">⬡</span>
          <span className="logo-text">APIX</span>
        </div>

        <div className="discovery-panel">
          <p className="section-label">Auto-Discovery</p>
          <div className="discovery-row">
            <input
              className="discovery-input"
              placeholder="https://api.example.com"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && discover()}
            />
            <button className="discover-btn" onClick={discover} disabled={discovering || !baseUrl}>
              {discovering ? <span className="spinner-sm" /> : "↗"}
            </button>
          </div>
          {discoveryError && <p className="discovery-error">{discoveryError}</p>}
          {endpoints && <EndpointList endpoints={endpoints} onSelect={selectEndpoint} />}
        </div>

        <History items={history} onLoad={loadFromHistory} statusColor={statusColor} />
      </aside>

      <main className="main">
        <header className="top-bar">
          <h1 className="page-title">Visual API Explorer</h1>
          <span className="badge">FastAPI Proxy</span>
        </header>

        <section className="request-panel">
          <div className="url-row">
            <select className="method-select" value={method} onChange={e => setMethod(e.target.value)}>
              {METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
            <input
              className="url-input"
              placeholder="https://api.example.com/endpoint"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendRequest()}
            />
            <button className="send-btn" onClick={sendRequest} disabled={loading || !url}>
              {loading ? <span className="spinner" /> : "Send"}
            </button>
          </div>

          <div className="tabs">
            {["auth", "headers", "body"].map(t => (
              <button key={t} className={`tab ${activeTab === t ? "tab-active" : ""}`} onClick={() => setActiveTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="tab-content">
            {activeTab === "auth" && (
              <div className="auth-panel">
                <div className="field-row">
                  <label>Type</label>
                  <select value={authType} onChange={e => setAuthType(e.target.value)}>
                    {AUTH_TYPES.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
                {authType !== "None" && (
                  <>
                    {authType === "API Key" && (
                      <div className="field-row">
                        <label>Header name</label>
                        <input value={authKeyName} onChange={e => setAuthKeyName(e.target.value)} placeholder="X-API-Key" />
                      </div>
                    )}
                    <div className="field-row">
                      <label>{authType === "Bearer" ? "Token" : authType === "Basic" ? "Base64" : "Key"}</label>
                      <input type="password" value={authValue} onChange={e => setAuthValue(e.target.value)} placeholder={authType === "Bearer" ? "eyJ..." : "your-key"} />
                    </div>
                  </>
                )}
              </div>
            )}
            {activeTab === "headers" && (
              <div className="headers-panel">
                {headers.map((h, i) => (
                  <div key={i} className="header-row">
                    <input placeholder="Key" value={h.key} onChange={e => updateHeader(i, "key", e.target.value)} />
                    <input placeholder="Value" value={h.value} onChange={e => updateHeader(i, "value", e.target.value)} />
                    <button className="remove-btn" onClick={() => removeHeader(i)}>✕</button>
                  </div>
                ))}
                <button className="add-btn" onClick={addHeader}>+ Add header</button>
              </div>
            )}
            {activeTab === "body" && (
              <textarea
                className="body-textarea"
                placeholder='{"key": "value"}'
                value={body}
                onChange={e => setBody(e.target.value)}
                disabled={method === "GET" || method === "DELETE"}
              />
            )}
          </div>
        </section>

        {error && <div className="error-banner">Error: {error}</div>}

        {response && (
          <section className="response-panel">
            <div className="response-meta">
              <span className={`status-badge ${statusColor(response.status_code)}`}>{response.status_code}</span>
              <span className="meta-item">{response.elapsed_ms} ms</span>
              <span className="meta-item">{response.body != null ? JSON.stringify(response.body).length : 0} bytes</span>
              <span className="meta-url">{response.url}</span>
            </div>
            <div className="response-tabs">
              <button className={`tab ${responseView === "tree" ? "tab-active" : ""}`} onClick={() => setResponseView("tree")}>Tree</button>
              {isTableable && <button className={`tab ${responseView === "table" ? "tab-active" : ""}`} onClick={() => setResponseView("table")}>Table</button>}
              <button className={`tab ${responseView === "headers" ? "tab-active" : ""}`} onClick={() => setResponseView("headers")}>Headers</button>
            </div>
            <div className="response-body">
              {responseView === "headers" && (
                <div className="headers-table">
                  {Object.entries(response.headers || {}).map(([k, v]) => (
                    <div key={k} className="header-entry"><span className="hk">{k}</span><span className="hv">{v}</span></div>
                  ))}
                </div>
              )}
              {responseView === "tree" && <JsonTree data={response.body} />}
              {responseView === "table" && <JsonTable data={response.body} />}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}