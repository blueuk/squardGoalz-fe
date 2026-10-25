interface SoccerBallLoaderProps {
  visible?: boolean;
  message?: string;
}

export default function SoccerBallLoader({ visible = true, message = '잠시만 기다려주세요...' }: SoccerBallLoaderProps) {
  if (!visible) return null;

  return (
    <div className="loading-overlay">
      <div style={{ position: 'relative', width: '120px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="soccer-ball-loader">⚽</span>
      </div>
      <div style={{ 
        marginTop: '12px', 
        fontSize: '14px', 
        fontWeight: 'bold', 
        color: '#191f28',
        letterSpacing: '-0.3px',
        textAlign: 'center'
      }}>
        {message}
      </div>
    </div>
  );
}
