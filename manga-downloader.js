var async = require('async');
var path = require('path');
var fs = require('fs');

var fse = require('fs-extra');
var moment = require('moment');

var utils = require('jul11co-wdt').Utils;

var Saver = require('jul11co-wdt').Saver;

var state_file_name = 'saver.json';
var page_handlers = [];

exports.setStateFileName = function(file_name) {
  state_file_name = file_name;
}

function loadHandlersFromDirectory(directory) {
  if (utils.directoryExists(directory)) {
    fs.readdirSync(directory).forEach(function(file) {
      if (file.indexOf('.js') > 0) {
        var handler = require(directory + "/" + file);
        // console.log('Loaded handler:', handler.name + ",", directory + "/" + file);
        page_handlers.push(handler);
      }
    });
  }
}

exports.loadDefaultHandlers = function() {
  loadHandlersFromDirectory(__dirname + '/handlers');
}

// handler
// {
//   name: String,
//   match: function(link, options) {...},
//   dispatch: function($, page, options, callback) {...}
// }
exports.addHandler = function(handler) {
  page_handlers.push(handler);
}

function addHandlers(saver) {
  page_handlers.forEach(function(handler) {
    saver.addHandler(handler);
  });
}

exports.getHandlers = function() {
  return page_handlers;
}

function updateObject(original, update, verbose) {
  if (typeof original == 'object' && typeof update == 'object') {
    for (var prop in update) {
      if (verbose) {
        console.log('Update prop "' + prop + '":', 
          ' (' + typeof original[prop] + ' --> ' + typeof update[prop] + ')');
      }
      if (typeof original[prop] == 'object' && typeof update[prop] == 'object') {
        updateObject(original[prop], update[prop], verbose);
      } else {
        original[prop] = update[prop];
      }
    }
  } else {
    original = update;
  }
}


///////////

Saver.prototype.getUniqueFileName = function(file_names, file_name) {
  var result_file_name = file_name;
  var file_name_ext = path.extname(file_name);
  var file_name_base = path.basename(file_name, file_name_ext);
  var collision = false;

  for (var i = 0; i < file_names.length; i++) {
    if (file_name == file_names[i].file_name) {
      collision = true;
      file_names[i].current_index++;
      result_file_name = file_name_base + '(' + file_names[i].current_index + ')' + file_name_ext;
    }
  }
  if (!collision) {
    file_names.push({
      file_name: file_name,
      current_index: 0
    });
  }
  return result_file_name;
}

Saver.prototype.setOutputDir = function(output_dir) {
  this._output_dir = output_dir;
  this._state_file = path.join(this._output_dir, this._state_file_name);
  if (utils.fileExists(this._state_file)) {
    // console.log('New state file:', this._state_file);
    // var update_state = (this.loadStateSync(this._state_file) || {});
    // updateObject(this._state, update_state);
    this._state = this.loadStateSync(this._state_file) || {};
  } else {
    this._state = {};
  }
}

Saver.prototype.setMangaOutputDir = function(manga_dir) {
  // console.log('Manga output dir: ' + manga_dir);
  this.setOutputDir(manga_dir);
}

Saver.prototype.isDone = function(link) {
  var state = this.getStateData(link);
  return (state && state.done);
}

Saver.prototype.createComicFile = function(output_dir, images, callback) {
  var self = this;

  var archive_filename = path.basename(output_dir);
  var comic_cbz = path.join(output_dir, '..', archive_filename + '.cbz');
  var comic_files = [];
  var count = 1;
  images.forEach(function(image) {
    if (typeof image == 'string') {
      var image_file = path.join(output_dir, image);
      if (utils.fileExists(image_file)) {
        comic_files.push({
          path: image_file,
          name: archive_filename + '-' + utils.numberPad(count, 3) + path.extname(image)
        });
      }
    } else {
      if (image.error) return;
      var image_file = path.join(output_dir, image.image_file || image.file);
      if (utils.fileExists(image_file)) {
        comic_files.push({
          path: image_file,
          name: archive_filename + '-' + utils.numberPad(count, 3) + path.extname(image.image_file || image.file)
        });
      }
    }
    count++;
  });

  self.createZipArchive(comic_cbz, comic_files, callback);
}

