"use client"

import { useState } from "react"

type JsonNodeProps = {
  data: unknown
  depth?: number
  keyName?: string | number | null
}

function JsonNode({ data, depth = 0, keyName = null }: JsonNodeProps) {
  const [collapsed, setCollapsed] = useState(depth > 2)

  if (data === null) return <span className="jn-null">null</span>
  if (typeof data === "boolean") return <span className="jn-bool">{String(data)}</span>
  if (typeof data === "number") return <span className="jn-num">{data}</span>
  if (typeof data === "string") return <span className="jn-str">"{data}"</span>

  const isArray = Array.isArray(data)
  const entries: [string | number, unknown][] = isArray
    ? (data as unknown[]).map((v, i) => [i, v])
    : Object.entries(data as Record<string, unknown>)
  const count = entries.length
  const open = isArray ? "[" : "{"
  const close = isArray ? "]" : "}"

  if (count === 0) {
    return (
      <span className="jn-empty">
        {keyName !== null && (
          <>
            <span className="jn-key">"{keyName}"</span>
            <span className="jn-colon">: </span>
          </>
        )}
        {open}{close}
      </span>
    )
  }

  return (
    <div className="jn-block" style={{ marginLeft: depth > 0 ? depth * 16 : 0 }}>
      <span className="jn-toggle" onClick={() => setCollapsed(!collapsed)}>
        <span className="jn-arrow">{collapsed ? "▶" : "▼"}</span>
        {keyName !== null && (
          <>
            <span className="jn-key">"{keyName}"</span>
            <span className="jn-colon">: </span>
          </>
        )}
        <span className="jn-bracket">{open}</span>
        {collapsed && (
          <span className="jn-summary">
            {count} {isArray ? "items" : "keys"}
            <span className="jn-bracket"> {close}</span>
          </span>
        )}
      </span>

      {!collapsed && (
        <div className="jn-children">
          {entries.map(([k, v], i) => (
            <div key={String(k)} className="jn-entry">
              {typeof v === "object" && v !== null ? (
                <JsonNode data={v} depth={depth + 1} keyName={isArray ? null : k} />
              ) : (
                <span>
                  {!isArray && (
                    <>
                      <span className="jn-key">"{k}"</span>
                      <span className="jn-colon">: </span>
                    </>
                  )}
                  <JsonNode data={v} depth={depth + 1} />
                </span>
              )}
              {i < entries.length - 1 && <span className="jn-comma">,</span>}
            </div>
          ))}
          <div className="jn-close">
            <span className="jn-bracket">{close}</span>
          </div>
        </div>
      )}
    </div>
  )
}

type JsonTreeProps = {
  data: unknown
}

export default function JsonTree({ data }: JsonTreeProps) {
  if (typeof data === "string") {
    return <pre className="json-raw">{data}</pre>
  }
  return (
    <div className="json-tree">
      <JsonNode data={data} depth={0} />
    </div>
  )
}
