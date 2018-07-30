/**
 * 配置文件
 */

const path = require('path');

/**
 * 默认设置
 */
let config = {
  host: '127.0.0.1',
  port: 3000,
  dir: path.join(__dirname, '../public') //默认静态目录为当前模块的/public下
};

module.exports = config;
