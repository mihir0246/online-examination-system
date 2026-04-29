'use client';

import React, { Suspense } from 'react';
import { 
  Typography, 
  Card, 
  Form, 
  Input, 
  Button, 
  Select, 
  Row, 
  Col, 
  Result,
  message 
} from 'antd';
import { 
  User, 
  Mail, 
  Phone, 
  Building2, 
  MapPin, 
  ArrowRight, 
  Send,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useExam } from '@/hooks/useExam';
import { useSearchParams } from 'next/navigation';


const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

function RegisterForm() {
  const [hasHydrated, setHasHydrated] = React.useState(false);
  const searchParams = useSearchParams();
  const testId = searchParams.get('testid');
  const { register, isRegistering, registrationSuccess, candidate, resendMail, isResending } = useExam();
  const [form] = Form.useForm();

  React.useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (!hasHydrated) {
    return null; // Prevent hydration mismatch by only rendering on client
  }

  const onFinish = async (values: any) => {
    if (!testId) {
      message.error('Invalid test link. Missing Test ID.');
      return;
    }
    
    await register({
      ...values,
      testid: testId
    });
  };

  if (registrationSuccess && candidate) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl"
      >
        <Card className="glass-card border-none shadow-2xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-green-600" />
          </div>
          <Title level={2}>Registration Successful!</Title>
          <Paragraph className="text-lg text-slate-500 mb-8">
            An email containing your unique examination link has been sent to <br />
            <Text className="font-bold text-indigo-600">{candidate.emailid}</Text>
          </Paragraph>
          
          <div className="space-y-4">
            <Button 
              type="primary" 
              size="large" 
              icon={<Send size={18} />}
              loading={isResending}
              onClick={() => resendMail(candidate._id)}
              className="h-12 px-8 rounded-xl font-bold"
            >
              Resend Examination Link
            </Button>

          </div>
          
          <div className="mt-12 p-4 bg-amber-50 rounded-xl border border-amber-100 text-left">
            <Text className="text-amber-800 font-bold block mb-1">Important Note:</Text>
            <Text className="text-amber-700 text-xs">
              Please check your spam folder if you don't receive the email within 2 minutes. 
              The link is unique to you and should not be shared.
            </Text>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-3xl"
    >
      <div className="text-center mb-10">
        <Title level={1} className="heading-gradient mb-2">Candidate Registration</Title>
        <Paragraph className="text-slate-500 text-lg">Enter your details to register for the examination portal.</Paragraph>
      </div>

      <Card className="glass-card border-none shadow-2xl p-6">
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ prefix: '+91' }}
        >
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="Full Name"
                rules={[{ required: true, message: 'Please enter your name' }]}
              >
                <Input prefix={<User size={16} className="text-slate-400 mr-2" />} placeholder="John Doe" size="large" className="h-12" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="emailid"
                label="Email Address"
                rules={[
                  { required: true, message: 'Please enter email' },
                  { type: 'email', message: 'Enter a valid email' }
                ]}
              >
                <Input prefix={<Mail size={16} className="text-slate-400 mr-2" />} placeholder="john@company.com" size="large" className="h-12" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <div className="grid grid-cols-4 gap-3">
                <Form.Item name="prefix" label="Prefix" className="col-span-1">
                  <Input disabled size="large" className="h-12" />
                </Form.Item>
                <Form.Item
                  name="contact"
                  label="Phone Number"
                  className="col-span-3"
                  rules={[
                    { required: true, message: 'Please enter phone' },
                    { len: 10, message: 'Must be 10 digits' }
                  ]}
                >
                  <Input prefix={<Phone size={16} className="text-slate-400 mr-2" />} placeholder="1234567890" size="large" className="h-12" />
                </Form.Item>
              </div>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="organisation"
                label="Organisation / College"
                rules={[{ required: true, message: 'Please enter organisation' }]}
              >
                <Input prefix={<Building2 size={16} className="text-slate-400 mr-2" />} placeholder="Acme University" size="large" className="h-12" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                name="location"
                label="Location / City"
                rules={[{ required: true, message: 'Please enter location' }]}
              >
                <Input prefix={<MapPin size={16} className="text-slate-400 mr-2" />} placeholder="New York, USA" size="large" className="h-12" />
              </Form.Item>
            </Col>
          </Row>

          <div className="pt-6 border-t border-slate-100 dark:border-white/5 mt-4">
            <Button 
              type="primary" 
              htmlType="submit" 
              block 
              size="large" 
              loading={isRegistering}
              className="h-14 text-lg font-bold rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 border-none flex items-center justify-center gap-3"
            >
              Confirm Registration <ArrowRight size={20} />
            </Button>
          </div>
        </Form>
      </Card>
      
      <div className="mt-8 text-center text-slate-400 text-sm">
        By registering, you agree to follow the examination code of conduct and proctoring guidelines.
      </div>
    </motion.div>
  );
}

export default function CandidateRegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Background Decor */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/3" />
      </div>
      
      <Suspense fallback={<div className="text-center"><Title level={3}>Loading Registration Portal...</Title></div>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
