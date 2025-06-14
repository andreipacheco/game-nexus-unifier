module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  transformIgnorePatterns: [
    '/node_modules/(?!steamapi)/'
  ],
  // Explicitly use babel-jest for js files, which might help pick up babel config
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
};
