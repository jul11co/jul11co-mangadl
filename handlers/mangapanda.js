var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'MangaPanda',
  website: 'http://www.mangapanda.com',

  match: function(link, options) {
    return /www\.mangapanda\.com\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'MangaPanda');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('#topchapter').length) {

      var links = [];
      $('#selectpage #pageMenu').first().children().each(function() {
        var title = $(this).text();
        links.push('http://www.mangapanda.com' + $(this).attr('value'));
      });
      // console.log(links);

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
        console.log('Wrong state! This page not included in chapter links');
        return callback();
      }

      // Get images on current page
      var images = saver.getImages($, page, '#imgholder');
      if (options.verbose) console.log(images);

      // Save to options
      options.chapter_pages[page.url].images = options.chapter_pages[page.url].images.concat(images);

      // Check if all chapter pages are visited
      var all_chapter_pages_visited = true;
      for (var prop in options.chapter_pages) {
        if (options.chapter_pages[prop].visited == false) {
          all_chapter_pages_visited = false;
          break;
        }
      }

      if (all_chapter_pages_visited) {
        // console.log('All chapter pages were visited. It\'s time to download');

        // It's time to download images
        var chapter_images = [];
        for (var prop in options.chapter_pages) {
          var chapter_page = options.chapter_pages[prop];
          chapter_images = chapter_images.concat(chapter_page.images);
        }
        // if (options.verbose) console.log(chapter_images);

        // Reset chapter pages
        options.chapter_pages = {};

        var link_obj = urlutil.parse(page.url);
        // http://www.mangapanda.com/bleach/1/3
        // --> /bleach/1/3
        // --> /bleach/1
        var chapter_url = path.dirname(link_obj.pathname);

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
        for (var prop in options.chapter_pages) {
          if (options.chapter_pages[prop].visited == false) {
            next_page = prop;
            break;
          }
        }

        // Process next page
        saver.processPage(next_page, options, callback);
      }
    } else if ($('#chapterlist').length) {
      console.log('Chapter list');

      // if (options.group_by_site) {
      //   options.output_dir = path.join(options.output_dir, 'Mangapanda');
      //   saver.setMangaOutputDir(options.output_dir);
      // }

      if (options.auto_manga_dir) {
        var manga_title = $('#mangaproperties h2.aname').first().text().trim();
        console.log('Manga output: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);

      var chapter_links = saver.getLinks($, page, '#chapterlist');
      if (options.verbose) console.log(chapter_links);

      console.log(chapter_links.length + ' chapters');
      saver.processPages(chapter_links, options, callback);
    } else {
      callback();
    }
  }
}