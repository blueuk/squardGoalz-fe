import React, { useState, useEffect } from 'react';
import api from '../api';
import SoccerBallLoader from './SoccerBallLoader';
import './CalendarTab.css';

// Module-level cache for common options
let cachedLocationOptions: any[] | null = null;
let cachedStatusOptions: any[] | null = null;

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
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  // Edit schedule state (time & location)
  const [editTime, setEditTime] = useState('07:00');
  const [editLocationCd, setEditLocationCd] = useState('01');
  const [editLocationCustom, setEditLocationCustom] = useState('');
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);

  // Bulk reset & schedule delete modal states
  const [showResetVoteModal, setShowResetVoteModal] = useState(false);
  const [isResettingVotes, setIsResettingVotes] = useState(false);
  const [showDeleteScheduleModal, setShowDeleteScheduleModal] = useState(false);
  const [isDeletingSchedule, setIsDeletingSchedule] = useState(false);
  const [statusOptions, setStatusOptions] = useState<any[]>([]);

  // Global loading state for CalendarTab
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('일정 정보를 불러오는 중...');

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

  const fetchSchedules = async () => {
    try {
      const res = await api.get('/schedule/search', { params: { team_uid: teamUid } });
      if (Array.isArray(res.data)) {
        setSchedules(res.data);
      } else {
        setSchedules([]);
      }
    } catch (e) {
      setSchedules([]);
    }
  };

  // ── Initial Data Load with Promise.all and Loader ───────────────────────
  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      setIsLoading(true);
      setLoadingMessage('일정 정보를 불러오는 중...');
      try {
        const [schedRes, locRes, statusRes] = await Promise.all([
          api.get('/schedule/search', { params: { team_uid: teamUid } }),
          cachedLocationOptions ? Promise.resolve(null) : api.get('/common_cd/search', { params: { group_cd: 'stadium_cd' } }),
          cachedStatusOptions ? Promise.resolve(null) : api.get('/common_cd/search', { params: { group_cd: 'status_cd' } })
        ]);

        if (!isMounted) return;

        if (locRes?.data && Array.isArray(locRes.data)) {
          cachedLocationOptions = locRes.data;
          setLocationOptions(locRes.data);
        } else if (cachedLocationOptions) {
          setLocationOptions(cachedLocationOptions);
        }

        if (statusRes?.data && Array.isArray(statusRes.data)) {
          cachedStatusOptions = statusRes.data;
          setStatusOptions(statusRes.data);
        } else if (cachedStatusOptions) {
          setStatusOptions(cachedStatusOptions);
        }

        if (schedRes?.data && Array.isArray(schedRes.data)) {
          setSchedules(schedRes.data);
          if (schedRes.data.length > 0) {
            const sorted = [...schedRes.data].sort((a, b) => b.play_date.localeCompare(a.play_date));
            const latestSched = sorted[0];

            setSelectedDate(latestSched.play_date);
            setSelectedSchedule(latestSched);

            const y = parseInt(latestSched.play_date.substring(0, 4));
            const m = parseInt(latestSched.play_date.substring(4, 6)) - 1;
            const d = parseInt(latestSched.play_date.substring(6, 8));
            setCurrentDate(new Date(y, m, d));

            await fetchVotesLocal(latestSched.vote_seq);
          }
        } else {
          setSchedules([]);
        }
      } catch (e) {
        console.error('Failed to load schedule data', e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadInitialData();
    return () => { isMounted = false; };
  }, [teamUid]);

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

  const syncEditScheduleFields = (sched: any) => {
    if (!sched) return;
    setEditTime(sched.play_start_time || '07:00');
    const matched = locationOptions.find(opt => opt.code_name === sched.play_location);
    if (matched) {
      setEditLocationCd(matched.code);
      setEditLocationCustom('');
    } else if (sched.play_location) {
      setEditLocationCd('custom');
      setEditLocationCustom(sched.play_location);
    } else {
      setEditLocationCd(locationOptions[0]?.code || '01');
      setEditLocationCustom('');
    }
  };

  const formatDateOnly = (dateStr: string) => {
    if (!dateStr) return '';
    const cleanDate = dateStr.replace(/-/g, '');
    if (cleanDate.length === 8) {
      const yyyy = cleanDate.substring(0, 4);
      const mm = cleanDate.substring(4, 6);
      const dd = cleanDate.substring(6, 8);
      return `${yyyy}년 ${mm}월 ${dd}일`;
    }
    return dateStr;
  };

  // 날짜·시간 / 장소를 따로 렌더링해 좁은 화면에서 자연스럽게 줄바꿈되도록 함
  const formatScheduleHeader = () => {
    if (!selectedDate) return null;
    const dateFormatted = formatDateOnly(selectedDate);
    const timeStr = selectedSchedule?.play_start_time || '미정';
    const locStr = selectedSchedule?.play_location || '미정';
    return (
      <>
        <span>{dateFormatted} {timeStr}</span>
        <span>장소: {locStr}</span>
      </>
    );
  };

  const handleToggleEditMode = async () => {
    if (isEditMode) {
      if (isUpdatingSchedule) return;
      setIsUpdatingSchedule(true);

      let finalLocation = '';
      if (editLocationCd === 'custom') {
        finalLocation = editLocationCustom.trim();
      } else {
        const found = locationOptions.find(opt => opt.code === editLocationCd);
        finalLocation = found ? found.code_name : '';
      }

      if (
        selectedSchedule &&
        (finalLocation !== (selectedSchedule.play_location || '') ||
          editTime !== (selectedSchedule.play_start_time || ''))
      ) {
        try {
          await api.post('/schedule/update', {
            vote_seq: selectedSchedule.vote_seq,
            team_uid: teamUid,
            play_start_time: editTime,
            play_location: finalLocation
          });

          const updatedSchedule = {
            ...selectedSchedule,
            play_start_time: editTime,
            play_location: finalLocation
          };
          setSelectedSchedule(updatedSchedule);
          setSchedules(prev =>
            prev.map(s => (s.vote_seq === selectedSchedule.vote_seq ? updatedSchedule : s))
          );
        } catch (e) {
          console.error(e);
          alert('일정 정보(시간/장소) 수정에 실패했습니다.');
        }
      }

      setSelectedMembers([]);
      setIsEditMode(false);
      setIsUpdatingSchedule(false);
    } else {
      if (selectedSchedule) {
        syncEditScheduleFields(selectedSchedule);
      }
      setIsEditMode(true);
    }
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
      syncEditScheduleFields(schedule);
      setIsLoading(true);
      setLoadingMessage('투표 현황을 불러오는 중...');
      try {
        await fetchVotesLocal(schedule.vote_seq);
      } finally {
        setIsLoading(false);
      }
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
    setIsLoading(true);
    setLoadingMessage('새 일정을 등록하는 중...');
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
      setIsLoading(false);
    }
  };

  const handleCancelMatch = () => {
    setShowCancelModal(true);
  };

  const handleConfirmCancelMatch = async () => {
    if (isCanceling) return;
    setIsCanceling(true);
    setIsLoading(true);
    setLoadingMessage('경기를 취소 처리하는 중...');
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
      setShowCancelModal(false);
      alert('경기가 취소 처리되었습니다.');
    } catch (e) {
      alert('상태 변경에 실패했습니다.');
    } finally {
      setIsCanceling(false);
      setIsLoading(false);
    }
  };

  const handleConfirmResetVotes = async () => {
    if (isResettingVotes || !selectedSchedule) return;
    setIsResettingVotes(true);
    setIsLoading(true);
    setLoadingMessage('투표를 초기화하는 중...');
    try {
      await Promise.all(votes.map(v => 
        api.post('/vote/update', {
          vote_seq: selectedSchedule.vote_seq,
          team_uid: teamUid,
          member_uid: v.member_uid,
          vote_cd: '01'
        })
      ));
      setSelectedMembers([]);
      fetchVotesLocal(selectedSchedule.vote_seq);
      setShowResetVoteModal(false);
      alert('모든 팀원의 투표 상태가 미투표로 일괄 초기화되었습니다.');
    } catch (e) {
      console.error(e);
      alert('투표 초기화에 실패했습니다.');
    } finally {
      setIsResettingVotes(false);
      setIsLoading(false);
    }
  };

  const handleConfirmDeleteSchedule = async () => {
    if (isDeletingSchedule || !selectedSchedule) return;
    setIsDeletingSchedule(true);
    setIsLoading(true);
    setLoadingMessage('일정을 삭제하는 중...');
    try {
      await api.post('/schedule/delete', {
        vote_seq: selectedSchedule.vote_seq,
        team_uid: teamUid
      });
      setShowDeleteScheduleModal(false);
      setSelectedSchedule(null);
      setVotes([]);
      setIsEditMode(false);
      await fetchSchedules();
      alert('일정이 삭제되었습니다.');
    } catch (e) {
      console.error(e);
      alert('일정 삭제에 실패했습니다.');
    } finally {
      setIsDeletingSchedule(false);
      setIsLoading(false);
    }
  };

  const handleBulkVoteChange = async (targetVoteCd: string) => {
    if (selectedMembers.length === 0) return;
    setIsLoading(true);
    setLoadingMessage('투표 상태를 변경하는 중...');
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
      await fetchVotesLocal(selectedSchedule.vote_seq);
    } catch (e) {
      alert('투표 상태 변경에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusLabel = (member: any) => {
    if (member?.code_name) return member.code_name;
    const found = statusOptions.find(opt => opt.code === member?.status_cd);
    if (found) return found.code_name;
    if (member?.status_cd === '01') return '활동';
    if (member?.status_cd === '02') return '부상';
    if (member?.status_cd === '03') return '휴식';
    return '활동';
  };

  const getStatusBadgeStyle = (statusCd?: string) => {
    if (statusCd === '02') {
      return { bgColor: '#fce8e6', color: '#c5221f' };
    } else if (statusCd === '03') {
      return { bgColor: '#f1f3f4', color: '#5f6368' };
    }
    return { bgColor: '#e6f4ea', color: '#137333' };
  };

  const renderMemberChips = (voteList: any[]) => {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
        {voteList.map((v, i) => {
          const m = members.find(m => m.member_uid === v.member_uid);
          if (!m) return null;
          const name = m.member_name;
          
          const statusText = getStatusLabel(m);
          const { bgColor, color } = getStatusBadgeStyle(m.status_cd);
          
          const isSelected = selectedMembers.includes(v.member_uid);
          
          return (
            <div
              key={i}
              className="vote-chip"
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
                padding: '6px 10px',
                backgroundColor: isSelected ? 'var(--toss-light-blue)' : '#f2f4f6',
                borderRadius: '20px',
                fontSize: 'calc(13px * var(--scale-factor, 1))',
                color: isSelected ? 'var(--toss-blue)' : '#333',
                boxShadow: isSelected ? '0 0 0 2px var(--toss-blue)' : '0 1px 2px rgba(0,0,0,0.05)',
                cursor: isEditMode ? 'pointer' : 'default',
                transition: 'all 0.2s'
              }}
            >
              <span>{name}</span>
              <span style={{
                backgroundColor: bgColor,
                color: color,
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: 'calc(10px * var(--scale-factor, 1))',
                fontWeight: 'bold',
                lineHeight: 1
              }}>
                {statusText}
              </span>
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
        <div className="card vote-panel" style={{ marginTop: '15px' }}>
          <div className="vote-header">
            <div className="vote-header-title">
              <h3 style={{ margin: '0 0 5px 0' }}>투표현황</h3>
              <p className="vote-header-info" style={{ color: '#191f28', fontSize: 'calc(15px * var(--scale-factor, 1))', fontWeight: 'bold' }}>
                {formatScheduleHeader()}
              </p>
            </div>
            {!isPastDate && (
              <button
                className="vote-header-action"
                onClick={handleToggleEditMode}
                disabled={isUpdatingSchedule}
                style={{ 
                  padding: '6px 12px', 
                  backgroundColor: isEditMode ? '#333' : '#f2f4f6', 
                  color: isEditMode ? '#fff' : '#333', 
                  border: 'none', 
                  borderRadius: '6px', 
                  fontSize: 'calc(13px * var(--scale-factor, 1))', 
                  fontWeight: 'bold', 
                  cursor: isUpdatingSchedule ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {isUpdatingSchedule ? '저장 중...' : isEditMode ? '완료' : '수정'}
              </button>
            )}
          </div>

          {isEditMode && (
            <div style={{ backgroundColor: '#f8f9fa', padding: '12px 14px', borderRadius: '12px', marginBottom: '12px', border: '1px solid #eef0f2' }}>
              <div style={{ fontSize: 'calc(12px * var(--scale-factor, 1))', fontWeight: 'bold', color: '#4e5968', marginBottom: '8px' }}>
                일정 정보 수정 (시간 / 장소)
              </div>
              <div className="vote-edit-fields">
                <div>
                  <label style={{ display: 'block', fontSize: 'calc(11px * var(--scale-factor, 1))', color: '#666', marginBottom: '4px' }}>시간</label>
                  <select 
                    value={editTime} 
                    onChange={(e) => setEditTime(e.target.value)} 
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: '#fff', fontSize: 'calc(13px * var(--scale-factor, 1))' }}
                  >
                    {Array.from({ length: 24 }).map((_, i) => {
                      const t = `${String(i).padStart(2, '0')}:00`;
                      return <option key={t} value={t}>{t}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'calc(11px * var(--scale-factor, 1))', color: '#666', marginBottom: '4px' }}>장소</label>
                  <select 
                    value={editLocationCd} 
                    onChange={(e) => setEditLocationCd(e.target.value)} 
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: '#fff', fontSize: 'calc(13px * var(--scale-factor, 1))' }}
                  >
                    {locationOptions.map(opt => (
                      <option key={opt.code} value={opt.code}>{opt.code_name}</option>
                    ))}
                    <option value="custom">기타 (직접 입력)</option>
                  </select>
                </div>
              </div>
              {editLocationCd === 'custom' && (
                <input 
                  type="text" 
                  value={editLocationCustom} 
                  onChange={(e) => setEditLocationCustom(e.target.value)} 
                  placeholder="장소를 입력해주세요"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', marginTop: '8px', fontSize: 'calc(13px * var(--scale-factor, 1))', boxSizing: 'border-box' }}
                />
              )}
            </div>
          )}
          
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
              <div style={{ fontSize: 'calc(12px * var(--scale-factor, 1))', fontWeight: 'bold', color: '#4e5968', marginBottom: '2px' }}>
                선택 팀원 상태 변경
              </div>
              <div className="vote-btn-row">
                <button 
                  onClick={() => handleBulkVoteChange('02')} 
                  className="vote-action-btn attend"
                  style={{ padding: '10px' }}
                >
                  참석
                </button>
                <button 
                  onClick={() => handleBulkVoteChange('03')} 
                  className="vote-action-btn absent"
                  style={{ padding: '10px' }}
                >
                  불참
                </button>
                <button 
                  onClick={() => handleBulkVoteChange('01')} 
                  className="vote-action-btn no-vote"
                  style={{ padding: '10px' }}
                >
                  미투표
                </button>
              </div>

              <div style={{ fontSize: 'calc(12px * var(--scale-factor, 1))', fontWeight: 'bold', color: '#4e5968', marginTop: '10px', marginBottom: '2px' }}>
                전체 일정 및 투표 관리
              </div>
              <button 
                onClick={() => setShowResetVoteModal(true)} 
                className="vote-action-btn"
                style={{ width: '100%', padding: '10px', backgroundColor: '#e5e8eb', color: '#333d4b' }}
              >
                미투표 일괄 초기화
              </button>
              <div className="vote-btn-row">
                <button 
                  onClick={handleCancelMatch} 
                  className="vote-action-btn cancel-match"
                  style={{ padding: '10px' }}
                >
                  경기취소
                </button>
                <button 
                  onClick={() => setShowDeleteScheduleModal(true)} 
                  className="vote-action-btn"
                  style={{ padding: '10px', backgroundColor: 'var(--toss-red)', color: '#fff' }}
                >
                  일정삭제
                </button>
              </div>
            </div>
          )}
        </div>
      );
    } else {
      // Create Schedule Panel
      return (
        <div className="card" style={{ marginTop: '15px' }}>
          <div style={{ marginBottom: '15px' }}>
            <h3 style={{ margin: '0 0 5px 0' }}>일정 등록</h3>
            <p style={{ color: '#191f28', fontSize: 'calc(15px * var(--scale-factor, 1))', fontWeight: 'bold', margin: '0' }}>
              {formatDateOnly(selectedDate)}
            </p>
          </div>
          
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
      <SoccerBallLoader visible={isLoading} message={loadingMessage} />
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

      {showCancelModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={() => !isCanceling && setShowCancelModal(false)}
        >
          <div 
            style={{
              backgroundColor: '#fff',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '360px',
              width: '100%',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              textAlign: 'center',
              animation: 'fadeIn 0.2s ease'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 'calc(17px * var(--scale-factor, 1))', fontWeight: 'bold', color: '#191f28' }}>
              경기를 취소하시겠습니까?
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: 'calc(13px * var(--scale-factor, 1))', color: '#666', lineHeight: '1.5' }}>
              취소 시 모든 참여자의 투표 상태가<br />
              <strong style={{ color: 'var(--toss-red)' }}>'경기취소(미진행)'</strong>으로 변경됩니다.
            </p>
            <div className="vote-btn-row">
              <button 
                onClick={() => setShowCancelModal(false)}
                disabled={isCanceling}
                className="vote-confirm-btn"
                style={{ padding: '12px', backgroundColor: '#f2f4f6', color: '#4e5968' }}
              >
                취소
              </button>
              <button 
                onClick={handleConfirmCancelMatch}
                disabled={isCanceling}
                className="vote-confirm-btn"
                style={{ padding: '12px', backgroundColor: '#191f28', color: '#fff' }}
              >
                {isCanceling ? '처리 중...' : '경기취소'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetVoteModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={() => !isResettingVotes && setShowResetVoteModal(false)}
        >
          <div 
            style={{
              backgroundColor: '#fff',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '360px',
              width: '100%',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              textAlign: 'center',
              animation: 'fadeIn 0.2s ease'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔄</div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 'calc(17px * var(--scale-factor, 1))', fontWeight: 'bold', color: '#191f28' }}>
              투표를 일괄 초기화하시겠습니까?
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: 'calc(13px * var(--scale-factor, 1))', color: '#666', lineHeight: '1.5' }}>
              해당 일자의 모든 팀원 투표 상태가<br />
              <strong style={{ color: 'var(--toss-blue)' }}>'미투표'</strong> 상태로 변경됩니다.
            </p>
            <div className="vote-btn-row">
              <button 
                onClick={() => setShowResetVoteModal(false)}
                disabled={isResettingVotes}
                className="vote-confirm-btn"
                style={{ padding: '12px', backgroundColor: '#f2f4f6', color: '#4e5968' }}
              >
                취소
              </button>
              <button 
                onClick={handleConfirmResetVotes}
                disabled={isResettingVotes}
                className="vote-confirm-btn"
                style={{ padding: '12px', backgroundColor: 'var(--toss-blue)', color: '#fff' }}
              >
                {isResettingVotes ? '처리 중...' : '초기화'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteScheduleModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={() => !isDeletingSchedule && setShowDeleteScheduleModal(false)}
        >
          <div 
            style={{
              backgroundColor: '#fff',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '360px',
              width: '100%',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              textAlign: 'center',
              animation: 'fadeIn 0.2s ease'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🗑️</div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 'calc(17px * var(--scale-factor, 1))', fontWeight: 'bold', color: 'var(--toss-red)' }}>
              일정을 삭제하시겠습니까?
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: 'calc(13px * var(--scale-factor, 1))', color: '#666', lineHeight: '1.5' }}>
              해당 일자의 경기 일정 및 모든 참여자의 투표가<br />
              <strong style={{ color: 'var(--toss-red)' }}>영구히 삭제</strong>됩니다.
            </p>
            <div className="vote-btn-row">
              <button 
                onClick={() => setShowDeleteScheduleModal(false)}
                disabled={isDeletingSchedule}
                className="vote-confirm-btn"
                style={{ padding: '12px', backgroundColor: '#f2f4f6', color: '#4e5968' }}
              >
                취소
              </button>
              <button 
                onClick={handleConfirmDeleteSchedule}
                disabled={isDeletingSchedule}
                className="vote-confirm-btn"
                style={{ padding: '12px', backgroundColor: 'var(--toss-red)', color: '#fff' }}
              >
                {isDeletingSchedule ? '삭제 중...' : '일정삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarTab;
