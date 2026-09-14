import React, { useCallback, useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import { useTheme } from '@/hooks/useTheme';

interface OnboardingTourProps {
  enabled?: boolean;
}

export function OnboardingTour({ enabled = true }: OnboardingTourProps) {
  const [run, setRun] = useState(false);
  const { isDark } = useTheme();

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('has_seen_onboarding_tour');
    if (!hasSeenTour && enabled) {
      setRun(true);
    }
  }, [enabled]);

  const dismissTour = useCallback(() => {
    setRun(false);
    localStorage.setItem('has_seen_onboarding_tour', 'true');
  }, []);

  // react-joyride's own Escape handling (disableCloseOnEsc={false}, its
  // default) only closes the *current* step and advances to the next one —
  // it does not end the tour the way Skip does. The tooltip is a modal
  // dialog (role="alertdialog"/aria-modal, applied by the library's default
  // Tooltip) that cycles focus between Skip/Next, which is only acceptable
  // per WCAG 2.4.3/2.4.7 if the trap has a single, predictable way out.
  // Make Escape fully end the tour, exactly like Skip.
  useEffect(() => {
    if (!run) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismissTour();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [run, dismissTour]);

  const steps: Step[] = [
    {
      target: 'body',
      content: 'Welcome to SOS Services. Let us show you around.',
      placement: 'center',
    },
    {
      target: '[data-sidebar="trigger"]',
      content: 'You can collapse the sidebar to get more workspace.',
    },
    {
      target: 'nav',
      content: 'Access your leads, quotes, and shipments from the main navigation.',
    },
    {
      target: '[data-testid="get-rates-btn"]',
      content: 'Our AI-powered engine helps you get the best rates instantly.',
    },
    {
      target: '.relative.flex-1.min-w-\\[300px\\]', // Search bar on leads page
      content: 'Powerful filters help you find exactly what you need.',
    },
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      dismissTour();
    }
  };

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton
      run={run}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={steps}
      disableCloseOnEsc={false}
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: isDark ? '#3b82f6' : '#2563eb',
          backgroundColor: isDark ? '#1f2937' : '#ffffff',
          textColor: isDark ? '#f3f4f6' : '#111827',
          arrowColor: isDark ? '#1f2937' : '#ffffff',
        },
      }}
    />
  );
}
