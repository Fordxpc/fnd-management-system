import React, { useEffect, useState } from 'react';

interface FlightRadarWidgetProps {
  flightNumber: string;
}

const FlightRadarWidget: React.FC<FlightRadarWidgetProps> = ({ flightNumber }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Aggressive mobile check (width < 1024 or touch device)
    const checkMobile = () => {
      const isSmallScreen = window.innerWidth < 1024;
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(isSmallScreen || isTouch);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!flightNumber) return null;
  
  const cleanFlightNo = flightNumber.replace(/[^a-zA-Z0-9]/g, '');
  const src = `https://www.flightradar24.com/simple_index.php?flight=${cleanFlightNo}`;
  const trackUrl = `https://www.flightradar24.com/${cleanFlightNo}`;

  return (
    <div className="dash-card" style={{ marginTop: '20px', padding: '16px' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>📡 Live Flight Tracking</h3>
      
      {isMobile ? (
        <div style={{ 
          background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)', 
          borderRadius: '8px', padding: '24px', textAlign: 'center', color: 'white',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px'
        }}>
          <div style={{ fontSize: '40px' }}>✈️</div>
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: '20px' }}>{flightNumber}</h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#93c5fd' }}>
              Live map tracking is only available on desktop. Click below to track this flight on your FlightRadar24 app.
            </p>
          </div>
          <a 
            href={trackUrl} target="_blank" rel="noreferrer"
            style={{ 
              background: '#2563eb', color: 'white', padding: '12px 24px', borderRadius: '6px', 
              textDecoration: 'none', fontWeight: 600, display: 'inline-block', width: '100%', maxWidth: '300px'
            }}
          >
            Track on FlightRadar24
          </a>
        </div>
      ) : (
        <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <iframe
            src={src}
            width="100%"
            height="400"
            style={{ border: 'none' }}
            title={`FlightRadar24 tracking for ${flightNumber}`}
          />
        </div>
      )}
    </div>
  );
};

export default FlightRadarWidget;