export default function History({ items, onLoad, statusColor }) {
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
