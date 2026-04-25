import { useState, useRef } from "react"
import JsonTree from "./JsonTree"
import History from "./History"
import "./App.css"

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]
const AUTH_TYPES = ["None", "Bearer", "API Key", "Basic"]
const PROXY_BASE = "http://localhost:8000/proxy"

export default function App() {
  const [url, setUrl] = useState("")
  const [method, setMethod] = useState("GET")
  const [authType, setAuthType] = useState("None")
  const [authValue, setAuthValue] = useState("")
  const [authKeyName, setAuthKeyName] = useState("X-API-Key")
  const [body, setBody] = useState("")
  const [headers, setHeaders] = useState([{ key: "", value: "" }])
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])
  const [activeTab, setActiveTab] = useState("body")
  const startTime = useRef(null)

  const addHeader = () => setHeaders([...headers, { key: "", value: "" }])
  const removeHeader = (i) => setHeaders(headers.filter((_, idx) => idx !== i))
  const updateHeader = (i, field, val) => {
    const updated = [...headers]
    updated[i][field] = val
    setHeaders(updated)
  }

  const buildProxyUrl = () => {
    const params = new URLSearchParams({ __url: url })
    if (authType === "Bearer" && authValue) {
      params.set("__auth", authValue)
      params.set("__auth_type", "Bearer")
    } else if (authType === "Basic" && authValue) {
      params.set("__auth", authValue)
      params.set("__auth_type", "Basic")
    }
    return `${PROXY_BASE}?${params.toString()}`
  }

  const sendRequest = async () => {
    if (!url) return
    setLoading(true)
    setError(null)
    setResponse(null)
    startTime.current = performance.now()

    try {
      const reqHeaders = { "Content-Type": "application/json" }
      headers.forEach(({ key, value }) => { if (key) reqHeaders[key] = value })
      if (authType === "API Key" && authValue) reqHeaders[authKeyName] = authValue

      const opts = {
        method,
        headers: reqHeaders,
      }
      if (["POST", "PUT", "PATCH"].includes(method) && body) {
        opts.body = body
      }

      const res = await fetch(buildProxyUrl(), opts)
      const data = await res.json()
      const elapsed = Math.round(performance.now() - startTime.current)

      const entry = {
        id: Date.now(),
        method,
        url,
        status: data.status_code,
        elapsed: data.elapsed_ms ?? elapsed,
        timestamp: new Date().toLocaleTimeString(),
        response: data,
      }
      setResponse(data)
      setHistory((h) => [entry, ...h].slice(0, 20))
      setActiveTab("body")
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const loadFromHistory = (entry) => {
    setUrl(entry.url)
    setMethod(entry.method)
    setResponse(entry.response)
  }

  const statusColor = (code) => {
    if (!code) return ""
    if (code < 300) return "status-ok"
    if (code < 400) return "status-redirect"
    if (code < 500) return "status-client-err"
    return "status-server-err"
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-icon">⬡</span>
          <span className="logo-text">APIX</span>
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
            <select className="method-select" value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
            <input
              className="url-input"
              placeholder="https://api.example.com/endpoint"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendRequest()}
            />
            <button className="send-btn" onClick={sendRequest} disabled={loading || !url}>
              {loading ? <span className="spinner" /> : "Send"}
            </button>
          </div>

          <div className="tabs">
            {["auth", "headers", "body"].map((t) => (
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
                  <select value={authType} onChange={(e) => setAuthType(e.target.value)}>
                    {AUTH_TYPES.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </div>
                {authType !== "None" && (
                  <>
                    {authType === "API Key" && (
                      <div className="field-row">
                        <label>Header name</label>
                        <input value={authKeyName} onChange={(e) => setAuthKeyName(e.target.value)} placeholder="X-API-Key" />
                      </div>
                    )}
                    <div className="field-row">
                      <label>{authType === "Basic" ? "Base64 credentials" : "Token / Key"}</label>
                      <input
                        type="password"
                        value={authValue}
                        onChange={(e) => setAuthValue(e.target.value)}
                        placeholder={authType === "Bearer" ? "eyJ..." : authType === "Basic" ? "dXNlcjpwYXNz" : "your-api-key"}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "headers" && (
              <div className="headers-panel">
                {headers.map((h, i) => (
                  <div key={i} className="header-row">
                    <input placeholder="Key" value={h.key} onChange={(e) => updateHeader(i, "key", e.target.value)} />
                    <input placeholder="Value" value={h.value} onChange={(e) => updateHeader(i, "value", e.target.value)} />
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
                onChange={(e) => setBody(e.target.value)}
                disabled={method === "GET" || method === "DELETE"}
              />
            )}
          </div>
        </section>

        {error && <div className="error-banner">Error: {error}</div>}

        {response && (
          <section className="response-panel">
            <div className="response-meta">
              <span className={`status-badge ${statusColor(response.status_code)}`}>
                {response.status_code}
              </span>
              <span className="meta-item">{response.elapsed_ms} ms</span>
              <span className="meta-item">
                {JSON.stringify(response.body).length} bytes
              </span>
              <span className="meta-url">{response.url}</span>
            </div>

            <div className="response-tabs">
              {["Response", "Headers"].map((t) => (
                <button
                  key={t}
                  className={`tab ${activeTab === t.toLowerCase() ? "tab-active" : ""}`}
                  onClick={() => setActiveTab(t.toLowerCase())}
                >{t}</button>
              ))}
            </div>

            <div className="response-body">
              {activeTab === "headers" ? (
                <div className="headers-table">
                  {Object.entries(response.headers || {}).map(([k, v]) => (
                    <div key={k} className="header-entry">
                      <span className="hk">{k}</span>
                      <span className="hv">{v}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <JsonTree data={response.body} />
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
