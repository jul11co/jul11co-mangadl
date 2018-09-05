#!/usr/bin/env node

var async = require('async');
var path = require('path');

var utils = require('jul11co-wdt').Utils;

var mangadownloader = require('./manga-downloader');

function printUsage() {
  console.log('Usage: mangadl <COMMAND> [OPTIONS...]');
  console.log('');
  console.log('  Download manga to local directory:');
  console.log('       mangadl [download] <page_url> [output_dir] [-GPAC] [--force] [--cbz] [--remove-dir]');
  console.log('');
  console.log('           --group-by-site,  -G    : group manga by site');
  console.log('           --progress,       -P    : show detailed progress');
  console.log('           --auto-manga-dir, -A    : create manga directory automatically');
  console.log('           --cbz,            -C    : create manga archive (CBZ)');
  console.log('           -GPAC                   : same as -G -P -A -C');
  console.log('           -GAC                    : same as -G -A -C');
  console.log('           --remove-dir            : remove chapter dir after download (only with --cbz)');
  console.log('');
  console.log('  Update local directory:');
  console.log('       mangadl update [output_dir] [--recursive] [--cbz] [--remove-dir]');
  console.log('');
  console.log('  List downloaded manga:');
  console.log('       mangadl list [output_dir]');
  console.log('');
  console.log('  Create comicbook archive (CBZ):');
  console.log('       mangadl archive [output_dir] [--recursive] [--remove-dir]');
  console.log('');
  console.log('  Cleanup manga:');
  console.log('       mangadl cleanup [output_dir] [--remove-cbz] [--remove-dir] [--remove-all] [--recursive]');
  console.log('');
  console.log('  Watch manga updates:');
  console.log('       mangadl watch [<output_dir> [refresh-minutes]]');
  console.log('');
  console.log('  Manga management:');
  console.log('       mangadl add <manga_dir> <page_url>');
  console.log('       mangadl enable <manga_dir>');
  console.log('       mangadl disable <manga_dir>');
  console.log('');
  console.log('  Manga links management (in existing manga directory):');
  console.log('       mangadl add-link <manga_dir> <page_url> [output_dir]');
  console.log('       mangadl remove-link <manga_dir> <page_url>');
  console.log('       mangadl enable-link <manga_dir> <page_url>');
  console.log('       mangadl disable-link <manga_dir> <page_url>');
  console.log('       mangadl mark-link-done <manga_dir> <page_url>');
  console.log('       mangadl mark-link-undone <manga_dir> <page_url>');
  console.log('');
  console.log('  List supported manga sites:');
  console.log('       mangadl help --supported-sites');
  console.log('');
}

process.on('SIGINT', function() {
  console.log("\nCaught interrupt signal");
  process.exit();
});

if (process.argv.length < 3) {
  printUsage();
  process.exit();
  return;
}

var command = process.argv[2];
var argv = [];
var options = {};
for (var i = 3; i < process.argv.length; i++) {
  if (process.argv[i] == '--recursive' || process.argv[i] == '-R') {
    options.recursive = true;
  } else if (process.argv[i] == '--cbz' || process.argv[i] == '-C') {
    options.cbz = true;
  } else if (process.argv[i] == '--group-by-site' || process.argv[i] == '-G') {
    options.group_by_site = true;
  } else if (process.argv[i] == '--auto-manga-dir' || process.argv[i] == '-A') {
    options.auto_manga_dir = true;
  } else if (process.argv[i] == '--progress' || process.argv[i] == '-P') {
    options.progress = true;
  } else if (process.argv[i] == '-GPAC') {
    options.group_by_site = true;
    options.auto_manga_dir = true;
    options.cbz = true;
    options.progress = true;
  } else if (process.argv[i] == '-GAC') {
    options.group_by_site = true;
    options.auto_manga_dir = true;
    options.cbz = true;
  } else if (process.argv[i].indexOf('--') == 0) {
    var arg = process.argv[i];
    if (arg.indexOf("=") > 0) {
      var arg_kv = arg.split('=');
      arg = arg_kv[0];
      arg = arg.replace('--','');
      arg = utils.replaceAll(arg, '-', '_');
      options[arg] = arg_kv[1];
    } else {
      arg = arg.replace('--','');
      arg = utils.replaceAll(arg, '-', '_');
      options[arg] = true;
    }
  } else {
    argv.push(process.argv[i]);
  }
}

