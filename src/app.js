/**
 * 手写静态服务器
 * 仿http-server
 */

const path = require('path');
const fs = require('fs');
const util = require('util');
const url = require('url');
const http = require('http');
const debug = require('debug')('*');
const chalk = require('chalk');
const ejs = require('ejs');
const mime = require('mime');

const config = require('./config');

const stat = util.promisify(fs.stat);
const readdir = util.promisify(fs.readdir);
const temp = fs.readFileSync(path.join(__dirname, '../template/file.ejs'), 'utf8');

class Server {
  constructor(args) {
    this.config = {
      ...config,
      ...args //命令行参数覆盖默认参数
    };
    this.handleRequest = this.handleRequest.bind(this);
  }
  async handleRequest(req, res) {
    let {pathname} = url.parse(req.url, true);
    let resource = path.join(this.config.dir, pathname); //取得文件的绝对路径
    try {
      let s = await stat(resource);
      if (s.isDirectory()) {
        let files = await readdir(resource);
        files = files.map((i) => {
          return {
            fileName: i,
            path: path.join(pathname, i)
          }
        });
        let html = ejs.render(temp, {files});
        res.setHeader('Content-Type', 'text/html;charset=utf8');
        res.end(html);
      } else {
        //是文件
        if (this.cache(req, res, resource, s)) {
          res.statusCode = 304;
          res.end();
          return;
        } else {
          this.sendFile(req, res, resource);
        }
      }
    } catch (e) {
      this.sendError(req, res, e);
    }
  }
  start() {
    let server = http.createServer(this.handleRequest);
    let {host, port} = this.config;
    server.listen({
      host,
      port
    }, () => {
      debug(`服务器已经启动在 http://${host}:${chalk.greenBright(port)}/ 上...`);
    });
  }
  /**
   * 发送文件
   * @param  {[type]} req      request对象
   * @param  {[type]} res      response对象
   * @param  {[type]} filePath 文件绝对路径
   * @param  {[type]} stat     状态（缓存使用）
   */
  sendFile(req, res, filePath, stat) {
    let contentType = mime.getType(filePath)
      ? mime.getType(filePath)
      : 'text/plain';
    res.setHeader('Content-Type', contentType + ';charset=utf8');
    fs.createReadStream(filePath).pipe(res);
  }
  /**
   * 发送错误消息
   * @param  {[type]} req request对象
   * @param  {[type]} res response对象
   * @param  {[type]} e   错误对象
   */
  sendError(req, res, e) {
    debug(util.inspect(e).toString());
    res.statusCode = 404;
    res.end('Not Found');
  }
  //缓存功能
  cache(req, res, path, stat) {
    let ifModidifySince = req.headers['if-modified-since'];
    let ifNoneMatch = req.headers['if-none-match'];//取值时头要小写
    let match = stat.ctime.getTime() + stat.size; //一般使用修改时间+文件大小判断

    //首次访问要把修改时间加上，否则浏览器不会发送If-Modified-Since头
    res.setHeader('Last-Modified', stat.ctime.toUTCString());
    //首次访问要把ETag加上，否则浏览器不会发送If-None-Match头
    res.setHeader('ETag', match);
    res.setHeader('Cache-Control', 'max-age=5');

    //修改时间和If-Modified-Since相同，说明文件没有改过
    if (stat.ctime.toUTCString() == ifModidifySince) {
      return true;
    }
    //ETag和后端生成的match相同，说明没有改过
    if (match == ifNoneMatch) {
      return true;
    }
    return false;
  }
}

module.exports = Server;