// manga
// {
//   chapter_url: String,
//   chapter_title: String,
//   chapter_images: [{
//     src: String,
//     file: String,
//     alt: String
//   }],
//   output_dir: String
// }
Saver.prototype.downloadMangaChapter = function(manga, options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }
  
  var self = this;

  console.log('Download chapter:', manga.chapter_title, '(' + manga.chapter_images.length + ' pages)');
  console.log('Chapter directory:', manga.output_dir);

  // Save current state
  var state_data = {
    output_dir: manga.output_dir_name || path.relative(options.output_dir || '.', manga.output_dir),
    chapter_title: manga.chapter_title,
    chapter_images: manga.chapter_images,
    done: false,
    last_update: new Date()
  };
  self.setStateData(manga.chapter_url, state_data);

  if (options.metadata_only && !options.cbz) {
    return callback();
  }

  var downloaded = 0;
  var total = manga.chapter_images.length;

  var progressReport = null;
  if (!options.quiet && options.full_progress) {
    progressReport = function(progress) {
      if (progress.file && progress.current && progress.total) {
        if (progress.current == progress.total) {
          process.stdout.write('\r');
          console.log('Downloaded: ' + utils.ellipsisMiddle(progress.file));
        } else {
          process.stdout.write('Downloading: ' + utils.ellipsisMiddle(progress.file) 
            + ' ' + progress.percentage + '% ' + progress.speed + 'kB/s\r');
        }
      }
    };
  } else {
    progressReport = function(progress) {
      if (progress.file && progress.current && progress.total) {
        if (progress.current == progress.total) {
          downloaded++;
          console.log('Downloaded:', downloaded+'/'+total, 
            utils.ellipsisMiddle(path.relative(manga.output_dir, progress.file)));
        }
      }
    };
  }

  // if (options.request_headers) {
  //   console.log(options.request_headers);
  // }

  // Download chapter_images here
  self.downloadImages(manga.chapter_images, {
    output_dir: manga.output_dir,
    skip_if_exist: true,
    request_headers: options.request_headers,
    max_download_threads: options.max_download_threads || 4,
    verbose: options.verbose,
    // progress: progressReport,
    onDownloadFailed: function(err, data) {
      if (data) {
        console.log('Download failed:', data.url);
      }
      console.log(err.message);
    },
    onDownloadFinished: function(res) {
      downloaded++;
      console.log('Downloaded:', downloaded+'/'+total, path.relative(options.output_dir, res.file));
    }
  }, function(err, images) {
    if (err) {
      return cb(err);
    }

    self.updateStateData(manga.chapter_url, {
      chapter_images: images, 
      done: true, 
      last_update: new Date() 
    }, true);

    if (options.cbz) {
      self.createComicFile(manga.output_dir, images, callback);
    } else {
      callback();
    }
  });
}

///////

exports.download = function(page_url, output_dir, options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  options.page_url = page_url;
  options.output_dir = output_dir;
  options.state_file_name = state_file_name;

  var saver = new Saver(options);
  var current_state = saver.getStateData(page_url);
  if (!options.force && current_state != null) {
    console.log('Warning: State file exists in output directory. ' +
      'Append --force to override/overwrite this.');
    return callback();
  }

  var callback_called = false;
  var onSaverEnd = function(err) {
    if (!callback_called) {
      callback_called = true;
      callback(err);
    }
  }

  saver.on('before_exit', function(err) {
    saver.updateStateData({last_update: new Date()});
  });

  saver.on('exit', function(err) {
    onSaverEnd(err);
  });

  // saver.on('error', function(err) {
  //   onSaverEnd(err);
  // });

  addHandlers(saver);
  
  saver.start(options);
}

