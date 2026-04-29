'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Table, 
  Button, 
  Typography, 
  Modal, 
  Form, 
  Input, 
  App
} from 'antd';
import { 
  Edit3
} from 'lucide-react';
import { useSubjects, Subject } from '@/hooks/useSubjects';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store';

const { Title } = Typography;

export default function SubjectsPage() {
  const { message } = App.useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [searchText, setSearchText] = useState('');
  const { subjects, isLoading, createSubject, isCreating } = useSubjects();
  const [form] = Form.useForm();
  const user = useSelector((state: RootState) => state.auth.userDetails);
  const isAdmin = user?.type === 'ADMIN';

  const handleOpenModal = (subject?: Subject) => {
    if (!isAdmin) return;
    if (subject) {
      setEditingSubject(subject);
      form.setFieldsValue({
        topic: subject.topic,
      });
    } else {
      setEditingSubject(null);
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const onFinish = async (values: any) => {
    if (!isAdmin) return;
    const payload = {
      _id: editingSubject?.id,
      topic: values.topic,
    };
    
    try {
      const data = await createSubject(payload);
      if (data.success) {
        message.success(data.message);
        setIsModalOpen(false);
      } else {
        message.warning(data.message);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Server Error during subject operation');
    }
  };

  const filteredSubjects = subjects?.filter(s => 
    s.topic.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: 'Name',
      dataIndex: 'topic',
      key: 'topic',
    },
    ...(isAdmin ? [{
      title: 'Action',
      key: 'action',
      width: 120,
      render: (_: any, record: Subject) => (
        <Button 
          type="primary" 
          icon={<Edit3 size={14} />} 
          onClick={() => handleOpenModal(record)}
          className="bg-blue-500 rounded-full w-8 h-8 p-0 flex items-center justify-center"
        />
      )
    }] : [])
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-4">
           {isAdmin && (
             <Button type="primary" onClick={() => handleOpenModal()}>Add New Subject</Button>
           )}
           <Input 
            placeholder="Search subjects..." 
            className="max-w-xs"
            onChange={e => setSearchText(e.target.value)}
            suppressHydrationWarning
           />
        </div>

        <div className="legacy-card overflow-hidden">
          <div className="bg-[#64748b] p-3 text-white font-bold text-center border-b border-slate-400">
             List of Topics
          </div>
          <Table 
            columns={columns} 
            dataSource={filteredSubjects} 
            loading={isLoading}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            className="legacy-table"
          />
        </div>

        <Modal
          title={editingSubject ? 'Update Topic' : 'Add New Topic'}
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          footer={null}
          destroyOnHidden
          centered
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            className="mt-6"
          >
            <Form.Item
              name="topic"
              label="Topic Name"
              rules={[{ required: true }]}
            >
              <Input placeholder="e.g. Computer Science" />
            </Form.Item>

            <Button type="primary" htmlType="submit" block loading={isCreating}>
              {editingSubject ? 'Save Changes' : 'Create Topic'}
            </Button>
          </Form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
