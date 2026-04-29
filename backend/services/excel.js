const Excel = require('exceljs');
const prisma = require("./prisma");
const logger = require("./logger");
const { uploadToS3 } = require("./s3");

const result = async (testid) => {
  try {
    const test = await prisma.test.findUnique({
      where: { id: testid, testconducted: true },
      select: { title: true, type: true, questions: { select: { weightage: true } } }
    });

    if (!test) throw new Error("Test not found or not conducted");

    const results = await prisma.result.findMany({
      where: { trainee: { testId: testid } },
      include: { trainee: true }
    });

    const maxMarks = test.questions.reduce((sum, q) => sum + q.weightage, 0);

    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Results');

    worksheet.columns = [
      { header: 'Type', key: 'Type', width: 20 },
      { header: 'Test-Title', key: 'Title', width: 20 },
      { header: 'Name', key: 'Name', width: 30 },
      { header: 'Email', key: 'Email', width: 40 },
      { header: 'Contact', key: 'Contact', width: 20 },
      { header: 'Organisation', key: 'Organisation', width: 30 },
      { header: 'Score', key: 'Score', width: 10 },
      { header: 'Max Marks', key: 'Outof', width: 10 }
    ];

    results.forEach(d => {
      worksheet.addRow({
        Name: d.trainee.name,
        Email: d.trainee.emailid,
        Contact: d.trainee.contact,
        Organisation: d.trainee.organisation,
        Type: test.type,
        Title: test.title,
        Score: d.score,
        Outof: maxMarks
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `results/result-${testid}-${Date.now()}.xlsx`;

    const url = await uploadToS3(buffer, fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return url;

  } catch (err) {
    logger.error(`Excel generation error: ${err.message}`);
    throw err;
  }
};

module.exports = { result };
