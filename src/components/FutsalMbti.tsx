import { useEffect, useRef, useState } from 'react';
import api from '../api';
import {
  AXES, AXIS_ORDER, QUESTIONS, QUESTION_VER, SCALE_FREQ, TYPES,
  interleave, scoreTest,
  type AxisKey, type MbtiResult, type TestType,
} from './mbtiData';
import './FutsalMbti.css';
import Icon from './Icon';

const ANSWER_DELAY_MS = 180; // 선택 표시 후 다음 문항으로 넘어가기까지

// 축별 성향 막대
export function MbtiMeters({ testType, pct }: { testType: TestType; pct: Partial<Record<AxisKey, number>> }) {
  return (
    <div className="mbti-meters">
      {AXIS_ORDER[testType].map(axis => {
        const a = pct[axis] ?? 50;
        const onA = a >= 50;
        const ax = AXES[axis];
        return (
          <div key={axis} className="mbti-meter">
            <div className="mbti-meter-labels">
              <span className={onA ? 'on' : ''}>{ax.a} {ax.an} {a}%</span>
              <span className={!onA ? 'on' : ''}>{100 - a}% {ax.bn} {ax.b}</span>
            </div>
            <div className="mbti-meter-track">
              <div className="mbti-meter-fill" style={{ [onA ? 'left' : 'right']: 0, width: `${onA ? a : 100 - a}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 유형 코드 / 이름 / 설명 / 강점
export function MbtiSummary({ code, compact = false }: { code: string; compact?: boolean }) {
  const type = TYPES[code];
  if (!type) return null;
  return (
    <div className={`mbti-summary${compact ? ' compact' : ''}`}>
      <span className={`mbti-pos${code.startsWith('G-') ? ' gk' : ''}`}>{type.pos}</span>
      <div className="mbti-code">{code}</div>
      <div className="mbti-name">{type.name}</div>
      {!compact && <p className="mbti-desc">{type.desc}</p>}
      <div className="mbti-chips">{type.str.map(s => <span key={s} className="mbti-chip">{s}</span>)}</div>
    </div>
  );
}

interface TestProps {
  teamUid: string;
  memberUid: string;
  onClose: () => void;
  onSaved: () => void; // 저장 후 MY 화면 갱신
}

type Step = 'branch' | 'quiz' | 'result';

// 풋살 MBTI 테스트 (전체 화면). 끝나면 결과를 저장
export default function FutsalMbtiTest({ teamUid, memberUid, onClose, onSaved }: TestProps) {
  const [step, setStep] = useState<Step>('branch');
  const [testType, setTestType] = useState<TestType>('field');
  const [order, setOrder] = useState<ReturnType<typeof interleave>>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState<MbtiResult | null>(null);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error'>('saving');
  // 답을 고른 뒤 다음 문항으로 넘어가는 동안 추가 입력을 막음 (빠른 두 번 탭으로 문항이 건너뛰어지던 버그)
  const advancing = useRef(false);

  useEffect(() => { advancing.current = false; }, [idx, step]);

  // 화면 뒤 페이지가 스크롤되지 않도록
  useEffect(() => {
    document.body.classList.add('scroll-lock');
    return () => document.body.classList.remove('scroll-lock');
  }, []);

  const start = (type: TestType) => {
    const questions = QUESTIONS[type];
    setTestType(type);
    setOrder(interleave(questions));
    setAnswers(new Array(questions.length).fill(null));
    setIdx(0);
    setStep('quiz');
  };

  const save = async (r: MbtiResult) => {
    setSaveState('saving');
    try {
      await api.post('/mbti/save', {
        team_uid: teamUid,
        member_uid: memberUid,
        test_type: r.testType,
        mbti_cd: r.code,
        fb_pct: r.pct.FB ?? null,
        cw_pct: r.pct.CW ?? null,
        pt_pct: r.pct.PT,
        sl_pct: r.pct.SL,
        answers: r.answers,
        question_ver: QUESTION_VER,
      });
      setSaveState('saved');
      onSaved();
    } catch (err) {
      console.error('풋살 MBTI 저장 실패', err);
      setSaveState('error');
    }
  };

  const choose = (value: number) => {
    if (advancing.current) return;
    advancing.current = true;
    const next = [...answers];
    next[order[idx].no] = value;
    setAnswers(next);
    setTimeout(() => {
      if (idx < order.length - 1) {
        setIdx(idx + 1);
        return;
      }
      // 모든 문항에 답했을 때만 판정 (빈 답이 점수에 섞이지 않도록)
      const missing = next.findIndex(v => v === null);
      if (missing >= 0) {
        setIdx(order.findIndex(o => o.no === missing));
        return;
      }
      const r = scoreTest(testType, next as number[]);
      setResult(r);
      setStep('result');
      save(r);
    }, ANSWER_DELAY_MS);
  };

  const back = () => {
    if (step === 'quiz' && idx > 0) setIdx(idx - 1);
    else if (step === 'quiz') setStep('branch');
    else onClose();
  };

  const current = order[idx];

  return (
    <div className="mbti-screen" role="dialog" aria-modal="true" aria-label="풋살 MBTI 테스트">
      <div className="mbti-wrap">
        {step === 'branch' && (
          <>
            <div className="mbti-top"><button className="mbti-back" onClick={onClose} aria-label="닫기"><Icon name="x" size={20} /></button></div>
            <h2 className="mbti-title">나는 어떤<br /><em>풋살 선수</em>일까?</h2>
            <p className="mbti-sub">4가지 축으로 알아보는 풋살 포지션 유형 테스트예요. 최근 경기들을 떠올리며 답해 주세요.</p>
            <div className="mbti-axes">
              {AXIS_ORDER.field.map(axis => (
                <div key={axis} className="mbti-axis-row">
                  <span><b>{AXES[axis].a}</b> {AXES[axis].an}</span>
                  <span>{AXES[axis].bn} <b>{AXES[axis].b}</b></span>
                </div>
              ))}
            </div>
            <p className="mbti-q small">경기에서 주로 골레이를 보나요?</p>
            <div className="mbti-branch">
              <button className="mbti-opt big" onClick={() => start('field')}>
                ⚽ 아니요, 필드에서 뛰어요<small>32문항 · 필드 유형 16가지 중 하나</small>
              </button>
              <button className="mbti-opt big" onClick={() => start('gk')}>
                🧤 네, 주로 골레이를 봐요<small>16문항 · 골레이 유형 4가지 중 하나</small>
              </button>
            </div>
          </>
        )}

        {step === 'quiz' && current && (
          <>
            <div className="mbti-top">
              <button className="mbti-back" onClick={back} aria-label="이전 문항">←</button>
              <div className="mbti-bar"><i style={{ width: `${(idx / order.length) * 100}%` }} /></div>
              <span className="mbti-count">{idx + 1} / {order.length}</span>
            </div>
            <span className="mbti-tag">{testType === 'gk' ? '골레이 · ' : ''}{AXES[current.q.ax].tag}</span>
            <p className="mbti-q">{current.q.t}</p>
            <div className="mbti-scale">
              {SCALE_FREQ.map((label, i) => (
                <button
                  key={label}
                  className={`mbti-opt${answers[current.no] === i + 1 ? ' sel' : ''}`}
                  onClick={() => choose(i + 1)}
                >
                  <span className="n">{i + 1}</span>{label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'result' && result && (
          <>
            <div className="mbti-top"><button className="mbti-back" onClick={onClose} aria-label="닫기"><Icon name="x" size={20} /></button></div>
            <MbtiSummary code={result.code} />
            <h3 className="mbti-sec">나의 성향</h3>
            <MbtiMeters testType={result.testType} pct={result.pct} />
            <p className={`mbti-save ${saveState}`}>
              {saveState === 'saving' && '결과를 저장하는 중...'}
              {saveState === 'saved' && '✅ MY 화면에 저장되었어요'}
              {saveState === 'error' && (
                <>저장하지 못했어요. <button className="mbti-link" onClick={() => save(result)}>다시 저장</button></>
              )}
            </p>
            {result.testType === 'gk' && (
              <p className="mbti-note">🧤 골레이도 필드에서 뛸 때가 있죠? 필드 테스트도 하면 필드 유형까지 알 수 있어요.</p>
            )}
            <div className="mbti-actions">
              {result.testType === 'gk' && <button className="mbti-btn gk" onClick={() => start('field')}>필드 테스트도 해보기</button>}
              <button className={`mbti-btn${result.testType === 'gk' ? ' ghost' : ''}`} onClick={onClose}>MY로 돌아가기</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
