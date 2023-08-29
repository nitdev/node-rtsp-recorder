//
//  recorder.js
//  node-rtsp-recorder
//
//  Created by Sahil Chaddha on 24/08/2018.
//

const moment = require('moment')
const childProcess = require('child_process')
const path = require('path')
const FileHandler = require('./fileHandler')
const fh = new FileHandler()

const RTSPRecorder = class {
  constructor(config = {}) {
    this.config = config
    this.name = config.name
    this.url = config.url
    this.timeLimit = config.timeLimit || 60
    this.folder = config.folder || 'media/'
    this.categoryType = config.type || 'video'
    this.directoryPathFormat = config.directoryPathFormat || 'MMM-Do-YY'
    this.fileNameFormat = config.fileNameFormat || 'YYYY-M-D-h-mm-ss'
    this.audioCodec = config.audioCodec || 'copy'
    this.videoCodec = config.videoCodec || 'copy'
    this.more = config.more || ''
    this.errorCallback = config.errorCallback || function () { }
    this.log = config.log || false;
    this.callbackData = config.callbackData || {};


    fh.createDirIfNotExists(this.getDirectoryPath())
    fh.createDirIfNotExists(this.getTodayPath())
  }

  getDirectoryPath() {
    return path.join(this.folder, (this.name ? this.name : ''))
  }

  getTodayPath() {
    return path.join(this.getDirectoryPath(), moment().format(this.directoryPathFormat))
  }

  getMediaTypePath() {
    return path.join(this.getTodayPath());
    // return path.join(this.getTodayPath(), this.categoryType)
  }

  getFilename(folderPath) {
    return path.join(folderPath, moment().format(this.fileNameFormat) + this.getExtenstion())
  }

  getExtenstion() {
    if (this.categoryType === 'audio') {
      return '.avi'
    }
    if (this.categoryType === 'image') {
      return '.jpg'
    }

    return '.mp4'
  }

  getArguments() {
    if (this.categoryType === 'audio') {
      return ['-vn', '-acodec', 'copy']
    }
    if (this.categoryType === 'image') {
      return ['-vframes', '1']
    }
    return ['-acodec', this.audioCodec, '-vcodec', this.videoCodec, this.more]
  }

  getCommand(fileName) {
    var args = ['ffmpeg', '-rtsp_transport', 'tcp', '-i', this.url]
    const mediaArgs = this.getArguments();
    mediaArgs.forEach((item) => {
      args.push(item)
    });
    args.push(fileName)
    return args.join(' ');
  }

  getChildProcess(fileName, callback) {
    var args = ['ffmpeg', '-rtsp_transport', 'tcp', '-i', this.url]
    const mediaArgs = this.getArguments();
    mediaArgs.forEach((item) => {
      args.push(item)
    });
    args.push(fileName)
    return childProcess.exec(this.getCommand(fileName), callback)

    // var args = ['-rtsp_transport', 'tcp', '-i', this.url]
    // const mediaArgs = this.getArguments()
    // mediaArgs.forEach((item) => {
    //   args.push(item)
    // })
    // args.push(fileName)
    // return childProcess.spawn('ffmpeg',
    //   args,
    //   { detached: false, stdio: 'ignore' })
  }

  stopRecording() {
    this.disableStreaming = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.writeStream) {
      this.killStream()
    }
  }

  startRecording() {
    if (!this.url) {
      console.log('URL Not Found.')
      return true
    }
    this.recordStream(1)
  }

  captureImage(cb) {
    this.writeStream = null
    const folderPath = this.getMediaTypePath()
    fh.createDirIfNotExists(folderPath)
    const fileName = this.getFilename(folderPath)
    this.writeStream = this.getChildProcess(fileName, function (err, stdout, stderr) {
      // console.log("err", err);
      // console.log("stdout", stdout);
      // console.log("stderr", stderr);
      // console.log("===============");

    })
    this.writeStream.once('exit', () => {
      if (cb) {
        cb()
      }
    })
  }

  killStream() {
    try {
      this.writeStream.stdin.write('q');
    } catch (e) {

    }

    // setTimeout(() => {
    try {
      this.writeStream.kill();
    } catch (e) {

    }
    // }, 20000)
    //this.writeStream.kill()
  }

  handleError(repeat) {
    if (this.disableStreaming) return true;
    if (repeat >= 3) {
      // Xử lý lỗi
      if (this.writeStream) {
        this.killStream()
      }

      this.errorCallback(this.callbackData);
    } else {
      if (this.writeStream) {
        this.killStream()
      }

      this.recordStream(repeat + 1)
    }
  }

  recordStream(repeat = 1) {
    if (this.categoryType === 'image') {
      return
    }
    const self = this
    if (this.timer) {
      clearTimeout(this.timer)
    }

    if (this.writeStream && this.writeStream.binded) {
      return false
    }

    if (this.writeStream && this.writeStream.connected) {
      this.writeStream.binded = true
      this.writeStream.once('exit', () => {
        // if (this.log) 
        // console.error("Error exit > " + this.name);
        this.handleError(repeat)
      })
      this.killStream()
      return false
    }

    this.writeStream = null;
    const folderPath = this.getMediaTypePath()
    try {
      fh.createDirIfNotExists(folderPath)
      const fileName = this.getFilename(folderPath)
      this.writeStream = this.getChildProcess(fileName, (err, stdout, stderr) => {
        // if (err) {
        //   console.log("camera id " + this.name);
        //   console.log("err::::: ", err);
        // }
        // if (stdout) console.log("stdout:::::", stdout);
        // if (stderr) console.log("stderr:::::", stderr);

        // if (err) {
        //   self.handleError(repeat)
        // }
      })

      this.writeStream.once('exit', () => {
        // if (this.log) {
        // if (repeat != 0) console.error("Error exit 219 > " + this.getCommand(fileName));
        // }
        this.handleError(repeat);
        // if (self.disableStreaming) {
        //   return true
        // }
        // self.recordStream(repeat + 1)
      });

      this.writeStream.stdout.on('error', function (err) {
        // console.log("err.code: " + err.code);
        if (err.code == "EPIPE") {
          process.exit(0);
        }
      });


      this.timer = setTimeout(() => {
        repeat = 0;
        this.killStream();
      }, this.timeLimit * 1000)
    } catch (e) {
      console.log('Start record ERROR ', e)
    }
  }
}

module.exports = RTSPRecorder
