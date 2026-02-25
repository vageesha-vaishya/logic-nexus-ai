import React, { useState, useEffect } from 'react';
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

  const steps: Step[] = [
    {
      target: 'body',
      content: 'Welcome to Logic Nexus AI! Let us show you around.',
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
      setRun(false);
      localStorage.setItem('has_seen_onboarding_tour', 'true');
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
