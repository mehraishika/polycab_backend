import { compare, hash } from 'bcryptjs';

const PASSWORD_SALT_ROUNDS = 10;

interface VerifyPasswordInput {
	plainPassword: string;
	storedPassword?: string;
	storedPasswordHash?: string;
}

export async function verifyPassword({
	plainPassword,
	storedPassword,
	storedPasswordHash,
}: VerifyPasswordInput): Promise<boolean> {
	if (storedPasswordHash) {
		return compare(plainPassword, storedPasswordHash);
	}

	if (storedPassword) {
		return plainPassword === storedPassword;
	}

	return false;
}

export async function hashPassword(plainPassword: string): Promise<string> {
	return hash(plainPassword, PASSWORD_SALT_ROUNDS);
}
