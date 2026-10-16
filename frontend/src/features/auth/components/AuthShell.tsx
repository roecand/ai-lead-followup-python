import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { refreshToken } from "../../../shared/api/client";
import { AUTH_CSS } from "../authStyles";
import { AuthBackdrop, AuthTop } from "./AuthChrome";
import { AUTH_PATHS, SECURE_ACCOUNT_PATH, SIGNED_IN_AUTH_PATHS, normalizePath } from "../authPaths";
import { SLIDE_MS, SlideDirection } from "../slide";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import VerifyPage from "../pages/VerifyPage";
import SecureAccountPage from "../pages/SecureAccountPage";

/**
 * Holds the sign-in, sign-up, verify and secure-account pages as one
 * sliding scene.
 *
 * The sky and the top bar stay still. Only the page content slides.
 * Moving forward (login, then signup, then verify, then secure account)
 * pushes the old page out to the left and brings the new one in from the
 * right. Moving back does the opposite.
 *
 * App.tsx renders this for any path in AUTH_PATHS, so it stays mounted
 * while you move between those pages. That's what lets the old page
 * animate out while the new one animates in.
 */

const rank = (pathname: string) => AUTH_PATHS.indexOf(normalizePath(pathname));

// `custom` is the direction, 1 for forward and -1 for back.
const slide: Variants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0, pointerEvents: "none" }),
};

// For people who've asked their device for less motion. A quick fade, no sliding.
const fade: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0, pointerEvents: "none" },
};

export default function AuthShell() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  // Work out the direction whenever the path changes. Doing it this way
  // (state that updates during render) keeps it fixed for the whole slide,
  // even if something re-renders halfway through.
  const [prevPath, setPrevPath] = useState(location.pathname);
  const [direction, setDirection] = useState(1);
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    setDirection(rank(location.pathname) >= rank(prevPath) ? 1 : -1);
  }

  // One "already signed in?" check for all the pages. It runs once when
  // you first land on any of them, not again on every slide, so the
  // incoming page never flashes blank while a request is in flight.
  // (It deliberately doesn't use navigate(). That function changes on every
  // route change, which would make the check run again after each slide.)
  const [session, setSession] = useState<"checking" | "signed-in" | "signed-out">("checking");
  useEffect(() => {
    refreshToken()
      .then((ok) => setSession(ok ? "signed-in" : "signed-out"))
      .catch(() => setSession("signed-out"));
  }, []);

  // The check only describes the page you first landed on. Sliding from
  // verify to the secure-account page happens after sign-up has signed you
  // in, so the old "signed-out" answer is stale by then and must not bounce
  // you. That's why this looks at the landing page, not the current one.
  const [landedOn] = useState(() => normalizePath(location.pathname));
  const landedNeedsSession = SIGNED_IN_AUTH_PATHS.includes(landedOn);
  // Checking the current page too stops the redirect to sign-in from
  // firing again once it has landed there.
  const onSignedInPage = SIGNED_IN_AUTH_PATHS.includes(normalizePath(location.pathname));

  if (session === "signed-in" && !landedNeedsSession) return <Navigate to="/dashboard" replace />;
  if (session === "signed-out" && landedNeedsSession && onSignedInPage) return <Navigate to="/" replace />;

  return (
    <div className="lf-root">
      <style>{AUTH_CSS}</style>

      <AuthBackdrop />
      <AuthTop />

      {session === "checking" ? null : (
        <div className="lf-slides">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={normalizePath(location.pathname)}
              className="lf-slide"
              custom={direction}
              variants={reduceMotion ? fade : slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={
                reduceMotion
                  ? { duration: 0.15 }
                  : { duration: SLIDE_MS / 1000, ease: [0.32, 0.72, 0, 1] }
              }
            >
              {/* Passing `location` freezes it for this copy, so the page
                  sliding out keeps showing what it showed, instead of
                  switching to the new route halfway through leaving. */}
              <SlideDirection.Provider value={direction}>
                <Routes location={location}>
                  <Route path="/" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/verify" element={<VerifyPage />} />
                  <Route path={SECURE_ACCOUNT_PATH} element={<SecureAccountPage />} />
                </Routes>
              </SlideDirection.Provider>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}