import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { signToken } from '../utils/jwt';
import { Role } from '../services/stateMachine';

let counter = 0;

export async function createTestUser(role: Role, namePrefix = 'Test') {
  counter += 1;
  const email = `${namePrefix.toLowerCase()}-${role.toLowerCase()}-${Date.now()}-${counter}@example.com`;
  const passwordHash = await bcrypt.hash('password123', 4); // low cost factor: faster tests
  const user = await prisma.user.create({
    data: { email, name: `${namePrefix} ${role}`, role, passwordHash },
  });
  const token = signToken({ sub: user.id, role: user.role as Role, email: user.email });
  return { user, token };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
