// FILE: src/middleware.js
// Purpose: Clerk auth middleware — protects all routes except explicitly public ones.
//
// PUBLIC ROUTES (no Clerk session required):
//   /             — home / sign-in page
//   /sign-in      — Clerk sign-in flow
//   /sign-up      — Clerk sign-up flow
//   /api/cron/*   — cron endpoints (use Bearer token auth instead)
//
// PROTECTED ROUTES (Clerk session required):
//   Everything else, including /admin, /dashboard, /api/admin/*
//
// TO ADD PUBLIC ROUTES for your app (e.g. a public survey or landing page):
//   Add the path to the isPublicRoute matcher below.
//   Example: "/survey(.*)", "/about", "/api/public/(.*)"

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",

  // Clerk intermediate auth flow routes
  "/factor-one(.*)",
  "/factor-two(.*)",
  "/sso-callback(.*)",

  // Cron endpoints — authenticated via Bearer token, not Clerk session
  "/api/cron/(.*)"
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)"
  ]
};