var scanDirRecursive = function(abspath, options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  var statefilelist = [];
  fs.readdir(abspath, function(err, files) {
    if (err) return callback(err);

    async.eachSeries(files, function(file, cb) {
      
      if (file.indexOf('.') == 0) {
        return cb();
      }

      var file_abs_path = path.join(abspath, file);
      var stats = fs.lstatSync(file_abs_path);
      // console.log(stats);
      if (stats.isFile() && file == state_file_name) {
          statefilelist.push(file_abs_path);
          cb();
      } else if (stats.isDirectory()) {
        scanDirRecursive(file_abs_path, options, function(err, statefiles) {
          if (err) return cb(err);
          statefilelist = statefilelist.concat(statefiles);
          cb();
        });
      } else {
        cb();
      }
    }, function(err) {
      callback(err, statefilelist);
    });
  });
}

var updateDir = function(output_dir, options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  if (!utils.fileExists(path.join(output_dir, state_file_name))) {
    return callback(new Error('State file not found in directory'));
  }

  options.update = true;
  options.output_dir = output_dir;
  options.state_file_name = state_file_name;

  var saver = new Saver(options);
  addHandlers(saver);

  var callback_called = false;
  var onSaverEnd = function(err) {
    if (!callback_called) {
      callback_called = true;
      callback(err);
    }
  }

  if (options.mark_all_done) {
    var marked = 0;
    var state = saver.getState();
    for (var prop in state) {
      if (utils.isHttpUrl(prop) && typeof state[prop] == 'object') {
        var page = state[prop];
        if (!page.done) {
          saver.updateStateData(prop, {done: true});
          marked++;
        }
      }
    }

    console.log('Marked all done:', marked);

    return callback();
  }

  if (options.resources_only) {

    var update_queue = [];
    var state = saver.getState();
    for (var prop in state) {
      if (utils.isHttpUrl(prop) && typeof state[prop] == 'object') {
        var page = state[prop];
        var done = page.done || false;
        var ignore = page.ignore || false;
        if ((options.force || !done) && !ignore 
          && typeof page.output_dir == 'string' && page.output_dir != ''
          && page.chapter_images && page.chapter_images.length) {
          update_queue.push({
            chapter_url: prop,
            chapter_title: page.chapter_title,
            chapter_images: page.chapter_images,
            output_dir: path.join(output_dir, page.output_dir)
          });
        }
      }
    }
    
    // console.log(update_queue);
    var total = update_queue.length;
    var current = 0;

    async.eachSeries(update_queue, function(update_item, cb) {
      current++;
      console.log('[' + current + '/' + total + ']', 'Download chapter: ' + update_item.chapter_url);
      saver.downloadMangaChapter(update_item, function(err) {
        if (err) return cb(err);
        cb();
      });
    }, function(err) {
      saver.exit(err);
      if (err) return callback(err);
      callback();
    });

    return;
  }

  if (saver.getStateData('ignore')) {
    console.log('Manga disabled:', output_dir);
    return callback();
  }
  
  if (!options.ignore_last_update) {
    var last_update = saver.getStateData('last_update');
    if (last_update) {
      console.log('Last update:', moment(last_update).fromNow());
      if (moment().diff(moment(last_update), 'minutes') < 60) { // too frequently
        console.log('Append --ignore-last-update to force update this manga.');
        return callback();
      }
    }
  }

  var page_url = saver.getStateData('url');
  if (page_url && !options.ignore_default_url) {
    if (page_url == '') {
      return callback(new Error('"url" field left empty'));
    }
    
    console.log('Update from URL: ' + page_url);
    options.page_url = page_url;

    saver.on('before_exit', function() {
      saver.updateStateData('last_update', new Date(), true);
    });

    saver.on('exit', function(err) {
      onSaverEnd(err);
    });

    saver.on('error', function(err) {
      console.log('Error:', err);
      // onSaverEnd(err);
    });

    saver.start(options, function(err) {
      if (err) {
        onSaverEnd(err);
      }
    });
  } else {
    var update_queue = [];
    var state = saver.getState();
    for (var prop in state) {
      if (utils.isHttpUrl(prop) && typeof state[prop] == 'object') {
        var page = state[prop];
        var update_page_url = prop;
        var update_output_dir = page.output_dir;
        var done = page.done || false;
        var ignore = page.ignore || false;
        if ((options.force || !done) && !ignore 
          && typeof update_output_dir == 'string' && update_output_dir != '') {
          update_queue.push({
            page_url: update_page_url,
            output_dir: path.join(output_dir, update_output_dir)
          });
        }
      }
    }
    
    // console.log(update_queue);
    var total = update_queue.length;
    var current = 0;

    async.eachSeries(update_queue, function(update_item, cb) {
      var cb_called = false;
      var onChildSaverEnd = function(err) {
        if (!cb_called) {
          cb_called = true;
          cb(err);
        }
      }

      current++;
      console.log('[' + current + '/' + total + ']', 'Update from URL: ' + update_item.page_url);
      
      // saver for processing each item
      var child_saver = new Saver({
        output_dir: update_item.output_dir,
        state_file_name: state_file_name
      });
      // add handlers for new saver
      addHandlers(child_saver);

      child_saver.on('error', function(err) {
        console.log('Error:', err);
        // onChildSaverEnd(err);
      });

      child_saver.on('before_exit', function() {
        child_saver.updateStateData('last_update', new Date(), true);
      });

      child_saver.on('exit', function(err) {
        if (options.verbose) {
          console.log('Saver exited: ' + update_item.page_url);
        }
        // saver for processing parent state file
        var output_dir_name = path.basename(update_item.output_dir);
        var child_state_update = {
          output_dir: output_dir_name,
          done: true,
          last_update: new Date() 
        };
        if (err) {
          if (options.verbose) {
            console.log('Child saver exited with error');
            console.log(err);
          }
          child_state_update.done = false;
        }
        saver.updateStateData(update_item.page_url, child_state_update, true);
        onChildSaverEnd(err);
      });

      child_saver.start({
        page_url: update_item.page_url,
        output_dir: update_item.output_dir,
        update: true,
        auto_manga_dir: options.auto_manga_dir,
        verbose: options.verbose
      }, function(err) {
        if (err) {
          onChildSaverEnd(err);
        }
      });
    }, function(err) {
      saver.updateStateData('last_update', new Date(), true);
      saver.exit(err);
      callback(err);
    });
  }
}

