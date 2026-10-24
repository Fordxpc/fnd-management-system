import React from 'react';

interface FlightRadarWidgetProps {
  flightNumber: string;
}

const FlightRadarWidget: React.FC<FlightRadarWidgetProps> = ({ flightNumber }) => {
  if (!flightNumber) return null;
  // Clean the flight number (remove spaces or hyphens if needed)
  const cleanFlightNo = flightNumber.replace(/[^a-zA-Z0-9]/g, '');
  const src = `https://www.flightradar24.com/simple_index.php?flight=${cleanFlightNo}`;

  return (
    <div className="dash-card" style={{ marginTop: '20px', padding: '16px' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>📡 Live Flight Tracking</h3>
      <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <iframe
          src={src}
          width="100%"
          height="400"
          style={{ border: 'none' }}
          title={`FlightRadar24 tracking for ${flightNumber}`}
        />
      </div>
    </div>
  );
};

export default FlightRadarWidget;