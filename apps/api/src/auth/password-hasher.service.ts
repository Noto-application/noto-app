import { Injectable } from '@nestjs/common';
import { hash, verify, Algorithm } from '@node-rs/argon2';

import type { PasswordHasher } from '../types/auth.types';

@Injectable()
export class PasswordHasherService implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return hash(password, { algorithm: Algorithm.Argon2id });
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    return verify(passwordHash, password);
  }
}