exports.update = function(output_dir, options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  if (!utils.directoryExists(output_dir)) {
    return callback(new Error('Directory does not exist'));
  }

  if (!utils.fileExists(path.join(output_dir, state_file_name)) || options.recursive) {

    // scan for state files
    scanDirRecursive(output_dir, function(err, statefiles) {
      if (err) return callback(err);

      if (statefiles.length == 0) {
        console.log('No need to update. State files not found.');
        return callback();
      }

      var total = statefiles.length;
      var current = 0;

      async.eachSeries(statefiles, function(statefile, cb) {
        var output_dir = path.dirname(statefile);

        current++;
        console.log('');
        console.log('[' + current + '/' + total + ']', 'Update: ' + output_dir);

        updateDir(output_dir, options, function(err) {
          if (err) return cb(err);
          cb();
        });
      }, function(err) {
        if (err) return callback(err);
        callback();
      });
    });
  } else {
    updateDir(output_dir, options, function(err) {
      if (err) return callback(err);
      callback();
    });
  }
}

exports.listManga = function(output_dir, options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  if (!utils.directoryExists(output_dir)) {
    return callback(new Error('Directory does not exist'));
  }

  if (!utils.fileExists(path.join(output_dir, state_file_name)) || options.recursive) {
    // scan for state files
    scanDirRecursive(output_dir, function(err, statefiles) {
      if (err) return callback(err);

      if (statefiles.length == 0) {
        console.log('No need to update. State files not found.');
        return callback();
      }

      var total = statefiles.length;
      var current = 0;

      async.eachSeries(statefiles, function(statefile, cb) {
        var output_dir = path.dirname(statefile);

        current++;
        console.log('');
        console.log('[' + current + '/' + total + ']', 'Manga: ' + output_dir);

        if (!utils.fileExists(path.join(output_dir, state_file_name))) {
          console.log('State file not found in directory');
          return cb();
        }

        var saver = new Saver({
          output_dir: output_dir,
          state_file_name: state_file_name,
          save_state_on_exit: false
        });

        var url = saver.getStateData('url');
        if (url)
          console.log('URL:', url);
        else
          console.log('URL: n/a');
        var last_update = saver.getStateData('last_update');
        if (last_update)
          console.log('Last update:', moment(last_update).fromNow());
        // else
        //   console.log('Last update: n/a');

        saver.exit();

        cb();
      }, function(err) {
        if (err) return callback(err);
        callback();
      });
    });
  } else {

    if (!utils.fileExists(path.join(output_dir, state_file_name))) {
      console.log('State file not found in directory');
      return cb();
    }

    var saver = new Saver({
      output_dir: output_dir,
      state_file_name: state_file_name,
      save_state_on_exit: false
    });

    console.log('URL:', saver.getStateData('url'));
    console.log('Last update:', saver.getStateData('last_update'));
    console.log('');

    saver.exit();

    callback();
  }
}

