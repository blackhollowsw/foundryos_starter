// FILE: src/app/page.js
// Purpose: Root page.
// - Unauthenticated users see the sign-in form.
// - Authenticated users are redirected based on their Clerk org role.
// Customize getRedirectPathForRole() to match your role names.

import { SignIn }   from "@clerk/nextjs";
import { auth }     from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// ── Role-based routing ────────────────────────────────────────────────────────
// Clerk returns org roles in the format "org:role_name".
// Adjust the role strings below to match what you configure in Clerk.

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/^org:/, "")
    .replaceAll("_", " ")
    .replaceAll("-", " ");
}

function getRedirectPathForRole(role) {
  const r = normalizeRole(role);

  if (r === "admin") return "/admin";
  if (r === "member") return "/dashboard";

  // Default fallback
  return "/dashboard";
}

// ── Clerk appearance ──────────────────────────────────────────────────────────
// Customize colors to match your brand.

const clerkAppearance = {
  elements: {
    card: {
      backgroundColor: "#ffffff",
      border: "1px solid #d7dde5",
      borderRadius: "18px",
      boxShadow: "0 24px 80px rgba(0, 0, 0, 0.32)"
    },
    headerTitle:         { color: "#101820", fontSize: "24px", fontWeight: "900" },
    headerSubtitle:      { color: "#4b5563" },
    formFieldLabel:      { color: "#101820", fontWeight: "700" },
    formFieldInput:      { backgroundColor: "#ffffff", borderColor: "#cbd5e1", color: "#101820" },
    formButtonPrimary:   { backgroundColor: "#101820", color: "#ffffff", fontWeight: "900" },
    footerActionLink:    { color: "#101820", fontWeight: "800" },
    identityPreviewEditButton: { color: "#101820" }
  }
};

// ── Page component ────────────────────────────────────────────────────────────

export default async function HomePage() {
  const { userId, orgRole } = await auth();

  if (userId) {
    redirect(getRedirectPathForRole(orgRole));
  }

  return (
    <main style={{
      minHeight: "100vh",
      margin: 0,
      background: "linear-gradient(135deg, #071016, #101820)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
      fontFamily: "Arial, sans-serif"
    }}>
      <section style={{
        width: "100%",
        maxWidth: 460,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24
      }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 38, fontWeight: 900, color: "#ffffff" }}>
            {process.env.APP_NAME || "Your App"}
          </h1>
          <p style={{ margin: "10px 0 0", color: "#cbd5e1", fontSize: 15, lineHeight: 1.5 }}>
            Sign in to continue.
          </p>
        </div>

        <SignIn
          forceRedirectUrl="/"
          fallbackRedirectUrl="/"
          routing="hash"
          appearance={clerkAppearance}
        />
      </section>
    </main>
  );
}
