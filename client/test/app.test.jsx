import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';

const account={id:1,name:'Student',email:'student@example.test'};
const progress={habits:[],history:[],percentage:0,expected:0,completions:0};
const response=(status,body)=>({status,ok:status<400,json:async()=>body});
afterEach(()=>jest.restoreAllMocks());
test('restores an existing session and sign-out returns to the login form', async()=>{
 const user=userEvent.setup();
 global.fetch=jest.fn(async(url,options={})=>{
  if(url.endsWith('/auth/logout')) return response(204,null);
  if(url.endsWith('/me')) return response(200,account);
  return response(200,progress);
 });
 render(<App/>);
 expect(await screen.findByRole('heading',{name:'My habits'})).toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Sign out'}));
 expect(await screen.findByRole('heading',{name:'Sign in'})).toBeInTheDocument();
 expect(screen.queryByText('No habits yet')).not.toBeInTheDocument();
});
test('sign-in reaches the actual personal dashboard with session-based requests', async()=>{
 let authenticated=false;
 const user=userEvent.setup();
 global.fetch=jest.fn(async(url,options={})=>{
  if(url.endsWith('/auth/login')) { authenticated=true; return response(200,{user:account}); }
  if(url.endsWith('/me')) return authenticated ? response(200,account) : response(401,{error:'Please sign in.'});
  return response(200,progress);
 });
 render(<App/>);
 await screen.findByRole('heading',{name:'Sign in'});
 await user.type(screen.getByLabelText('Email'),'student@example.test');
 await user.type(screen.getByLabelText('Password'),'a-valid-password');
 await user.click(screen.getByRole('button',{name:'Sign in'}));
 expect(await screen.findByText('No habits yet')).toBeInTheDocument();
 expect(screen.getByText('Student')).toBeInTheDocument();
});
