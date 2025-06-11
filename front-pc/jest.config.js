module.exports = {
  // ...
  transform: {
    '^.+\\.js$': 'babel-jest', // 使用 Babel 转换 JS 文件
  },
  moduleFileExtensions: ['js', 'json', 'vue'],
  testEnvironment: 'node',
};
