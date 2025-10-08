import OnboardingFlow from '../OnboardingFlow';

export default function OnboardingFlowExample() {
  return (
    <OnboardingFlow
      onComplete={(data) => console.log('Onboarding complete:', data)}
    />
  );
}
