var path = require('path');
var urlutil = require('url');

module.exports = {
  
  name: 'MangaFox',
  website: 'http://mangafox.la',

  match: function(link, options) {
    return /mangafox\.me\/manga\//g.test(link) || /mangafox\.la\/manga\//g.test(link);
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

      // console.log(options.chapter_pages);

      if (typeof options.chapter_pages != 'undefined' 
        && typeof options.chapter_pages[page.url] != 'undefined') {
        options.chapter_pages[page.url].visited = true;
      } else {
        console.log('Wrong state! This page not included in chapter links');
        return callback();
      }

      // Get images on current page
      var images = saver.getImages($, page, '#viewer');
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

        // Reset chapter_pages
        options.chapter_pages = {};

        var chapter_url_obj = urlutil.parse(chapter_url);
        var output_dir_name = path.basename(chapter_url_obj.pathname);
        var output_dir = path.join((options.output_dir || '.'), output_dir_name);      

        var chapter_title = $('#series h1.no').text().trim();

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
    } else if ($('#chapters').length) {
      console.log('Chapter list');

      // if (options.group_by_site) {
      //   options.output_dir = path.join(options.output_dir, 'Mangafox');
      //   saver.setMangaOutputDir(options.output_dir);
      // }

      if (options.auto_manga_dir) {
        var manga_title = $('#series_info .cover img').attr('alt').trim();
        console.log('Manga title: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);

      var chapter_links = saver.getLinks($, page, '#chapters', { 
        filters: [
          'http://mangafox.me/manga/',
          'http://mangafox.la/manga/'
        ] 
      });
      for (var i = 0; i < chapter_links.length; i++) {
        var chapter_link = chapter_links[i];
        if (chapter_link.indexOf('.html') > 0) {
          var chapter_link_obj = urlutil.parse(chapter_link);
          chapter_links[i] = chapter_link.replace(path.basename(chapter_link_obj.pathname),'');
        }
      }
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