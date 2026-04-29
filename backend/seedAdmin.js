const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
require('dotenv').config();

const seedAdmin = async () => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@gmail.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

        if (adminPassword === 'admin') {
            console.warn('WARNING: Using default admin password. Set ADMIN_PASSWORD env variable for production.');
        }

        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const resetPassword = process.env.RESET_ADMIN_PASSWORD === 'true';

        const existing = await prisma.user.findUnique({
            where: { emailid: adminEmail }
        });

        if (existing) {
            if (resetPassword) {
                await prisma.user.update({
                    where: { emailid: adminEmail },
                    data: { password: hashedPassword }
                });
                console.log('Admin password reset successfully!');
            } else {
                console.log('Admin user already exists. Use RESET_ADMIN_PASSWORD=true to update password.');
            }
        } else {
            await prisma.user.create({
                data: {
                    name: 'Admin',
                    emailid: adminEmail,
                    password: hashedPassword,
                    contact: '0000000000',
                    type: 'ADMIN',
                    status: true
                }
            });
            console.log('Admin user created successfully!');
        }

        process.exit(0);
    } catch (err) {
        console.error('Error seeding admin:', err);
        process.exit(1);
    }
};

seedAdmin();