// console.log('Command:', command, argv);

options.html_file_root = '.html';

if (options.state_file_name && options.state_file_name != '') {
  console.log('State file name:', options.state_file_name);
  mangadownloader.setStateFileName(options.state_file_name);
}

if (options.recursive && options.depth && typeof options.depth == 'string') {
  options.depth = parseInt(options.depth);
  if (isNaN(options.depth)) {
    console.log('Invalid depth:', options.depth);
    process.exit();
  }
}

mangadownloader.loadDefaultHandlers();

if ((command == 'help' || command == 'h')){
  if (options.supported_sites) {
    var handlers = mangadownloader.getHandlers();
    console.log('Here is list of supported sites (' + handlers.length + '):');
    for (var i = 0; i < handlers.length; i++) {
      if (handlers[i].website) {
        console.log(' ' + (i+1) + '. ' + handlers[i].name + ' - ' + handlers[i].website);
      } else {
        console.log(' ' + (i+1) + '. ' + handlers[i].name);
      }
    }
    console.log('');
  } else {
    printUsage();
  }
  process.exit();
}
else if ((command == 'download' || command == 'd') && argv.length >= 1){
  options.download = true;

  options.cbz = true;  // default
  if (options.no_cbz) options.cbz = false;

  var page_url = argv[0];
  options.page_url = page_url;
  console.log('Page URL: ' + page_url);

  var output_dir = argv[1];
  if (!output_dir) {
    output_dir = '.';
    options.auto_manga_dir = true;
  }
  options.output_dir = output_dir;
  console.log('Output directory: ' + options.output_dir);

  mangadownloader.download(page_url, output_dir, options, function(err) {
    if (err) {
      console.log(err);
      process.exit();
    }
  });
} else if (command == 'update' || command == 'u') {
  options.update = true;

  options.cbz = true;  // default
  if (options.no_cbz) options.cbz = false;

  var output_dir = argv[0] || '.';
  options.output_dir = output_dir;
  console.log('Output directory: ' + options.output_dir);

  mangadownloader.update(output_dir, options, function(err) {
    if (err) {
      console.log(err);
      process.exit();
    }
  });
} else if (command == 'create-archive' || command == 'archive' || command == 'a') {
  options.archive = true;

  var output_dir = argv[0] || '.';
  options.output_dir = output_dir;
  console.log('Output directory: ' + options.output_dir);

  mangadownloader.createArchive(output_dir, options, function(err) {
    if (err) {
      console.log(err);
      process.exit();
    } else {
      console.log('Done.');
    }
  });
} else if (command == 'cleanup') {
  options.cleanup = true;

  var output_dir = argv[0] || '.';
  options.output_dir = output_dir;
  console.log('Output directory: ' + options.output_dir);

  mangadownloader.cleanup(output_dir, options, function(err) {
    if (err) {
      console.log(err);
      process.exit();
    } else {
      console.log('Done.');
    }
  });
} else if (command == 'list') {
  options.list_manga = true;

  var output_dir = argv[0] || '.';
  options.output_dir = output_dir;
  console.log('Manga directory: ' + options.output_dir);

  mangadownloader.listManga(output_dir, options, function(err) {
    if (err) {
      console.log(err);
      process.exit();
    }
  });
} else if (command == 'watch') {
  options.watch = true;

  var output_dir = argv[0] || '.';
  options.output_dir = output_dir;
  console.log('Output directory: ' + options.output_dir);

  var refresh_interval = 30; // default: in minutes
  if (argv.length >= 2) {
    refresh_interval = parseInt(argv[1]);
  }
  console.log('Refresh interval:', refresh_interval);

  var updating = false;
  var updateManga = function() {
    if (updating) return;
    updating = true;
    mangadownloader.update(output_dir, options, function(err) {
      if (err) {
        console.log(err);
      }
      updating = false;
    });
  }

  setInterval(updateManga, refresh_interval*60*1000);
  updateManga();
} else if ((command == 'add-manga' || command == 'add')  && argv.length >= 2){
  options.add_manga = true;

  var manga_dir = argv[0];
  console.log('Manga directory: ' + manga_dir);

  var page_url = argv[1];
  console.log('Page URL: ' + page_url);

  mangadownloader.addManga(page_url, manga_dir, options, function(err) {
    if (err) {
      console.log(err);
      process.exit();
    }
  });
} else if ((command == 'enable-manga' || command == 'enable') && argv.length >= 1) {
  options.enable_manga = true;

  var manga_dir = argv[0];
  console.log('Manga directory: ' + manga_dir);

  mangadownloader.enableManga(manga_dir, options, function(err) {
    if (err) {
      console.log(err);
      process.exit();
    }
  });
} else if ((command == 'disable-manga' || command == 'disable') && argv.length >= 1) {
  options.disable_manga = true;

  var manga_dir = argv[0];
  console.log('Manga directory: ' + manga_dir);

  mangadownloader.disableManga(manga_dir, options, function(err) {
    if (err) {
      console.log(err);
      process.exit();
    }
  });
} else if ((command == 'add-link') && argv.length >= 2) {
  options.add_link = true;

  var manga_dir = argv[0];
  console.log('Manga directory: ' + manga_dir);

  var page_url = argv[1];
  console.log('Page URL: ' + page_url);

  options.output_dir = argv[2]; // content of page_url will be placed here (if set)

  mangadownloader.addLink(manga_dir, page_url, options, function(err) {
    if (err) {
      console.log(err);
      process.exit();
    }
  });
} else if ((command == 'remove-link') && argv.length >= 2) {
  options.remove_link = true;

  var manga_dir = argv[0];
  console.log('Manga directory: ' + manga_dir);

  var page_url = argv[1];
  console.log('Page URL: ' + page_url);

  mangadownloader.removeLink(manga_dir, page_url, options, function(err) {
    if (err) {
      console.log(err);
      process.exit();
    }
  });
} else if ((command == 'enable-link') && argv.length >= 2) {
  options.enable_link = true;

  var manga_dir = argv[0];
  console.log('Manga directory: ' + manga_dir);

  var page_url = argv[1];
  console.log('Page URL: ' + page_url);

  mangadownloader.updateLink(manga_dir, page_url, {ignore: false}, options, function(err) {
    if (err) {
      console.log(err);
      process.exit();
    }
  });
} else if ((command == 'disable-link') && argv.length >= 2) {
  options.disable_link = true;

  var manga_dir = argv[0];
  console.log('Manga directory: ' + manga_dir);

  var page_url = argv[1];
  console.log('Page URL: ' + page_url);

  mangadownloader.updateLink(manga_dir, page_url, {ignore: true}, options, function(err) {
    if (err) {
      console.log(err);
      process.exit();
    }
  });
} else if ((command == 'mark-link-done') && argv.length >= 2) {
  options.mark_link_done = true;

  var manga_dir = argv[0];
  console.log('Manga directory: ' + manga_dir);

  var page_url = argv[1];
  console.log('Page URL: ' + page_url);

  mangadownloader.updateLink(manga_dir, page_url, {done: true}, options, function(err) {
    if (err) {
      console.log(err);
      process.exit();
    }
  });
} else if ((command == 'mark-link-undone') && argv.length >= 2) {
  options.mark_link_undone = true;

  var manga_dir = argv[0];
  console.log('Manga directory: ' + manga_dir);

  var page_url = argv[1];
  console.log('Page URL: ' + page_url);

  mangadownloader.updateLink(manga_dir, page_url, {done: false}, options, function(err) {
    if (err) {
      console.log(err);
      process.exit();
    }
  });
} else if (/^((http|https):\/\/)/.test(command)) {
  options.download = true;

  options.cbz = true; // default
  if (options.no_cbz) options.cbz = false;

  var page_url = command;
  options.page_url = page_url;
  console.log('Page URL: ' + page_url);

  var output_dir = argv[0];
  if (!output_dir) {
    output_dir = '.';
    options.auto_manga_dir = true;
  }
  options.output_dir = output_dir;
  console.log('Output directory: ' + options.output_dir);

  mangadownloader.download(page_url, output_dir, options, function(err) {
    if (err) {
      console.log(err);
      process.exit();
    }
  });
} else {
  printUsage();
  process.exit();
}

