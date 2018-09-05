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
        // console.log('Wrong state! This page not included in chapter links');
        // return callback();
        options.chapter_pages[page.url] = {
          visited: true,
          images: []
        };
      }

      // Get images on current page
      var images = saver.getImages($, page, '#viewer');
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
        var chapter_url = page.url.replace(path.basename(link_obj.pathname),'');
        var output_dir_name = path.basename(path.dirname(link_obj.pathname));
        var output_dir = path.join((options.output_dir || '.'), output_dir_name);
        
        var chapter_title = $('.manga_read .title').text().trim();
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
    } else if ($('.chapter_list').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('.article_content h1.title-top').first().text().trim();
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

      if (options.update_info_only) {
        return callback();
      }

      var chapter_links = saver.getLinks($, page, '.chapter_list');

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  },

  getMangaInfo: function($, page, options) {
    var manga_info = {};
    if ($('.chapter_content').length) {
      manga_info.url = page.url;
      manga_info.name = $('.article_content h1.title-top').eq(0).text().trim();
      manga_info.cover_image = $('.detail_info img').attr('src');
      manga_info.description = $('.manga .content .summary').text().trim();

      $('.detail_info li#rate').remove();
      $('.detail_info li span#show a').remove();
      $('.detail_info ul li').each(function() {
        if ($(this).children('b').length) {
          var info_key = $(this).children('b').eq(0).text().trim();
          info_key = info_key.replace(':','');
          if (info_key == '') {
            return;
          }

          var info_value = [];
          if (info_key == 'Summary') {
            info_value.push($(this).children('span').eq(1).text().trim());
          } else if (info_key == 'Status(s)') {
            var value = $(this).text().trim();
            value = value.replace('Status(s):','').trim();
            info_value.push(value);
          } else {
            $(this).children('b').remove();
            if ($(this).children().length) {
              $(this).children().each(function() {
                var value = $(this).text().trim();
                value = utils.replaceAll(value,'\n','');
                if (value != '') {
                  info_value.push(value);
                }
              });
            } else {
              var value = $(this).text().trim();
              info_value.push(value);
            }
          }

          if (info_key == 'Alternative Name') {
            var alt_names = [];
            for (var i = 0; i < info_value.length; i++) {
              var value = info_value[i].trim().split(';');
              if (value.length > 0) {
                for (var j = 0; j < value.length; j++) {
                  var alt_name = value[j].trim();
                  if (alt_name != '') {
                    alt_names.push(alt_name);
                  }
                }
              }
            }
            if (alt_names.length) manga_info.alt_names = alt_names;
          } else if (info_key == 'Author(s)') {
            manga_info.authors = info_value;
          } else if (info_key == 'Artist(s)') {
            manga_info.artists = info_value;
          } else if (info_key == 'Genre(s)') {
            manga_info.genres = info_value;
          } else if (info_key == 'Status(s)') {
            manga_info.status = info_value.join('');
          } else if (info_key == 'Rank') {
            manga_info.rank_str = info_value.join('');
          } else if (info_key == 'Type') {
            manga_info.type = info_value.join('');
          } else if (info_key == 'Summary') {
            manga_info.description = info_value.join('');
          }
          else {
            manga_info[info_key] = info_value;
          }
        }
      });

      var manga_chapters = [];
      $('.chapter_content ul.chapter_list li').each(function() {
        manga_chapters.push({
          url: $(this).children('a').eq(0).attr('href'),
          title: $(this).children('a').eq(0).text().trim(),
          published_date_str: $(this).children('span.time').text().trim()
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
