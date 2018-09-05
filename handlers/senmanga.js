var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'SenManga',
  website: 'https://raw.senmanga.com',

  match: function(link, options) {
    return /raw\.senmanga\.com\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'SenManga');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if ($('#reader').length && $('.pager').length) {

      var chapter_title = $('.pager select[name="chapter"] option[selected="selected"]').text().trim();
      chapter_title = "Chapter " + chapter_title;

      var chapter_url = $('.location .walk').find('a').eq(3).attr('href');

      var page_links = [];
      $('.pager select[name="page"]').first().children().each(function() {
        var title = $(this).text();
        page_links.push(chapter_url + '/' + $(this).attr('value'));
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

      // console.log(options.chapter_pages);

      if (typeof options.chapter_pages != 'undefined' 
        && typeof options.chapter_pages[page.url] != 'undefined') {
        options.chapter_pages[page.url].visited = true;
      } else if (typeof options.chapter_pages != 'undefined') {
        options.chapter_pages[page.url] = {
          visited: true,
          images: []
        };
        // console.log('Wrong state! This page not included in chapter links');
        // return callback();
      }

      // Get images on current page
      // var images = saver.getImages($, page, '#mainImg');
      var images = []; 
      page_image = {
        src: $('img#picture').attr('src').split('?')[0],
        alt: $('img#picture').attr('alt')
      };
      if (page_image.src.indexOf('//') == 0) {
        page_image.src = 'http:' + page_image.src;
      }
      images.push(page_image);
      if (options.debug) console.log(images);

      saver.updateStateData(page.url, {
        images: images
      });

      if (typeof options.chapter_pages != 'undefined' 
        && typeof options.chapter_pages[page.url] != 'undefined'
        && images.length > 0) {

        // console.log(images);

        // Save to options
        options.chapter_pages[page.url].images = options.chapter_pages[page.url].images.concat(images);
      }

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

        console.log('Chapter URL:', chapter_url);

        var output_dir_name = chapter_title;
        var output_dir = path.join(options.output_dir, output_dir_name);
        
        if (options.debug) {
        console.log('Options output dir : ' + options.output_dir);
        console.log('Page output dir    : ' + page.output_dir);
        console.log('Output dir         : ' + output_dir);
        }

        options.request_headers = {
          "Referer": page.url,
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.1.1 Safari/605.1.15"
        };

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
    } else if ($('#content .comic').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('#content .comic h1.title').eq(0).text().trim();
      console.log('Manga title: ' + manga_title);
      if (options.debug) console.log('Chapter list');

      if (options.auto_manga_dir) {
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);
      if (options.save_index_html) {
        saver.saveHtmlSync(path.join(options.output_dir, 'index.html'), $.html());
      }
      var manga_info = this.getMangaInfo($, page, options);
      if (manga_info && manga_info.url) {
        saver.saveJsonSync(path.join(options.output_dir, 'manga.json'), manga_info);
      }

      var chapter_links = []; // saver.getLinks($, page, '');
      $('#content .list .group .element .title a').each(function() {
        chapter_links.push($(this).attr('href'));
      });

      chapter_links = chapter_links.filter(function(chapter_link) {
        return !saver.isVisited(chapter_link);
      });
      chapter_links = chapter_links.filter(function(chapter_link) {
        return !saver.isDone(chapter_link.replace('https:','http:'));
      });

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  },

  getMangaInfo: function($, page, options) {
    var manga_info = {};
    if ($('#content .comic').length) {
      manga_info.url = page.url;
      manga_info.name = $('#content .comic h1.title').eq(0).text().trim();
      manga_info.cover_image = $('#content .comic .thumbnail img').first().attr('src');

      $('#content .comic .info ul.series-info li').each(function() {
        var $info_key = $(this).children('b').eq(0);
        var info_key = $info_key.text().trim();
        $info_key.remove();

        if (info_key == 'Alternate Names') {
          var alt_names = [];
          $(this).find('a').each(function() {
            var alt_name = $(this).text();
            if (alt_name) {
              alt_name = alt_name.trim();
              alt_names.push(alt_name);
            }
          });
          if (alt_names.length) manga_info.alt_names = alt_names;
        } else if (info_key == 'Status') {
          manga_info.status = $(this).text().replace(':','').trim();
        } else if (info_key == 'Type') {
          manga_info.type = $(this).text().replace(':','').trim();
        } else if (info_key == 'Published:') {
          manga_info.published = $(this).text().trim();
        } else if (info_key == 'Rank') {
          manga_info.rank = $(this).text().replace(':','').trim();
        } else if (info_key == 'Total Views') {
          manga_info.views = $(this).text().replace(':','').trim();
        } else if (info_key == 'Categories') {
          var genres = [];
          $(this).find('a').each(function() {
            var genre = $(this).text();
            if (genre) {
              genre = genre.trim();
              genres.push(genre);
            }
          });
          if (genres.length) manga_info.genres = genres;
        } else if (info_key == 'Summary') {
          manga_info.description = $(this).find('span').text().trim();
        } 
      });
      
      var manga_chapters = [];
      $('#content .list .group .element .title a').each(function() {
        var chapter_url = $(this).attr('href');
        if (!chapter_url || chapter_url == '') return;
        
        manga_chapters.push({
          url: chapter_url,
          title: $(this).text().trim(),
          published_date_str: $(this).parent().parent().children('div.meta_r').text().trim()
        });
      });

      manga_info.chapter_count = manga_chapters.length;
          
      if (options.include_chapters || options.with_chapters) {
        manga_info.chapters = manga_chapters;
      }

      if (options.verbose) {
        console.log('Manga:');
        console.log('    Name: ' + manga_info.name);
        console.log('    Cover image: ' + manga_info.cover_image);
        // console.log('    Description: ' + manga_info.description);
        console.log('    Authors: ' + manga_info.authors);
        console.log('    Genres: ' + manga_info.genres);
        console.log('    Status: ' + manga_info.status);
        console.log('    Chapter count: ' + manga_info.chapter_count);
      }
    }
    return manga_info;
  }
}