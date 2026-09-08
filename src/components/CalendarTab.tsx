import React, { useState, useEffect } from 'react';
import api from '../api';

interface CalendarTabProps {
  teamUid: string;
  members: any[]; // The rates list from App.tsx
  isAdmin?: boolean;
}

const CalendarTab: React.FC<CalendarTabProps> = ({ teamUid, members, isAdmin = false }) => {
  const getUpcomingSaturdayDate = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = (6 - day + 7) % 7;
    d.setDate(d.getDate() + diff);
    return d;
  };
  const [currentDate, setCurrentDate] = useState(getUpcomingSaturdayDate());
  const [schedules, setSchedules] = useState<any[]>([]);
  
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // Create schedule form
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createTime, setCreateTime] = useState('07:00');
  const [createLocationCd, setCreateLocationCd] = useState('01');
  const [createLocationCustom, setCreateLocationCustom] = useState('');
  const [locationOptions, setLocationOptions] = useState<any[]>([]);

  // Vote modal state
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [votes, setVotes] = useState<any[]>([]);

  const fetchLocations = async () => {
    try {
      const res = await api.get('/common_cd/search', { params: { group_cd: 'stadium_cd' } });
      if (Array.isArray(res.data)) {
        setLocationOptions(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch locations', e);
    }
  };

  const fetchSchedules = async (isInit = false) => {
    try {
      const res = await api.get('/schedule/search', { params: { team_uid: teamUid } });
      if (Array.isArray(res.data)) {
        setSchedules(res.data);
        if (isInit && res.data.length > 0) {
          const sorted = [...res.data].sort((a, b) => b.play_date.localeCompare(a.play_date));
          const latestSched = sorted[0];
          
          setSelectedDate(latestSched.play_date);
          setSelectedSchedule(latestSched);
          
          const y = parseInt(latestSched.play_date.substring(0, 4));
          const m = parseInt(latestSched.play_date.substring(4, 6)) - 1;
          const d = parseInt(latestSched.play_date.substring(6, 8));
          setCurrentDate(new Date(y, m, d));
          
          fetchVotesLocal(latestSched.vote_seq);
        }
      } else {
        setSchedules([]);
      }
    } catch (e) {
      setSchedules([]);
    }
  };

  const fetchVotesLocal = async (voteSeq: number) => {
    try {
      const res = await api.get('/vote/search', { params: { vote_seq: voteSeq, team_uid: teamUid } });
      if (Array.isArray(res.data)) {
        const sorted = res.data.sort((a, b) => {
          const nameA = getMemberName(a.member_uid);
          const nameB = getMemberName(b.member_uid);
          return nameA.localeCompare(nameB, 'ko-KR');
        });
        setVotes(sorted);
      } else {
        setVotes([]);
      }
    } catch (e) {
      setVotes([]);
    }
  };

  useEffect(() => {
    fetchSchedules(true);
    fetchLocations();
  }, [teamUid]);
  
  useEffect(() => {
    fetchSchedules(false);
  }, [currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const days = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const formatYYYYMMDD = (y: number, m: number, d: number) => {
    return `${y}${String(m + 1).padStart(2, '0')}${String(d).padStart(2, '0')}`;
  };

  const handleDateClick = async (d: number) => {
    const dateStr = formatYYYYMMDD(year, month, d);
    setSelectedDate(dateStr);
    setIsEditMode(false);
    setSelectedMembers([]);
    
    const schedule = schedules.find(s => s.play_date === dateStr);
    if (schedule) {
      // Show vote panel
      setSelectedSchedule(schedule);
      fetchVotesLocal(schedule.vote_seq);
    } else {
      // Show create panel
      setSelectedSchedule(null);
      setVotes([]);
    }
  };

  const getMemberName = (uid: string) => {
    const m = members.find(m => m.member_uid === uid);
    return m ? m.member_name : uid;
  };



  const handleCreateSchedule = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    let finalLocation = '';
    if (createLocationCd === 'custom') {
      finalLocation = createLocationCustom;
    } else {
      const found = locationOptions.find(opt => opt.code === createLocationCd);
      finalLocation = found ? found.code_name : '';
    }

    try {
      await api.post('/schedule/insert', {
        team_uid: teamUid,
        play_date: selectedDate,
        play_start_time: createTime,
        play_end_time: '',
        play_location: finalLocation,
        vote_period_from: '',
        vote_period_to: '',
        vote_end_yn: 'N'
      });
      alert('일정이 등록되었습니다. (팀원 모두 미투표 상태로 등록됨)');
      setCreateTime('07:00');
      setCreateLocationCd('01');
      setCreateLocationCustom('');
      await fetchSchedules();
      
      // Auto select the newly created schedule
      const res = await api.get('/schedule/search', { params: { team_uid: teamUid } });
      if (Array.isArray(res.data)) {
        const newSchedule = res.data.find(s => s.play_date === selectedDate);
        if (newSchedule) {
          setSelectedSchedule(newSchedule);
          fetchVotesLocal(newSchedule.vote_seq);
        }
      }
    } catch (e) {
      alert('일정 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelMatch = async () => {
    if (!window.confirm("정말 경기를 취소하시겠습니까?\\n모든 참여자의 투표가 '미진행'으로 변경됩니다.")) return;
    try {
      await Promise.all(votes.map(v => 
        api.post('/vote/update', {
          vote_seq: selectedSchedule.vote_seq,
          team_uid: teamUid,
          member_uid: v.member_uid,
          vote_cd: '04'
        })
      ));
      setSelectedMembers([]);
      fetchVotesLocal(selectedSchedule.vote_seq);
      alert('경기가 취소 처리되었습니다.');
    } catch (e) {
      alert('상태 변경에 실패했습니다.');
    }
  };

  const handleBulkVoteChange = async (targetVoteCd: string) => {
    if (selectedMembers.length === 0) return;
    try {
      await Promise.all(selectedMembers.map(uid => 
        api.post('/vote/update', {
          vote_seq: selectedSchedule.vote_seq,
          team_uid: teamUid,
          member_uid: uid,
          vote_cd: targetVoteCd
        })
      ));
      setSelectedMembers([]);
      fetchVotesLocal(selectedSchedule.vote_seq);
    } catch (e) {
      alert('투표 상태 변경에 실패했습니다.');
    }
  };

  const renderMemberChips = (voteList: any[]) => {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
        {voteList.map((v, i) => {
          const m = members.find(m => m.member_uid === v.member_uid);
          if (!m) return null;
          const name = m.member_name;
          
          let dotColor = '#2ecc71'; // 기본: 활동 (초록)
          if (m.status_cd === '02') dotColor = '#f1c40f'; // 부상 (노랑)
          else if (m.status_cd === '03') dotColor = '#e74c3c'; // 휴식 (빨강)
          
          const isSelected = selectedMembers.includes(v.member_uid);
          
          return (
            <div 
              key={i} 
              onClick={() => {
                if (!isEditMode) return;
                if (isSelected) {
                  setSelectedMembers(prev => prev.filter(uid => uid !== v.member_uid));
                } else {
                  setSelectedMembers(prev => [...prev, v.member_uid]);
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px',
                backgroundColor: isSelected ? 'var(--toss-light-blue)' : '#f2f4f6',
                borderRadius: '20px',
                fontSize: 'calc(13px * var(--scale-factor, 1))',
                color: isSelected ? 'var(--toss-blue)' : '#333',
                boxShadow: isSelected ? '0 0 0 2px var(--toss-blue)' : '0 1px 2px rgba(0,0,0,0.05)',
                cursor: isEditMode ? 'pointer' : 'default',
                transition: 'all 0.2s'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: dotColor }}></span>
              {name}
            </div>
          );
        })}
      </div>
    );
  };

  const renderBottomPanel = () => {
    if (!selectedDate) return null;

    const today = new Date();
    const todayStr = formatYYYYMMDD(today.getFullYear(), today.getMonth(), today.getDate());
    const isPastDate = isAdmin ? false : selectedDate < todayStr;

    if (selectedSchedule) {
      // Vote Panel
      const attend = votes.filter(v => v.vote_cd === '02');
      const absent = votes.filter(v => v.vote_cd === '03');
      const noVote = votes.filter(v => v.vote_cd === '01');
      const canceled = votes.filter(v => v.vote_cd === '04');

      return (
        <div className="card" style={{ marginTop: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              <h3 style={{ margin: '0 0 5px 0' }}>{selectedDate} 투표 현황</h3>
              <p style={{ color: '#191f28', fontSize: 'calc(15px * var(--scale-factor, 1))', fontWeight: 'bold', margin: '0' }}>
                시간: {selectedSchedule.play_start_time || '미정'} &nbsp;|&nbsp; 장소: {selectedSchedule.play_location || '미정'}
              </p>
            </div>
            {!isPastDate && (
              <button 
                onClick={() => {
                  setIsEditMode(!isEditMode);
                  if (isEditMode) setSelectedMembers([]); // Clear on exit
                }}
                style={{ padding: '6px 12px', backgroundColor: isEditMode ? '#333' : '#f2f4f6', color: isEditMode ? '#fff' : '#333', border: 'none', borderRadius: '6px', fontSize: 'calc(13px * var(--scale-factor, 1))', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {isEditMode ? '취소' : '수정'}
              </button>
            )}
          </div>
          
          {isEditMode && (
            <p style={{ fontSize: 'calc(12px * var(--scale-factor, 1))', color: 'var(--toss-blue)', margin: '5px 0 0 0' }}>변경할 팀원을 선택한 후 아래의 상태 버튼을 눌러주세요.</p>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
            <div>
              <div style={{ fontSize: 'calc(14px * var(--scale-factor, 1))', fontWeight: 'bold', color: 'var(--toss-blue)' }}>참석 ({attend.length}명)</div>
              {attend.length > 0 ? renderMemberChips(attend) : <div style={{ fontSize: 'calc(13px * var(--scale-factor, 1))', color: '#888', marginTop: '8px' }}>없음</div>}
            </div>
            <div>
              <div style={{ fontSize: 'calc(14px * var(--scale-factor, 1))', fontWeight: 'bold', color: 'var(--toss-red)' }}>불참 ({absent.length}명)</div>
              {absent.length > 0 ? renderMemberChips(absent) : <div style={{ fontSize: 'calc(13px * var(--scale-factor, 1))', color: '#888', marginTop: '8px' }}>없음</div>}
            </div>
            <div>
              <div style={{ fontSize: 'calc(14px * var(--scale-factor, 1))', fontWeight: 'bold', color: 'var(--toss-gray)' }}>미투표 ({noVote.length}명)</div>
              {noVote.length > 0 ? renderMemberChips(noVote) : <div style={{ fontSize: 'calc(13px * var(--scale-factor, 1))', color: '#888', marginTop: '8px' }}>없음</div>}
            </div>
            {canceled.length > 0 && (
              <div>
                <div style={{ fontSize: 'calc(14px * var(--scale-factor, 1))', fontWeight: 'bold', color: '#191f28' }}>경기취소(미진행) ({canceled.length}명)</div>
                {renderMemberChips(canceled)}
              </div>
            )}
          </div>

          {isEditMode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleBulkVoteChange('02')} style={{ flex: 1, padding: '10px', backgroundColor: 'var(--toss-blue)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: 'calc(13px * var(--scale-factor, 1))', fontWeight: 'bold' }}>참석</button>
                <button onClick={() => handleBulkVoteChange('03')} style={{ flex: 1, padding: '10px', backgroundColor: 'var(--toss-red)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: 'calc(13px * var(--scale-factor, 1))', fontWeight: 'bold' }}>불참</button>
                <button onClick={() => handleBulkVoteChange('01')} style={{ flex: 1, padding: '10px', backgroundColor: 'var(--toss-gray)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: 'calc(13px * var(--scale-factor, 1))', fontWeight: 'bold' }}>미투표</button>
              </div>
              <button onClick={handleCancelMatch} style={{ width: '100%', padding: '10px', backgroundColor: '#191f28', color: '#fff', border: 'none', borderRadius: '8px', fontSize: 'calc(13px * var(--scale-factor, 1))', fontWeight: 'bold' }}>경기취소</button>
            </div>
          )}
        </div>
      );
    } else {
      // Create Schedule Panel
      return (
        <div className="card" style={{ marginTop: '15px' }}>
          <h3 style={{ marginTop: 0 }}>일정 등록 ({selectedDate})</h3>
          
          {isPastDate ? (
            <p style={{ color: '#e74c3c', fontSize: 'calc(14px * var(--scale-factor, 1))', marginBottom: '15px', fontWeight: 'bold' }}>
              과거의 날짜에는 새로운 일정을 등록할 수 없습니다.
            </p>
          ) : (
            <>
              <p style={{ color: '#888', fontSize: 'calc(13px * var(--scale-factor, 1))', marginBottom: '15px' }}>이 날짜에는 아직 일정이 없습니다.</p>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: 'calc(12px * var(--scale-factor, 1))', color: '#666', marginBottom: '5px' }}>시간</label>
                <select 
                  value={createTime} 
                  onChange={(e) => setCreateTime(e.target.value)} 
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box', backgroundColor: '#fff' }}
                >
                  {Array.from({ length: 24 }).map((_, i) => {
                    const t = `${String(i).padStart(2, '0')}:00`;
                    return <option key={t} value={t}>{t}</option>;
                  })}
                </select>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: 'calc(12px * var(--scale-factor, 1))', color: '#666', marginBottom: '5px' }}>장소</label>
                <select 
                  value={createLocationCd} 
                  onChange={(e) => setCreateLocationCd(e.target.value)} 
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box', backgroundColor: '#fff', marginBottom: createLocationCd === 'custom' ? '10px' : '0' }}
                >
                  {locationOptions.map(opt => (
                    <option key={opt.code} value={opt.code}>{opt.code_name}</option>
                  ))}
                  <option value="custom">기타 (직접 입력)</option>
                </select>
                {createLocationCd === 'custom' && (
                  <input 
                    type="text" 
                    value={createLocationCustom} 
                    onChange={(e) => setCreateLocationCustom(e.target.value)} 
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} 
                    placeholder="장소를 입력해주세요"
                  />
                )}
              </div>
              <button 
                onClick={handleCreateSchedule}
                disabled={isSubmitting}
                style={{ width: '100%', padding: '12px', backgroundColor: isSubmitting ? '#ccc' : 'var(--toss-blue)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
              >
                {isSubmitting ? '생성 중...' : '일정 생성하기'}
              </button>
            </>
          )}
        </div>
      );
    }
  };

  return (
    <div className="section" style={{ display: 'block' }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <button onClick={handlePrevMonth} style={{ background: 'none', border: 'none', fontSize: 'calc(18px * var(--scale-factor, 1))', cursor: 'pointer' }}>&lt;</button>
          <span style={{ fontWeight: 'bold', fontSize: 'calc(16px * var(--scale-factor, 1))' }}>{year}년 {month + 1}월</span>
          <button onClick={handleNextMonth} style={{ background: 'none', border: 'none', fontSize: 'calc(18px * var(--scale-factor, 1))', cursor: 'pointer' }}>&gt;</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', textAlign: 'center' }}>
          {['일', '월', '화', '수', '목', '금', '토'].map(day => (
            <div key={day} style={{ fontWeight: 'bold', fontSize: 'calc(12px * var(--scale-factor, 1))', color: '#888', paddingBottom: '10px', minWidth: 0, overflow: 'hidden' }}>{day}</div>
          ))}
          
          {days.map((day, idx) => {
            if (day === null) return <div key={idx} />;
            
            const dateStr = formatYYYYMMDD(year, month, day);
            const hasSchedule = schedules.some(s => s.play_date === dateStr);
            const isSelected = selectedDate === dateStr;
            
            return (
              <div 
                key={idx} 
                onClick={() => handleDateClick(day)}
                style={{ 
                  aspectRatio: '2 / 1', minWidth: 0, display: 'flex', flexDirection: 'column', 
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isSelected ? 'var(--toss-blue)' : (hasSchedule ? 'var(--toss-light-blue)' : '#fff'), 
                  color: isSelected ? '#fff' : (hasSchedule ? 'var(--toss-blue)' : '#333'),
                  borderRadius: '6px', cursor: 'pointer',
                  border: hasSchedule && !isSelected ? '1px solid var(--toss-blue)' : '1px solid #f2f4f6',
                  position: 'relative'
                }}
              >
                <span style={{ fontSize: 'calc(14px * var(--scale-factor, 1))', fontWeight: hasSchedule || isSelected ? 'bold' : 'normal' }}>{day}</span>
              </div>
            );
          })}
        </div>
      </div>

      {renderBottomPanel()}
    </div>
  );
};

export default CalendarTab;
