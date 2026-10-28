function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
const dayNumber = date => Date.parse(date + 'T00:00:00Z') / 86400000;

function currentDate(timeZone = 'UTC') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

// The reporting window is inclusive. Weekly opportunities recur on the start weekday.
function summarize(habits, history, asOf, from = null) {
  const end = dayNumber(asOf);
  const rows = habits.map(habit => {
    const start = dayNumber(habit.start_date);
    const interval = habit.frequency === 'weekly' ? 7 : 1;
    const windowStart = from ? Math.max(start, dayNumber(from)) : start;
    const first = start + Math.max(0, Math.ceil((windowStart - start) / interval)) * interval;
    const expected = Math.max(0, Math.floor((end - first) / interval) + 1);
    const completions = history.filter(row => row.habit_id === habit.id &&
      dayNumber(row.completed_date) >= first && dayNumber(row.completed_date) <= end &&
      (dayNumber(row.completed_date) - start) % interval === 0).length;
    return { ...habit, expected, completions,
      percentage: expected ? Math.round(completions / expected * 100) : 0,
      completedToday: history.some(row => row.habit_id === habit.id && row.completed_date === asOf),
      dueToday: habit.status === 'active' && end >= start && (end - start) % interval === 0 };
  });
  const expected = rows.reduce((sum, habit) => sum + habit.expected, 0);
  const completions = rows.reduce((sum, habit) => sum + habit.completions, 0);
  return { asOf, from, expected, completions,
    percentage: expected ? Math.round(completions / expected * 100) : 0,
    habits: rows,
    history: history.filter(row => row.completed_date <= asOf && (!from || row.completed_date >= from)) };
}
module.exports = { validDate, dayNumber, currentDate, summarize };
