module.exports = {
  highlight: jest.fn((code, options) => `highlighted:${code}`),
  listLanguages: jest.fn(() => ['javascript', 'typescript', 'python', 'bash'])
};
