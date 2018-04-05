var path = require('path');
var urlutil = require('url');

module.exports = {
  
  name: 'MangaFox',
  website: 'http://fanfox.net',

  match: function(link, options) {
    return /mangafox\.me\/manga\//g.test(link) || /mangafox\.la\/manga\//g.test(link)
       || /fanfox\.net\/manga\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'MangaFox');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('#viewer').length) {

      var link_obj = urlutil.parse(page.url);
      var chapter_url = page.url;
      if (page.url.indexOf('.html') > 0) {
        chapter_url = page.url.replace(path.basename(link_obj.pathname),'');
      }

      var links = [];
      links.push(page.url);
      
      $('.r.m .l select').first().children().each(function() {
        var title = $(this).text();
        if (title.toLowerCase() != 'comments') {
          links.push(chapter_url + $(this).attr('value') + '.html');
        }
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
      var images = saver.getImages($, page, '#viewer');
      if (options.debug) console.log(images);

      saver.updateStateData(page.url, {
        images: images
      })

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

        // Reset chapter_pages
        options.chapter_pages = {};

        var chapter_url_obj = urlutil.parse(chapter_url);
        var output_dir_name = path.basename(chapter_url_obj.pathname);
        var output_dir = path.join(options.output_dir, output_dir_name);      

        var chapter_title = $('#series h1.no').text().trim();

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
    } else if ($('#chapters').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('#series_info .cover img').attr('alt').trim();
      console.log('Manga title: ' + manga_title);
      console.log('Chapter list');

      if (options.auto_manga_dir) {
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);

      var chapter_links = saver.getLinks($, page, '#chapters', { 
        filters: [
          'http://mangafox.me/manga/',
          'http://mangafox.la/manga/',
          'http://fanfox.net/manga/'
        ] 
      });

      for (var i = 0; i < chapter_links.length; i++) {
        var chapter_link = chapter_links[i];
        if (chapter_link.indexOf('.html') > 0) {
          var chapter_link_obj = urlutil.parse(chapter_link);
          chapter_links[i] = chapter_link.replace(path.basename(chapter_link_obj.pathname),'');
        }
      }

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  }
}