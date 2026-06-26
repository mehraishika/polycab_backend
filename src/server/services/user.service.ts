import { UserRepository } from "@/server/repositories/user.repository";
import { toErrorMessage } from "@/server/utils/api-error";
import { hashPassword, verifyPassword } from "@/server/utils/password";
import type {
  UserListQueryInput,
  UserRoleType,
  CreateSubUserInput,
  ServiceAdminEditInput,
  ServiceAdminUserListInput,
  UpdateProfileInput,
} from "@/server/validators/user.validator";

export interface CreateSubUserSuccess {
  status: 201;
  message: string;
  data: {
    user: UserDetailData;
  };
}

export interface CreateSubUserError {
  status: 400 | 409 | 500;
  message: string;
}

export type CreateSubUserResult = CreateSubUserSuccess | CreateSubUserError;

export interface DeleteUserServiceSuccess {
  status: 200;
  message: string;
  data: {
    userId: string;
  };
}

export interface DeleteUserServiceError {
  status: 404 | 500;
  message: string;
}

export type DeleteUserServiceResult =
  | DeleteUserServiceSuccess
  | DeleteUserServiceError;

export interface UserDetailData {
  id: string;
  account: string;
  email: string | null;
  portal: string;
  role: string;
  status: string;
  timezone: string | null;
  phone: string | null;
  address: string | null;
  assignedById: string | null;
  isDeleted: boolean;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface GetUserDetailSuccess {
  status: 200;
  message: string;
  data: {
    user: UserDetailData;
  };
}

export interface GetUserDetailError {
  status: 404;
  message: string;
}

export type GetUserDetailResult = GetUserDetailSuccess | GetUserDetailError;

export interface UserListSuccess {
  status: 200;
  message: string;
  data: {
    items: UserDetailData[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  };
}

export type UserListResult = UserListSuccess;

interface SubAccountUserListItem {
  id: string;
  account: string;
  deviceCount: number;
  phone: string | null;
  email: string | null;
  timezone: string | null;
  status: string;
  role: string;
  portal: string;
  createdAt: string;
  updatedAt: string;
}

interface SubAccountUserViewData {
  id: string;
  account: string;
  password: null;
  phone: string | null;
  email: string | null;
  timezone: string | null;
  role: string;
  portal: string;
  status: string;
  deviceCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SubAccountUserEditData {
  id: string;
  account: string;
  phone: string | null;
  email: string | null;
  timezone: string | null;
  role: string;
  portal: string;
  status: string;
  updatedAt: string;
}

interface SubAccountUserDeleteData {
  id: string;
  account: string;
  role: string;
  portal: string;
  status: "deleted";
  deletedAt: string | null;
}

interface ServiceResultError {
  status: 400 | 401 | 403 | 404 | 409 | 500;
  message: string;
}

interface ServiceAdminUserListSuccess {
  status: 200;
  message: string;
  data: {
    items: SubAccountUserListItem[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  };
}

type ServiceAdminUserListResult =
  | ServiceAdminUserListSuccess
  | ServiceResultError;

interface ServiceAdminUserViewSuccess {
  status: 200;
  message: string;
  data: SubAccountUserViewData;
}

type ServiceAdminUserViewResult =
  | ServiceAdminUserViewSuccess
  | ServiceResultError;

interface ServiceAdminUserEditSuccess {
  status: 200;
  message: string;
  data: SubAccountUserEditData;
}

type ServiceAdminUserEditResult =
  | ServiceAdminUserEditSuccess
  | ServiceResultError;

interface ServiceAdminUserDeleteSuccess {
  status: 200;
  message: string;
  data: SubAccountUserDeleteData;
}

type ServiceAdminUserDeleteResult =
  | ServiceAdminUserDeleteSuccess
  | ServiceResultError;

type ChangePasswordInput = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type ForgotPasswordInput = {
  account: string;
  newPassword: string;
  confirmPassword: string;
};

export class UserService {
  constructor(
    private readonly userRepository: UserRepository = new UserRepository(),
  ) {}

  private isRoleAllowedForSubAccountManagement(
    role: string | undefined,
  ): boolean {
    return role === "service_admin" || role === "service_super_admin";
  }

  private async validateSubAccountManager(
    actorId: bigint,
    actorRole: string | undefined,
  ): Promise<ServiceResultError | null> {
    if (!this.isRoleAllowedForSubAccountManagement(actorRole)) {
      return {
        status: 403,
        message: "You are not allowed to manage sub accounts",
      };
    }

    const actor = await this.userRepository.findActorById(actorId);

    if (!actor || actor.isDeleted) {
      return {
        status: 401,
        message: "Unauthorized",
      };
    }

    if (
      actor.portal !== "service" ||
      !this.isRoleAllowedForSubAccountManagement(actor.role)
    ) {
      return {
        status: 403,
        message: "You are not allowed to manage sub accounts",
      };
    }

    return null;
  }

