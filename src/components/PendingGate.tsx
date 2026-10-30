import type { ReactNode } from 'react';
import { usePermission } from '../permissions';
import teamLogo from '../img/teamlogo.png';

// 가입했지만 아직 선수 명단에 연결되지 않은 회원은 관리자 승인 전까지 앱을 사용할 수 없음
export default function PendingGate({ onLogout, children }: { onLogout: () => void; children: ReactNode }) {
  const { approved, loaded } = usePermission();
  if (!loaded || approved) return <>{children}</>;

  return (
    <div className="register-page">
      <div className="register-card" style={{ textAlign: 'center' }}>
        <img src={teamLogo} alt="풋고추FC" style={{ width: '140px', height: 'auto', marginBottom: '12px' }} />
        <h2 className="register-title">⏳ 가입 승인 대기 중</h2>
        <p className="register-desc" style={{ marginBottom: '20px' }}>
          관리자가 선수 명단에 등록하면 이용할 수 있습니다.<br />승인 후 다시 접속해주세요.
        </p>
        <button className="register-submit" style={{ background: '#f2f4f6', color: '#4e5968' }} onClick={onLogout}>
          로그아웃
        </button>
      </div>
    </div>
  );
}
