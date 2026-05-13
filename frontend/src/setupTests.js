// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import '@testing-library/jest-dom/extend-expect';

// Mock fetch API
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve([
      { id: '1', name: '哲学家', role: 'Philosopher' },
      { id: '2', name: '科学家', role: 'Scientist' },
      { id: '3', name: '历史学家', role: 'Historian' },
      { id: '4', name: '艺术家', role: 'Artist' }
    ])
  })
); 