  private mapSubAccountStatus(record: {
    isDeleted: boolean;
    status: string;
  }): string {
    if (record.isDeleted) {
      return "deleted";
    }

    return record.status;
  }

  private mapSubAccountListItem(
    record: {
      id: bigint;
      account: string;
      phone: string | null;
      email: string | null;
      timezone: string | null;
      status: string;
      isDeleted: boolean;
      role: string;
      portal: string;
      createdAt: Date;
      updatedAt: Date;
    },
    deviceCount: number,
  ): SubAccountUserListItem {
    return {
      id: String(record.id),
      account: record.account,
      deviceCount,
      phone: record.phone,
      email: record.email,
      timezone: record.timezone,
      status: this.mapSubAccountStatus(record),
      role: record.role,
      portal: record.portal,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mapSubAccountViewData(
    record: {
      id: bigint;
      account: string;
      phone: string | null;
      email: string | null;
      timezone: string | null;
      role: string;
      portal: string;
      status: string;
      isDeleted: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
    deviceCount: number,
  ): SubAccountUserViewData {
    return {
      id: String(record.id),
      account: record.account,
      password: null,
      phone: record.phone,
      email: record.email,
      timezone: record.timezone,
      role: record.role,
      portal: record.portal,
      status: this.mapSubAccountStatus(record),
      deviceCount,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mapSubAccountEditData(record: {
    id: bigint;
    account: string;
    phone: string | null;
    email: string | null;
    timezone: string | null;
    role: string;
    portal: string;
    status: string;
    isDeleted: boolean;
    updatedAt: Date;
  }): SubAccountUserEditData {
    return {
      id: String(record.id),
      account: record.account,
      phone: record.phone,
      email: record.email,
      timezone: record.timezone,
      role: record.role,
      portal: record.portal,
      status: this.mapSubAccountStatus(record),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mapSubAccountDeleteData(record: {
    id: bigint;
    account: string;
    role: string;
    portal: string;
    deletedAt: Date | null;
  }): SubAccountUserDeleteData {
    return {
      id: String(record.id),
      account: record.account,
      role: record.role,
      portal: record.portal,
      status: "deleted",
      deletedAt: record.deletedAt?.toISOString() ?? null,
    };
  }

  private mapUserDetail(record: {
    id: bigint;
    account: string;
    email: string | null;
    portal: string;
    role: string;
    status: string;
    timezone: string | null;
    phone: string | null;
    address: string | null;
    assignedById: bigint | null;
    isDeleted: boolean;
    emailVerifiedAt: Date | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): UserDetailData {
    return {
      id: String(record.id),
      account: record.account,
      email: record.email,
      portal: record.portal,
      role: record.role,
      status: record.status,
      timezone: record.timezone,
      phone: record.phone,
      address: record.address,
      assignedById:
        typeof record.assignedById === "bigint"
          ? String(record.assignedById)
          : null,
      isDeleted: record.isDeleted,
      emailVerifiedAt: record.emailVerifiedAt?.toISOString() ?? null,
      lastLoginAt: record.lastLoginAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      deletedAt: record.deletedAt?.toISOString() ?? null,
    };
  }

  async updateProfile(userId: string, payload: UpdateProfileInput) {
    const updated = await this.userRepository.updateProfile(
      BigInt(userId),
      payload,
    );

    return {
      status: 200,
      message: "Profile updated successfully.",
      data: updated,
    };
  }

  async getEditById(id: bigint): Promise<GetUserDetailResult> {
    const record = await this.userRepository.findDetailById(id);

    if (!record || record.isDeleted) {
      return {
        status: 404,
        message: "User not found",
      };
    }

    return {
      status: 200,
      message: "User edit data fetched successfully",
      data: {
        user: this.mapUserDetail(record),
      },
    };
  }

  async getViewById(id: bigint): Promise<GetUserDetailResult> {
    const record = await this.userRepository.findDetailById(id);

    if (!record || record.isDeleted) {
      return {
        status: 404,
        message: "User not found",
      };
    }

    return {
      status: 200,
      message: "User view data fetched successfully",
      data: {
        user: this.mapUserDetail(record),
      },
    };
  }

  async getUserListByRole(
    roleType: UserRoleType,
    filters: UserListQueryInput,
  ): Promise<UserListResult> {
    const result = await this.userRepository.listByRole(roleType, filters);
    const totalPages = Math.max(1, Math.ceil(result.total / filters.limit));

    return {
      status: 200,
      message: "Users fetched successfully",
      data: {
        items: result.items.map((item) => this.mapUserDetail(item)),
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: result.total,
          totalPages,
          hasNextPage: filters.page < totalPages,
          hasPrevPage: filters.page > 1,
        },
      },
    };
  }

  async deleteById(id: bigint): Promise<DeleteUserServiceResult> {
    const existingUser = await this.userRepository.findById(id);

    if (!existingUser || existingUser.isDeleted) {
      return {
        status: 404,
        message: "User not found",
      };
    }

    try {
      const deleted = await this.userRepository.softDeleteById(id);

      if (!deleted) {
        return {
          status: 404,
          message: "User not found",
        };
      }

      return {
        status: 200,
        message: "User deleted successfully",
        data: {
          userId: String(id),
        },
      };
    } catch (error: unknown) {
      return {
        status: 500,
        message: toErrorMessage(error),
      };
    }
  }

  async createSubUser(
    input: CreateSubUserInput,
    assignedById: bigint,
  ): Promise<CreateSubUserResult> {
    const existingAccount = await this.userRepository.findByPortalAndAccount(
      "service",
      input.account,
    );

    if (existingAccount) {
      return {
        status: 409,
        message: "Account already exists",
      };
    }

    const existingEmail = await this.userRepository.findByPortalAndEmail(
      "service",
      input.email,
    );

    if (existingEmail) {
      return {
        status: 409,
        message: "Email already exists",
      };
    }

    try {
      const passwordHash = await hashPassword(input.password);
      const record = await this.userRepository.createServiceUser({
        account: input.account,
        email: input.email,
        timezone: input.timezone,
        passwordHash,
        role: input.role,
        phone: input.mobileNumber,
        assignedById,
      });

      return {
        status: 201,
        message: "Sub-user created successfully",
        data: {
          user: this.mapUserDetail(record),
        },
      };
    } catch (error: unknown) {
      return {
        status: 500,
        message: toErrorMessage(error),
      };
    }
  }

  async getServiceAdminUserList(
    actorId: bigint,
    actorRole: string | undefined,
    input: ServiceAdminUserListInput,
  ): Promise<ServiceAdminUserListResult> {
    const accessError = await this.validateSubAccountManager(
      actorId,
      actorRole,
    );
    if (accessError) {
      return accessError;
    }

    const result = await this.userRepository.listScopedServiceAdmins(
      actorId,
      input,
    );
    const totalPages = Math.max(
      1,
      Math.ceil(result.totalItems / input.pageSize),
    );
    const accounts = result.items.map((item) => item.account);
    const deviceCountMap =
      await this.userRepository.getDeviceCountsByAccounts(accounts);

    return {
      status: 200,
      message: "User list fetched successfully.",
      data: {
        items: result.items.map((item) =>
          this.mapSubAccountListItem(
            item,
            deviceCountMap.get(item.account) ?? 0,
          ),
        ),
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          totalItems: result.totalItems,
          totalPages,
        },
      },
    };
  }

  async getServiceAdminViewById(
    id: bigint,
    actorId: bigint,
    actorRole: string | undefined,
  ): Promise<ServiceAdminUserViewResult> {
    const accessError = await this.validateSubAccountManager(
      actorId,
      actorRole,
    );
    if (accessError) {
      return accessError;
    }

    const record = await this.userRepository.findScopedServiceAdminById(
      id,
      actorId,
    );

    if (!record || record.isDeleted) {
      return {
        status: 404,
        message: "User not found",
      };
    }

    const deviceCountMap = await this.userRepository.getDeviceCountsByAccounts([
      record.account,
    ]);

    return {
      status: 200,
      message: "User details fetched successfully.",
      data: this.mapSubAccountViewData(
        record,
        deviceCountMap.get(record.account) ?? 0,
      ),
    };
  }

  async getServiceAdminList(
    actorId: bigint,
    actorRole: string | undefined,
  ): Promise<ServiceAdminUserListResult> {
    const accessError = await this.validateSubAccountManager(
      actorId,
      actorRole,
    );

    if (accessError) {
      return accessError;
    }

    const records = await this.userRepository.findScopedServiceAdmins(actorId);
    console.log("records", records);

    const deviceCountMap = await this.userRepository.getDeviceCountsByAccounts(
      records.map((r) => r.account),
    );

    return {
      status: 200,
      message: "Users fetched successfully.",
      data: {
        items: records.map((record) =>
          this.mapSubAccountListItem(
            record,
            deviceCountMap.get(record.account) ?? 0,
          ),
        ),
        pagination: {
          page: 1,
          pageSize: records.length,
          totalItems: records.length,
          totalPages: 1,
        },
      },
    };
  }

  async editServiceAdminById(
    id: bigint,
    actorId: bigint,
    actorRole: string | undefined,
    input: ServiceAdminEditInput,
  ): Promise<ServiceAdminUserEditResult> {
    const accessError = await this.validateSubAccountManager(
      actorId,
      actorRole,
    );
    if (accessError) {
      return accessError;
    }

    const existing = await this.userRepository.findScopedServiceAdminById(
      id,
      actorId,
    );

    if (!existing || existing.isDeleted) {
      return {
        status: 404,
        message: "User not found",
      };
    }

    const duplicateEmail =
      await this.userRepository.findServiceAdminByEmailExcludingId(
        input.email,
        id,
      );

    if (duplicateEmail) {
      return {
        status: 409,
        message: "Email already exists",
      };
    }

    try {
      const passwordHash =
        input.password.trim().length > 0
          ? await hashPassword(input.password)
          : undefined;

      const updated = await this.userRepository.updateScopedServiceAdminById(
        id,
        actorId,
        input,
        passwordHash,
      );

      if (!updated) {
        return {
          status: 404,
          message: "User not found",
        };
      }

      return {
        status: 200,
        message: "User updated successfully.",
        data: this.mapSubAccountEditData(updated),
      };
    } catch (error: unknown) {
      return {
        status: 500,
        message: toErrorMessage(error),
      };
    }
  }

  async deleteServiceAdminById(
    id: bigint,
    actorId: bigint,
    actorRole: string | undefined,
  ): Promise<ServiceAdminUserDeleteResult> {
    const accessError = await this.validateSubAccountManager(
      actorId,
      actorRole,
    );
    if (accessError) {
      return accessError;
    }

    if (id === actorId) {
      return {
        status: 400,
        message: "You cannot delete your own account",
      };
    }

    const existing = await this.userRepository.findScopedServiceAdminById(
      id,
      actorId,
    );

    if (!existing) {
      return {
        status: 404,
        message: "User not found",
      };
    }

    if (existing.isDeleted) {
      return {
        status: 400,
        message: "User is already deleted",
      };
    }

    try {
      const deleted =
        await this.userRepository.softDeleteScopedServiceAdminById(id, actorId);

      if (!deleted) {
        return {
          status: 400,
          message: "User is already deleted",
        };
      }

      return {
        status: 200,
        message: "User deleted successfully.",
        data: this.mapSubAccountDeleteData(deleted),
      };
    } catch (error: unknown) {
      return {
        status: 500,
        message: toErrorMessage(error),
      };
    }
  }

  async changePassword(userId: bigint, data: ChangePasswordInput) {
    const user = await this.userRepository.findPasswordById(userId);

    if (!user || user.isDeleted) {
      return {
        status: 404,
        message: "User not found",
      };
    }

    const isValidPassword = await verifyPassword({
      plainPassword: data.oldPassword,
      storedPasswordHash: user.passwordHash,
    });

    if (!isValidPassword) {
      return {
        status: 400,
        message: "Old password is incorrect",
      };
    }

    const samePassword = await verifyPassword({
      plainPassword: data.newPassword,
      storedPasswordHash: user.passwordHash,
    });

    if (samePassword) {
      return {
        status: 400,
        message: "New password cannot be same as old password",
      };
    }

    const hashedPassword = await hashPassword(data.newPassword);

    await this.userRepository.updatePassword(userId, hashedPassword);

    return {
      status: 200,
      message: "Password changed successfully",
    };
  }

  async forgotPassword(data: ForgotPasswordInput) {
    const user = await this.userRepository.findPasswordByAccount(data.account);

    if (!user || user.isDeleted) {
      return {
        status: 404,
        message: "Account not found",
      };
    }

    const samePassword = await verifyPassword({
      plainPassword: data.newPassword,
      storedPasswordHash: user.passwordHash,
    });

    if (samePassword) {
      return {
        status: 400,
        message: "New password cannot be same as old password",
      };
    }

    const hashedPassword = await hashPassword(data.newPassword);

    await this.userRepository.updatePassword(user.id, hashedPassword);

    return {
      status: 200,
      message: "Password reset successfully",
    };
  }
}
