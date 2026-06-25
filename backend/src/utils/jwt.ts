import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { Role } from '../services/stateMachine';

export interface JwtPayload {
  sub: string; // user id
  role: Role;
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}
