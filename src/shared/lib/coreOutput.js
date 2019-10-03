import fs from 'fs';
import path from 'path';
import events from 'events';

import store from 'store';
import { coreDataDir } from 'consts/paths';
import { printCoreOutput } from 'actions/ui';

// Generated by CoffeeScript 2.3.1
const boundMethodCheck = function(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new Error('Bound instance method accessed before binding');
  }
};

class Tail extends events.EventEmitter {
  readBlock() {
    var block, stream;
    boundMethodCheck(this, Tail);
    if (this.queue.length >= 1) {
      block = this.queue[0];
      if (block.end > block.start) {
        stream = fs.createReadStream(this.filename, {
          start: block.start,
          end: block.end - 1,
          encoding: this.encoding,
        });
        stream.on('error', error => {
          if (this.logger) {
            this.logger.error(`Tail error: ${error}`);
          }
          return this.emit('error', error);
        });
        stream.on('end', () => {
          var x;
          x = this.queue.shift();
          if (this.queue.length > 0) {
            this.internalDispatcher.emit('next');
          }
          if (this.flushAtEOF && this.buffer.length > 0) {
            this.emit('line', this.buffer);
            return (this.buffer = '');
          }
        });
        return stream.on('data', data => {
          var chunk, i, len, parts, results;
          if (this.separator === null) {
            return this.emit('line', data);
          } else {
            this.buffer += data;
            parts = this.buffer.split(this.separator);
            this.buffer = parts.pop();
            results = [];
            for (i = 0, len = parts.length; i < len; i++) {
              chunk = parts[i];
              results.push(this.emit('line', chunk));
            }
            return results;
          }
        });
      }
    }
  }

  constructor(filename, options = {}) {
    var fromBeginning;
    super(filename, options);
    this.readBlock = this.readBlock.bind(this);
    this.change = this.change.bind(this);
    this.filename = filename;
    ({
      separator: this.separator = /[\r]{0,1}\n/,
      fsWatchOptions: this.fsWatchOptions = {},
      follow: this.follow = true,
      logger: this.logger,
      useWatchFile: this.useWatchFile = false,
      flushAtEOF: this.flushAtEOF = false,
      encoding: this.encoding = 'utf-8',
      fromBeginning: fromBeginning = false,
    } = options);
    if (this.logger) {
      this.logger.info('Tail starting...');
      this.logger.info(`filename: ${this.filename}`);
      this.logger.info(`encoding: ${this.encoding}`);
    }
    this.buffer = '';
    this.internalDispatcher = new events.EventEmitter();
    this.queue = [];
    this.isWatching = false;
    this.internalDispatcher.on('next', () => {
      return this.readBlock();
    });
    this.watch(fromBeginning);
  }

  change(filename) {
    var err, stats;
    boundMethodCheck(this, Tail);
    try {
      stats = fs.statSync(filename);
    } catch (error1) {
      err = error1;
      if (this.logger) {
        this.logger.error(`'${e}' event for ${filename}. ${err}`);
      }
      this.emit('error', `'${e}' event for ${filename}. ${err}`);
      return;
    }
    if (stats.size < this.pos) {
      //scenario where texts is not appended but it's actually a w+
      this.pos = stats.size;
    }
    if (stats.size > this.pos) {
      this.queue.push({
        start: this.pos,
        end: stats.size,
      });
      this.pos = stats.size;
      if (this.queue.length === 1) {
        return this.internalDispatcher.emit('next');
      }
    }
  }

  watch(fromBeginning) {
    var err, stats;
    if (this.isWatching) {
      return;
    }
    if (this.logger) {
      this.logger.info(`filesystem.watch present? ${fs.watch !== void 0}`);
      this.logger.info(`useWatchFile: ${this.useWatchFile}`);
      this.logger.info(`fromBeginning: ${fromBeginning}`);
    }
    this.isWatching = true;
    try {
      stats = fs.statSync(this.filename);
    } catch (error1) {
      err = error1;
      if (this.logger) {
        this.logger.error(`watch for ${this.filename} failed: ${err}`);
      }
      this.emit('error', `watch for ${this.filename} failed: ${err}`);
      return;
    }
    this.pos = fromBeginning ? 0 : stats.size;
    if (this.pos === 0) {
      this.change(this.filename);
    }
    if (!this.useWatchFile && fs.watch) {
      if (this.logger) {
        this.logger.info('watch strategy: watch');
      }
      return (this.watcher = fs.watch(
        this.filename,
        this.fsWatchOptions,
        (e, filename) => {
          return this.watchEvent(e, filename);
        }
      ));
    } else {
      if (this.logger) {
        this.logger.info('watch strategy: watchFile');
      }
      return fs.watchFile(this.filename, this.fsWatchOptions, (curr, prev) => {
        return this.watchFileEvent(curr, prev);
      });
    }
  }

