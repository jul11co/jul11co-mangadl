var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'MangaReader',
  website: 'http://www.mangareader.net',

  match: function(link, options) {
    return /www\.mangareader\.net\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'MangaReader');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('#topchapter').length) {

      var links = [];
      $('#selectpage #pageMenu').first().children().each(function() {
        var title = $(this).text();
        // links.push('http://www.mangareader.net' + $(this).attr('value'));
        links.push('https://www.mangareader.net' + $(this).attr('value'));
      });
      if (options.verbose) console.log('Chapter pages: ' + links.length);
      if (options.verbose) console.log(links);

      if (typeof options.chapter_pages == 'undefined') {
        // It's is a page of a manga chapter
        // Init data holder for chapter pages in options (passed through all callback)
        options.chapter_pages = {};
      }

      for (var i = 0; i < links.length; i++) {
        var chapter_page_link = links[i];
        if (typeof options.chapter_pages[chapter_page_link] == 'undefined') {
          options.chapter_pages[chapter_page_link] = {
            visited: false,
            images: []
          };
        }
      }

      if (typeof options.chapter_pages != 'undefined' 
        && typeof options.chapter_pages[page.url] != 'undefined') {
        options.chapter_pages[page.url].visited = true;
      } else {
        console.log('Wrong state! This page not included in chapter links: ' + page.url);
        return callback();
      }

      // Get images on current page
      var images = saver.getImages($, page, '#imgholder');
      if (options.verbose) console.log(images);

      // Save to options
      options.chapter_pages[page.url].images = options.chapter_pages[page.url].images.concat(images);

      // Check if all chapter pages are visited
      var all_chapter_pages_visited = true;
      for (var chapter_page_link in options.chapter_pages) {
        if (options.chapter_pages[chapter_page_link].visited == false) {
          all_chapter_pages_visited = false;
          break;
        }
      }

      if (all_chapter_pages_visited) {
        // console.log('All chapter pages were visited. It\'s time to download');

        // It's time to download images
        var chapter_images = [];
        for (var chapter_page_link in options.chapter_pages) {
          var chapter_page = options.chapter_pages[chapter_page_link];
          chapter_images = chapter_images.concat(chapter_page.images);
        }
        // if (options.verbose) console.log(chapter_images);

        // Reset chapter pages
        options.chapter_pages = {};

        var link_obj = urlutil.parse(page.url);
        // http://www.mangareader.net/abandon-the-old-in-tokyo/1/30
        // --> /abandon-the-old-in-tokyo/1/30
        // --> /abandon-the-old-in-tokyo/1
        // var chapter_url = path.dirname(link_obj.pathname);
        var chapter_url = 'https://www.mangareader.net' + path.dirname(link_obj.pathname);

        var output_dir_name = path.basename(path.dirname(link_obj.pathname));
        var output_dir = path.join((options.output_dir || '.'), output_dir_name);
        
        if (options.verbose) {
        console.log('Options output dir : ' + options.output_dir);
        console.log('Page output dir    : ' + page.output_dir);
        console.log('Output dir         : ' + output_dir);
        }

        var chapter_title = $('#topchapter #mangainfo h1').first().text().trim();
        chapter_title = utils.replaceAll(chapter_title, '\r\n', '').trim();

        saver.downloadMangaChapter({
          chapter_url: chapter_url,
          chapter_title: chapter_title,
          chapter_images: chapter_images,
          output_dir: output_dir
        }, options, function(err) {
          if (err) return callback(err);
          callback();
        });

      } else {

        // Get next unprocessed page in options.chapter_pages
        var next_page = '';
        for (var chapter_page_link in options.chapter_pages) {
          if (options.chapter_pages[chapter_page_link].visited == false) {
            next_page = chapter_page_link;
            break;
          }
        }

        var all_chapter_pages_count = 0;
        var visited_chapter_pages_count = 0;
        for (var chapter_page_link in options.chapter_pages) {
          all_chapter_pages_count++;
          if (options.chapter_pages[chapter_page_link].visited) visited_chapter_pages_count++;
        }

        console.log('Chapter page:', (visited_chapter_pages_count+1) + '/' + all_chapter_pages_count, next_page);

        // Process next page
        saver.processPage(next_page, options, function(err) {
          if (err) {
            return callback(err);
          }
          callback();
        });
      }
    } else if ($('#chapterlist').length) {
      console.log('Chapter list');

      if (options.auto_manga_dir) {
        // var manga_output_dir = page.url.replace('http://www.mangareader.net/','');
        var manga_output_dir = page.title.split('-')[0].trim();
        console.log('Manga output: ' + manga_output_dir);
        options.output_dir = path.join(options.output_dir, manga_output_dir);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);

      var chapter_links = saver.getLinks($, page, '#chapterlist');
      chapter_links = chapter_links.map(function(chapter_link) {
        if (chapter_link.indexOf('/') == 0) {
          // return 'http://www.mangareader.net' + chapter_link;
          return 'https://www.mangareader.net' + chapter_link;
        }
        return chapter_link;
      });
      if (options.debug) console.log(chapter_links);

      console.log(chapter_links.length + ' chapters');
      var new_chapters = chapter_links.filter(function(link) {
        return !saver.isDone(link) && !saver.isDone(link.replace('https://', 'http://'))
           && !saver.isDone(link.replace('https://www.mangareader.net', ''));
      });
      console.log(new_chapters.length + ' new chapters');

      if (new_chapters.length == 0) return callback();
      if (options.verbose) console.log(new_chapters);

      saver.processPages(new_chapters, options, function(err) {
        if (err) return callback(err);
        callback();
      });
    } else {
      callback();
    }
  }
}