exports.addManga = function(page_url, manga_dir, options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  utils.ensureDirectoryExists(manga_dir);

  var saver = new Saver({ 
    output_dir: manga_dir,
    state_file_name: state_file_name
  });
  var current_url = saver.getStateData('url');
  if (!options.force && current_url) {
    console.log('Warning: Manga URL already set. Append --force to override/overwrite this.');
    console.log('Current manga URL:', current_url);
    return callback();
  }

  saver.updateStateData('url', page_url, true);

  console.log('Manga URL set to:', page_url);
  console.log('Done.');

  callback();
}

exports.enableManga = function(manga_dir, options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }
  
  if (!utils.directoryExists(manga_dir)) {
    return callback(new Error('Directory does not exist'));
  }

  if (!utils.fileExists(path.join(manga_dir, state_file_name))) {
    return callback(new Error('State file not found in directory'));
  }

  var saver = new Saver({ 
    output_dir: manga_dir,
    state_file_name: state_file_name
  });
  saver.updateStateData('ignore', false, true);
  
  console.log('Manga enabled: ' + saver.getStateData('url'));
  console.log('Done.');

  callback();
}

exports.disableManga = function(manga_dir, options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }
  
  if (!utils.directoryExists(manga_dir)) {
    return callback(new Error('Directory does not exist'));
  }

  if (!utils.fileExists(path.join(manga_dir, state_file_name))) {
    return callback(new Error('State file not found in directory'));
  }

  var saver = new Saver({ 
    output_dir: manga_dir,
    state_file_name: state_file_name
  });
  saver.updateStateData('ignore', true, true);
  
  console.log('Manga disabled: ' + saver.getStateData('url'));
  console.log('Done.');
  
  callback();
}

