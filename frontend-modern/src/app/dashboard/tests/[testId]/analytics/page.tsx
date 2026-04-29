'use client';

import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Typography, 
  Card, 
  Table, 
  Tag, 
  Row, 
  Col, 
  Statistic, 
  Tabs, 
  Progress, 
  Avatar, 
  Empty, 
  Button,
  Rate,
  Divider,
  Space,
  Skeleton,
  Descriptions,
  message
} from 'antd';
import { 
  Users, 
  TrendingUp, 
  Target, 
  MessageSquare, 
  ArrowLeft, 
  Download, 
  ExternalLink,
  CheckCircle2,
  Calendar,
  Layers,
  Star
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTestAnalytics } from '@/hooks/useTestAnalytics';
import { useCandidateDetails } from '@/hooks/useCandidateDetails';
import { useParams, useRouter } from 'next/navigation';
import moment from 'moment';
import { Modal } from 'antd';

const { Title, Text, Paragraph } = Typography;

export default function TestAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
   const testId = params.testId as string;
  const { analytics, isLoading } = useTestAnalytics(testId);
  const [selectedCandidateId, setSelectedCandidateId] = React.useState<string | null>(null);
  const { details: candidateDetails, isLoading: isDetailsLoading } = useCandidateDetails(selectedCandidateId);

  React.useEffect(() => {
    if (candidateDetails) {
      message.success({ content: 'Details loaded', key: 'cand-load', duration: 1 });
    }
  }, [candidateDetails]);

  if (isLoading) return <DashboardLayout><Skeleton active className="p-12" /></DashboardLayout>;
  if (!analytics) return <DashboardLayout><Empty description="No analytics data found" /></DashboardLayout>;

  const { details, stats, feedbacks, maxMarks } = analytics;

  const candidateColumns = [
    {
      title: 'Candidate',
      key: 'name',
      render: (record: any) => (
        <div className="flex items-center gap-3">
          <Avatar className="bg-indigo-100 text-indigo-600 font-bold">
            {record.userid.name[0]}
          </Avatar>
          <div>
            <div className="font-bold text-slate-800 dark:text-slate-200">{record.userid.name}</div>
            <div className="text-xs text-slate-400">{record.userid.emailid}</div>
          </div>
        </div>
      )
    },
    {
      title: 'Score',
      key: 'score',
      render: (record: any) => (
        <div className="flex flex-col">
          <Text className="font-bold">{record.score} / {maxMarks}</Text>
          <Progress 
            percent={Math.round((record.score / maxMarks) * 100)} 
            size="small" 
            showInfo={false} 
            strokeColor="#4f46e5"
          />
        </div>
      )
    },
    {
      title: 'Organisation',
      dataIndex: ['userid', 'organisation'],
      key: 'organisation'
    },
    {
      title: 'Status',
      key: 'status',
      render: (record: any) => (
        <Tag color={record.score >= (maxMarks * 0.4) ? 'green' : 'red'} className="rounded-full px-3">
          {record.score >= (maxMarks * 0.4) ? 'PASS' : 'FAIL'}
        </Tag>
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (record: any) => (
        <Button 
          type="link" 
          onClick={(e) => {
            e.stopPropagation();
            const id = record._id || record.id;
            console.log('Candidate clicked:', id, record);
            if (id) {
              window.alert('Loading report for: ' + record.userid.name);
              message.loading({ content: 'Fetching candidate details...', key: 'cand-load' });
              setSelectedCandidateId(id);
            } else {
              message.error('Candidate ID not found');
            }
          }}
          className="text-indigo-600 font-bold hover:text-indigo-800"
        >
          View Details
        </Button>
      )
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button 
              icon={<ArrowLeft size={18} />} 
              onClick={() => router.back()} 
              className="glass border-none"
            />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Tag color="blue" className="rounded-full uppercase text-[10px] font-bold tracking-wider">{details.type}</Tag>
                <Text type="secondary" className="text-xs">{moment(details.createdAt).format('MMMM Do, YYYY')}</Text>
              </div>
              <Title level={3} className="mb-0">{details.title}</Title>
            </div>
          </div>
          <Space>
            <Button icon={<Download size={18} />} className="rounded-xl h-11 px-6 font-bold glass">Export Excel</Button>
            <Button type="primary" icon={<ExternalLink size={18} />} className="rounded-xl h-11 px-6 font-bold bg-indigo-600">Public Link</Button>
          </Space>
        </div>

        {/* KPI Grid */}
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12} lg={6}>
            <Card className="glass-card border-none shadow-lg">
              <Statistic 
                title="Total Candidates" 
                value={stats.length} 
                prefix={<Users size={20} className="text-indigo-600 mr-2" />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="glass-card border-none shadow-lg">
              <Statistic 
                title="Avg. Score" 
                value={Math.round(stats.reduce((acc: number, s: any) => acc + s.score, 0) / (stats.length || 1))} 
                suffix={`/ ${maxMarks}`}
                prefix={<Target size={20} className="text-green-600 mr-2" />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="glass-card border-none shadow-lg">
              <Statistic 
                title="Pass Rate" 
                value={Math.round((stats.filter((s: any) => s.score >= (maxMarks * 0.4)).length / (stats.length || 1)) * 100)} 
                suffix="%" 
                prefix={<TrendingUp size={20} className="text-purple-600 mr-2" />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="glass-card border-none shadow-lg">
              <Statistic 
                title="Feedbacks" 
                value={feedbacks.length} 
                prefix={<MessageSquare size={20} className="text-amber-600 mr-2" />} 
              />
            </Card>
          </Col>
        </Row>

        {/* Main Content Tabs */}
        <Card className="shadow-xl">
          <Tabs 
            defaultActiveKey="1" 
            className="premium-tabs"
            items={[
              {
                key: '1',
                label: <span className="flex items-center gap-2"><CheckCircle2 size={16} /> Results Palette</span>,
                children: (
                  <Table 
                    columns={candidateColumns} 
                    dataSource={stats} 
                    pagination={{ pageSize: 10 }}
                    rowKey={(record: any) => record._id || record.id}
                    className="mt-4"
                  />
                )
              },
              {
                key: '2',
                label: <span className="flex items-center gap-2"><Star size={16} /> Feedback Insights</span>,
                children: (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
                    {feedbacks.length > 0 ? feedbacks.map((f: any, i: number) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <Card className="bg-slate-50 dark:bg-slate-900 border-none rounded-2xl h-full">
                          <div className="flex justify-between items-start mb-4">
                            <Avatar className="bg-indigo-600">{f.userid.name[0]}</Avatar>
                            <Rate disabled defaultValue={f.rating} className="text-sm" />
                          </div>
                          <Paragraph className="text-slate-600 italic mb-4">"{f.feedback}"</Paragraph>
                          <div className="mt-auto pt-4 border-t border-slate-200 dark:border-white/5">
                            <Text className="font-bold text-xs">{f.userid.name}</Text>
                            <div className="text-[10px] text-slate-400">{moment(f.createdAt).fromNow()}</div>
                          </div>
                        </Card>
                      </motion.div>
                    )) : <Empty className="col-span-full py-12" description="No feedback received yet" />}
                  </div>
                )
              },
              {
                key: '3',
                label: <span className="flex items-center gap-2"><Layers size={16} /> Configuration</span>,
                children: (
                  <div className="p-6 max-w-2xl">
                    <Descriptions bordered column={1} className="modern-descriptions">
                      <Descriptions.Item label="Total Questions">{details.questions.length}</Descriptions.Item>
                      <Descriptions.Item label="Maximum Marks">{maxMarks}</Descriptions.Item>
                      <Descriptions.Item label="Subjects">
                        <Space wrap>
                          {details.subjects.map((s: any) => (
                            <Tag key={s.id} color="blue" className="rounded-full">{s.topic}</Tag>
                          ))}
                        </Space>
                      </Descriptions.Item>
                      <Descriptions.Item label="Conducted On">{moment(details.createdAt).format('LLLL')}</Descriptions.Item>
                    </Descriptions>
                  </div>
                )
              }
            ]}
          />
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
                  {candidateDetails.results[0]?.score || 0} <span className="text-sm font-normal text-slate-400">/ {maxMarks}</span>
                </div>
              </div>
            </div>

            <div>
              <Title level={5} className="mb-4 flex items-center gap-2">
                <Layers size={18} className="text-indigo-600" /> Answer Analysis
              </Title>
              <div className="space-y-3">
                {details.questions.map((q: any, idx: number) => {
                  const answer = candidateDetails.answerSheet?.answers.find((a: any) => a.questionId === q.id);
                  
                  return (
                    <div key={q.id} className="p-4 border border-slate-100 dark:border-white/5 rounded-xl flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Tag className="rounded-md">Q{idx + 1}</Tag>
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
                      <div className="text-right ml-4">
                        <Text className="text-xs font-bold block">{q.weightage} Marks</Text>
                        {answer ? (
                          <CheckCircle2 size={18} className="text-green-500 mt-1 ml-auto" />
                        ) : (
                          <Tag color="default" className="mt-1">Not Answered</Tag>
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
    </DashboardLayout>
  );
}
