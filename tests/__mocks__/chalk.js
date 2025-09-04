const createChalkMethod = (color) => {
  const fn = jest.fn(text => `${color}:${text}`);
  fn.bold = jest.fn(text => `${color}:bold:${text}`);
  fn.italic = jest.fn(text => `${color}:italic:${text}`);
  fn.underline = jest.fn(text => `${color}:underline:${text}`);
  fn.bgGray = { white: jest.fn(text => `${color}:bgGray:white:${text}`) };
  return fn;
};

const mockChalk = {
  red: createChalkMethod('red'),
  green: createChalkMethod('green'),
  blue: createChalkMethod('blue'),
  yellow: createChalkMethod('yellow'),
  gray: createChalkMethod('gray'),
  bold: createChalkMethod('bold'),
  italic: createChalkMethod('italic'),
  bgGray: { white: jest.fn(text => `bgGray:white:${text}`) }
};

// Add cross-chaining
mockChalk.red.bold = jest.fn(text => `red:bold:${text}`);
mockChalk.green.bold = jest.fn(text => `green:bold:${text}`);
mockChalk.blue.bold = jest.fn(text => `blue:bold:${text}`);
mockChalk.yellow.bold = jest.fn(text => `yellow:bold:${text}`);

module.exports = mockChalk;
module.exports.default = mockChalk;
