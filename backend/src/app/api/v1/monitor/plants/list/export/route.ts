import type { NextRequest } from 'next/server';

import { requireAuth } from '@/server/middleware/auth.middleware';
import type { User } from '@/server/utils/auth-helper';
import { withRequestLogging } from '@/server/middleware/request-log.middleware';
import { exportPlantList } from '@/server/services/plant.service';
import { successResponse, errorResponse, } from '@/server/utils/api-response';
import { resolveUserScope, } from '@/server/utils/scope-resolver';
import { UserRepository } from '@/server/repositories/user.repository';

const userRepository = new UserRepository();

async function getPlantListExportRoute(request: NextRequest,) {
    const auth = (request as any).auth;

    if (!auth?.userId) {
        return errorResponse(
            'Unauthorized',
            401,
        );
    }

    // const scope =
    //     await resolveUserScope({
    //         userId: auth.userId,
    //         account:
    //             auth.account ??
    //             auth.userId,
    //         role: auth.role,
    //     });

    const searchParams = new URL(request.url).searchParams;

    const fromService =
        searchParams.get('fromService') === 'true';

    const targetEndUserId =
        searchParams.get('targetEndUserId') ?? undefined;

    const baseScope =
        await resolveUserScope({
            userId: auth.userId,
            account:
                auth.account ??
                auth.userId,
            role: auth.role,
        });

    const hasServiceRole =
        auth.role === 'service_admin' ||
        auth.role === 'service_super_admin';

    let scope = baseScope;

    if (
        fromService &&
        hasServiceRole &&
        targetEndUserId
    ) {
        const accountScope =
            await userRepository.getAccountScopeByUserId(
                targetEndUserId,
            );

        if (!accountScope) {
            return errorResponse(
                'Selected end user not found',
                404,
            );
        }

        scope = accountScope;
    }

    console.log({
        fromService,
        targetEndUserId,
        baseScope,
        finalScope: scope,
        role: auth.role,
    });

    const user: User = {
        userId: auth.userId,
        account:
            typeof auth.account ===
                'string'
                ? auth.account
                : auth.userId,
        role: auth.role,
    };

    const data = await exportPlantList(
        user,
        scope,
        fromService,
        targetEndUserId,
    );
    return successResponse(
        'Plant list export generated successfully.',
        {
            fileName:
                data.fileName,

            downloadUrl:
                data.downloadUrl,

            expiresAt:
                data.expiresAt,
        },
    );
}

export const GET =
    withRequestLogging(
        requireAuth(
            getPlantListExportRoute,
        ),
        {
            routeName:
                'monitor.plants.list.export',
        },
    );