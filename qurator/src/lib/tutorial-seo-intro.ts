export type TutorialSeoIntroStep = {
  heading?: string;
  body?: string;
};

export type TutorialSeoIntro = {
  title: string;
  description: string;
  firstStep: { heading: string; body: string } | null;
};

export function buildTutorialSeoIntro({
  title,
  description,
  steps,
}: {
  title: string;
  description: string;
  steps: TutorialSeoIntroStep[];
}): TutorialSeoIntro {
  const firstStep = steps.find((step) => step.heading?.trim() && step.body?.trim());

  return {
    title,
    description,
    firstStep: firstStep
      ? { heading: firstStep.heading!.trim(), body: firstStep.body!.trim() }
      : null,
  };
}
