'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Table, 
  Button, 
  Typography, 
  Space,
  Tag,
  Input,
  Select,
  Popconfirm
} from 'antd';
import { 
  Plus,
  Info,
  BarChart2,
  Trash2
} from 'lucide-react';
import { useExams, Exam } from '@/hooks/useExams';
import { useSubjects } from '@/hooks/useSubjects';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const { Option } = Select;

const { Title, Text } = Typography;

export default function ExamsPage() {
  const [searchText, setSearchText] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const { exams, isLoading, deleteTest } = useExams();
  const { subjects } = useSubjects();
  const router = useRouter();

  const filteredExams = exams?.filter(e => {
    const matchesSearch = (e.testName || '').toLowerCase().includes((searchText || '').toLowerCase()) ||
                          (e.testId || '').toLowerCase().includes((searchText || '').toLowerCase());
    
    if (selectedTopic === 'all') return matchesSearch;
    
    // Check if the exam has the selected topic
    const hasTopic = e.subjects?.some(s => s.id === selectedTopic || s.topic === selectedTopic);
    return matchesSearch && hasTopic;
  });

  const columns = [
    {
      title: 'Test Id',
      dataIndex: 'testId',
      key: 'testId',
      render: (text: string) => <Text className="font-bold">{text}</Text>
    },
    {
      title: 'Test Name',
      dataIndex: 'testName',
      key: 'testName',
    },
    {
      title: 'Topic',
      key: 'topic',
      render: (_: any, record: Exam) => {
        if (!record.subjects || record.subjects.length === 0) return 'N/A';
        return record.subjects.map(s => s.topic).join(', ');
      }
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      render: (min: number) => `${min} mins`
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: boolean) => (
        <Tag color={status ? 'green' : 'red'}>
          {status ? 'ACTIVE' : 'INACTIVE'}
        </Tag>
      )
    },
    {
      title: 'Action',
      key: 'action',
      width: 150,
      render: (_: any, record: Exam) => (
        <Space size="small">
          <Link href={`/dashboard/tests/${record.id}`}>
            <Button 
              type="primary" 
              size="small"
              icon={<Info size={14} />} 
              className="flex items-center justify-center bg-blue-500 rounded-full w-8 h-8 p-0"
            />
          </Link>
          <Button 
            type="primary" 
            size="small"
            icon={<BarChart2 size={14} />} 
            className="flex items-center justify-center bg-green-500 rounded-full w-8 h-8 p-0"
            onClick={() => router.push(`/dashboard/tests/${record.id}/analytics`)}
          />
          <Popconfirm
            title="Delete this test?"
            description="Are you sure you want to delete this test? This action is permanent."
            onConfirm={() => deleteTest(record.id)}
            okText="Yes, delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button 
              danger
              type="primary" 
              size="small"
              icon={<Trash2 size={14} />} 
              className="flex items-center justify-center rounded-full w-8 h-8 p-0"
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
         <div className="flex justify-between items-center mb-4">
           <Link href="/dashboard/tests/create">
             <Button 
              type="primary" 
              icon={<Plus size={18} className="mr-1" />} 
              className="flex items-center"
              suppressHydrationWarning
             >
              Create New Test
             </Button>
           </Link>
           <div className="flex gap-4 items-center">
             <Select
                value={selectedTopic}
                onChange={setSelectedTopic}
                style={{ width: 200 }}
                placeholder="Filter by Topic"
             >
                <Option value="all">All Topics</Option>
                {subjects?.map(s => (
                  <Option key={s.id || s._id} value={s.id || s._id}>{s.topic}</Option>
                ))}
             </Select>
             <Input 
              placeholder="Search exams..." 
              className="max-w-xs"
              onChange={e => setSearchText(e.target.value)}
              suppressHydrationWarning
             />
           </div>
        </div>

        <div className="legacy-card overflow-hidden">
          <div className="bg-[#64748b] p-3 text-white font-bold text-center border-b border-slate-400">
             List of existing tests
          </div>
          <Table 
            columns={columns} 
            dataSource={filteredExams} 
            loading={isLoading}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            className="legacy-table"
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
