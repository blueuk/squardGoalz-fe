import { useState, type DragEvent } from 'react';
import type { ArrangeParticipant, FixedTeams } from './teamArrangeUtils';

interface TeamStyle {
  name: string;
  color: string;
}

interface Props {
  participants: ArrangeParticipant[];
  fixed: FixedTeams;
  teams: TeamStyle[];
  teamSize: number;
  onChange: (fixed: FixedTeams) => void;
}

const LIST_ZONE = 0; // 참석자 목록 (지정 해제)

// 참석자를 드래그해 팀에 미리 지정하는 보드 (PC 전용, Ctrl+클릭으로 열림)
export default function ArrangeFixBoard({ participants, fixed, teams, teamSize, onChange }: Props) {
  const [draggingUid, setDraggingUid] = useState<string | null>(null);
  const [overZone, setOverZone] = useState<number | null>(null);

  const sorted = [...participants].sort((a, b) => a.member_name.localeCompare(b.member_name));
  const membersOf = (zone: number) => sorted.filter(p => (fixed[p.member_uid] ?? LIST_ZONE) === zone);

  const canDrop = (zone: number) => {
    if (!draggingUid) return false;
    if (zone === LIST_ZONE || fixed[draggingUid] === zone) return true;
    return membersOf(zone).length < teamSize;
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, zone: number) => {
    e.preventDefault();
    setOverZone(null);
    if (!draggingUid || !canDrop(zone)) return;
    const next = { ...fixed };
    if (zone === LIST_ZONE) delete next[draggingUid];
    else next[draggingUid] = zone;
    onChange(next);
    setDraggingUid(null);
  };

  const zoneProps = (zone: number) => ({
    'data-zone': zone,
    onDragOver: (e: DragEvent<HTMLDivElement>) => {
      if (!canDrop(zone)) return; // preventDefault 하지 않으면 놓을 수 없음
      e.preventDefault();
      setOverZone(zone);
    },
    onDragLeave: () => setOverZone(prev => (prev === zone ? null : prev)),
    onDrop: (e: DragEvent<HTMLDivElement>) => handleDrop(e, zone),
  });

  const renderPlayers = (zone: number, color?: string) => (
    <div className="fix-players">
      {membersOf(zone).map(p => (
        <span
          key={p.member_uid}
          draggable
          className={`fix-player${color ? ' placed' : ''}${draggingUid === p.member_uid ? ' dragging' : ''}`}
          style={color ? { backgroundColor: color } : undefined}
          data-uid={p.member_uid}
          onDragStart={e => {
            e.dataTransfer.setData('text/plain', p.member_uid); // Firefox는 데이터가 있어야 드래그 시작
            e.dataTransfer.effectAllowed = 'move';
            setDraggingUid(p.member_uid);
          }}
          onDragEnd={() => { setDraggingUid(null); setOverZone(null); }}
        >
          {p.member_name}
        </span>
      ))}
    </div>
  );

  return (
    <div className="fix-board">
      <p className="fix-hint">미리 정할 선수만 팀으로 끌어다 놓으세요. 나머지 선수는 자동으로 배정됩니다.</p>

      <div className={`fix-zone${overZone === LIST_ZONE ? ' over' : ''}`} {...zoneProps(LIST_ZONE)}>
        <div className="fix-zone-head">
          <span>참석자</span>
          <span>{membersOf(LIST_ZONE).length}명</span>
        </div>
        {participants.length === 0 ? <p className="fix-hint">참석자가 없습니다.</p> : renderPlayers(LIST_ZONE)}
      </div>

      <div className="fix-teams">
        {teams.map((team, idx) => {
          const zone = idx + 1;
          const count = membersOf(zone).length;
          return (
            <div
              key={team.name}
              className={`fix-zone team${overZone === zone ? ' over' : ''}${count >= teamSize ? ' full' : ''}`}
              style={{ borderTopColor: team.color }}
              {...zoneProps(zone)}
            >
              <div className="fix-zone-head" style={{ color: team.color }}>
                <span>{team.name}팀</span>
                <span>{count}/{teamSize}</span>
              </div>
              {renderPlayers(zone, team.color)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
