import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from '../src/Home';
import { createSampleHomeData } from '../src/homeData';

const now = new Date(2026, 9, 31, 12, 0);
const user = { id: 1, name: 'Alex Rivera' };
const renderHome = (props = {}) => render(<Home user={user} now={now} data={createSampleHomeData(now)} {...props} />);

test('greets the user and shows the three homepage sections', () => {
  renderHome();
  expect(screen.getByRole('heading', { name: 'Welcome back, Alex' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'My recent goals' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Group goals' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Upcoming events' })).toBeInTheDocument();
});
test('lists my goals most recently updated first, capped at four', () => {
  renderHome();
  const items = within(screen.getByRole('region', { name: 'My recent goals' })).getAllByRole('listitem');
  expect(items).toHaveLength(4);
  expect(items[0]).toHaveTextContent('Review lecture notes');
  expect(items[0]).toHaveTextContent('Done today');
  expect(items[0]).toHaveTextContent('Updated 2h ago');
});
test('group goals show other members and can be filtered by group', async () => {
  const u = userEvent.setup();
  renderHome();
  const section = screen.getByRole('region', { name: 'Group goals' });
  expect(within(section).getByText('Priya Natarajan')).toBeInTheDocument();
  await u.selectOptions(screen.getByLabelText('Filter by group'), 'Dorm Floor 3');
  expect(within(section).getByText('Sam Okafor')).toBeInTheDocument();
  expect(within(section).queryByText('Priya Natarajan')).not.toBeInTheDocument();
});
test('RSVP buttons set, change and clear a response and update the going count', async () => {
  const u = userEvent.setup();
  renderHome();
  const group = screen.getByRole('group', { name: 'RSVP for Weekend long run' });
  const card = group.closest('li');
  expect(card).toHaveTextContent('6 going');
  expect(card).toHaveTextContent('Not responded yet');
  await u.click(within(group).getByRole('button', { name: 'Going' }));
  expect(within(group).getByRole('button', { name: 'Going' })).toHaveAttribute('aria-pressed', 'true');
  expect(card).toHaveTextContent('7 going');
  expect(card).toHaveTextContent("You're going");
  await u.click(within(group).getByRole('button', { name: "Can't go" }));
  expect(card).toHaveTextContent('6 going');
  await u.click(within(group).getByRole('button', { name: "Can't go" }));
  expect(card).toHaveTextContent('Not responded yet');
});
test('hides events that already ended and shows empty states', () => {
  const data = { groups: [], myGoals: [], groupGoals: [], events: [{ id: 1, groupId: 1, title: 'Old study night', type: 'study', startsAt: new Date(2026, 9, 1, 18).toISOString(), endsAt: new Date(2026, 9, 1, 20).toISOString(), location: 'Library', goingCount: 2, myRsvp: null }] };
  renderHome({ data });
  expect(screen.queryByText('Old study night')).not.toBeInTheDocument();
  expect(screen.getByText(/No upcoming events/)).toBeInTheDocument();
  expect(screen.getByText(/haven’t added any goals/)).toBeInTheDocument();
  expect(screen.getByText(/No goals shared in your groups/)).toBeInTheDocument();
});
test('navigation links point at the dashboard and groups routes', () => {
  renderHome();
  const nav = screen.getByRole('navigation', { name: 'Main' });
  expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  expect(within(nav).getByRole('link', { name: 'My habits' })).toHaveAttribute('href', '#/dashboard');
  expect(within(nav).getByRole('link', { name: 'Groups' })).toHaveAttribute('href', '#/groups');
});
