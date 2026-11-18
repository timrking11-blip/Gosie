import type { WeekendContext } from './weekend-feedback';

export type { WeekendContext };
export type WeekendSampleIdea = {
  title: string;
  kind: string;
  when: string;
  budget: string;
  budgetLevel: number;
  travelMinutes: number;
  fit: Record<WeekendContext, number>;
  why: string;
};

export const budgetOptions = [
  { label: 'Up to $', value: 1 },
  { label: 'Up to $$', value: 2 },
  { label: 'Any', value: null },
] as const;
export type BudgetLimit = (typeof budgetOptions)[number]['value'];
export const travelOptions = [10, 15, 25] as const;

export const weekendSampleIdeas: WeekendSampleIdea[] = [
  { title: 'Late set at a small jazz room', kind: 'Music', when: 'Sat · evening', budget: '$$', budgetLevel: 2, travelMinutes: 20, fit: { All: 9, Solo: 7, Friends: 7, Date: 10, Group: 5 }, why: 'Sample interest: live music. This event and its details are fictional.' },
  { title: 'Restored-print film night', kind: 'Film', when: 'Fri · 8 pm', budget: '$', budgetLevel: 1, travelMinutes: 12, fit: { All: 8, Solo: 10, Friends: 7, Date: 8, Group: 6 }, why: 'Sample interest: classic cinema. This event and its details are fictional.' },
  { title: 'Long lunch, shared plates', kind: 'Food', when: 'Sun · midday', budget: '$$', budgetLevel: 2, travelMinutes: 15, fit: { All: 8, Solo: 4, Friends: 10, Date: 7, Group: 9 }, why: 'Sample interest: relaxed meals. No personal preference was used to create this fictional example.' },
  { title: 'Riverside walk & market', kind: 'Outdoors', when: 'Sun · morning', budget: 'Free', budgetLevel: 0, travelMinutes: 8, fit: { All: 7, Solo: 9, Friends: 8, Date: 6, Group: 8 }, why: 'Sample interest: time outdoors. This event and its details are fictional.' },
];

export function rankWeekendSampleIdeas(
  ideas: readonly WeekendSampleIdea[],
  context: WeekendContext,
  budgetLimit: BudgetLimit,
  travelLimit: number,
): WeekendSampleIdea[] {
  return ideas
    .filter((idea) =>
      (budgetLimit === null || idea.budgetLevel <= budgetLimit) &&
      idea.travelMinutes <= travelLimit,
    )
    .sort((a, b) => b.fit[context] - a.fit[context]);
}
