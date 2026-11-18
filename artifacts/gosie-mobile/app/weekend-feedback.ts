export const weekendContexts = ['All', 'Solo', 'Friends', 'Date', 'Group'] as const;
export type WeekendContext = (typeof weekendContexts)[number];

export type WeekendFeedbackState = {
  context: WeekendContext;
  savedIdeas: string[];
  dismissedIdeas: string[];
  ratings: Record<string, number>;
};

export type WeekendFeedbackAction =
  | { type: 'set-context'; context: WeekendContext }
  | { type: 'toggle-saved'; title: string }
  | { type: 'dismiss'; title: string }
  | { type: 'restore'; title: string }
  | { type: 'rate'; title: string; rating: number };

export function createWeekendFeedbackState(): WeekendFeedbackState {
  return {
    context: 'All',
    savedIdeas: [],
    dismissedIdeas: [],
    ratings: {},
  };
}

export function weekendFeedbackReducer(
  state: WeekendFeedbackState,
  action: WeekendFeedbackAction,
): WeekendFeedbackState {
  switch (action.type) {
    case 'set-context':
      return { ...state, context: action.context };
    case 'toggle-saved':
      return {
        ...state,
        savedIdeas: state.savedIdeas.includes(action.title)
          ? state.savedIdeas.filter((title) => title !== action.title)
          : [...state.savedIdeas, action.title],
      };
    case 'dismiss':
      return state.dismissedIdeas.includes(action.title)
        ? state
        : { ...state, dismissedIdeas: [...state.dismissedIdeas, action.title] };
    case 'restore':
      return {
        ...state,
        dismissedIdeas: state.dismissedIdeas.filter((title) => title !== action.title),
      };
    case 'rate':
      return { ...state, ratings: { ...state.ratings, [action.title]: action.rating } };
  }
}

export function summarizeWeekendFeedback(state: WeekendFeedbackState) {
  return {
    saved: state.savedIdeas.length,
    dismissed: state.dismissedIdeas.length,
    rated: Object.keys(state.ratings).length,
  };
}
