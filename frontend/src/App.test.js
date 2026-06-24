import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login page', () => {
  render(<App />);
  const titleElement = screen.getByText('ZIPPY');
  expect(titleElement).toBeInTheDocument();
});
