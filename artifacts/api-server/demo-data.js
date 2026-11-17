const demoProfiles = [
  {
    id: 'demo-maya',
    title: 'Maya — Professional Focus',
    config: {
      schemaVersion: '1.0.0-draft',
      balance: 'professional',
      weekGrouping: 'company',
      budgetPerActivity: 60,
      budgetHard: false,
      maxTravelMinutes: 30,
      exceptionTravelMinutes: 60,
      allowExceptions: true,
      transportModes: ['transit', 'walking'],
      homeBase: 'Downtown (demo)',
      weekendInterests: ['Live music', 'Restaurants and food'],
      customInterests: [],
      socialContexts: [],
      surpriseMe: false,
      customSections: [],
    },
  },
  {
    id: 'demo-jordan',
    title: 'Jordan — Personal Focus',
    config: {
      schemaVersion: '1.0.0-draft',
      balance: 'personal',
      weekGrouping: 'chronological',
      budgetPerActivity: 25,
      budgetHard: true,
      maxTravelMinutes: 25,
      exceptionTravelMinutes: 25,
      allowExceptions: false,
      transportModes: ['walking', 'cycling'],
      homeBase: 'Lakeside (demo)',
      weekendInterests: ['Outdoor', 'Fitness', 'Relaxation'],
      customInterests: [],
      socialContexts: [],
      surpriseMe: true,
      customSections: [],
    },
  },
  {
    id: 'demo-alex',
    title: 'Alex — Balanced',
    config: {
      schemaVersion: '1.0.0-draft',
      balance: 'balanced',
      weekGrouping: 'category',
      budgetPerActivity: 50,
      budgetHard: false,
      maxTravelMinutes: 35,
      exceptionTravelMinutes: 60,
      allowExceptions: true,
      transportModes: ['walking', 'transit', 'cycling'],
      homeBase: 'Old Market (demo)',
      weekendInterests: [
        'Arts/museums/theater',
        'Restaurants and food',
        'Hidden gems',
        'Learning and workshops',
      ],
      customInterests: [
        {
          id: 'ci-marvel-demo',
          label: 'Marvel movies and premiere-night screenings',
          category: 'Movies & Cinema',
          specificInterest: 'Marvel Cinematic Universe',
          desiredExperience: 'Premiere night or opening weekend',
          priority: 1,
        },
        {
          id: 'ci-photo-demo',
          label: 'Photography walks',
          category: 'Outdoors',
          specificInterest: 'Photography',
          desiredExperience: 'Guided walks and meetups',
          priority: 2,
        },
      ],
      socialContexts: [],
      surpriseMe: true,
      balancedPriorities: ['Deadlines', 'Social Plans', 'Learning'],
      customSections: [],
    },
  },
];

const demoWeek = [
  { offset: 0, timeLabel: '09:30', title: 'Q3 planning review with leadership', category: 'Meetings', company: 'Northwind Studio', domain: 'professional', priority: 'High' },
  { offset: 1, timeLabel: '12:00', title: 'Lunch break and a short walk', category: 'Wellbeing', company: null, domain: 'personal', priority: 'Low' },
  { offset: 2, timeLabel: '15:00', title: 'Atlas prototype milestone due', category: 'Deadlines', company: 'Northwind Studio', domain: 'professional', priority: 'High' },
  { offset: 3, timeLabel: '10:00', title: 'Decide: extend contractor or hire in-house', category: 'Decisions', company: 'Northwind Studio', domain: 'professional', priority: 'High' },
  { offset: 4, timeLabel: '19:00', title: 'Dinner with Sam and Priya', category: 'Social Plans', company: null, domain: 'personal', priority: 'Medium' },
  { offset: 4, timeLabel: '16:00', title: 'Storefront launch checklist review', category: 'Deadlines', company: 'Harbor Retail Group', domain: 'professional', priority: 'Medium' },
  { offset: 5, timeLabel: '10:30', title: 'Side-project: photo archive sorting', category: 'Personal Goals', company: null, domain: 'personal', priority: 'Low' },
  { offset: 6, timeLabel: '09:00', title: 'A slow morning, left open', category: 'Rest', company: null, domain: 'personal', priority: 'Low' },
];

function addDays(isoDate, amount) {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function currentWeekStart(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function makeDemoWeek(weekStart = currentWeekStart()) {
  return demoWeek.map((item) => ({ ...item, day: addDays(weekStart, item.offset) }));
}

module.exports = { demoProfiles, makeDemoWeek, currentWeekStart, addDays };
