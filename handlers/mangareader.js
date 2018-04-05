var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'MangaReader',
  website: 'http://www.mangareader.net',

  match: function(link, options) {
    return /www\.mangareader\.net\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'MangaReader');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('#topchapter').length) {

      var links = [];
      $('#selectpage #pageMenu').first().children().each(function() {
        var title = $(this).text();
        // links.push('http://www.mangareader.net' + $(this).attr('value'));
        links.push('https://www.mangareader.net' + $(this).attr('value'));
      });
      if (options.debug) console.log('Chapter pages: ' + links.length);
      if (options.debug) console.log(links);

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
        console.log('Wrong state! This page not included in chapter links: ' + page.url);
        return callback();
      }

      // Get images on current page
      var images = saver.getImages($, page, '#imgholder');
      if (options.debug) console.log(images);

      saver.updateStateData(page.url, {
        images: images
      });

      // Save to options
      options.chapter_pages[page.url].images = options.chapter_pages[page.url].images.concat(images);

      // Check if all chapter pages are visited
      var all_chapter_pages_visited = true;
      for (var chapter_page_link in options.chapter_pages) {
        if (options.chapter_pages[chapter_page_link].visited == false) {
          all_chapter_pages_visited = false;
          break;
        }
      }

      if (all_chapter_pages_visited) {
        var chapter_images = [];
        for (var chapter_page_link in options.chapter_pages) {
          // var chapter_page = options.chapter_pages[chapter_page_link];
          var chapter_page = saver.getStateData(chapter_page_link);
          chapter_images = chapter_images.concat(chapter_page.images);
        }
        if (options.debug) console.log(chapter_images);

        // Reset chapter pages
        options.chapter_pages = {};

        var link_obj = urlutil.parse(page.url);
        // http://www.mangareader.net/abandon-the-old-in-tokyo/1/30
        // --> /abandon-the-old-in-tokyo/1/30
        // --> /abandon-the-old-in-tokyo/1
        // var chapter_url = path.dirname(link_obj.pathname);
        var chapter_url = 'https://www.mangareader.net' + path.dirname(link_obj.pathname);

        var output_dir_name = path.basename(path.dirname(link_obj.pathname));
        var output_dir = path.join((options.output_dir || '.'), output_dir_name);
        
        if (options.verbose) {
        console.log('Options output dir : ' + options.output_dir);
        console.log('Page output dir    : ' + page.output_dir);
        console.log('Output dir         : ' + output_dir);
        }

        var chapter_title = $('#topchapter #mangainfo h1').first().text().trim();
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
        for (var chapter_page_link in options.chapter_pages) {
          if (options.chapter_pages[chapter_page_link].visited == false) {
            next_page = chapter_page_link;
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
    } else if ($('#chapterlist').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      // var manga_title = page.title.split('-')[0].trim();
      var manga_title = $('#mangaproperties h2.aname').text().trim();
      if (!manga_title) {
        manga_title = page.title.split('-')[0].trim();
      }
      console.log('Manga title: ' + manga_title);
      console.log('Chapter list');

      if (options.auto_manga_dir) {
        // var manga_output_dir = page.url.replace('http://www.mangareader.net/','');
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);
      if (options.save_index_html) {
        saver.saveHtmlSync(path.join(options.output_dir, 'index.html'), $.html());
      }
      var manga_info = getMangaInfo($, page, options);
      if (manga_info && manga_info.url) {
        saver.saveJsonSync(path.join(options.output_dir, 'manga.json'), manga_info);
      }

      var chapter_links = saver.getLinks($, page, '#chapterlist');
      chapter_links = chapter_links.map(function(chapter_link) {
        if (chapter_link.indexOf('/') == 0) {
          // return 'http://www.mangareader.net' + chapter_link;
          return 'https://www.mangareader.net' + chapter_link;
        }
        return chapter_link;
      });

      chapter_links = chapter_links.filter(function(link) {
        return !saver.isDone(link) && !saver.isDone(link.replace('https://', 'http://'))
           && !saver.isDone(link.replace('https://www.mangareader.net', ''));
      });

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  }
}

var getMangaInfo = function($, page, options) {
  var manga_info = {};
  if ($('#chapterlist').length) {
    manga_info.url = page.url;
    manga_info.name = $('#mangaproperties h2.aname').text().trim();
    manga_info.cover_image = $('#mangaimg img').attr('src');
    manga_info.description = $('#readmangasum p').text();

    $('#mangaproperties table tr').each(function() {
      var info_key = $(this).children('td.propertytitle').text().trim();
      var info_value = [];
      if ($(this).children('td').eq(1).children().length) {
        $(this).children('td').eq(1).children().each(function() {
          var value = $(this).text().trim();
          if (value != info_key) {
            value = utils.replaceAll(value,'\n','');
            if (value != '') {
              info_value.push(value);
            }
          }
        });
      } else {
        var value = $(this).children('td').eq(1).text().trim();
        if (value != '') {
          info_value.push(value);
        }
      }
      info_key = info_key.replace(':','');
      if (info_key == '' || info_key == 'Tweet it:' || info_key == 'Like it:' || info_key == 'Name' 
        || info_value.length == 0) {
        return;
      }

      if (info_key == 'Alternate Name') {
        manga_info.alt_names = info_value.join(' ').split(', ');
      } else if (info_key == 'Author') {
        manga_info.authors = info_value.join(' ').split(', ');
      } else if (info_key == 'Artist') {
        manga_info.artists = info_value.join(' ').split(', ');
      } else if (info_key == 'Genre') {
        manga_info.genres = info_value;
      } else if (info_key == 'Status') {
        manga_info.status = info_value.join('');
      } else {
        manga_info[info_key] = info_value;
      }
    });

    $('#chapterlist table tr.table_head').remove();

    var manga_chapters = [];
    $('#chapterlist table tr').each(function() {
      var chapter_title = $(this).children('td').eq(0).text().trim();
      chapter_title = utils.replaceAll(chapter_title,'\n','').trim();
      manga_chapters.push({
        url: $(this).children('td').eq(0).children('a').attr('href'),
        title: chapter_title,
        published_date_str: $(this).children('td').eq(1).text()
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