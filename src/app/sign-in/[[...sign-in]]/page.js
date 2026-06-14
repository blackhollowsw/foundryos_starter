// FILE: src/app/sign-in/[[...sign-in]]/page.js
import { SignIn } from "@clerk/nextjs";

const clerkAppearance = {
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%" },
    card: {
      width: "100%",
      backgroundColor: "#ffffff",
      border: "1px solid #d7dde5",
      borderRadius: "18px",
      boxShadow: "0 24px 80px rgba(0, 0, 0, 0.28)"
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

export default function SignInPage() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #071016, #101820)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{
        width: "100%",
        maxWidth: 460,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24
      }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: "#ffffff", textAlign: "center" }}>
          {process.env.APP_NAME || "Your App"}
        </h1>
        <SignIn forceRedirectUrl="/" appearance={clerkAppearance} />
      </div>
    </main>
  );
}
