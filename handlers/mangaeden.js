var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'MangaEden',
  website: 'http://www.mangaeden.com',

  match: function(link, options) {
    return /www\.mangaeden\.com\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'MangaEden');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if ($('#mainImg').length && $('#pageSelect').length) {

      var page_links = [];
      $('#pageSelect').first().children().each(function() {
        var title = $(this).text();
        page_links.push('http://www.mangaeden.com' + $(this).attr('value'));
      });

      if (typeof options.chapter_pages == 'undefined') {
        // Init data holder for chapter pages in options (passed through all callback)
        options.chapter_pages = {};
      }

      for (var i = 0; i < page_links.length; i++) {
        var chapter_page_link = page_links[i];
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
      // var images = saver.getImages($, page, '#mainImg');
      var images = []; 
      page_image = {
        src: $('img#mainImg').attr('src'),
        alt: $('img#mainImg').attr('alt')
      };
      if (page_image.src.indexOf('//') == 0) {
        page_image.src = 'http:' + page_image.src;
      }
      images.push(page_image);
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
        // http://www.mangaeden.com/en/en-manga/push-man/4/1/
        // --> /en/en-manga/push-man/4/1/
        // --> /en/en-manga/push-man/4/
        var chapter_url = link_obj.protocol + '//' + link_obj.hostname + path.dirname(link_obj.pathname);
        console.log('Chapter URL:', chapter_url);

        var output_dir_name = path.basename(path.dirname(link_obj.pathname));
        var output_dir = path.join(options.output_dir, output_dir_name);
        
        if (options.debug) {
        console.log('Options output dir : ' + options.output_dir);
        console.log('Page output dir    : ' + page.output_dir);
        console.log('Output dir         : ' + output_dir);
        }

        var chapter_title = $('#combobox option[selected="selected"]').first().text().trim();
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
    } else if ($('#mangaPage').length && $('.chapterLink').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('span.manga-title').eq(0).text().trim();
      console.log('Manga output: ' + manga_title);
      console.log('Chapter list');

      if (options.auto_manga_dir) {
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);

      var chapter_links = []; // saver.getLinks($, page, '');
      $('a.chapterLink').each(function() {
        chapter_links.push($(this).attr('href'));
      });

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  }
}