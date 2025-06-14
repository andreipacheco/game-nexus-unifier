module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  transformIgnorePatterns: [
    '/node_modules/(?!steamapi|node-fetch)/' // Ensure steamapi and node-fetch are transformed
  ],
  // Explicitly use babel-jest for js files, which might help pick up babel config
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
};
