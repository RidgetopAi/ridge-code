const mockClient = {
  connect: jest.fn(),
  callTool: jest.fn(),
  listTools: jest.fn(),
  close: jest.fn()
};

const MockClient = jest.fn(() => mockClient);

module.exports = {
  Client: MockClient
};
