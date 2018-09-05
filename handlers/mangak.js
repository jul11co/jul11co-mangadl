var path = require('path');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'MangaK',
  website: 'http://mangak.info',

  match: function(link, options) {
    return /mangak\./g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'MangaK');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('.vung_doc').length) {

      var chapter_title = $('.name_chapter').text();

      var chapter_images = saver.getImages($, page, '.vung_doc');
      if (options.verbose) console.log(chapter_images);

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: page.output_dir
      }, options, callback);

    } else if ($('.chapter-list').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('h1.entry-title').text().trim();
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

      var chapter_links = saver.getLinks($, page, '.chapter-list', {
        exclude_visited_links: true
      });

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  },

  getMangaInfo: function($, page, options) {
    var manga_info = {};
    if ($('.chapter-list').length) {
      manga_info.url = page.url;
      manga_info.name = $('.truyen_info .entry-title').text();
      manga_info.cover_image = $('.truyen_info .info_image img').attr('src');
      manga_info.description = $('.truyen_description .entry-content').text();

      $('ul.truyen_info_right li').each(function() {
        if ($(this).children('span').length) {
          var info_key = $(this).children('span').text().trim();
          var info_value = [];
          $(this).children().each(function() {
            var value = $(this).text().trim();
            if (value != info_key) {
              value = utils.replaceAll(value,'\n','');
              if (value != '') {
                info_value.push(value);
              }
            }
          });
          if (info_value.length == 0) return;
          
          info_key = info_key.replace(' :','').replace(':','');
          
          if (info_key == 'Tên khác') {
            manga_info.alt_names = info_value;
          } else if (info_key == 'Tác Giả') {
            manga_info.authors = info_value;
          } else if (info_key == 'Thể Loại') {
            manga_info.genres = info_value;
          } else if (info_key == 'Trạng Thái') {
            manga_info.status = info_value.join('');
          } else {
            manga_info[info_key] = info_value;
          }
        }
      });

      var manga_chapters = [];
      $('.chapter-list .row').each(function() {
        manga_chapters.push({
          url: $(this).children('span').eq(0).children('a').attr('href'),
          title: $(this).children('span').eq(0).text(),
          published_date_str: $(this).children('span').eq(1).text()
        });
      });

      manga_info.chapter_count = manga_chapters.length;
      
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
