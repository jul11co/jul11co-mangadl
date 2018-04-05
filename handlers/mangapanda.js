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
        links.push('http://www.mangapanda.com' + $(this).attr('value'));
      });

      if (typeof options.chapter_pages == 'undefined') {
        // Init data holder for chapter pages in options (passed through all callback)
        options.chapter_pages = {};
      }

      for (var i = 0; i < links.length; i++) {
        var chapter_page_link = links[i];
        if (typeof options.chapter_pages[chapter_page_link] == 'undefined') {
          // options.chapter_pages[chapter_page_link] = {
          //   visited: false,
          //   images: []
          // };
          var chapter_page_cache = saver.getStateData(chapter_page_link);
          if (chapter_page_cache && chapter_page_cache.visited && chapter_page_cache.images) {
            options.chapter_pages[chapter_page_link] = {
              visited: true,
              images: chapter_page_cache.images
            };
          } else {
            options.chapter_pages[chapter_page_link] = {
              visited: false,
              images: []
            };
          }
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
      if (options.debug) console.log(images);

      saver.updateStateData(page.url, {
        images: images
      });

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
        var chapter_images = [];
        for (var prop in options.chapter_pages) {
          // var chapter_page = options.chapter_pages[prop];
          var chapter_page = saver.getStateData(prop);
          chapter_images = chapter_images.concat(chapter_page.images);
        }
        if (options.debug) console.log(chapter_images);

        // Reset chapter pages
        options.chapter_pages = {};

        var link_obj = urlutil.parse(page.url);
        // http://www.mangapanda.com/bleach/1/3
        // --> /bleach/1/3
        // --> /bleach/1
        var chapter_url = path.dirname(link_obj.pathname);

        var output_dir_name = path.basename(path.dirname(link_obj.pathname));
        var output_dir = path.join((options.output_dir || '.'), output_dir_name);
        
        if (options.debug) {
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
        }, options, callback);

      } else {

        // Get next unprocessed page in options.chapter_pages
        var next_page = '';
        for (var prop in options.chapter_pages) {
          if (options.chapter_pages[prop].visited == false) {
            next_page = prop;
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
        saver.processPage(next_page, options, callback);
      }
    } else if ($('#chapterlist').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('#mangaproperties h2.aname').first().text().trim();
      console.log('Manga output: ' + manga_title);
      console.log('Chapter list');

      if (options.auto_manga_dir) {
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);

      var chapter_links = saver.getLinks($, page, '#chapterlist');

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  }
}