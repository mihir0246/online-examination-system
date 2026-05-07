'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store';
import { 
  Typography, 
  Card, 
  Button, 
  Tag, 
  Descriptions, 
  Space, 
  Divider,
  Empty,
  Skeleton,
  App,
  Tabs,
  Table, 
  Tooltip,
  InputNumber,
  Rate,
  Input
} from 'antd';
import { 
  ArrowLeft, 
  Play, 
  Square, 
  Copy, 
  ChevronRight, 
  Search, 
  Users, 
  FileText, 
  BarChart3, 
  Clock, 
  Settings, 
  CheckCircle2, 
  Layers,
  MessageSquare,
  BookOpen,
  RefreshCw,
  BarChart2,
  Ban,
  Calendar,
  Mail,
  Trash2
} from 'lucide-react';
import { useTestDetails } from '@/hooks/useTestDetails';
import Link from 'next/link';
import moment from 'moment';
import { useCandidateDetails } from '@/hooks/useCandidateDetails';
import { Modal, Tag as AntTag } from 'antd';
import apiClient from '@/services/apiClient';

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

const { Title, Text } = Typography;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff4d4f'];

export default function TestDetailsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const params = useParams();
  const router = useRouter();
  const testId = params.testId as string;
  const { 
    test, 
    candidates,
    stats,
    isLoading, 
    isLoadingCandidates,
    isLoadingStats,
    refetchCandidates,
    beginTest, 
    endTest, 
    stopRegistration,
    isStarting, 
    isEnding,
    isStopping
  } = useTestDetails(testId);

  const user = useSelector((state: RootState) => state.auth.userDetails);

  const [selectedCandidateId, setSelectedCandidateId] = React.useState<string | null>(null);
  const { details: candidateDetails, isLoading: isDetailsLoading, refetch: refetchCandidate } = useCandidateDetails(selectedCandidateId);

  const [evaluatingAnswerId, setEvaluatingAnswerId] = React.useState<string | null>(null);
  const [evaluationScore, setEvaluationScore] = React.useState<number>(0);

  const [deleteModalVisible, setDeleteModalVisible] = React.useState(false);
  const [candidateToDelete, setCandidateToDelete] = React.useState<any>(null);
  const [deleteConfirmationName, setDeleteConfirmationName] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDeleteTrainee = async () => {
    if (!candidateToDelete || deleteConfirmationName !== candidateToDelete.name) {
      return message.error('Please type the exact name to confirm deletion.');
    }
    
    setIsDeleting(true);
    try {
      const { data } = await apiClient.delete(`/api/v1/admin/trainee/${candidateToDelete.id}`);
      if (data.success) {
        message.success('Trainee deleted successfully.');
        setDeleteModalVisible(false);
        setCandidateToDelete(null);
        setDeleteConfirmationName('');
        // Update local state without re-fetching ghost entries
        queryClient.setQueryData(['test-candidates', testId], (oldData: any) => {
          return oldData?.filter((c: any) => c.id !== candidateToDelete.id) || [];
        });
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to delete trainee');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEvaluate = async (answerId: string, testId: string, maxScore: number) => {
    try {
      if (evaluationScore < 0 || evaluationScore > maxScore) {
        return message.error(`Score must be between 0 and ${maxScore}`);
      }
      setEvaluatingAnswerId(answerId);
      const { data } = await apiClient.post('/api/v1/test/evaluate-answer', {
        answerId,
        score: evaluationScore,
        traineeId: selectedCandidateId,
        testId
      });
      if (data.success) {
        message.success('Answer evaluated successfully');
        // Refresh everything to ensure total score and stats are updated
        queryClient.invalidateQueries({ queryKey: ['test-candidates', testId] });
        queryClient.invalidateQueries({ queryKey: ['test-stats', testId] });
        queryClient.invalidateQueries({ queryKey: ['candidate-details', selectedCandidateId] });
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to submit evaluation');
    } finally {
      setEvaluatingAnswerId(null);
    }
  };

  const maxMarks = stats?.maxMarks || 100;

  if (isLoading) {
    return (
      <DashboardLayout>
        <Card className="legacy-card">
          <Skeleton active paragraph={{ rows: 10 }} />
        </Card>
      </DashboardLayout>
    );
  }

  if (!test) {
    return (
      <DashboardLayout>
        <Card className="legacy-card text-center py-20">
          <Empty description="Test not found" />
          <Button icon={<ArrowLeft size={16} />} onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </Card>
      </DashboardLayout>
    );
  }

  const getStatusColor = () => {
    if (test.testconducted) return 'red';
    if (test.testbegins) return 'green';
    return 'blue';
  };

  const getStatusText = () => {
    if (test.testconducted) return 'CONDUCTED';
    if (test.testbegins) return 'LIVE';
    return 'UPCOMING';
  };

  const handleDownloadResults = async () => {
    try {
      message.info('Result download initiated...');
      window.open(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'}/api/v1/test/results/download/${testId}`);
    } catch (error) {
      message.error('Failed to initiate download');
    }
  };

  const candidateColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Email Id',
      dataIndex: 'emailid',
      key: 'emailid',
    },
    {
      title: 'Contact No',
      dataIndex: 'contact',
      key: 'contact',
    },
    {
      title: 'Score',
      key: 'score',
      render: (_: any, record: any) => (
        <Tag color="blue" className="font-bold">
          {record.results?.length > 0 ? record.results[record.results.length - 1].score : 0}
        </Tag>
      ),
    },
    {
      title: 'Links',
      key: 'links',
      render: (_: any, record: any) => (
        <Space>
           <Button 
            size="small" 
            icon={<Copy size={12} />}
            onClick={() => {
              const link = `${window.location.origin}/exam/instructions/${testId}/${record.id}`;
              navigator.clipboard.writeText(link);
              message.success('Candidate link copied!');
            }}
          >
            Copy Link
          </Button>
          <Button 
            size="small"
            type="primary"
            className="bg-indigo-600 border-indigo-600"
            onClick={() => setSelectedCandidateId(record.id)}
          >
            View Report
          </Button>
          <Button 
            size="small"
            icon={<Mail size={12} />}
            onClick={async () => {
              try {
                const { data } = await apiClient.post('/api/v1/test/send-result-email', {
                  testId,
                  traineeId: record.id
                });
                if (data.success) message.success('Result emailed to student!');
              } catch (error) {
                message.error('Failed to send email');
              }
            }}
          >
            Email Result
          </Button>
          {user?.type === 'ADMIN' && (
            <Button 
              size="small"
              danger
              icon={<Trash2 size={12} />}
              onClick={() => {
                setCandidateToDelete(record);
                setDeleteConfirmationName('');
                setDeleteModalVisible(true);
              }}
            >
              Delete Student
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const handleReleaseAllResults = async () => {
    try {
      const { data } = await apiClient.post('/api/v1/test/send-all-results-email', {
        testId
      });
      if (data.success) {
        message.success(data.message);
      }
    } catch (error) {
      message.error('Failed to release all results');
    }
  };

  const tabItems = [
    {
      key: '1',
      label: <span className="flex items-center gap-2"><BookOpen size={16} /> Details</span>,
      children: (
        <div className="space-y-6">
          <Descriptions bordered column={2} className="legacy-descriptions bg-white">
            <Descriptions.Item label="Test Name" span={2}>{test.title}</Descriptions.Item>
            <Descriptions.Item label="Test Type">{test.type}</Descriptions.Item>
            <Descriptions.Item label="Created On">{moment(test.createdAt).format('DD/MM/YYYY')}</Descriptions.Item>
            <Descriptions.Item label="Duration">{test.duration} Minutes</Descriptions.Item>
            <Descriptions.Item label="Difficulty">Level {test.difficulty}</Descriptions.Item>
            <Descriptions.Item label="Organisation" span={2}>{test.organisation || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Subjects" span={2}>
              {test.subjects?.map((s: any, i: number) => (
                <Tag key={s.id || i} color="blue">{s.topic}</Tag>
              ))}
            </Descriptions.Item>
          </Descriptions>
        </div>
      ),
    },
    {
      key: '2',
      label: <span className="flex items-center gap-2"><FileText size={16} /> Questions</span>,
      children: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {test.questions && test.questions.length > 0 ? (
              test.questions.map((q: any, i: number) => (
                <Card key={q.id} size="small" className="border-slate-200">
                  <div className="flex justify-between">
                    <Text strong>Q{i + 1}: {q.body}</Text>
                    <Tag color="blue">{q.weightage} Marks</Tag>
                  </div>
                </Card>
              ))
            ) : (
              <Empty description="No questions found" />
            )}
          </div>
        </div>
      ),
    },
    {
      key: '3',
      label: <span className="flex items-center gap-2"><Users size={16} /> Candidates</span>,
      children: (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Button 
              icon={<RefreshCw size={16} />} 
              onClick={() => refetchCandidates()}
              loading={isLoadingCandidates}
            >
              Reload!
            </Button>
            <Button 
              type="primary"
              icon={<Mail size={16} />}
              className="bg-indigo-600 border-indigo-600"
              onClick={handleReleaseAllResults}
              disabled={!candidates || candidates.length === 0}
            >
              Release All Results to Email
            </Button>
          </div>
          <Table 
            columns={candidateColumns} 
            dataSource={candidates} 
            loading={isLoadingCandidates}
            rowKey="id"
            className="legacy-table"
            pagination={{ pageSize: 10 }}
          />
        </div>
      ),
    },
    {
      key: '4',
      label: <span className="flex items-center gap-2"><BarChart2 size={16} /> Statistics</span>,
      children: (
        <div className="space-y-8 p-4">
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border">
            <Text>Download the test result excel sheet.</Text>
            <Button type="primary" danger onClick={handleDownloadResults}>Download</Button>
          </div>

          {!stats || stats.appeared === 0 ? (
            <Empty description="No results available yet. Once candidates finish the test, statistics will appear here." />
          ) : (
            <div className="space-y-12">
              {/* Score vs No of Students */}
              <div className="space-y-4">
                <Title level={4} className="text-slate-600">Score vs No of students.</Title>
                <div className="h-[300px] w-full" style={{ minHeight: '300px', minWidth: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <BarChart data={stats.scoreDistribution}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="score" label={{ value: 'Scores', position: 'insideBottom', offset: -5 }} />
                      <YAxis allowDecimals={false} />
                      <RechartsTooltip />
                      <Bar dataKey="count" fill="#8884d8" name="Students" barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Pass/Fail */}
                <div className="space-y-4">
                  <Title level={4} className="text-slate-600">Pass/Fail.</Title>
                  <div className="h-[300px]" style={{ minHeight: '300px', minWidth: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%" debounce={50}>
                      <PieChart>
                        <Pie
                          data={stats.passFail}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell key="cell-0" fill="#00C49F" />
                          <Cell key="cell-1" fill="#ff4d4f" />
                        </Pie>
                        <RechartsTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Percentage wise category */}
                <div className="space-y-4">
                  <Title level={4} className="text-slate-600">Percentage wise category.</Title>
                  <div className="h-[300px]" style={{ minHeight: '300px', minWidth: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%" debounce={50}>
                      <PieChart>
                        <Pie
                          data={stats.percentageCategories}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label
                        >
                          {stats.percentageCategories.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      key: '5',
      label: <span className="flex items-center gap-2"><RefreshCw size={16} /> Feedbacks</span>,
      children: <Empty description="No feedback received yet." />,
    }
  ];

  return (
     <DashboardLayout>
      <div className="space-y-6">
        {/* Header Breadcrumb */}
        <div className="flex justify-between items-center">
          <Link href="/dashboard/tests" className="flex items-center text-slate-500 hover:text-slate-700 transition-colors">
            <ArrowLeft size={16} className="mr-1" />
            Back to Exams
          </Link>
          
          <Link href={`/dashboard/tests/${testId}/analytics`}>
            <Button type="primary" icon={<BarChart2 size={16} />} className="bg-indigo-600 border-indigo-600">
              View Advanced Dashboard
            </Button>
          </Link>
        </div>

        {/* Basic Info Card */}
        <Card title="Basic Test Info" className="legacy-card shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded border border-slate-100">
              <Text strong className="text-slate-500 uppercase text-xs">Test Id</Text>
              <Text code className="text-indigo-600">{testId}</Text>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded border border-slate-100">
              <Text strong className="text-slate-500 uppercase text-xs">Registration Link</Text>
              <Space>
                <div className="max-w-[200px] truncate bg-white px-2 py-1 border rounded text-xs text-slate-400">
                  {`${window.location.origin}/exam/register?testid=${testId}`}
                </div>
                <Tooltip title="Copy Link">
                  <Button 
                    size="small" 
                    icon={<Copy size={14} />} 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/exam/register?testid=${testId}`);
                      message.success('Registration link copied!');
                    }} 
                  />
                </Tooltip>
              </Space>
            </div>

            <div className="flex justify-between items-center p-3 bg-slate-50 rounded border border-slate-100">
              <Text strong className="text-slate-500 uppercase text-xs">Registration Open</Text>
              <Space>
                <Tag color={test.isRegistrationavailable ? 'green' : 'red'}>
                  {test.isRegistrationavailable ? 'OPEN' : 'CLOSED'}
                </Tag>
                {test.isRegistrationavailable && (
                  <Button 
                    danger 
                    size="small" 
                    icon={<Ban size={14} className="mr-1" />}
                    onClick={() => stopRegistration()}
                    loading={isStopping}
                  >
                    Stop Registration
                  </Button>
                )}
              </Space>
            </div>

            <div className="flex justify-between items-center p-3 bg-slate-50 rounded border border-slate-100">
              <Text strong className="text-slate-500 uppercase text-xs">Test Status</Text>
              <Space>
                <Tag color={getStatusColor()}>{getStatusText()}</Tag>
                <Space>
                  {!test.testconducted && !test.testbegins && (
                    <Button 
                      type="primary" 
                      className="bg-blue-600 border-blue-600"
                      size="small"
                      icon={<Play size={14} className="mr-1" />}
                      onClick={async () => { try { await beginTest(); } catch {} }}
                      loading={isStarting}
                    >
                      Start Test
                    </Button>
                  )}
                  {test.testbegins && !test.testconducted && (
                    <Button 
                      danger
                      type="primary"
                      size="small"
                      icon={<Square size={14} className="mr-1" />}
                      onClick={async () => { try { await endTest(); } catch {} }}
                      loading={isEnding}
                    >
                      End Test
                    </Button>
                  )}
                </Space>
              </Space>
            </div>
          </div>
        </Card>

        {/* Tabs for Candidates and Questions */}
        <Card className="legacy-card shadow-sm border-t-4 border-t-indigo-600">
          <Tabs defaultActiveKey="1" items={tabItems} className="legacy-tabs" />
        </Card>
      </div>

      <Modal
        title={<Title level={4}>Candidate Performance Details</Title>}
        open={!!selectedCandidateId}
        onCancel={() => setSelectedCandidateId(null)}
        footer={null}
        width={800}
        className="premium-modal"
      >
        {isDetailsLoading ? (
          <Skeleton active />
        ) : candidateDetails ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl">
              <div>
                <Text type="secondary" className="text-xs uppercase font-bold tracking-wider">Candidate</Text>
                <Title level={5} className="mb-0">{candidateDetails.name}</Title>
                <Text className="text-xs">{candidateDetails.emailid}</Text>
              </div>
              <div className="text-right">
                <Text type="secondary" className="text-xs uppercase font-bold tracking-wider">Total Score</Text>
                <div className="text-2xl font-black text-indigo-600">
                  {candidateDetails.results?.length > 0 ? candidateDetails.results[candidateDetails.results.length - 1].score : 0} <span className="text-sm font-normal text-slate-400">/ {maxMarks}</span>
                </div>
              </div>
            </div>
            
            {candidateDetails.feedback && (
              <Card size="small" className="bg-amber-50/50 border-amber-100 rounded-2xl">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2 text-amber-800 font-bold">
                    <MessageSquare size={16} /> Student Reflection
                  </div>
                  <Rate disabled defaultValue={candidateDetails.feedback.rating} className="text-sm" />
                </div>
                <Text className="text-amber-700 italic block">
                  "{candidateDetails.feedback.comment}"
                </Text>
              </Card>
            )}

            <div>
              <Title level={5} className="mb-4 flex items-center gap-2">
                <Layers size={18} className="text-indigo-600" /> Answer Analysis
              </Title>
              <div className="space-y-3">
                {test.questions.map((q: any, idx: number) => {
                  const answer = candidateDetails.answerSheet?.answers.find((a: any) => a.questionId === q.id);
                  
                  return (
                    <div key={q.id} className="p-4 border border-slate-100 dark:border-white/5 rounded-xl flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <AntTag className="rounded-md">Q{idx + 1}</AntTag>
                          <Text className="font-medium">{q.body}</Text>
                        </div>
                        <div className="pl-10">
                          <Text type="secondary" className="text-xs">
                            Response: <span className={answer ? "text-indigo-600 font-bold" : "text-slate-400 italic"}>
                              {answer ? answer.options.join(', ') : 'No Response'}
                            </span>
                          </Text>
                        </div>
                      </div>
                      <div className="text-right ml-4 min-w-[120px]">
                        <Text className="text-xs font-bold block mb-2">{q.weightage} Marks</Text>
                        {q.type === 'TEXT' ? (
                          <div className="flex flex-col items-end gap-2">
                            {answer ? (
                              <>
                                <Space.Compact>
                                  <InputNumber
                                    min={0}
                                    max={q.weightage}
                                    defaultValue={answer.score || 0}
                                    onChange={(val) => setEvaluationScore(val || 0)}
                                    onPressEnter={() => handleEvaluate(answer.id, testId, q.weightage)}
                                    disabled={evaluatingAnswerId === answer.id}
                                    className="w-16"
                                  />
                                  <Button 
                                    type="primary" 
                                    size="small"
                                    onClick={() => handleEvaluate(answer.id, testId, q.weightage)}
                                    loading={evaluatingAnswerId === answer.id}
                                  >
                                    Save
                                  </Button>
                                </Space.Compact>
                                {answer.isEvaluated && <AntTag color="green">Evaluated</AntTag>}
                                <div className="text-left mt-2 p-2 bg-blue-50 text-blue-800 text-xs rounded w-full max-w-[250px]">
                                  <strong>Ref:</strong> {q.explanation}
                                </div>
                              </>
                            ) : (
                              <AntTag color="default">Not Answered</AntTag>
                            )}
                          </div>
                        ) : (
                          answer ? (
                            <CheckCircle2 size={18} className="text-green-500 mt-1 ml-auto" />
                          ) : (
                            <AntTag color="default" className="mt-1">Not Answered</AntTag>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <Empty description="No details found" />
        )}
      </Modal>

      {/* Delete Trainee Confirmation Modal */}
      <Modal
        title={
          <Title level={4} className="text-red-600 mb-0 flex items-center gap-2">
            <Trash2 size={20} /> Permanent Erasure Warning
          </Title>
        }
        open={deleteModalVisible}
        onCancel={() => {
          setDeleteModalVisible(false);
          setCandidateToDelete(null);
          setDeleteConfirmationName('');
        }}
        onOk={handleDeleteTrainee}
        okText="Permanently Delete Student"
        okButtonProps={{ 
          danger: true, 
          disabled: deleteConfirmationName !== candidateToDelete?.name,
          loading: isDeleting
        }}
      >
        <div className="space-y-4 py-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <strong>Warning:</strong> You are about to permanently delete <strong>{candidateToDelete?.name}</strong>.
            This action is irreversible and will immediately wipe:
            <ul className="list-disc ml-5 mt-2 text-sm">
              <li>Profile data and login credentials</li>
              <li>S3 uploaded files and attachments</li>
              <li>Exam answers and results</li>
              <li>Active Redis sessions (locking the student out immediately)</li>
            </ul>
          </div>
          
          <div>
            <p className="mb-2 text-slate-600">
              Please type <strong>{candidateToDelete?.name}</strong> to confirm.
            </p>
            <Input 
              value={deleteConfirmationName}
              onChange={(e) => setDeleteConfirmationName(e.target.value)}
              placeholder={`Type ${candidateToDelete?.name} to confirm`}
              onPressEnter={handleDeleteTrainee}
            />
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
