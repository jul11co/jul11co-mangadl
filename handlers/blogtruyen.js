var path = require('path');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'Blogtruyen',
  website: 'http://blogtruyen.com',

  match: function(link, options) {
    return /blogtruyen\.com/g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {
    
    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'Blogtruyen');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('.al-c.linkchapter').length) {

      var chapter_title = $('header h1').eq(0).text();

      var chapter_images = saver.getImages($, page, 'article#content');
      if (options.verbose) console.log(chapter_images);

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: page.output_dir
      }, options, callback);

    } else if ($('#list-chapters').length) {
      var manga_title = page.title.replace('| BlogTruyen.Com', '').trim();
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
      var manga_info = getMangaInfo($, page, options);
      if (manga_info && manga_info.url) {
        saver.saveJsonSync(path.join(options.output_dir, 'manga.json'), manga_info);
      }

      $('#list-chapters .download').remove();
      var chapter_links = saver.getLinks($, page, '#list-chapters', { 
        /*filters: ['/truyen/']*/ 
      });

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  }
}

var getMangaInfo = function($, page, options) {
  var manga_info = {};
  if ($('#list-chapters').length) {
    manga_info = {};
    manga_info.url = page.url;
    // manga_info.name = $('.story-detail .entry-title').text().trim();
    $('#breadcrumbs a').remove();
    manga_info.name = $('#breadcrumbs').children('span').eq(1).text().trim();
    manga_info.name = utils.replaceAll(manga_info.name, '>', '').trim();
    if (manga_info.name == '') {
      manga_info.name = $('.story-detail .entry-title').text().trim();
    }
    manga_info.cover_image = $('.manga-detail .thumbnail img').attr('src');
    manga_info.description = $('.manga-detail .detail .content').text().trim();
    
    $('.like-buttons').remove();
    var info_arrays = [];
    $('.manga-detail .description p').each(function() {
      var info_str = $(this).text().trim();
      var info_arr = info_str.split('\r\n\r\n');
      for (var i = 0; i < info_arr.length; i++) {
        if (info_arr[i] != '') {
          info_arrays.push(info_arr[i]);
        }
      }
    });

    info_arrays.forEach(function(info_str) {
      var info_kv = info_str.split(':');
      var info_key = '';
      var info_value = [];
      if (info_kv.length > 0) {
        info_key = info_kv[0].trim();
        info_key = info_key.replace(':','');
      }
      if (info_kv.length > 1) {
        var info_value_arr = info_kv[1].split('\r\n');
        for (var i = 0; i < info_value_arr.length; i++) {
          var value = info_value_arr[i].trim();
          if (info_key == 'Tác giả' || info_key == 'Tên khác') {
            var value_arr = [];
            if (value.indexOf(';') > 0) {
              value_arr = value.split(';');
            } else {
              value_arr = value.split(',');
            }
            for (var j = 0; j < value_arr.length; j++) {
              var value_item = value_arr[j].trim();
              if (value_item != '') {
                info_value.push(value_item);
              }
            }
          } else {
            if (value != '') {
              info_value.push(value);
            }
          }
        }
      }
      if (info_key == '' || info_key == 'Số lượt xem' || info_key == 'Yêu thích') {
        return;
      }
      if (info_key == 'Tên khác') {
        manga_info.alt_names = info_value;
      } else if (info_key == 'Tác giả') {
        manga_info.authors = info_value;
      } else if (info_key == 'Thể loại') {
        manga_info.genres = info_value;
      } else if (info_key == 'Trạng thái') {
        manga_info.status = info_value.join('');
      } else {
        manga_info[info_key] = info_value;
      }
    });

    var manga_chapters = [];
    $('#list-chapters p').each(function() {
      manga_chapters.push({
        url: $(this).children('span.title').children('a').attr('href'),
        title: $(this).children('span.title').children('a').text().trim(),
        published_date_str: $(this).children('span.publishedDate').text()
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