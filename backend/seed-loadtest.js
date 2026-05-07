import prisma from './services/prisma.js';

async function seed() {
  const user = await prisma.user.upsert({
    where: { emailid: 'loadtest@example.com' },
    update: {},
    create: {
      name: 'Load Test Admin',
      emailid: 'loadtest@example.com',
      password: 'password',
      contact: '0000000000'
    }
  });

  const subject = await prisma.subject.upsert({
    where: { topic: 'Load Test Subject' },
    update: {},
    create: { topic: 'Load Test Subject' }
  });

  const test = await prisma.test.create({
    data: {
      type: "MOCK",
      title: "Load Test Exam",
      duration: 60,
      testbegins: true,
      testconducted: false,
      isRegistrationavailable: true,
      createdById: user.id,
      subjectIds: [subject.id],
      questions: {
        create: Array.from({ length: 5 }).map((_, i) => ({
          body: `Q${i+1}`,
          explanation: "none",
          subjectId: subject.id,
          createdById: user.id,
          options: {
            create: [
              { optbody: "A", isAnswer: true },
              { optbody: "B", isAnswer: false }
            ]
          }
        }))
      }
    }
  });
  console.log(test.id);
}

seed().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});
