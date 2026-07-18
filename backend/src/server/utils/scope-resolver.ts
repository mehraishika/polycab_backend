/**
 * Scope Resolver
 * 
 * Determines which user accounts/plants the authenticated user can access.
 * This is critical for security - JWT validates true identity, scope determines data visibility.
 * 
 * Architecture:
 * - JWT determines WHO you are (userId, role)
 * - Scope determines WHAT DATA you can see
 * - Request role is only a DATA FILTER, not for access control
 */

import { User } from '@/server/utils/auth-helper';

/**
 * Resolve user's accessible scope (list of userAccount values)
 * 
 * Examples:
 * - End-user: scope = [their userId]
 * - Service user with multiple accounts: scope = [account1, account2, ...]
 * - Admin: scope = [all accessible accounts or user's own account]
 * 
 * @param user - Authenticated user from JWT
 * @returns Array of account identifiers user can access
 */
export async function resolveUserScope(user: User): Promise<string[]> {
  // For now, each user can only access their own account
  // This can be extended to support:
  // - Service users managing multiple end-user accounts
  // - Hierarchical scope resolution
  // - Dynamic scope from database lookups
  
  if (!user || !user.account) {
    return [];
  }

  return [user.account];
}

/**
 * Future enhancement: Database-backed scope resolution
 * 
 * export async function resolveUserScope(user: User): Promise<string[]> {
 *   const prisma = new PrismaClient();
 *   
 *   // If user is admin, return all accounts they manage
 *   if (user.role === 'admin' || user.role === 'super_admin') {
 *     const accounts = await prisma.userAccount.findMany({
 *       where: { managedBy: user.userId },
 *       select: { accountId: true }
 *     });
 *     return accounts.map(a => a.accountId);
 *   }
 *   
 *   // Otherwise return user's own account
 *   return [user.account];
 * }
 */
