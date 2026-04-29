"use client"

export type HistoryEntry = {
  id: number
  method: string
  url: string
  status: number
  elapsed: number
  timestamp: string
  response: ApiResponse
}

export type ApiResponse = {
  status_code: number
  elapsed_ms: number
  url: string
  headers: Record<string, string>
  body: unknown
}

type Props = {
  items: HistoryEntry[]
  onLoad: (entry: HistoryEntry) => void
  statusColor: (code: number) => string
}

export default function History({ items, onLoad, statusColor }: Props) {
  if (items.length === 0) {
    return (
      <div className="history-empty">
        <span>No requests yet</span>
      </div>
    )
  }

  return (
    <div className="history">
      <p className="history-label">History</p>
      {items.map((entry) => (
        <button key={entry.id} className="history-item" onClick={() => onLoad(entry)}>
          <div className="hi-top">
            <span className="hi-method">{entry.method}</span>
            <span className={`hi-status ${statusColor(entry.status)}`}>{entry.status}</span>
          </div>
          <div className="hi-url">{entry.url.replace(/^https?:\/\//, "")}</div>
          <div className="hi-meta">{entry.timestamp} · {entry.elapsed}ms</div>
        </button>
      ))}
    </div>
  )
}
