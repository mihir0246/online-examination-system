'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Table, 
  Button, 
  Typography, 
  Space, 
  Modal, 
  Form, 
  Input, 
  Popconfirm,
  App,
  Select
} from 'antd';
import { 
  Edit3, 
  Trash2,
} from 'lucide-react';
import { useTrainers, Trainer } from '@/hooks/useTrainers';
import { useSubjects } from '@/hooks/useSubjects';
import { motion } from 'framer-motion';

const { Title } = Typography;

export default function TrainersPage() {
  const { message } = App.useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [searchText, setSearchText] = useState('');
  const { trainers, isLoading, createTrainer, deleteTrainer, isCreating } = useTrainers();
  const { subjects } = useSubjects();
  const [form] = Form.useForm();

  const handleOpenModal = (trainer?: Trainer) => {
    if (trainer) {
      setEditingTrainer(trainer);
      form.setFieldsValue({
        name: trainer.name,
        emailid: trainer.emailid,
        contact: trainer.contact.replace('+91', ''),
        prefix: '+91',
        subjectIds: trainer.subjectIds || []
      });
    } else {
      setEditingTrainer(null);
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const onFinish = async (values: any) => {
    const payload = {
      _id: editingTrainer?.id, // Backend expects _id
      name: values.name,
      emailid: values.emailid,
      contact: values.contact, // We send just the number, backend handles it or we can prefix
      password: values.password,
      subjectIds: values.subjectIds || []
    };
    
    try {
      const data = await createTrainer(payload);
      if (data.success) {
        message.success(data.message);
        setIsModalOpen(false);
      } else {
        message.warning(data.message);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Server Error during teacher registration');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const data = await deleteTrainer(id);
      if (data.success) {
        message.success(data.message);
      } else {
        message.warning(data.message);
      }
    } catch (error: any) {
      message.error('Error during teacher removal');
    }
  };

  const filteredTrainers = trainers?.filter(t => 
    t.name.toLowerCase().includes(searchText.toLowerCase()) ||
    t.emailid.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Email Id',
      dataIndex: 'emailid',
      key: 'emailid',
    },
    {
      title: 'Assigned Subjects',
      key: 'subjects',
      render: (_: any, record: Trainer) => {
        const count = record.subjectIds?.length || 0;
        return count === 0 ? <span className="text-gray-400">None</span> : <span className="font-medium text-blue-600">{count} Subject(s)</span>;
      }
    },
    {
      title: 'Contact Number',
      dataIndex: 'contact',
      key: 'contact',
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: Trainer) => (
        <Space size="middle">
          <Button 
            type="primary" 
            size="small"
            icon={<Edit3 size={14} />} 
            onClick={() => handleOpenModal(record)}
            className="flex items-center justify-center bg-blue-500 rounded-full w-8 h-8 p-0"
          />
          <Popconfirm
            title="Delete Teacher?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button 
              type="primary" 
              danger
              size="small"
              icon={<Trash2 size={14} />} 
              className="flex items-center justify-center bg-red-500 rounded-full w-8 h-8 p-0"
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
           <Button type="primary" onClick={() => handleOpenModal()} suppressHydrationWarning>Add New Teacher</Button>
           <Input 
            placeholder="Search teachers..." 
            className="max-w-xs"
            onChange={e => setSearchText(e.target.value)}
            suppressHydrationWarning
           />
        </div>

        <div className="legacy-card overflow-hidden">
          <div className="bg-[#64748b] p-3 text-white font-bold text-center border-b border-slate-400">
             List of Trainer
          </div>
          <Table 
            columns={columns} 
            dataSource={filteredTrainers} 
            loading={isLoading}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            className="legacy-table"
          />
        </div>

        <Modal
          title={editingTrainer ? 'Update Teacher' : 'Register New Teacher'}
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
            initialValues={{ prefix: '+91' }}
          >
            <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
              <Input placeholder="John Doe" />
            </Form.Item>
            {!editingTrainer && (
              <Form.Item name="emailid" label="Email Address" rules={[{ required: true, type: 'email' }]}>
                <Input placeholder="john@example.com" />
              </Form.Item>
            )}
            <Form.Item label="Phone Number" required>
              <Space.Compact className="w-full">
                <Form.Item name="prefix" noStyle>
                  <Input style={{ width: '20%' }} disabled />
                </Form.Item>
                <Form.Item
                  name="contact"
                  noStyle
                  rules={[{ required: true, len: 10, message: 'Please enter 10 digit number' }]}
                >
                  <Input style={{ width: '80%' }} placeholder="1234567890" />
                </Form.Item>
              </Space.Compact>
            </Form.Item>
            
            <Form.Item name="subjectIds" label="Assign Subjects">
              <Select 
                mode="multiple" 
                placeholder="Select subjects for this teacher"
                options={subjects?.map(s => ({ label: s.topic, value: s.id })) || []}
                allowClear
              />
            </Form.Item>

            {!editingTrainer && (
              <Form.Item name="password" label="Initial Password" rules={[{ required: true }]}>
                <Input.Password placeholder="••••••••" />
              </Form.Item>
            )}
            <Button type="primary" htmlType="submit" block loading={isCreating}>
              {editingTrainer ? 'Save Changes' : 'Register Teacher'}
            </Button>
          </Form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
