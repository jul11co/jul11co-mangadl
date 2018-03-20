var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'MangaHere',
  website: 'http://www.mangahere.cc',

  match: function(link, options) {
    return /www\.mangahere\.cc\/manga\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'MangaHere');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('#viewer').length) {

      var link_obj = urlutil.parse(page.url);
      var chapter_url = page.url;
      if (page.url.indexOf('.html') > 0) {
        chapter_url = page.url.replace(path.basename(link_obj.pathname),'');  
      }
      // console.log('Manga chapter page: ' + chapter_url);

      var links = [];
      if ($('.go_page .prew_page').length) {
        var prev_page = $('.go_page .prew_page').attr('href');
        if (prev_page.indexOf(chapter_url) >= 0) {
          // previous page in same chapter
          links.push(prev_page);  
        }
      }
      if ($('.go_page .next_page').length) {
        var next_page = $('.go_page .next_page').attr('href');
        if (next_page.indexOf(chapter_url) >= 0) {
          // next page in same chapter
          links.push(next_page); 
        }
      }

      links.push(page.url);
      
      if (typeof options.chapter_pages == 'undefined') {
        // It's is a page of a manga chapter
        // Init data holder for chapter pages in options (passed through all callback)
        options.chapter_pages = {};
      }

      for (var i = 0; i < links.length; i++) {
        var chapter_page_link = links[i];
        if (typeof options.chapter_pages[chapter_page_link] == 'undefined') {
          // console.log('Add chapter page link: ' + chapter_page_link);
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
      var images = saver.getImages($, page, '#viewer', { blacklist: [ '.gif' ]});
      // if (options.verbose) console.log(images);

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
        // if (options.verbose) {
        // console.log('All chapter pages were visited. It\'s time to download');
        // }
        
        // It's time to download images
        var chapter_images = [];
        for (var prop in options.chapter_pages) {
          var chapter_page = options.chapter_pages[prop];
          chapter_images = chapter_images.concat(chapter_page.images);
        }
        if (options.verbose) console.log(chapter_images);

        // Reset chapter_pages
        options.chapter_pages = {};

        // http://www.mangahere.co/manga/<MANGANAME>/[<VOLUME>/]<CHAPTER>
        var chapter_path = chapter_url.replace('http://www.mangahere.cc/manga/','');
        // <MANGANAME>/[<VOLUME>/]<CHAPTER>
        chapter_path = chapter_path.substring(chapter_path.indexOf('/')); // skip MANGANAME
        // [<VOLUME>/]<CHAPTER>
        var output_dir = path.join((options.output_dir || '.'), chapter_path);

        // var link_obj = urlutil.parse(chapter_url);
        // var output_dir_name = path.basename(link_obj.pathname);
        // var output_dir = path.join((options.output_dir || '.'), output_dir_name);
        
        if (options.verbose) {
        console.log('Options output dir : ' + options.output_dir);
        console.log('Page output dir    : ' + page.output_dir);
        console.log('Output dir         : ' + output_dir);
        }
        // var output_dir = page.output_dir;

        var chapter_title = $('.readpage_top .title h1').text().trim();

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
    } else if ($('.manga_detail').length) {
      console.log('Chapter list');

      if (options.auto_manga_dir) {
        var manga_title = page.title.split(' - Read ')[0].trim();
        console.log('Manga title: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);

      var chapter_links = saver.getLinks($, page, '.detail_list', { 
        filters: ['http://www.mangahere.cc/manga/'] 
      });
      if (options.verbose) console.log(chapter_links);

      console.log(chapter_links.length + ' chapters');
      var new_chapters = chapter_links.filter(function(link) {
        return !saver.isDone(link);
      });
      console.log(new_chapters.length + ' new chapters');

      saver.processPages(new_chapters, options, function(err) {
        if (err) {
          if (err.httpStatusCode == 502) {
            return setTimeout(function() {
              options.chapter_pages = {};
              var retry_chapters = new_chapters.filter(function(link) {
                return !saver.isDone(link);
              });
              saver.processPages(retry_chapters, options, callback);
            }, 5000);
          }
          return callback(err);
        }
        callback();
      });
    } else {
      callback();
    }
  }
}