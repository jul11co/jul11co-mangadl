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

    if (page.url.indexOf('readms.net/r/') >= 0 && $('#reader-nav').length) {

      var chapter_title = $('.btn-reader-chapter .dropdown-menu li a').text().trim();

      var links = [];
      // links = saver.getLinks($, page, '.btn-reader-page .dropdown-menu', {
      //   filters: [
      //     'readms.net/r/',
      //     'mangastream.com/r/'
      //   ]
      // });
      var first_page_url = $('.btn-reader-page .dropdown-menu li a').first().attr('href');
      var last_page_url = $('.btn-reader-page .dropdown-menu li a').last().attr('href');

      var getPageNum = function(chapter_page_url) {
        var chapter_page_url_obj = urlutil.parse(chapter_page_url);
        return parseInt(path.basename(chapter_page_url_obj.pathname));
      }
      var first_page_num = getPageNum(first_page_url);
      var last_page_num = getPageNum(last_page_url);

      var chapter_base_url = 'https://readms.net' + path.dirname(urlutil.parse(first_page_url).pathname);
      for (var i = first_page_num; i <= last_page_num; i++) {
        links.push(chapter_base_url + '/' + i);
      }

      if (typeof options.chapter_pages == 'undefined') {
        // Init data holder for chapter pages in options (passed through all callback)
        options.chapter_pages = [];
      }

      for (var i = 0; i < links.length; i++) {
        var chapter_page_link = links[i];
        if (options.chapter_pages.indexOf(chapter_page_link) == -1) {
          options.chapter_pages.push(chapter_page_link);
        }
      }

      // Get images on current page
      // var images = saver.getImages($, page, '#manga-page');
      var images = []; 
      if ($('#manga-page').length) {
        var image_src = $('#manga-page').attr('src');
        if (image_src.indexOf('//') == 0) image_src = 'http:' + image_src;
        images.push({
          src: image_src
        });
      }
      if (options.debug) console.log(images);

      saver.updateStateData(page.url, {
        images: images
      });

      // Check if all chapter pages are visited
      var all_chapter_pages_visited = true;
      for (var i = 0; i < options.chapter_pages.length; i++) {
        var chapter_page_url = options.chapter_pages[i];
        if (!saver.isVisited(chapter_page_url)) {
          all_chapter_pages_visited = false;
          break;
        }
      }

      if (all_chapter_pages_visited) {
        var chapter_images = [];
        for (var i = 0; i < options.chapter_pages.length; i++) {
          var chapter_page_url = options.chapter_pages[i];
          var chapter_page = saver.getStateData(chapter_page_url);
          chapter_images = chapter_images.concat(chapter_page.images||[]);
        }

        var chapter_image_urls = [];
        chapter_images = chapter_images.filter(function(chapter_image) {
          if (chapter_image_urls.indexOf(chapter_image.src) == -1) {
            chapter_image_urls.push(chapter_image.src);
            return true;
          }
          return false;
        });
        if (options.debug) console.log(chapter_images);

        // Reset chapter pages
        options.chapter_pages = [];

        var link_obj = urlutil.parse(page.url);
        // http://readms.net/r/jagaaaaaan/09/4168/2
        // --> /jagaaaaaan/09/4168/2
        // --> /jagaaaaaan/09/4168/
        var chapter_url = 'https://readms.net' + path.dirname(link_obj.pathname);
        // --> 09
        var output_dir_name = path.basename(path.dirname(path.dirname(link_obj.pathname)));
        var chapter_output_dir = path.join((options.output_dir || '.'), output_dir_name);
        
        if (options.debug) {
        console.log('Options output dir : ' + options.output_dir);
        console.log('Page output dir    : ' + page.output_dir);
        console.log('Chapter output dir : ' + chapter_output_dir);
        }

        var chapter_title = $('.btn-reader-chapter a').first().text().trim();
        chapter_title = utils.replaceAll(chapter_title, '\r\n', '').trim();

        saver.downloadMangaChapter({
          chapter_url: chapter_url,
          chapter_title: chapter_title,
          chapter_images: chapter_images,
          output_dir: chapter_output_dir
        }, options, callback);

      } else {

        // Get next unprocessed page in options.chapter_pages
        var next_page_url = '';
        for (var i = 0; i < options.chapter_pages.length; i++) {
          var chapter_page_url = options.chapter_pages[i];
          if (!saver.isVisited(chapter_page_url)) {
            next_page_url = chapter_page_url;
            break;
          }
        }

        var all_chapter_pages_count = options.chapter_pages.length;
        var visited_chapter_pages_count = 0;
        for (var i = 0; i < options.chapter_pages.length; i++) {
          var chapter_page_url = options.chapter_pages[i];
          if (saver.isVisited(chapter_page_url)) visited_chapter_pages_count++;
        }

        console.log('Chapter page:', (visited_chapter_pages_count+1) + '/' + all_chapter_pages_count, next_page_url);

        // Process next page
        saver.processPage(next_page_url, options, callback);
      }
    } else if (page.url.indexOf('mangastream.com/manga/') >= 0 
      || page.url.indexOf('readms.net/manga/') >= 0) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('.content h1').first().text().trim();
      console.log('Manga title: ' + manga_title);
      if (options.debug) console.log('Chapter list');

      if (options.auto_manga_dir) {
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);

      var manga_name = page.url;
      manga_name = manga_name.replace('http://','');
      manga_name = manga_name.replace('https://','');
      manga_name = manga_name.replace('mangastream.com/manga/','');
      manga_name = manga_name.replace('readms.net/manga/','');

      var chapter_links = saver.getLinks($, page, 'table.table', {
        filters: [
          'readms.net/r/' + manga_name + '/',
          'mangastream.com/r/' + manga_name + '/' 
        ]
      });

      chapter_links = chapter_links.filter(function(link) {
        return !saver.isVisited(link);
      });
      
      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  }
}