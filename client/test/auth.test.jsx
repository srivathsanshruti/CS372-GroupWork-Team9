import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthForm from '../src/components/AuthForm';

test('email/password sign-in calls the auth API', async () => {
  const user=userEvent.setup(), signedIn=jest.fn(), account={id:1,name:'Student'};
  const api=jest.fn().mockResolvedValue({user:account});
  render(<AuthForm api={api} onAuthenticated={signedIn}/>);
  await user.type(screen.getByLabelText('Email'),'student@example.test');
  await user.type(screen.getByLabelText('Password'),'a-valid-password');
  await user.click(screen.getByRole('button',{name:'Sign in'}));
  expect(api).toHaveBeenCalledWith('/auth/login',{method:'POST',body:{email:'student@example.test',password:'a-valid-password'}});
  expect(signedIn).toHaveBeenCalledWith(account);
});
test('registration rejects mismatched passwords before sending', async () => {
  const user=userEvent.setup(), api=jest.fn();
  render(<AuthForm api={api} onAuthenticated={jest.fn()}/>);
  await user.click(screen.getByRole('button',{name:'Create an account'}));
  await user.type(screen.getByLabelText('Name'),'Student');
  await user.type(screen.getByLabelText('Email'),'student@example.test');
  await user.type(screen.getByLabelText('Password'),'a-valid-password');
  await user.type(screen.getByLabelText('Confirm password'),'different-password');
  await user.click(screen.getByRole('button',{name:'Create account'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match.');
  expect(api).not.toHaveBeenCalled();
});
test('registration submits name, email and password and authenticates', async () => {
  const user=userEvent.setup(), api=jest.fn().mockResolvedValue({user:{id:1}}), signedIn=jest.fn();
  render(<AuthForm api={api} onAuthenticated={signedIn}/>);
  await user.click(screen.getByRole('button',{name:'Create an account'}));
  await user.type(screen.getByLabelText('Name'),'Student');
  await user.type(screen.getByLabelText('Email'),'student@example.test');
  await user.type(screen.getByLabelText('Password'),'a-valid-password');
  await user.type(screen.getByLabelText('Confirm password'),'a-valid-password');
  await user.click(screen.getByRole('button',{name:'Create account'}));
  expect(api).toHaveBeenCalledWith('/auth/register',{method:'POST',body:{name:'Student',email:'student@example.test',password:'a-valid-password'}});
  expect(signedIn).toHaveBeenCalledWith({id:1});
});
test('failed sign-in stays on form with server feedback', async () => {
  const user=userEvent.setup(), signedIn=jest.fn();
  render(<AuthForm api={jest.fn().mockRejectedValue(new Error('Email or password is incorrect.'))} onAuthenticated={signedIn}/>);
  await user.type(screen.getByLabelText('Email'),'student@example.test');
  await user.type(screen.getByLabelText('Password'),'wrong-password');
  await user.click(screen.getByRole('button',{name:'Sign in'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  expect(signedIn).not.toHaveBeenCalled();
});
