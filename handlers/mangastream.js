var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'MangaStream',
  website: 'https://mangastream.com',

  match: function(link, options) {
    return (/mangastream\.com\/manga\//g.test(link)
      || /mangastream\.com\/r\//g.test(link)
      || /readms\.net\/manga\//g.test(link)
      || /readms\.net\/r\//g.test(link));
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'MangaStream');
      saver.setMangaOutputDir(options.output_dir);
    }

    if (page.url.indexOf('readms.net/r/') >= 0
      && $('#reader-nav').length) {

      // Get images on current page
      var images = []; // saver.getImages($, page, '#manga-page');
      if ($('#manga-page').length) {
        var image_src = $('#manga-page').attr('src');
        if (image_src.indexOf('//') == 0) image_src = 'http:' + image_src;
        images.push({
          src: image_src
        });
      }
      if (options.verbose) console.log(images);
      saver.updateStateData(page.url, {images: images});

      var links = saver.getLinks($, page, '.btn-reader-page .dropdown-menu', {
        filters: [
          'readms.net/r/',
          'mangastream.com/r/'
        ]
      });
      // console.log(links);

      // if ($('ul.pager li.next a').length) {
      //   var next_page_url = $('ul.pager li.next a').attr('href');
      // }

      if (typeof options.chapter_pages == 'undefined') {
        // It's a page of a manga chapter
        // Init data holder for chapter pages in options (passed through all callback)
        options.chapter_pages = {};
      }

      for (var i = 0; i < links.length; i++) {
        var chapter_page_link = links[i];
        if (typeof options.chapter_pages[chapter_page_link] == 'undefined') {
          var chapter_page = saver.getStateData(chapter_page_link);
          if (chapter_page && chapter_page.visisted && chapter_page.images) {
            options.chapter_pages[chapter_page_link] = {
              visited: true,
              // images: []
            };
          } else {
            options.chapter_pages[chapter_page_link] = {
              visited: false,
              // images: []
            };
          }
        }
      }

      options.chapter_pages[page.url] = { visited: true };

      // Check if all chapter pages are visited
      var all_chapter_pages_visited = true;
      for (var chapter_page_url in options.chapter_pages) {
        if (options.chapter_pages[chapter_page_url].visited == false) {
          all_chapter_pages_visited = false;
          break;
        }
      }

      if (all_chapter_pages_visited) {
        // console.log('All chapter pages were visited. It\'s time to download');

        var chapter_images = [];
        for (var chapter_page_url in options.chapter_pages) {
          // var chapter_page = options.chapter_pages[chapter_page_url];
          var chapter_page = saver.getStateData(chapter_page_url);
          chapter_images = chapter_images.concat(chapter_page.images);
        }

        var chapter_image_urls = [];
        chapter_images = chapter_images.filter(function(chapter_image) {
          if (chapter_image_urls.indexOf(chapter_image.src) == -1) {
            chapter_image_urls.push(chapter_image.src);
            return true;
          }
          return false;
        });
        // if (options.verbose) console.log(chapter_images);

        // Reset chapter pages
        options.chapter_pages = {};

        var link_obj = urlutil.parse(page.url);
        // http://readms.net/r/jagaaaaaan/09/4168/2
        // --> /jagaaaaaan/09/4168/2
        // --> /jagaaaaaan/09/4168/
        var chapter_url = 'https://readms.net' + path.dirname(link_obj.pathname);
        // --> 09
        var output_dir_name = path.basename(path.dirname(path.dirname(link_obj.pathname)));
        var chapter_output_dir = path.join((options.output_dir || '.'), output_dir_name);
        
        if (options.verbose) {
        console.log('Options output dir : ' + options.output_dir);
        console.log('Page output dir    : ' + page.output_dir);
        console.log('Chapter output dir         : ' + chapter_output_dir);
        }

        var chapter_title = $('.btn-reader-chapter a').first().text().trim();
        chapter_title = utils.replaceAll(chapter_title, '\r\n', '').trim();

        saver.downloadMangaChapter({
          chapter_url: chapter_url,
          chapter_title: chapter_title,
          chapter_images: chapter_images,
          output_dir: chapter_output_dir
        }, options, function(err) {
          if (err) return callback(err);
          callback();
        });

      } else {

        // Get next unprocessed page in options.chapter_pages
        var next_page_url = '';
        for (var chapter_page_url in options.chapter_pages) {
          if (options.chapter_pages[chapter_page_url].visited == false) {
            next_page_url = chapter_page_url;
            break;
          }
        }

        var all_chapter_pages_count = 0;
        var visited_chapter_pages_count = 0;
        for (var chapter_page_url in options.chapter_pages) {
          all_chapter_pages_count++;
          if (options.chapter_pages[chapter_page_url].visited) visited_chapter_pages_count++;
        }

        console.log('Chapter page:', (visited_chapter_pages_count+1) + '/' + all_chapter_pages_count, next_page_url);

        // Process next page
        saver.processPage(next_page_url, options, callback);
      }
    } else if (page.url.indexOf('mangastream.com/manga/') >= 0 || page.url.indexOf('readms.net/manga/') >= 0) {
      console.log('Chapter list');

      var manga_name = page.url;
      manga_name = manga_name.replace('http://','');
      manga_name = manga_name.replace('https://','');
      manga_name = manga_name.replace('mangastream.com/manga/','');
      manga_name = manga_name.replace('readms.net/manga/','');

      var manga_title = $('.content h1').first().text().trim();
      console.log('Manga: ' + manga_title);

      if (options.auto_manga_dir) {
        // var manga_output_dir = page.url.replace('http://www.mangareader.net/','');
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);

      var chapter_links = saver.getLinks($, page, 'table.table', {
        filters: [
          'readms.net/r/' + manga_name + '/',
          'mangastream.com/r/' + manga_name + '/' 
        ]
      });
      if (options.verbose) console.log(chapter_links);

      console.log(chapter_links.length + ' chapters');
      var new_chapters = chapter_links.filter(function(link) {
        return !saver.isVisited(link);
      });
      console.log(new_chapters.length + ' new chapters');
      saver.processPages(new_chapters, options, callback);
    } else {
      callback();
    }
  }
}