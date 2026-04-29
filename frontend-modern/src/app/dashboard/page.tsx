'use client';

import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Typography, Row, Col, Card } from 'antd';
import { Info, Edit3, Trash2, CheckCircle, FileText, BarChart, Download } from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store';

const { Title, Text, Paragraph } = Typography;

export default function DashboardPage() {
  const user = useSelector((state: RootState) => state.auth.userDetails);

  return (
    <DashboardLayout>
      <div className="space-y-8 bg-slate-200 p-8 rounded-lg">
        {/* Admin Instructions Section */}
        <section>
          <Title level={3} className="text-slate-800 font-bold mb-4">Admin Instructions</Title>
          
          <div className="space-y-6">
            <div>
              <Text className="font-bold block mb-2">1. All Teachers</Text>
              <Paragraph className="ml-4 mb-0">List of existing teachers.</Paragraph>
              <ul className="list-none ml-8 space-y-1">
                <li className="flex items-center gap-2">• Add New - Create new teacher account.</li>
                <li className="flex items-center gap-2">• Action - 
                   <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white"><Edit3 size={12} /></span> Edit teacher details.
                </li>
                <li className="flex items-center gap-2 ml-14">
                   <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white"><Trash2 size={12} /></span> Delete teacher account.
                </li>
              </ul>
            </div>

            <div>
              <Text className="font-bold block mb-2">2. All Subjects</Text>
              <Paragraph className="ml-4 mb-0">List of existing subjects.</Paragraph>
              <ul className="list-none ml-8 space-y-1">
                <li className="flex items-center gap-2">• Add New - Create new subject.</li>
                <li className="flex items-center gap-2">• Action - 
                   <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white"><Edit3 size={12} /></span> Edit subject name.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Teacher Instructions Section */}
        <section>
          <Title level={3} className="text-slate-800 font-bold mb-4">Teacher Instructions</Title>
          
          <div className="space-y-6">
            <div>
              <Text className="font-bold block mb-2">1. All Questions</Text>
              <Paragraph className="ml-4 mb-0">List of existing questions.</Paragraph>
              <ul className="list-none ml-8 space-y-1">
                <li className="flex items-center gap-2">• Add New - Create new question.</li>
                <li className="flex items-center gap-2">• Action - 
                   <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white"><Info size={12} /></span> Question details & body.
                </li>
                <li className="flex items-center gap-2 ml-14">
                   <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white"><Trash2 size={12} /></span> Delete question.
                </li>
              </ul>
            </div>

            <div>
              <Text className="font-bold block mb-2">2. All Exams</Text>
              <Paragraph className="ml-4 mb-0">List of existing exams.</Paragraph>
              <ul className="list-none ml-8 space-y-1">
                <li className="flex items-center gap-2">• Action - <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white"><Info size={12} /></span>
                   <ul className="list-none ml-6 space-y-1 mt-1">
                      <li>• Test Details</li>
                      <li>• Test Questions</li>
                      <li>• Candidates List of Registered Candidates</li>
                      <li>• Statistics - 
                         <ul className="list-none ml-6 space-y-1 mt-1">
                            <li>▪ Download excel sheet of results</li>
                            <li>▪ Graphical representation of results</li>
                         </ul>
                      </li>
                   </ul>
                </li>
              </ul>
            </div>

            <div>
              <Text className="font-bold block mb-2">3. New Exams</Text>
              <ul className="list-none ml-4 space-y-2">
                 <li>• Create new test
                    <ol className="list-decimal ml-8 mt-1">
                       <li>Enter basic test details</li>
                       <li>Select Questions
                          <ul className="list-none mt-1">
                             <li>▪ Questions - Random &gt; Enter number of questions to be selected automatically and click Generate Test Paper. Click Next to proceed.</li>
                             <li>▪ Questions - Manually &gt; Select Questions manually . Click Next to proceed.</li>
                          </ul>
                       </li>
                    </ol>
                 </li>
                 <li>• Basic test info
                    <ul className="list-none ml-8 mt-1 space-y-1">
                       <li>• Registration link - The link for Registration of candidate for the test.</li>
                       <li>• Stop Registration - Click to disable Registration Link.</li>
                       <li>• Reload - Click to get the list of registered candidates.</li>
                       <li>• Start Test - Click to begin test.</li>
                       <li>• End Test - Click to end test.</li>
                    </ul>
                 </li>
              </ul>
              <Paragraph className="font-bold mt-4">NOTE-A link for this test has been sent to the email id of registered candidates. Click on the link to take test.</Paragraph>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
