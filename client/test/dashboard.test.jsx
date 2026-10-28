import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonalDashboard from '../src/PersonalDashboard';
import { localDate } from '../src/api';

const today = localDate();
const habit = {id:1,user_id:1,title:'Read chapter',goal:'Read 10 pages',frequency:'daily',start_date:today,status:'active',completion_count:0,expected:1,completions:0,percentage:0,dueToday:true,completedToday:false};
const progress = {habits:[habit],history:[],percentage:0,expected:1,completions:0,asOf:today};
let records;
beforeEach(() => {
  records=[];
  global.fetch=jest.fn(async (url,options={}) => {
    records.push({url,options});
    return {ok:true,status:200,json:async () => url.endsWith('/me') ? {id:1,name:'Alex',email:'alex@example.test'} : progress};
  });
});
afterEach(() => jest.restoreAllMocks());
async function load() {
  render(<PersonalDashboard />);
  await screen.findAllByText('Read chapter');
}
test('uses current account and has no sample account selector or demo requests', async () => {
  await load();
  expect(screen.getByText('Alex')).toBeInTheDocument();
  expect(screen.queryByText(/Shruti Demo|Local meeting demo/)).not.toBeInTheDocument();
  expect(records.some(record => record.url.includes('/demo'))).toBe(false);
});
test('creates a real habit via the API', async () => {
  const user=userEvent.setup(); await load();
  await user.click(screen.getByRole('button',{name:'+ Add habit'}));
  await user.type(screen.getByLabelText('Name'),'Solve practice problems');
  await user.type(screen.getByLabelText('Goal'),'Solve five problems');
  await user.click(screen.getByRole('button',{name:'Add habit'}));
  await screen.findByText('Habit added.');
  const record=records.find(item=>item.options.method==='POST');
  expect(record.url).toBe('/api/habits');
  expect(JSON.parse(record.options.body)).toEqual({title:'Solve practice problems',goal:'Solve five problems',frequency:'daily',start_date:today});
});
test('completion checkbox writes the actual date and refreshes progress', async () => {
  const user=userEvent.setup(); await load();
  await user.click(screen.getByRole('checkbox'));
  await screen.findByText('Completion saved.');
  const record=records.find(item=>item.options.method==='POST');
  expect(record.url).toBe('/api/habits/1/completions');
  expect(JSON.parse(record.options.body)).toEqual({completed_date:today});
});
test('edit saves updates through PUT', async () => {
  const user=userEvent.setup(); await load();
  await user.click(screen.getByRole('button',{name:'Edit Read chapter'}));
  await user.clear(screen.getByLabelText('Goal'));
  await user.type(screen.getByLabelText('Goal'),'Read 15 pages');
  await user.click(screen.getByRole('button',{name:'Save changes'}));
  await screen.findByText('Habit updated.');
  expect(JSON.parse(records.find(item=>item.options.method==='PUT').options.body).goal).toBe('Read 15 pages');
});
test('delete requires confirmation; cancelling makes no delete request', async () => {
  const user=userEvent.setup(); await load();
  await user.click(screen.getByRole('button',{name:'Delete Read chapter'}));
  expect(screen.getByText('This also removes its completion history. This cannot be undone.')).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Keep habit'}));
  expect(records.some(item=>item.options.method==='DELETE')).toBe(false);
  await user.click(screen.getByRole('button',{name:'Delete Read chapter'}));
  await user.click(screen.getByRole('button',{name:'Delete habit'}));
  await screen.findByText('Habit deleted.');
  expect(records.find(item=>item.options.method==='DELETE').url).toBe('/api/habits/1');
});
test('progress period is sent to the API', async () => {
  const user=userEvent.setup(); await load();
  await user.click(screen.getByRole('button',{name:'Progress'}));
  await user.selectOptions(screen.getByLabelText('Reporting period'),'7');
  await waitFor(()=>expect(records.some(item=>item.url.includes('from='))).toBe(true));
  expect(screen.getByRole('progressbar',{name:'Overall completion'})).toHaveAttribute('aria-valuenow','0');
});
test('expired session clears private data and uses the host login callback', async () => {
  const user=userEvent.setup(); const signIn=jest.fn();
  global.fetch.mockImplementation(async ()=>({ok:false,status:401,json:async()=>({error:'Please sign in.'})}));
  render(<PersonalDashboard onSignIn={signIn}/>);
  await screen.findByText('Sign in to see your habits');
  expect(screen.queryByText('Read chapter')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Sign in'})); expect(signIn).toHaveBeenCalledTimes(1);
});
test('backend errors display without pretending a save succeeded', async () => {
  const user=userEvent.setup(); await load();
  global.fetch.mockImplementation(async ()=>({ok:false,status:409,json:async()=>({error:'Already completed.'})}));
  await user.click(screen.getByRole('checkbox'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Already completed.');
  expect(screen.queryByText('Completion saved.')).not.toBeInTheDocument();
});