var createArchive = function(output_dir, options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }
  
  // options.output_dir = output_dir;

  if (!utils.fileExists(path.join(output_dir, state_file_name))) {
    return callback(new Error('State file not found in directory: ' + output_dir));
  }

  var saver = new Saver({
    output_dir: output_dir,
    state_file_name: state_file_name,
    save_state_on_exit: false
  });

  var update_queue = [];

  var state = saver.getState();
  for (var prop in state) {
    if (/*utils.isHttpUrl(prop) && */typeof state[prop] == 'object') {
      var page = state[prop];
      if (page.done && page.output_dir && (page.chapter_images || page.images)) {
        var page_output_dir = path.resolve(output_dir, page.output_dir);
        
        if (utils.directoryExists(page_output_dir)) {
          var page_archive_file = page_output_dir + '.cbz';
          if (!utils.fileExists(page_archive_file)) {
            update_queue.push(page);
          } else {
            console.log('Existing:', page_archive_file);
            if (options.cleanup) {
              console.log('Directory removed:', page_output_dir);
              fse.removeSync(page_output_dir);
            }
          }
        }
      }
    }
  }

  // console.log(update_queue);
  var total = update_queue.length;
  var current = 0;

  async.eachSeries(update_queue, function(update_item, cb) {

    var input_dir = path.resolve(output_dir, update_item.output_dir);
    var archive_file = input_dir + '.cbz';

    current++;
    console.log('[' + current + '/' + total + ']', 'Creating archive: ' + archive_file);
    
    if (utils.fileExists(archive_file)) {
      console.log('File exists:', archive_file);
      if (options.cleanup) {
        console.log('Directory removed:', input_dir);
        fse.removeSync(input_dir);
      }
      return cb();
    }

    saver.createComicFile(input_dir, update_item.chapter_images || update_item.images, function(err) {
      if (err) return cb(err);
      if (options.cleanup) {
        console.log('Directory removed:', input_dir);
        fse.removeSync(input_dir);
      }
      cb();
    });

  }, function(err) {
    if (err) return callback(err);
    callback();
  });
}

exports.createArchive = function(output_dir, options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  if (!utils.directoryExists(output_dir)) {
    return callback(new Error('Directory does not exist'));
  }

  console.log('Creating archives...');

  if (options.recursive) {
    // scan for state files
    scanDirRecursive(output_dir, function(err, statefiles) {
      if (err) return callback(err);

      if (statefiles.length == 0) {
        console.log('No need to update. State files not found.');
        return callback();
      }

      var total = statefiles.length;
      var current = 0;

      async.eachSeries(statefiles, function(statefile, cb) {
        var output_dir = path.dirname(statefile);

        current++;
        console.log('');
        console.log('[' + current + '/' + total + ']', 'Update: ' + output_dir);

        createArchive(output_dir, options, function(err) {
          if (err) return cb(err);
          cb();
        });
      }, function(err) {
        if (err) return callback(err);
        callback();
      });
    });
  } else {
    createArchive(output_dir, options, function(err) {
      if (err) return callback(err);
      callback();
    });
  }
}

var cleanupDir = function(output_dir, options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }
  
  // options.output_dir = output_dir;

  if (!utils.fileExists(path.join(output_dir, state_file_name))) {
    return callback(new Error('State file not found in directory: ' + output_dir));
  }

  var saver = new Saver({
    output_dir: output_dir,
    state_file_name: state_file_name,
    save_state_on_exit: false
  });

  var update_queue = [];

  var state = saver.getState();
  for (var prop in state) {
    if (utils.isHttpUrl(prop) && typeof state[prop] == 'object') {
      var page = state[prop];
      if (page.done && page.output_dir && page.chapter_images) {
        var page_output_dir = path.resolve(output_dir, page.output_dir);
        
        var page_archive_file = page_output_dir + '.cbz';
        if (options.remove_dir && utils.directoryExists(page_output_dir)) {
          update_queue.push(page);
        } else if (options.remove_cbz && utils.fileExists(page_archive_file)) {
          update_queue.push(page);
        }
      }
    }
  }

  // console.log(update_queue);
  var total = update_queue.length;
  var current = 0;

  async.eachSeries(update_queue, function(update_item, cb) {

    var manga_dir = path.resolve(output_dir, update_item.output_dir);
    var archive_file = manga_dir + '.cbz';

    current++;
    console.log('[' + current + '/' + total + ']', 'Cleanup: ' + manga_dir);
    
    if (options.remove_cbz && utils.fileExists(archive_file)) {
      console.log('File removed:', archive_file);
      fse.removeSync(archive_file);
    }
    if (options.remove_dir && utils.directoryExists(manga_dir)) {
      console.log('Directory removed:', manga_dir);
      fse.removeSync(manga_dir);
    }

    cb();
  }, function(err) {
    if (err) return callback(err);
    callback();
  });
}

