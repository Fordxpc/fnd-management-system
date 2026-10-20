function OpsBoardPage() {
  return (
    <div className="page-content" style={{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>📋 Daily Operations Board</h2>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Runway Inspections & Ground Task Allocation</p>
        </div>
        <a 
          href="https://fnd-operations.pages.dev/" 
          target="_blank" 
          rel="noreferrer"
          style={{ fontSize: '12px', color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}
        >
          Open in new tab ↗
        </a>
      </div>
      
      {/* The embedded standalone app */}
      <iframe 
        src="https://fnd-operations.pages.dev/" 
        title="Daily Operations Board"
        style={{ 
          flex: 1, 
          width: '100%', 
          border: 'none', 
          borderRadius: '0 0 8px 8px',
          minHeight: 'calc(100vh - 160px)'
        }} 
      />
    </div>
  );
}

export default OpsBoardPage;