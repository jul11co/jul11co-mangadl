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
      // console.log('Chapter page: ' + chapter_url);

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
        // Init data holder for chapter pages in options (passed through all callback)
        options.chapter_pages = {};
      }

      for (var i = 0; i < links.length; i++) {
        var chapter_page_link = links[i];
        if (typeof options.chapter_pages[chapter_page_link] == 'undefined') {
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
      var images = saver.getImages($, page, '#viewer', { blacklist: [ '.gif' ]});
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

        // Reset chapter_pages
        options.chapter_pages = {};

        // http://www.mangahere.co/manga/<MANGANAME>/[<VOLUME>/]<CHAPTER>
        var chapter_path = chapter_url.replace('http://www.mangahere.cc/manga/','');
        // <MANGANAME>/[<VOLUME>/]<CHAPTER>
        chapter_path = chapter_path.substring(chapter_path.indexOf('/')); // skip MANGANAME
        // [<VOLUME>/]<CHAPTER>
        var output_dir = path.join((options.output_dir || '.'), chapter_path);

        if (options.debug) {
        console.log('Options output dir : ' + options.output_dir);
        console.log('Page output dir    : ' + page.output_dir);
        console.log('Output dir         : ' + output_dir);
        }

        var chapter_title = $('.readpage_top .title h1').text().trim();

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
    } else if ($('.manga_detail').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = page.title.split(' - Read ')[0].trim();
      console.log('Manga title: ' + manga_title);
      console.log('Chapter list');

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

      var chapter_links = saver.getLinks($, page, '.detail_list', { 
        filters: ['http://www.mangahere.cc/manga/'] 
      });

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  },

  getMangaInfo: function($, page, options) {
    var manga_info = {};
    if ($('.manga_detail').length) {
      manga_info.url = page.url;
      manga_info.name = $('.detail_topText li h2').text().trim();
      if (!manga_info.name || manga_info.name == '') {
        manga_info.name = $('article .title').eq(0).text().trim();
      }
      manga_info.cover_image = $('.manga_detail_top img.img').attr('src');

      $('li#rate').remove();
      $('li.posR').remove();
      $('.detail_topText li p#show a').remove();

      $('.detail_topText li').each(function() {
        var info_key = $(this).children('label').eq(0).text().trim();
        $(this).children('label').eq(0).remove();
        info_key = info_key.replace(':','');

        var info_value = [];
        if (info_key == 'Alternative Name') {
          info_value = $(this).text().split(';');
        } else if (info_key == 'Genre(s)') {
          info_value = $(this).text().split(',');
        } else if (info_key == 'Author(s)') {
          $(this).children().each(function() {
            var value = $(this).text().trim();
            value = utils.replaceAll(value,'\n','');
            if (value != '') {
              info_value.push(value);
            }
          });
        } else if (info_key == 'Status') {
          info_value.push($(this).text().trim());
        } else if (info_key == 'Rank') {
          info_value.push($(this).text().trim());
        } else if ($(this).children('p').length) {
          info_key = 'Description';
          info_value.push($(this).children('p').eq(1).text().trim());
        }

        if (info_key == 'Alternative Name') {
          var alt_names = [];
          for (var i = 0; i < info_value.length; i++) {
            var value = utils.replaceAll(info_value[i],'\t','').trim().split(';');
            if (value.length > 0) {
              for (var j = 0; j < value.length; j++) {
                var alt_name = value[j].trim();
                if (alt_name != '' && alt_name != 'None') {
                  alt_names.push(alt_name);
                }
              }
            }
          }
          if (alt_names.length) manga_info.alt_names = alt_names;
        } else if (info_key == 'Author(s)') {
          manga_info.authors = info_value;
        } else if (info_key == 'Genre(s)') {
          manga_info.genres = info_value;
        } else if (info_key == 'Status') {
          manga_info.status = info_value.join('');
        } else if (info_key == 'Description') {
          manga_info.description = info_value.join('');
        } else {
          manga_info[info_key] = info_value;
        }
      });
      
      $('ul.tab_comment').remove();

      var manga_chapters = [];
      $('.detail_list ul li').each(function() {
        var chapter_url = $(this).children('span.left').children('a').attr('href');
        if (!chapter_url || chapter_url == '') return;
        
        manga_chapters.push({
          url: chapter_url,
          title: $(this).children('span.left').text().trim(),
          published_date_str: $(this).children('span.right').text().trim()
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