exports.cleanup = function(output_dir, options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  if (!utils.directoryExists(output_dir)) {
    return callback(new Error('Directory does not exist'));
  }

  console.log('Cleaning up...');

  if (options.recursive) {
    // scan for state files
    scanDirRecursive(output_dir, function(err, statefiles) {
      if (err) return callback(err);

      if (statefiles.length == 0) {
        console.log('No need to update. State files not found.');
        return callback();
      }

      var total = statefiles.length;
      var current = 0;

      async.eachSeries(statefiles, function(statefile, cb) {
        var output_dir = path.dirname(statefile);

        current++;
        console.log('');
        console.log('[' + current + '/' + total + ']', 'Update: ' + output_dir);

        cleanupDir(output_dir, options, function(err) {
          if (err) return cb(err);
          cb();
        });
      }, function(err) {
        if (err) return callback(err);
        callback();
      });
    });
  } else {
    cleanupDir(output_dir, options, function(err) {
      if (err) return callback(err);
      callback();
    });
  }
}

exports.addLink = function(manga_dir, page_url, options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  if (!utils.directoryExists(manga_dir)) {
    return callback(new Error('Directory does not exist'));
  }

  if (!utils.fileExists(path.join(manga_dir, state_file_name))) {
    return callback(new Error('State file not found in directory'));
  }

  var saver = new Saver({ 
    output_dir: manga_dir,
    state_file_name: state_file_name
  });
  var current_state = saver.getStateData(page_url);
  if (!options.force && current_state) {
    console.log('Warning: Link already exists. Append --force to override/overwrite this.');
    console.log(current_state);
    return callback();
  }

  if (options.output_dir) {
    saver.updateStateData(page_url, {
      output_dir: options.output_dir,
      done: false,
      last_update: new Date()
    }, true);
  } else {
    saver.updateStateData(page_url, {
      done: false,
      last_update: new Date()
    }, true);
  }

  console.log('Link added:', page_url);
  console.log('Done.');

  callback();
}

exports.removeLink = function(manga_dir, page_url, options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  if (!utils.directoryExists(manga_dir)) {
    return callback(new Error('Directory does not exist'));
  }

  if (!utils.fileExists(path.join(manga_dir, state_file_name))) {
    return callback(new Error('State file not found in directory'));
  }

  var saver = new Saver({ 
    output_dir: manga_dir,
    state_file_name: state_file_name
  });
  var current_state = saver.getStateData(page_url);
  if (!current_state) {
    console.log('Warning: Link does not exist.');
    return callback();
  }

  saver.deleteStateData(page_url, true);

  console.log('Link removed:', page_url);
  console.log('Done.');

  callback();
}

exports.updateLink = function(manga_dir, page_url, update_data, options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  if (!utils.directoryExists(manga_dir)) {
    return callback(new Error('Directory does not exist'));
  }

  if (!utils.fileExists(path.join(manga_dir, state_file_name))) {
    return callback(new Error('State file not found in directory'));
  }

  var saver = new Saver({ 
    output_dir: manga_dir,
    state_file_name: state_file_name
  });
  var current_state = saver.getStateData(page_url);
  if (!current_state) {
    console.log('Warning: Link does not exist.');
    return callback();
  }

  saver.updateStateData(page_url, update_data, true);

  console.log('Link updated:', page_url);
  console.log('Done.');

  callback();
}
