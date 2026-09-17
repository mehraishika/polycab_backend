// // //auth\verify-code\route.ts
// // import { NextRequest, NextResponse } from "next/server";

// // import { AuthService } from "@/server/services/auth.service";
// // import { errorResponse, successResponse } from "@/server/utils/api-response";

// // const authService = new AuthService();

// // export async function POST(request: NextRequest): Promise<Response> {
// //   let body: unknown;

// //   try {
// //     body = await request.json();
// //   } catch {
// //     return errorResponse("Invalid JSON payload", 400);
// //   }

// //   if (typeof body !== "object" || body === null) {
// //     return errorResponse("Invalid request body", 400);
// //   }

// //   const data = body as {
// //     verificationId?: unknown;
// //     code?: unknown;
// //   };

// //   if (
// //     typeof data.verificationId !== "string" ||
// //     typeof data.code !== "string"
// //   ) {
// //     return errorResponse("Verification ID and code are required", 400);
// //   }

// //   const result = await authService.verifyLoginCode({
// //     verificationId: data.verificationId,
// //     code: data.code,
// //   });

// //   if (result.status !== 200) {
// //     return errorResponse(result.message, result.status);
// //   }

// //   const response = successResponse(result.message, {
// //     requiresVerification: false,
// //     accessToken: result.data.accessToken,
// //     refreshToken: result.data.refreshToken,
// //     user: result.data.user,
// //     redirect: result.data.redirect,
// //   });

// //   const nextResponse = response as NextResponse;

// //   nextResponse.cookies.set("accessToken", result.data.accessToken, {
// //     httpOnly: true,
// //     secure: process.env.NODE_ENV === "production",
// //     sameSite: "lax",
// //     path: "/",
// //     maxAge: result.data.cookieMaxAge,
// //   });

// //   nextResponse.cookies.set("refreshToken", result.data.refreshToken, {
// //     httpOnly: true,
// //     secure: process.env.NODE_ENV === "production",
// //     sameSite: "lax",
// //     path: "/",
// //     maxAge: result.data.refreshCookieMaxAge,
// //   });

// //   return nextResponse;
// // }

// import { NextRequest, NextResponse } from "next/server";

// import { AuthService } from "@/server/services/auth.service";
// import {
//   errorResponse,
//   successResponse,
// } from "@/server/utils/api-response";

// const authService = new AuthService();

// export async function POST(request: NextRequest): Promise<Response> {
//   let body: unknown;

//   try {
//     body = await request.json();
//   } catch {
//     return errorResponse("Invalid JSON payload", 400);
//   }

//   if (typeof body !== "object" || body === null) {
//     return errorResponse("Invalid request body", 400);
//   }

//   const data = body as {
//     verificationId?: unknown;
//     code?: unknown;
//   };

//   if (
//     typeof data.verificationId !== "string" ||
//     typeof data.code !== "string"
//   ) {
//     return errorResponse(
//       "Verification ID and code are required",
//       400,
//     );
//   }

//   const result = await authService.verifyLoginCode({
//     verificationId: data.verificationId,
//     code: data.code,
//   });

//   if (result.status !== 200) {
//     return errorResponse(result.message, result.status);
//   }

//   /*
//    * If 2FA is enabled, the 4-digit verification
//    * is successful but login is not complete yet.
//    *
//    * The user must now enter the 6-digit TOTP code.
//    */
//   if (
//     "requiresTwoFactor" in result.data &&
//     result.data.requiresTwoFactor === true
//   ) {
//     return successResponse(result.message, {
//       requiresVerification: false,
//       requiresTwoFactor: true,
//       twoFactorChallengeId:
//         result.data.twoFactorChallengeId,
//       user: result.data.user,
//     });
//   }

//   /*
//    * Normal login flow when 2FA is disabled.
//    */
//   const response = successResponse(result.message, {
//     requiresVerification: false,
//     requiresTwoFactor: false,
//     accessToken: result.data.accessToken,
//     refreshToken: result.data.refreshToken,
//     user: result.data.user,
//     redirect: result.data.redirect,
//   });

//   const nextResponse = response as NextResponse;

//   nextResponse.cookies.set(
//     "accessToken",
//     result.data.accessToken,
//     {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "lax",
//       path: "/",
//       maxAge: result.data.cookieMaxAge,
//     },
//   );

//   nextResponse.cookies.set(
//     "refreshToken",
//     result.data.refreshToken,
//     {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "lax",
//       path: "/",
//       maxAge: result.data.refreshCookieMaxAge,
//     },
//   );

//   return nextResponse;
// }

import { errorResponse } from "@/server/utils/api-response";

export async function POST(): Promise<Response> {
  return errorResponse(
    "The old 4-digit verification flow has been disabled. Please use Google Authenticator 2FA.",
    410,
  );
}