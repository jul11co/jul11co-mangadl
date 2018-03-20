var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'MangaTown',
  website: 'http://www.mangatown.com',

  match: function(link, options) {
    return /www\.mangatown\.com\/manga\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'MangaTown');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('#viewer').length) {

      var links = saver.getLinks($, page, '.page_select');
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

      // console.log('Page:', page.url);
      // console.log(options.chapter_pages);

      if (typeof options.chapter_pages != 'undefined' 
        && typeof options.chapter_pages[page.url] != 'undefined') {
        options.chapter_pages[page.url].visited = true;
      } else {
        // console.log('Wrong state! This page not included in chapter links');
        // return callback();
        options.chapter_pages[page.url] = {
          visited: true,
          images: []
        };
      }

      // Get images on current page
      var images = saver.getImages($, page, '#viewer');
      if (options.verbose) console.log(images);

      // Save to options
      options.chapter_pages[page.url].images = options.chapter_pages[page.url].images.concat(images);
      // console.log(options.chapter_pages);

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
        var chapter_url = page.url.replace(path.basename(link_obj.pathname),'');
        var output_dir_name = path.basename(path.dirname(link_obj.pathname));
        var output_dir = path.join((options.output_dir || '.'), output_dir_name);
        
        // console.log('Options output dir : ' + options.output_dir);
        // console.log('Page output dir    : ' + page.output_dir);
        // console.log('Output dir         : ' + output_dir);

        var chapter_title = $('.manga_read .title').text().trim();
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
    } else if ($('.chapter_list').length) {
      console.log('Chapter list');

      // if (options.group_by_site) {
      //   options.output_dir = path.join(options.output_dir, 'MangaTown');
      //   saver.setMangaOutputDir(options.output_dir);
      // }

      if (options.auto_manga_dir) {
        var manga_output_dir = $('.article_content h1.title-top').first().text().trim();
        console.log('Manga output: ' + manga_output_dir);
        options.output_dir = path.join(options.output_dir, manga_output_dir);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);

      var chapter_links = saver.getLinks($, page, '.chapter_list');
      if (options.verbose) console.log(chapter_links);

      page.chapter_links = chapter_links;

      console.log(chapter_links.length + ' chapters');
      saver.processPages(chapter_links, options, function(err) {
        if (err) return callback(err);
        callback();
      });
    } else {
      callback();
    }
  }
}