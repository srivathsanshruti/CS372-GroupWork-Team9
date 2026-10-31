// Placeholder data for the homepage design.
// TODO(backend): replace createSampleHomeData() with real API calls once the
// goals / groups / events endpoints exist. Home.jsx accepts a `data` prop with
// this exact shape, so wiring it up later only means passing the fetched result in.
export function createSampleHomeData(now = new Date()) {
  const hoursAgo = hours => new Date(now.getTime() - hours * 36e5).toISOString();
  const at = (days, hour, minute = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  return {
    groups: [
      { id: 1, name: 'Algorithms Study Crew' },
      { id: 2, name: 'Dorm Floor 3' },
      { id: 3, name: 'Morning Run Club' }
    ],
    // The signed-in user's own habits, most recently updated first (Home sorts too).
    myGoals: [
      { id: 1, title: 'Review lecture notes', goal: 'Spend 20 minutes reviewing after class', frequency: 'daily', completed: 5, expected: 7, completedToday: true, updatedAt: hoursAgo(2) },
      { id: 2, title: 'Practice problems', goal: 'Solve five problems from the problem set', frequency: 'daily', completed: 4, expected: 7, completedToday: false, updatedAt: hoursAgo(20) },
      { id: 3, title: 'Weekly reading', goal: 'Finish one chapter of the textbook', frequency: 'weekly', completed: 2, expected: 3, completedToday: false, updatedAt: hoursAgo(52) },
      { id: 4, title: 'Gym session', goal: 'Lift for 45 minutes', frequency: 'weekly', completed: 1, expected: 3, completedToday: false, updatedAt: hoursAgo(120) }
    ],
    // Goals belonging to other members of the user's groups.
    groupGoals: [
      { id: 101, groupId: 1, member: 'Priya Natarajan', title: 'LeetCode warm-up', goal: 'One medium problem every morning', frequency: 'daily', completed: 6, expected: 7, updatedAt: hoursAgo(1) },
      { id: 102, groupId: 3, member: 'Marcus Bell', title: 'Run 3 miles', goal: 'Easy pace before breakfast', frequency: 'daily', completed: 3, expected: 5, updatedAt: hoursAgo(3) },
      { id: 103, groupId: 1, member: 'Jordan Lee', title: 'Finish problem set 4', goal: 'Draft all proofs before Thursday', frequency: 'weekly', completed: 1, expected: 2, updatedAt: hoursAgo(9) },
      { id: 104, groupId: 2, member: 'Sam Okafor', title: 'Cook dinner at home', goal: 'Skip takeout on weeknights', frequency: 'daily', completed: 4, expected: 5, updatedAt: hoursAgo(26) },
      { id: 105, groupId: 2, member: 'Elena Rossi', title: 'Sleep by 11pm', goal: 'Phone down, lights out', frequency: 'daily', completed: 2, expected: 7, updatedAt: hoursAgo(30) },
      { id: 106, groupId: 3, member: 'Dani Cho', title: 'Stretch routine', goal: '10 minutes after every run', frequency: 'daily', completed: 5, expected: 6, updatedAt: hoursAgo(48) }
    ],
    // myRsvp: null | 'going' | 'maybe' | 'declined'. goingCount excludes the current user.
    events: [
      { id: 1, groupId: 1, title: 'Midterm review session', type: 'study', startsAt: at(0, 19), endsAt: at(0, 21), location: 'Library, Room 204', goingCount: 4, myRsvp: 'going' },
      { id: 2, groupId: 3, title: 'Weekend long run', type: 'social', startsAt: at(1, 8), endsAt: at(1, 9, 30), location: 'Campus quad', goingCount: 6, myRsvp: null },
      { id: 3, groupId: 2, title: 'Floor movie night', type: 'social', startsAt: at(3, 20), endsAt: at(3, 22, 30), location: 'Dorm 3 lounge', goingCount: 9, myRsvp: null },
      { id: 4, groupId: 1, title: 'Problem set 5 work session', type: 'study', startsAt: at(6, 16), endsAt: at(6, 18), location: 'Student Union, 2nd floor', goingCount: 3, myRsvp: 'maybe' }
    ]
  };
}
