'use client';

import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Button, 
  Card, 
  Row, 
  Col, 
  Progress, 
  Space, 
  Badge, 
  Modal, 
  Skeleton,
  Radio,
  Tooltip,
  Avatar,
  Tag,
  Input,
  App,
  Result as AntResult,
  Alert
} from 'antd';
import { 
  Timer, 
  Flag, 
  ChevronLeft, 
  ChevronRight, 
  LogOut, 
  User, 
  CheckCircle2, 
  Circle,
  HelpCircle,
  ShieldAlert,
  Clock,
  LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useExamSession } from '@/hooks/useExamSession';
import { useProctoring } from '@/hooks/useProctoring';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { useParams, useRouter } from 'next/navigation';

const { Title, Text, Paragraph } = Typography;

export default function ExamPortalPage() {
  const { message, modal } = App.useApp();
  const params = useParams();
  const router = useRouter();
  const testId = params.testId as string;
  const traineeId = params.traineeId as string;

  const { 
    questions, 
    answers, 
    localAnswers,
    activeQuestionIndex, 
    setActiveQuestionIndex, 
    timeLeft, 
    setTimeLeft, 
    isLoading, 
    isExamOver, 
    testNotStarted,
    connectionError,
    saveAnswer, 
    submitExam,
    isSubmitting,
    trainee 
  } = useExamSession(testId, traineeId);

  const {
    videoRef,
    tabSwitches,
    startWebcam,
    stopWebcam,
    takeSnapshot
  } = useProctoring(testId, traineeId, {
    onTabSwitch: (count) => {
      message.warning(`Warning: Tab switch detected! (${count})`, 5);
    }
  });

  // Plan 3.3: Send heartbeat to server every 30s so trainer can see active trainees
  useHeartbeat({ testId, traineeId, enabled: !isExamOver });

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [visitedIndices, setVisitedIndices] = useState<Set<number>>(new Set([0]));
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);

  useEffect(() => {
    if (!testNotStarted && !isLoading && !isExamOver) {
      startWebcam();
    }
    return () => stopWebcam();
  }, [testNotStarted, isLoading, isExamOver]);

  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);

  useEffect(() => {
    if (!testId || !traineeId || isLoading || isExamOver) return;
    
    // Auto-save the current question's state every 60 seconds
    const autoSaveInterval = setInterval(() => {
      const currentQ = questions[activeQuestionIndex];
      if (currentQ) {
        saveAnswer(currentQ.id, selectedOption, isBookmarked).catch(() => {});
        setLastSavedTime(new Date());
        setShowSavedIndicator(true);
        setTimeout(() => setShowSavedIndicator(false), 3000);
      }
    }, 60000);

    return () => clearInterval(autoSaveInterval);
  }, [activeQuestionIndex, selectedOption, isBookmarked, isLoading, isExamOver, testId, traineeId]);

  const currentQuestion = questions[activeQuestionIndex];
  // Read from localAnswers (optimistic) — always up-to-date without re-fetching
  const currentLocalAnswer = currentQuestion ? localAnswers[currentQuestion.id] : undefined;

  useEffect(() => {
    setVisitedIndices(prev => new Set(prev).add(activeQuestionIndex));
    
    if (currentLocalAnswer) {
      setSelectedOption(currentLocalAnswer.options?.[0] || null);
      setIsBookmarked(currentLocalAnswer.isBookmarked ?? false);
    } else {
      setSelectedOption(null);
      setIsBookmarked(false);
    }
  }, [activeQuestionIndex]); // Only re-run on question navigation, not on every answer change

  const handleSaveAndNext = async () => {
    if (!currentQuestion) return;
    // Save current state before navigating
    saveAnswer(currentQuestion.id, selectedOption, isBookmarked).catch(() => {});
    setLastSavedTime(new Date());
    setShowSavedIndicator(true);
    setTimeout(() => setShowSavedIndicator(false), 3000);

    // Navigate immediately for instant UX
    const nextIndex = activeQuestionIndex < questions.length - 1 ? activeQuestionIndex + 1 : null;
    if (nextIndex !== null) {
      setActiveQuestionIndex(nextIndex);
      setMobilePaletteOpen(false); // auto-close palette on mobile when navigating
    } else {
      message.success('Last question reached. You can review your answers or click End Test.');
    }
  };

  const handleToggleBookmark = async () => {
    if (!currentQuestion) return;
    const newBookmarkState = !isBookmarked;
    setIsBookmarked(newBookmarkState);
    await saveAnswer(currentQuestion.id, selectedOption, newBookmarkState);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
  };

  if (testNotStarted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-card border-none shadow-2xl p-12 text-center max-w-lg">
            <AntResult
              icon={<Clock size={64} className="text-indigo-600 animate-pulse mx-auto mb-4" />}
              title="Waiting for Admin to Start"
              subTitle="The admin has not started the paper yet. Please stay on this page, it will automatically refresh once the test is live."
            />
            <div className="mt-8 flex items-center justify-center gap-2 text-slate-400">
              <div className="w-2 h-2 bg-indigo-600 rounded-full animate-ping" />
              <Text className="text-sm font-medium">Checking test status...</Text>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (isExamOver) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="glass-card border-none shadow-2xl p-12 text-center max-w-lg">
            <AntResult
              status="success"
              title="Examination Submitted!"
              subTitle="Your responses have been securely recorded."
              extra={[
                <Button 
                  type="primary" 
                  key="results"
                  size="large"
                  onClick={() => router.push(`/exam/results/${testId}/${traineeId}`)}
                  className="rounded-xl h-12 px-8 font-bold bg-indigo-600"
                >
                  View Results & Give Feedback
                </Button>
              ]}
            />
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden relative">
      {connectionError && (
        <div className="fixed top-0 left-0 right-0 z-[1000]">
          <Alert
            message="Connection Lost"
            description="We've lost connection to the server. Your progress is saved locally and will sync once reconnected."
            type="error"
            showIcon
            banner
          />
        </div>
      )}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center p-12">
          <Skeleton active />
        </div>
      ) : (
        <>
          {/* Header */}
          <header className="h-auto min-h-[64px] py-2 glass border-b border-white/10 px-4 flex flex-wrap items-center justify-between sticky top-0 z-40 gap-y-2">
            <div className="flex items-center gap-2 sm:gap-3 w-auto">
              <Button
                className="xl:hidden glass border-white/20 rounded-xl flex items-center justify-center w-10 h-10 p-0"
                onClick={() => setMobilePaletteOpen(true)}
              >
                <LayoutGrid size={20} className="text-indigo-600" />
              </Button>
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">E</div>
              <Title level={4} className="mb-0 hidden sm:block text-sm sm:text-base">Exam Portal</Title>
            </div>

            {/* Auto-save indicator */}
            <AnimatePresence>
              {showSavedIndicator && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full shadow-md flex items-center gap-1 z-50 border border-green-200"
                >
                  <CheckCircle2 size={12} /> Saved
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2 sm:gap-6 justify-end">
              <div className="flex items-center gap-1.5 sm:gap-3 bg-white/50 dark:bg-slate-900/50 px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-white/20">
                <Timer className={`w-4 h-4 sm:w-5 sm:h-5 ${timeLeft && timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-indigo-600'}`} />
                <Text className="font-mono text-sm sm:text-lg font-bold">{timeLeft ? formatTime(timeLeft) : '--:--'}</Text>
              </div>
              <Button 
                danger 
                icon={<LogOut size={14} className="sm:w-4 sm:h-4" />} 
                onClick={() => modal.confirm({
                  title: 'End Examination?',
                  content: 'Are you sure you want to submit your answers and end the test?',
                  onOk: () => submitExam()
                })}
                className="rounded-xl font-bold border-red-500/20 bg-red-500/10 text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4"
              >
                <span className="hidden sm:inline">End Test</span>
              </Button>
            </div>
          </header>

      <main className="flex-1 overflow-hidden flex">
        {/* Left Side: Question Viewer */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-12">
          <motion.div
            key={activeQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <div className="flex items-center justify-between">
              <Text type="secondary" className="font-bold uppercase tracking-widest text-xs">Question {activeQuestionIndex + 1} of {questions.length}</Text>
              {isBookmarked && <Tag color="gold" icon={<Flag size={14} className="mr-1" />}>Bookmarked</Tag>}
            </div>

            <Title level={3} className="leading-relaxed">{currentQuestion?.body}</Title>

            {currentQuestion?.quesimg && (
              <div className="rounded-2xl overflow-hidden border border-slate-200">
                <img src={currentQuestion.quesimg} alt="Question" className="max-h-64 mx-auto" />
              </div>
            )}

            <div className="space-y-4 pt-4">
              {currentQuestion?.type === 'TEXT' ? (
                <div className="space-y-4">
                  <Text type="secondary">Write your answer below:</Text>
                  <Input.TextArea 
                    rows={8}
                    placeholder="Type your answer here..."
                    className="rounded-2xl p-6 text-base bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 focus:border-indigo-600"
                    value={selectedOption || ''}
                    onChange={(e) => setSelectedOption(e.target.value)}
                  />
                </div>
              ) : (
                <Radio.Group 
                  className="w-full space-y-4" 
                  value={selectedOption}
                  onChange={(e) => setSelectedOption(e.target.value)}
                >
                  {currentQuestion?.options.map((opt: any, idx: number) => (
                    <label 
                      key={idx}
                      className={`flex items-center min-h-[44px] p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                        selectedOption === opt.optbody 
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' 
                        : 'border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 hover:border-indigo-200'
                      }`}
                    >
                      <Radio value={opt.optbody} className="mr-4 transform scale-110" />
                      <div className="flex-1 flex items-center gap-4">
                        {opt.optimg && <img src={opt.optimg} alt="Option" className="w-12 h-12 rounded-lg object-cover" />}
                        <Text className="text-base font-medium">{opt.optbody}</Text>
                      </div>
                    </label>
                  ))}
                </Radio.Group>
              )}
            </div>
          </motion.div>
        </div>

        {/* Mobile Backdrop */}
        {mobilePaletteOpen && (
          <div 
            className="fixed inset-0 bg-black/60 z-40 xl:hidden backdrop-blur-sm"
            onClick={() => setMobilePaletteOpen(false)}
          />
        )}

        {/* Right Side: Question Palette (Responsive Drawer) */}
        <aside className={`fixed inset-y-0 right-0 z-50 w-80 bg-slate-50 dark:bg-slate-950 border-l border-white/10 p-6 overflow-y-auto transition-transform duration-300 xl:static xl:translate-x-0 ${mobilePaletteOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full shadow-none'}`}>
          <div className="space-y-8">
            <div className="flex xl:hidden justify-between items-center mb-4">
              <Title level={5} className="mb-0">Question Palette</Title>
              <Button type="text" onClick={() => setMobilePaletteOpen(false)}>Close</Button>
            </div>
            {/* Proctoring View */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 border-2 border-indigo-500/20 shadow-lg aspect-video mb-6 group">
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute top-2 left-2 px-2 py-1 bg-red-500/80 rounded-lg flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-[10px] text-white font-bold uppercase tracking-wider">Live Proctoring</span>
              </div>
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Tooltip title="Your webcam is active for security verification.">
                  <HelpCircle size={14} className="text-white/50" />
                </Tooltip>
              </div>
            </div>

            <div className="text-center pb-6 border-b border-slate-100 dark:border-white/5">
              <Avatar size={64} icon={<User />} className="mb-3 bg-indigo-100 text-indigo-600" />
              <Title level={5} className="mb-0">{trainee?.name || 'Candidate'}</Title>
              <Text type="secondary" className="text-xs">{trainee?.emailid || 'Secure Exam Session'}</Text>
            </div>

            <div>
              <Title level={5} className="mb-4 hidden xl:block">Question Palette</Title>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q: any, idx: number) => {
                  // Use localAnswers for instant palette updates (no server round-trip needed)
                  const localAns = localAnswers[q.id];
                  let bgColor = 'bg-slate-100 dark:bg-slate-900';
                  let textColor = 'text-slate-400';
                  
                  if (idx === activeQuestionIndex) {
                    bgColor = 'bg-indigo-600';
                    textColor = 'text-white scale-110 shadow-lg';
                  } else if (localAns?.isBookmarked) {
                    bgColor = 'bg-amber-500';
                    textColor = 'text-white';
                  } else if (localAns?.options?.length > 0) {
                    bgColor = 'bg-green-500';
                    textColor = 'text-white';
                  } else if (visitedIndices.has(idx)) {
                    bgColor = 'bg-indigo-100 dark:bg-indigo-900/40 border-2 border-indigo-400';
                    textColor = 'text-indigo-600 dark:text-indigo-400';
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveQuestionIndex(idx);
                        setMobilePaletteOpen(false);
                      }}
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center font-bold text-sm transition-all hover:scale-105 ${bgColor} ${textColor}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3 text-xs">
                <div className="w-3 h-3 rounded bg-green-500" /> <Text>Answered</Text>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="w-3 h-3 rounded bg-amber-500" /> <Text>Bookmarked</Text>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="w-3 h-3 rounded bg-indigo-400" /> <Text>Visited</Text>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="w-3 h-3 rounded bg-slate-200" /> <Text>Not Visited</Text>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Footer Navigation */}
      <footer className="h-16 sm:h-20 glass border-t border-white/10 px-4 sm:px-6 flex items-center justify-between">
        <Space size="small">
          <Button 
            size="large" 
            icon={<ChevronLeft size={18} />} 
            disabled={activeQuestionIndex === 0}
            onClick={() => setActiveQuestionIndex(activeQuestionIndex - 1)}
            className="rounded-xl glass border-none flex items-center h-10 sm:h-12 w-10 sm:w-auto p-0 sm:px-4 justify-center"
          >
            <span className="hidden sm:inline">Previous</span>
          </Button>
          <Button 
            size="large" 
            icon={<Flag size={18} className={isBookmarked ? 'text-amber-500' : ''} />} 
            onClick={handleToggleBookmark}
            className={`rounded-xl glass border-none flex items-center h-10 sm:h-12 w-10 sm:w-auto p-0 sm:px-4 justify-center ${isBookmarked ? 'bg-amber-50 text-amber-600' : ''}`}
          >
            <span className="hidden sm:inline">{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
          </Button>
        </Space>

        <Button 
          type="primary" 
          size="large" 
          onClick={handleSaveAndNext}
          className="h-10 sm:h-12 px-5 sm:px-10 rounded-xl font-bold bg-indigo-600 flex items-center justify-center gap-1 sm:gap-2 text-sm sm:text-base"
        >
          <span className="hidden sm:inline">{activeQuestionIndex === questions.length - 1 ? 'Save & Finish' : 'Save & Next'}</span>
          <span className="sm:hidden">{activeQuestionIndex === questions.length - 1 ? 'Finish' : 'Next'}</span>
          <ChevronRight size={16} className="sm:w-[18px] sm:h-[18px]" />
        </Button>
      </footer>

      {/* Proctoring Overlay (Tab Detection Placeholder) */}
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] px-4 py-1 bg-red-500/10 border border-red-500/20 rounded-full flex items-center gap-2">
        <ShieldAlert size={14} className="text-red-500" />
        <Text className="text-[10px] text-red-500 font-bold uppercase tracking-tighter">Monitoring Active</Text>
      </div>
        </>
      )}
    </div>
  );
}
