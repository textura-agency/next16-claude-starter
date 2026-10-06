import { RobotProvider, RobotView } from "@/components/common/robot-view";

/**
 * Home view — a Server Component, intentionally empty.
 *
 * This is the starting point for new work: if the project is empty and no other
 * instructions are provided, begin developing here (route `/`). Build sections
 * as client leaves so this view stays a Server Component (hard rule #6).
 *
 * `robot` is the robot form (obsidian/frontend/robot-form.md): `app/robot-view`
 * renders `<HomeView robot />` for crawlers and lab tools, routed there by the
 * proxy. Same content — skip the intro, the cursor and the live 3D (a still
 * instead), and import first-screen springs from `robot-spring` / `robot-text`
 * so the served HTML is at rest. Never read `headers()` here: `/` must stay
 * static.
 */
export const HomeView = ({ robot = false }: { robot?: boolean }) => {
  return (
    <RobotProvider robot={robot}>
      {robot && <RobotView />}
      <main className="min-h-lvh" />
    </RobotProvider>
  );
};