  rename(filename) {
    //MacOS sometimes throws a rename event for no reason.
    //Different platforms might behave differently.
    //see https://nodejs.org/api/fs.html#fs_fs_watch_filename_options_listener
    //filename might not be present.
    //https://nodejs.org/api/fs.html#fs_filename_argument
    //Better solution would be check inode but it will require a timeout and
    // a sync file read.
    if (filename === void 0 || filename !== this.filename) {
      this.unwatch();
      if (this.follow) {
        return setTimeout(() => {
          return this.watch();
        }, 1000);
      } else {
        if (this.logger) {
          this.logger.error(
            `'rename' event for ${this.filename}. File not available.`
          );
        }
        return this.emit(
          'error',
          `'rename' event for ${this.filename}. File not available.`
        );
      }
    } else {
    }
  }

  // @logger.info("rename event but same filename")
  watchEvent(e, evtFilename) {
    if (e === 'change') {
      return this.change(this.filename);
    } else if (e === 'rename') {
      return this.rename(evtFilename);
    }
  }

  watchFileEvent(curr, prev) {
    if (curr.size > prev.size) {
      this.pos = curr.size; // Update @pos so that a consumer can determine if entire file has been handled
      this.queue.push({
        start: prev.size,
        end: curr.size,
      });
      if (this.queue.length === 1) {
        return this.internalDispatcher.emit('next');
      }
    }
  }

  unwatch() {
    if (this.watcher) {
      this.watcher.close();
    } else {
      fs.unwatchFile(this.filename);
    }
    this.isWatching = false;
    this.queue = [];
    if (this.logger) {
      return this.logger.info('Unwatch ', this.filename);
    }
  }
}

var tail;
var debugFileLocation;
var checkIfFileExistsInterval;
var printCoreOutputTimer;

export function startCoreOuputWatch() {
  if (store.getState().settings.manualDaemon) {
    return;
  }
  let datadir = coreDataDir;

  var debugfile;
  if (fs.existsSync(path.join(datadir, 'log', '0.log'))) {
    debugfile = path.join(datadir, 'log', '0.log');
  } else if (process.platform === 'win32') {
    debugfile = datadir + '\\debug.log';
  } else {
    debugfile = datadir + '/debug.log';
  }

  debugFileLocation = debugfile;

  fs.stat(debugFileLocation, (err, stat) => {
    checkDebugFileExists(err, stat);
  });

  checkIfFileExistsInterval = setInterval(() => {
    if (tail != undefined) {
      clearInterval(checkIfFileExistsInterval);
      return;
    }
    fs.stat(debugFileLocation, (err, stat) => {
      checkDebugFileExists(err, stat);
    });
  }, 5000);
}

export function stopCoreOuputWatch() {
  if (tail != undefined) {
    tail.unwatch();
  }
  clearInterval(printCoreOutputTimer);
  clearInterval(checkIfFileExistsInterval);
}

function checkDebugFileExists(err, stat) {
  if (err == null) {
    processDeamonOutput(debugFileLocation);
    clearInterval(checkIfFileExistsInterval);
  } else {
    console.log('exists', stat);
  }
}

function processDeamonOutput(debugfile) {
  const tailOptions = {
    useWatchFile: true,
  };
  tail = new Tail(debugfile, tailOptions);
  let n = 0;
  let batch = [];
  tail.on('line', d => {
    batch.push(d);
  });
  printCoreOutputTimer = setInterval(() => {
    if (store.getState().ui.console.core.paused) {
      return;
    }
    if (batch.length == 0) {
      return;
    }
    store.dispatch(printCoreOutput(batch));
    batch = [];
  }, 1000);
}
