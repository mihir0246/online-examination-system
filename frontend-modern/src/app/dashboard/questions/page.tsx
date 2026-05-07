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
  Select,
  Space,
  Popconfirm,
  Tag,
  Upload,
  Alert,
  Divider,
  App
} from 'antd';
import { 
  Plus,
  Info,
  Trash2,
  Upload as UploadIcon,
  Download,
  FileText,
  FileSearch
} from 'lucide-react';
import { useQuestions, Question } from '@/hooks/useQuestions';
import { useSubjects } from '@/hooks/useSubjects';
import apiClient from '@/services/apiClient';

const { Title, Text } = Typography;
const { Option } = Select;

export default function QuestionsPage() {
  const { message } = App.useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const { questions, isLoading, createQuestion, deleteQuestion, deleteAllQuestions, bulkCreate, isCreating, isDeleting } = useQuestions();
  const { subjects } = useSubjects();
  const [form] = Form.useForm();
  const [bulkForm] = Form.useForm();

  const handleOpenModal = (question?: Question) => {
    if (question) {
      setEditingQuestion(question);
      form.setFieldsValue({
        question: question.body,
        subjectId: question.subjectId,
        level: question.difficulty.toString(),
        type: question.type || 'MCQ',
        op1: question.options[0]?.optbody,
        op2: question.options[1]?.optbody,
        op3: question.options[2]?.optbody,
        op4: question.options[3]?.optbody,
        ans: (question.options.findIndex(o => o.isAnswer) + 1).toString(),
        explanation: question.explanation
      });
    } else {
      setEditingQuestion(null);
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const onFinish = async (values: any) => {
    await createQuestion(values);
    setIsModalOpen(false);
  };

  const handleFileChange = async (info: any) => {
    const file = info.file;
    if (!file) return;

    // If CSV, handle locally as before
    if (file.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const rows = text.split('\n').filter(row => row.trim() !== '');
        const startIndex = rows[0].toLowerCase().includes('question') ? 1 : 0;
        const parsed = rows.slice(startIndex).map(row => {
          const [body, op1, op2, op3, op4, ans, level, explanation] = row.split(',').map(s => s.trim());
          const options = [op1, op2, op3, op4].filter(o => o).map((o, i) => ({ optbody: o, isAnswer: ans === (i + 1).toString() }));
          return {
            body,
            type: options.length > 0 ? "MCQ" : "TEXT",
            options,
            explanation: explanation || "Imported from CSV",
            difficulty: parseInt(level) || 0
          };
        }).filter(q => q.body);
        setParsedPreview(parsed);
      };
      reader.readAsText(file);
    } else {
      // PDF or Word - send to backend for parsing
      setIsParsing(true);
      const formData = new FormData();
      formData.append('file', file);
      try {
        const { data } = await apiClient.post('/api/v1/questions/upload-parse', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (data.success) {
          setParsedPreview(data.data);
          message.success(`${data.data.length} questions extracted! Review them below.`);
        }
      } catch (error) {
        message.error("Failed to parse file. Please use the CSV template.");
      } finally {
        setIsParsing(false);
      }
    }
  };

  const confirmBulkImport = async () => {
    const subjectId = bulkForm.getFieldValue('subjectId');
    if (!subjectId) return message.error("Please select a target topic first");
    if (parsedPreview.length === 0) return message.error("No questions found in file");

    await bulkCreate({ questions: parsedPreview, subjectId });
    setIsBulkModalOpen(false);
    setParsedPreview([]);
    bulkForm.resetFields();
  };

  const downloadSample = () => {
    const csvContent = "Question,Option 1,Option 2,Option 3,Option 4,Correct Answer (1-4),Level (0-2),Explanation\nWhat is React?,A Library,A Framework,A Language,A Tool,1,0,React is a UI library\nDefine a Hook,,,,,,0,Hooks let you use state and other React features without writing a class.\n";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'question_bank_template.csv';
    a.click();
  };

  const filteredQuestions = questions?.filter(q => {
    const matchesSearch = q.body.toLowerCase().includes(searchText.toLowerCase()) ||
                          q.subject?.topic.toLowerCase().includes(searchText.toLowerCase());
    const matchesSubject = selectedSubject ? q.subjectId === selectedSubject : true;
    return matchesSearch && matchesSubject;
  });

  const handleDeleteAll = () => {
    if (!selectedSubject) {
      message.error("Please select a specific subject from the filter dropdown first to delete its questions.");
      return;
    }
    deleteAllQuestions(selectedSubject);
  };

  const columns = [
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'MCQ' ? 'blue' : 'purple'}>{type}</Tag>
      )
    },
    {
      title: 'Question',
      dataIndex: 'body',
      key: 'body',
      ellipsis: true,
      render: (text: string) => <Text className="font-medium">{text}</Text>
    },
    {
      title: 'Topic',
      key: 'topic',
      render: (_: any, record: Question) => record.subject?.topic || 'N/A'
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      render: (_: any, record: Question) => (
        <Space size="small">
          <Button 
            type="primary" 
            size="small"
            icon={<Info size={14} />} 
            onClick={() => handleOpenModal(record)}
            className="flex items-center justify-center bg-blue-500 rounded-full w-8 h-8 p-0"
          />
          <Popconfirm
            title="Delete Question?"
            onConfirm={() => deleteQuestion(record.id)}
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
      <div className="space-y-6" suppressHydrationWarning>
        <div className="flex justify-between items-center mb-4">
           <Space>
             <Button 
              type="primary" 
              icon={<Plus size={18} className="mr-1" />} 
              onClick={() => handleOpenModal()}
              className="flex items-center"
              suppressHydrationWarning
             >
              Add New Question
             </Button>
             <Button 
              icon={<UploadIcon size={18} className="mr-1" />} 
              onClick={() => setIsBulkModalOpen(true)}
              className="flex items-center border-blue-500 text-blue-500"
              suppressHydrationWarning
             >
              Bulk Upload (PDF/Word/CSV)
             </Button>
             <Popconfirm
               title="Delete Questions for Selected Subject?"
               description="This will permanently remove all questions for the currently selected subject. This action cannot be undone."
               onConfirm={handleDeleteAll}
               okText="Yes, delete all"
               cancelText="Cancel"
               okButtonProps={{ danger: true, loading: isDeleting }}
             >
               <Button 
                danger
                icon={<Trash2 size={18} className="mr-1" />}
                loading={isDeleting}
                className="flex items-center"
                suppressHydrationWarning
               >
                Delete All
               </Button>
             </Popconfirm>
           </Space>
           <Space>
             <Select
               placeholder="Filter by Subject"
               allowClear
               style={{ width: 200 }}
               onChange={(val) => setSelectedSubject(val)}
               options={subjects?.map(s => ({ label: s.topic, value: s.id })) || []}
             />
             <Input 
              placeholder="Search questions..." 
              className="max-w-xs"
              onChange={e => setSearchText(e.target.value)}
             />
           </Space>
        </div>

        <div className="legacy-card overflow-hidden">
          <div className="bg-[#64748b] p-3 text-white font-bold text-center border-b border-slate-400">
             List of Questions (Mixed MCQ & Descriptive)
          </div>
          <Table 
            columns={columns} 
            dataSource={filteredQuestions} 
            loading={isLoading}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            className="legacy-table"
          />
        </div>

        {/* Bulk Upload Modal */}
        <Modal
          title="Bulk Question Import"
          open={isBulkModalOpen}
          onCancel={() => { setIsBulkModalOpen(false); setParsedPreview([]); }}
          footer={null}
          width={800}
          destroyOnHidden
          centered
        >
          <div className="mb-4">
            <Alert 
              title="Supported Formats: PDF, Word (.docx), CSV, Text"
              description={
                <div className="text-xs">
                  <p>• MCQ pattern: Q: [Text], 1: [Opt], 2: [Opt], Ans: 1</p>
                  <p>• Text pattern: Q: [Text] (with no options detected)</p>
                  <Button type="link" size="small" icon={<Download size={12} />} onClick={downloadSample} className="p-0 mt-1">Download CSV Template</Button>
                </div>
              }
              type="info"
              showIcon
            />
          </div>
          <Form
            form={bulkForm}
            layout="vertical"
          >
            <Form.Item name="subjectId" label="Target Topic" rules={[{ required: true }]}>
              <Select placeholder="Select subject">
                {subjects?.map(s => (
                  <Option key={s.id} value={s.id}>{s.topic}</Option>
                ))}
              </Select>
            </Form.Item>
            
            <Upload.Dragger 
              accept=".csv,.pdf,.docx,.txt" 
              maxCount={1} 
              beforeUpload={(file) => { handleFileChange({ file }); return false; }}
              showUploadList={false}
            >
              <p className="ant-upload-drag-icon">
                {isParsing ? <FileSearch size={40} className="animate-pulse text-blue-500 mx-auto" /> : <UploadIcon size={40} className="text-slate-400 mx-auto" />}
              </p>
              <p className="ant-upload-text">Click or drag file to parse questions</p>
            </Upload.Dragger>

            {parsedPreview.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <Title level={5} className="mb-0">
                    Preview — {parsedPreview.length} question{parsedPreview.length !== 1 ? 's' : ''} detected
                  </Title>
                  <Text type="secondary" className="text-xs">
                    ✏️ Edit text, 🗑 delete bad extractions, or ⬇ merge split questions
                  </Text>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {parsedPreview.map((q: any, i: number) => (
                    <div key={i} className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-mono text-slate-400 mt-2 w-6 shrink-0">{i + 1}.</span>
                        <Input.TextArea
                          autoSize={{ minRows: 1, maxRows: 5 }}
                          value={q.body}
                          onChange={(e) => {
                            const updated = [...parsedPreview];
                            updated[i] = { ...updated[i], body: e.target.value };
                            setParsedPreview(updated);
                          }}
                          className="text-sm flex-1 border-0 bg-transparent resize-none focus:bg-slate-50 rounded"
                        />
                        <div className="flex flex-col gap-1 shrink-0">
                          {/* Split at sentence boundary */}
                          <Button
                            size="small"
                            title="Split into two questions"
                            onClick={() => {
                              const text = parsedPreview[i].body;
                              // Find split point: ". C" or "? C" or "! C" (sentence + capital)
                              const splitIdx = text.search(/[.?!]\s+(?=[A-Z])/);
                              const at = splitIdx > 0 ? splitIdx + 1 : Math.floor(text.length / 2);
                              const part1 = text.slice(0, at).trim();
                              const part2 = text.slice(at).trim();
                              if (!part2) return;
                              const updated = [...parsedPreview];
                              updated[i] = { ...updated[i], body: part1 };
                              updated.splice(i + 1, 0, { ...updated[i], body: part2 });
                              setParsedPreview(updated);
                            }}
                            className="text-xs px-2 text-blue-600 border-blue-300"
                          >
                            ✂ Split
                          </Button>
                          {/* Merge with next */}
                          {i < parsedPreview.length - 1 && (
                            <Button
                              size="small"
                              title="Merge with question below"
                              onClick={() => {
                                const updated = [...parsedPreview];
                                updated[i] = { ...updated[i], body: updated[i].body + ' ' + updated[i + 1].body };
                                updated.splice(i + 1, 1);
                                setParsedPreview(updated);
                              }}
                              className="text-xs px-2"
                            >
                              ⬇ Merge
                            </Button>
                          )}
                          {/* Delete */}
                          <Button
                            size="small"
                            danger
                            title="Remove this item"
                            onClick={() => {
                              const updated = parsedPreview.filter((_: any, idx: number) => idx !== i);
                              setParsedPreview(updated);
                            }}
                            icon={<Trash2 size={12} />}
                            className="text-xs px-2"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button 
              type="primary" 
              block 
              loading={isCreating || isParsing} 
              className="h-11 mt-4 bg-blue-600"
              onClick={confirmBulkImport}
              disabled={parsedPreview.length === 0}
            >
              Confirm & Import to Database
            </Button>
          </Form>
        </Modal>

        {/* Single Question Modal */}
        <Modal
          title={editingQuestion ? 'Edit Question' : 'Add New Question'}
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          footer={null}
          width={700}
          destroyOnHidden
          centered
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            className="mt-6"
          >
            <Form.Item name="subjectId" label="Select Topic" rules={[{ required: true }]}>
              <Select placeholder="Select subject">
                {subjects?.map(s => (
                  <Option key={s.id} value={s.id}>{s.topic}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="type" label="Question Type" initialValue="MCQ">
              <Select onChange={(val) => form.setFieldsValue({ type: val })}>
                <Option value="MCQ">Multiple Choice (MCQ)</Option>
                <Option value="TEXT">Descriptive (TEXT)</Option>
              </Select>
            </Form.Item>

            <Form.Item name="question" label="Question" rules={[{ required: true }]}>
              <Input.TextArea rows={3} placeholder="Type your question here..." />
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}>
              {({ getFieldValue }) => 
                getFieldValue('type') === 'MCQ' ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <Form.Item name="op1" label="Option 1" rules={[{ required: true }]}>
                        <Input placeholder="Option 1" />
                      </Form.Item>
                      <Form.Item name="op2" label="Option 2" rules={[{ required: true }]}>
                        <Input placeholder="Option 2" />
                      </Form.Item>
                      <Form.Item name="op3" label="Option 3" rules={[{ required: true }]}>
                        <Input placeholder="Option 3" />
                      </Form.Item>
                      <Form.Item name="op4" label="Option 4" rules={[{ required: true }]}>
                        <Input placeholder="Option 4" />
                      </Form.Item>
                    </div>

                    <Form.Item name="ans" label="Correct Answer" rules={[{ required: true }]}>
                      <Select placeholder="Select Answer">
                        <Option value="1">Option 1</Option>
                        <Option value="2">Option 2</Option>
                        <Option value="3">Option 3</Option>
                        <Option value="4">Option 4</Option>
                      </Select>
                    </Form.Item>
                  </>
                ) : (
                  <Alert title="Descriptive questions do not require options. Students will provide text answers." type="info" showIcon className="mb-4" />
                )
              }
            </Form.Item>

            <Form.Item name="level" label="Difficulty Level" rules={[{ required: true }]}>
              <Select placeholder="Difficulty">
                <Option value="0">Easy</Option>
                <Option value="1">Medium</Option>
                <Option value="2">Hard</Option>
              </Select>
            </Form.Item>

            <Form.Item name="explanation" label="Explanation / Sample Answer" rules={[{ required: true }]}>
              <Input.TextArea rows={2} placeholder="Provide reference answer or explanation..." />
            </Form.Item>

            <Button type="primary" htmlType="submit" block loading={isCreating} className="h-11 mt-4 bg-blue-600">
              {editingQuestion ? 'Update Question' : 'Add Question'}
            </Button>
          </Form>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
