'use client';

import React, { useState } from 'react';
import { Layout, Menu, Button } from 'antd';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  HelpCircle, 
  FileText, 
  LogOut,
  Menu as MenuIcon
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, logout } from '@/lib/store';

const { Header, Sider, Content } = Layout;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.userDetails);

  const handleLogout = () => {
    dispatch(logout());
    router.push('/login');
  };

  const menuItems = [
    { key: '/dashboard', icon: <LayoutDashboard size={22} />, label: 'Dashboard' },
    ...(user?.type === 'ADMIN' ? [
      { key: '/dashboard/trainers', icon: <Users size={22} />, label: 'Teachers' }
    ] : []),
    { key: '/dashboard/subjects', icon: <BookOpen size={22} />, label: 'Subjects' },
    { key: '/dashboard/questions', icon: <HelpCircle size={22} />, label: 'Questions' },
    { key: '/dashboard/tests', icon: <FileText size={22} />, label: 'Exams' },
  ];

  return (
    <Layout className="min-h-screen">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={240}
        collapsedWidth={70}
        className="bg-[#0d121b] border-r border-white/5 hidden md:block"
        style={{
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          background: '#0d121b'
        }}
      >
        <div className="h-16 flex items-center justify-center border-b border-white/5 cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
           <MenuIcon size={24} className="text-white" />
        </div>

        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[pathname]}
          className="bg-transparent border-none mt-4"
          items={menuItems.map(item => ({
            key: item.key,
            icon: item.icon,
            label: <Link href={item.key}>{item.label}</Link>,
          }))}
        />
      </Sider>

      <Layout className={collapsed ? "md:ml-[70px] transition-all duration-300" : "md:ml-[240px] transition-all duration-300"}>
        <Header className="bg-[#020617] border-b border-white/5 px-6 flex items-center justify-between sticky top-0 z-[90] h-16">
          <div className="flex items-center gap-4">
             {/* Logo */}
             <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-900/50 border border-green-500 flex items-center justify-center rounded text-green-500 font-bold text-xs">NP</div>
             </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="w-8 h-8 rounded-full bg-[#0088cc] flex items-center justify-center cursor-pointer hover:bg-[#0077bb] transition-colors" onClick={handleLogout}>
                <LogOut size={16} className="text-white" />
             </div>
          </div>
        </Header>

        <Content className="p-6 bg-[#e2e8f0] min-h-[calc(100vh-64px)]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </Content>
      </Layout>
    </Layout>
  );
}
