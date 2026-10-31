import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupsPage from '../src/GroupsPage';

const user = { id: 1, name: 'Alex' };
const group = (id, fields) => ({ id, name: 'Group ' + id, course: null, description: null, meeting_info: null, creator_id: 2, creator_name: 'Bob', member_count: 1, is_member: false, is_owner: false, ...fields });
let records, list;
const response = (status, body) => ({ status, ok: status < 400, json: async () => body });
beforeEach(() => {
  records = [];
  list = [
    group(1, { name: 'Algorithms Crew', course: 'CS 372', description: 'Weekly problem sets', meeting_info: 'Library 204', member_count: 2 }),
    group(2, { name: 'Morning Runners', is_member: true, member_count: 3 }),
    group(3, { name: 'Chem Lab', creator_id: 1, creator_name: 'Alex', is_member: true, is_owner: true })
  ];
  global.fetch = jest.fn(async (url, options = {}) => {
    records.push({ url, method: options.method || 'GET', body: options.body && JSON.parse(options.body) });
    if (url === '/api/groups/courses') return response(200, ['CS 372']);
    if (options.method === 'POST' && url === '/api/groups') return response(201, group(9, { name: 'New' }));
    if (options.method === 'DELETE') return response(204, null);
    if (options.method === 'POST') return response(201, list[0]);
    return response(200, list);
  });
});
afterEach(() => jest.restoreAllMocks());
const groupItem = name => screen.getByText(name).closest('li');
const lastGet = prefix => records.filter(r => r.method === 'GET' && r.url.startsWith(prefix)).at(-1).url;

test('lists groups with details and the right action for each', async () => {
  render(<GroupsPage user={user} />);
  await screen.findByText('Algorithms Crew');
  const algo = groupItem('Algorithms Crew');
  expect(within(algo).getByText('CS 372')).toBeInTheDocument();
  expect(within(algo).getByText('Weekly problem sets')).toBeInTheDocument();
  expect(within(algo).getByText('2 members')).toBeInTheDocument();
  expect(within(algo).getByText('Created by Bob')).toBeInTheDocument();
  expect(within(algo).getByRole('button', { name: 'Join Algorithms Crew' })).toBeInTheDocument();
  expect(within(groupItem('Morning Runners')).getByRole('button', { name: 'Leave Morning Runners' })).toBeInTheDocument();
  const own = groupItem('Chem Lab');
  expect(within(own).getByText('1 member')).toBeInTheDocument();
  expect(within(own).getByText('Created by you')).toBeInTheDocument();
  expect(within(own).queryByRole('button', { name: /Leave/ })).not.toBeInTheDocument();
});

test('join and leave call the membership endpoints and refresh', async () => {
  const actor = userEvent.setup();
  render(<GroupsPage user={user} />);
  await actor.click(await screen.findByRole('button', { name: 'Join Algorithms Crew' }));
  expect(await screen.findByText('You joined Algorithms Crew.')).toBeInTheDocument();
  expect(records).toContainEqual(expect.objectContaining({ url: '/api/groups/1/members', method: 'POST' }));
  await actor.click(screen.getByRole('button', { name: 'Leave Morning Runners' }));
  expect(await screen.findByText('You left Morning Runners.')).toBeInTheDocument();
  expect(records).toContainEqual(expect.objectContaining({ url: '/api/groups/2/members/me', method: 'DELETE' }));
  expect(records.filter(r => r.method === 'GET' && r.url.startsWith('/api/groups?')).length).toBe(3);
});

test('search, course and membership filters build the query string', async () => {
  const actor = userEvent.setup();
  render(<GroupsPage user={user} />);
  await screen.findByText('Algorithms Crew');
  await actor.type(screen.getByLabelText('Search groups'), 'algo');
  await waitFor(() => expect(lastGet('/api/groups?')).toBe('/api/groups?q=algo'));
  await actor.selectOptions(screen.getByLabelText('Course'), 'CS 372');
  await waitFor(() => expect(lastGet('/api/groups?')).toBe('/api/groups?q=algo&course=CS+372'));
  await actor.click(screen.getByLabelText('My groups only'));
  await waitFor(() => expect(lastGet('/api/groups?')).toBe('/api/groups?q=algo&course=CS+372&mine=1'));
});

test('creates a group from the form', async () => {
  const actor = userEvent.setup();
  render(<GroupsPage user={user} />);
  await actor.click(await screen.findByRole('button', { name: '+ New group' }));
  await actor.type(screen.getByLabelText('Name'), 'Study Hall');
  await actor.type(screen.getByLabelText('Course (optional)'), 'CS 101');
  await actor.click(screen.getByRole('button', { name: 'Create group' }));
  expect(await screen.findByText('Group created.')).toBeInTheDocument();
  expect(records.find(r => r.method === 'POST').body).toEqual({ name: 'Study Hall', course: 'CS 101', description: '', meeting_info: '' });
  expect(screen.queryByRole('button', { name: 'Create group' })).not.toBeInTheDocument();
});

test('owners confirm before deleting a group', async () => {
  const actor = userEvent.setup();
  render(<GroupsPage user={user} />);
  await actor.click(await screen.findByRole('button', { name: 'Delete Chem Lab' }));
  expect(records.some(r => r.method === 'DELETE')).toBe(false);
  await actor.click(screen.getByRole('button', { name: 'Delete group' }));
  expect(await screen.findByText('Chem Lab was deleted.')).toBeInTheDocument();
  expect(records).toContainEqual(expect.objectContaining({ url: '/api/groups/3', method: 'DELETE' }));
});

test('shows server errors and an empty state', async () => {
  const actor = userEvent.setup();
  list = [];
  render(<GroupsPage user={user} />);
  expect(await screen.findByRole('heading', { name: 'No groups yet' })).toBeInTheDocument();
  global.fetch = jest.fn(async url => url.endsWith('/courses') ? response(200, []) : response(500, { error: 'Something went wrong. Please try again.' }));
  await actor.click(screen.getByLabelText('My groups only'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
});

test('a 401 hands control back to the app', async () => {
  global.fetch = jest.fn(async () => response(401, { error: 'Please sign in to view groups.' }));
  const onSignedOut = jest.fn();
  render(<GroupsPage user={user} onSignedOut={onSignedOut} />);
  await waitFor(() => expect(onSignedOut).toHaveBeenCalled());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
