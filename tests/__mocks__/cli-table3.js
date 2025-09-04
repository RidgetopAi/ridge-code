class MockTable extends Array {
  constructor(options) {
    super();
    this.options = options;
  }
  
  toString() {
    return 'mocked table output';
  }
  
  push(...items) {
    super.push(...items);
  }
}

module.exports = MockTable;
module.exports.default = MockTable;
