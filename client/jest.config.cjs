module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  transform: { '^.+\\.[jt]sx?$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }], ['@babel/preset-react', { runtime: 'automatic' }]] }] },
  moduleNameMapper: { '\\.css$': '<rootDir>/test/styleMock.cjs' }
};
