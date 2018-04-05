var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

var lastChar = function(str) {
  if (!str) return '';
  if (str.length == 1) return str;
  return str.substring(str.length-1);
}

var removeLastChar = function(str) {
  return str.substring(0, str.length-1);
}

var removeLastChars = function(str, char_to_remove) {
  while (lastChar(str) == char_to_remove) {
    str = removeLastChar(str);
  }
  return str;
}

var fromBase64 = function(str) {
  if (!str) return '';
  return Buffer.from(str, 'base64').toString('ascii');
}

module.exports = {
  
  name: 'Bamtoki',
  website: 'https://webtoon.bamtoki.com',

  match: function(link, options) {
    return /webtoon\.bamtoki\.com\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'Bamtoki');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if ($('.view-wrap').length && $('.view-wrap .contents').length) {

      console.log('Chapter page:', page.url);

      var chapter_title = $('.view-wrap h1').first().text().trim();
      chapter_title = utils.replaceAll(chapter_title, '/', '-');
      chapter_title = utils.replaceAll(chapter_title, ':', ' -');
      // chapter_title = utils.replaceAll(chapter_title, '.', '_');
      chapter_title = removeLastChars(chapter_title, '.');
      console.log('Chapter title:', chapter_title);

      // Get images on current page
      var chapter_images = [];
      if ($('#tooncontentdata').length) {
        $(".contents #tooncontent").html(fromBase64($("#tooncontentdata").html().trim()));
        $('.contents #tooncontent img').each(function() {
          var image_src = $(this).attr('src');
          if (image_src) {
            chapter_images.push({
              src: image_src,
              file: path.basename(image_src)
            });
          }
        });
      } else {
        $('.contents img.img-tag').each(function() {
          var image_src = $(this).attr('src');
          if (image_src) {
            chapter_images.push({
              src: image_src,
              file: path.basename(image_src)
            });
          }
        });
      }
      
      if (options.debug) console.log(chapter_images);
      if (chapter_images.length == 0) return callback();

      var chapter_output_dir = path.join(options.output_dir, chapter_title);
      
      // console.log('Output dir: ', options.output_dir);
      // console.log('Page output_dir:', page.output_dir);
      // console.log('Chapter output_dir:', chapter_output_dir);

      options.request_headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:59.0) Gecko/20100101 Firefox/59.0"
      };

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: chapter_output_dir
      }, options, callback);

    } else if ($('.title-section').length && $('.board-list').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('.title-section .toon-desc h1').first().text();
      manga_title = utils.replaceAll(manga_title, ':', ' -');
      // manga_title = utils.replaceAll(manga_title, '.', '_');
      manga_title = removeLastChars(manga_title, '.');
      console.log('Manga title: ' + manga_title);
      // console.log('Chapter list');

      if (options.auto_manga_dir) {
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);

      var chapter_links = saver.getLinks($, page, '.item-list.board-list li', {
        filters: [
          'https://webtoon.bamtoki.com/'
        ]
      });

      chapter_links = chapter_links.map(function(chapter_link) {
        return encodeURI(decodeURI(chapter_link));
      });

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  }
}