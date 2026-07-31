"use client";

import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";

interface DashboardTourProps {
  run: boolean;
  calendarId: string;
  steps: Step[];
  onFinish: () => void;
}

export function DashboardTour({ run, calendarId, steps, onFinish }: DashboardTourProps) {
  const handleCallback = (data: CallBackProps) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      try {
        localStorage.setItem(`dashboard_tour_seen_${calendarId}`, "1");
      } catch {
        // quota or disabled localStorage
      }
      onFinish();
    }
  };

  return (
    <Joyride
      run={run}
      steps={steps}
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      disableScrollParentFix
      callback={handleCallback}
      styles={{
        options: {
          primaryColor: "#18181b",
          textColor: "#18181b",
          backgroundColor: "#ffffff",
          overlayColor: "rgba(24, 24, 27, 0.6)",
          arrowColor: "#ffffff",
          zIndex: 9999,
        },
        tooltip: {
          borderRadius: 16,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        },
        buttonNext: {
          borderRadius: 9999,
          backgroundColor: "#18181b",
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          padding: "0.625rem 1rem",
        },
        buttonSkip: {
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: "#71717a",
        },
        tooltipTitle: {
          fontSize: "0.875rem",
          fontWeight: 600,
        },
        tooltipContent: {
          fontSize: "0.875rem",
        },
      }}
      locale={{
        last: "Done",
        skip: "Skip tour",
        next: "Next",
        back: "Back",
      }}
    />
  );
}
